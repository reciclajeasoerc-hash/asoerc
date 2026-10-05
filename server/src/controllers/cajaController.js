const { Caja, MovimientoCaja, Bodega } = require('../models');
const { obtenerCajaDia } = require('../utils/caja');

const INCLUDE = [{ model: MovimientoCaja, as: 'movimientos' }, { model: Bodega, as: 'bodega' }];

// Caja de HOY: la crea si no existe (mismo camino que compras/ventas/bot, para que la base
// sugerida se calcule igual venga de donde venga).
exports.obtenerOAbrir = async (req, res) => {
    try {
        const { bodega_id } = req.query;
        if (!bodega_id) return res.status(400).json({ ok: false, msg: 'bodega_id requerido' });
        const fecha = require("../utils/fecha").hoy();
        const base = await obtenerCajaDia(bodega_id, fecha);
        const caja = await Caja.findByPk(base.id, { include: INCLUDE });
        res.json({ ok: true, caja });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

// Caja de un día CUALQUIERA, solo lectura: no crea nada. caja = null si ese día no hubo caja.
exports.porDia = async (req, res) => {
    try {
        // Un usuario que no es superadmin y no tiene bodega asignada no puede elegir cuál ver
        // (bodegaFilter solo fuerza la bodega cuando el usuario tiene una).
        if (req.user?.rol !== 'superadmin' && !req.user?.bodega_id) return res.status(403).json({ ok: false, msg: 'Tu usuario no tiene bodega asignada' });
        const { bodega_id, fecha } = req.query;
        if (!bodega_id || !/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) return res.status(400).json({ ok: false, msg: 'bodega_id y fecha (AAAA-MM-DD) requeridos' });
        const caja = await Caja.findOne({ where: { bodega_id, fecha }, include: INCLUDE });
        res.json({ ok: true, caja });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.agregarMovimiento = async (req, res) => {
    try {
        const { tipo, concepto, monto, referencia } = req.body;
        if (!tipo || !concepto || !monto) return res.status(400).json({ ok: false, msg: 'Tipo, concepto y monto requeridos' });
        const caja = await Caja.findByPk(req.params.id);
        if (!caja) return res.status(404).json({ ok: false, msg: 'Caja no encontrada' });
        if (caja.estado === 'cerrada') return res.status(400).json({ ok: false, msg: 'Caja cerrada' });
        const hora = new Date().toTimeString().slice(0, 8);
        await MovimientoCaja.create({ caja_id: caja.id, tipo, concepto, monto, referencia, hora });
        await recalcularCaja(caja.id);
        const full = await Caja.findByPk(caja.id, { include: [{ model: MovimientoCaja, as: 'movimientos' }, { model: Bodega, as: 'bodega' }] });
        res.json({ ok: true, caja: full });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

// Fija la BASE del día (saldo_inicial) de una caja abierta: el efectivo con el que
// arranca la bodega ese día. Cada administradora la registra según lo que se le entrega,
// en vez de arrastrar automáticamente el saldo del día anterior.
exports.actualizarBase = async (req, res) => {
    try {
        const caja = await Caja.findByPk(req.params.id);
        if (!caja) return res.status(404).json({ ok: false, msg: 'Caja no encontrada' });
        if (caja.estado === 'cerrada') return res.status(400).json({ ok: false, msg: 'La caja está cerrada' });
        // La base se registra UNA vez al abrir el día. Después de confirmada, solo el
        // superadmin la corrige (las encargadas no pueden irla ajustando para cuadrar).
        if (caja.base_confirmada && req.user?.rol !== 'superadmin')
            return res.status(403).json({ ok: false, msg: 'La base del día ya se registró. Solo el superadministrador puede corregirla.' });
        const base = parseFloat(req.body.saldo_inicial);
        if (isNaN(base) || base < 0) return res.status(400).json({ ok: false, msg: 'Base inválida' });
        // UPDATE condicional: si dos personas la registran a la vez, solo la primera entra.
        const condicion = req.user?.rol === 'superadmin' ? { id: caja.id, estado: 'abierta' } : { id: caja.id, estado: 'abierta', base_confirmada: false };
        const [cambiadas] = await Caja.update({ saldo_inicial: base, base_confirmada: true }, { where: condicion });
        if (!cambiadas) return res.status(409).json({ ok: false, msg: 'La base del día ya se registró. Solo el superadministrador puede corregirla.' });
        await recalcularCaja(caja.id);
        const full = await Caja.findByPk(caja.id, { include: [{ model: MovimientoCaja, as: 'movimientos' }, { model: Bodega, as: 'bodega' }] });
        res.json({ ok: true, caja: full });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.cerrar = async (req, res) => {
    try {
        const caja = await Caja.findByPk(req.params.id);
        if (!caja) return res.status(404).json({ ok: false, msg: 'No encontrada' });
        if (caja.estado === 'cerrada') return res.status(400).json({ ok: false, msg: 'Ya está cerrada' });
        await recalcularCaja(caja.id);
        await caja.update({ estado: 'cerrada', observaciones: req.body.observaciones });
        const full = await Caja.findByPk(caja.id, { include: [{ model: MovimientoCaja, as: 'movimientos' }, { model: Bodega, as: 'bodega' }] });
        res.json({ ok: true, caja: full });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.reabrir = async (req, res) => {
    try {
        const caja = await Caja.findByPk(req.params.id);
        if (!caja) return res.status(404).json({ ok: false, msg: 'No encontrada' });
        if (caja.estado !== 'cerrada') return res.status(400).json({ ok: false, msg: 'La caja no está cerrada' });
        await caja.update({ estado: 'abierta' });
        const full = await Caja.findByPk(caja.id, { include: [{ model: MovimientoCaja, as: 'movimientos' }, { model: Bodega, as: 'bodega' }] });
        res.json({ ok: true, caja: full });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.historial = async (req, res) => {
    try {
        const { bodega_id, desde, hasta } = req.query;
        const where = {};
        if (bodega_id) where.bodega_id = bodega_id;
        if (desde && hasta) where.fecha = { [require('sequelize').Op.between]: [desde, hasta] };
        const cajas = await Caja.findAll({ where, include: [{ model: Bodega, as: 'bodega' }], order: [['fecha', 'DESC']], limit: 60 });
        res.json({ ok: true, cajas });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

async function recalcularCaja(caja_id) {
    const caja = await Caja.findByPk(caja_id, { include: [{ model: MovimientoCaja, as: 'movimientos' }] });
    const ingresos = caja.movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + parseFloat(m.monto), 0);
    const egresos  = caja.movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + parseFloat(m.monto), 0);
    const saldo_final = parseFloat(caja.saldo_inicial) + ingresos - egresos;
    await caja.update({ total_ingresos: ingresos, total_egresos: egresos, saldo_final });
}
