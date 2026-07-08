const { Caja, MovimientoCaja, Bodega } = require('../models');

exports.obtenerOAbrir = async (req, res) => {
    try {
        const { bodega_id } = req.query;
        const fecha = new Date().toISOString().slice(0, 10);
        let caja = await Caja.findOne({ where: { bodega_id, fecha }, include: [{ model: MovimientoCaja, as: 'movimientos' }, { model: Bodega, as: 'bodega' }] });
        if (!caja) {
            // Tomar saldo final del día anterior como saldo inicial
            const anterior = await Caja.findOne({ where: { bodega_id, estado: 'cerrada' }, order: [['fecha', 'DESC']] });
            const saldo_inicial = anterior ? parseFloat(anterior.saldo_final) : 0;
            caja = await Caja.create({ bodega_id, fecha, saldo_inicial, estado: 'abierta' });
            caja = await Caja.findByPk(caja.id, { include: [{ model: MovimientoCaja, as: 'movimientos' }, { model: Bodega, as: 'bodega' }] });
        }
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
        const base = parseFloat(req.body.saldo_inicial);
        if (isNaN(base) || base < 0) return res.status(400).json({ ok: false, msg: 'Base inválida' });
        await caja.update({ saldo_inicial: base });
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
