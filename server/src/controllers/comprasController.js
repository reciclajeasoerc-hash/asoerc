const { sequelize, Compra, CompraItem, Reciclador, Material, Bodega, PrestamoReciclador, Caja, MovimientoCaja, MaterialPrecioReciclador } = require('../models');
const { Op } = require('sequelize');
const whatsappService = require('../services/whatsappService');
const { hoy } = require('../utils/fecha');
const { recalcularCaja, obtenerCajaDia, sumarEnCaja } = require('../utils/caja');

const include = [
    { model: Reciclador, as: 'reciclador' },
    { model: Bodega, as: 'bodega' },
    { model: CompraItem, as: 'items', include: [{ model: Material, as: 'material' }] }
];

exports.listar = async (req, res) => {
    try {
        const { fecha, bodega_id, reciclador_id, estado, page = 1 } = req.query;
        const where = {};
        if (fecha) where.fecha = fecha;
        if (bodega_id) where.bodega_id = bodega_id;
        if (reciclador_id) where.reciclador_id = reciclador_id;
        if (estado) where.estado = estado;
        const limit = 50, offset = (page - 1) * limit;
        const { rows, count } = await Compra.findAndCountAll({
            where, include, order: [['createdAt', 'DESC']], limit, offset
        });
        res.json({ ok: true, items: rows, total: count });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.obtener = async (req, res) => {
    try {
        const compra = await Compra.findByPk(req.params.id, { include });
        if (!compra) return res.status(404).json({ ok: false, msg: 'Compra no encontrada' });
        res.json({ ok: true, compra });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.crear = async (req, res) => {
    try {
        const { reciclador_id, bodega_id, fecha, observaciones } = req.body;
        if (!reciclador_id || !bodega_id) return res.status(400).json({ ok: false, msg: 'Reciclador y bodega requeridos' });
        const compra = await Compra.create({
            reciclador_id, bodega_id,
            fecha: fecha || hoy(),
            observaciones, estado: 'borrador'
        });
        const full = await Compra.findByPk(compra.id, { include });
        res.json({ ok: true, compra: full });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.agregarItem = async (req, res) => {
    try {
        const { material_id, kilos } = req.body;
        const compra = await Compra.findByPk(req.params.id);
        if (!compra) return res.status(404).json({ ok: false, msg: 'Compra no encontrada' });
        if (compra.estado === 'finalizada') return res.status(400).json({ ok: false, msg: 'Compra ya finalizada' });
        const material = await Material.findByPk(material_id);
        if (!material) return res.status(404).json({ ok: false, msg: 'Material no encontrado' });
        const precioEsp = await MaterialPrecioReciclador.findOne({ where: { reciclador_id: compra.reciclador_id, material_id } });
        const precio_unitario = precioEsp ? parseFloat(precioEsp.precio) : parseFloat(material.precio_compra);
        const total = parseFloat(kilos) * precio_unitario;

        // Acumular kilos de forma SEGURA ante concurrencia (transacción con bloqueo de fila).
        await sequelize.transaction(async (t) => {
            const existente = await CompraItem.findOne({ where: { compra_id: compra.id, material_id }, lock: t.LOCK.UPDATE, transaction: t });
            if (existente) {
                const nuevosKilos = parseFloat(existente.kilos) + parseFloat(kilos);
                await existente.update({ kilos: nuevosKilos, total: nuevosKilos * precio_unitario }, { transaction: t });
            } else {
                await CompraItem.create({ compra_id: compra.id, material_id, kilos, precio_unitario, total }, { transaction: t });
            }
        });
        await recalcularTotal(compra.id);
        const full = await Compra.findByPk(compra.id, { include });
        res.json({ ok: true, compra: full });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.quitarItem = async (req, res) => {
    try {
        await CompraItem.destroy({ where: { id: req.params.item_id, compra_id: req.params.id } });
        await recalcularTotal(req.params.id);
        const full = await Compra.findByPk(req.params.id, { include });
        res.json({ ok: true, compra: full });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.finalizar = async (req, res, _intento = 0) => {
    // La caja del día se obtiene ANTES de abrir la transacción, para no retener dos conexiones
    // a la vez (evita agotar el pool y trabar bajo mucha concurrencia).
    const pre = await Compra.findByPk(req.params.id, { attributes: ['bodega_id', 'fecha', 'estado'] });
    if (!pre) return res.status(404).json({ ok: false, msg: 'Compra no encontrada' });
    if (pre.estado === 'finalizada') return res.status(400).json({ ok: false, msg: 'Ya finalizada' });
    const caja = await obtenerCajaDia(pre.bodega_id, pre.fecha);

    // TODO en una TRANSACCIÓN: préstamos, saldo del reciclador y caja se actualizan
    // juntos o no se actualiza nada. Así nunca queda la plata a medias si algo falla.
    const t = await sequelize.transaction();
    try {
        // Bloqueo de fila: dos finalizaciones simultáneas de la MISMA compra se serializan
        // → la segunda ve 'finalizada' y no vuelve a registrar el egreso (evita pagar doble).
        const compra = await Compra.findByPk(req.params.id, { include, lock: t.LOCK.UPDATE, transaction: t });
        if (!compra) { await t.rollback(); return res.status(404).json({ ok: false, msg: 'Compra no encontrada' }); }
        if (compra.estado === 'finalizada') { await t.rollback(); return res.status(400).json({ ok: false, msg: 'Ya finalizada' }); }

        // Descontar préstamos pendientes del reciclador.
        // IMPORTANTE: se descuenta solo el SALDO restante (monto − abonado), respetando los
        // abonos ya registrados, y como máximo hasta lo que vale la compra (no se puede
        // descontar más de lo que se le va a pagar). Los más viejos se pagan primero.
        const prestamos = await PrestamoReciclador.findAll({
            where: { reciclador_id: compra.reciclador_id, pagado: false },
            order: [['fecha', 'ASC'], ['id', 'ASC']],
            transaction: t
        });
        let descuento = 0;
        let disponible = parseFloat(compra.total); // tope: solo se descuenta hasta el total de la compra
        for (const p of prestamos) {
            const restante = parseFloat(p.monto) - parseFloat(p.abonado || 0);
            if (restante <= 0) { await p.update({ pagado: true, compra_id: compra.id }, { transaction: t }); continue; }
            if (disponible <= 0) break; // no queda plata en esta compra para seguir descontando
            const aDescontar = Math.min(restante, disponible);
            const nuevoAbonado = parseFloat(p.abonado || 0) + aDescontar;
            const quedaPagado = nuevoAbonado >= parseFloat(p.monto) - 0.001;
            await p.update({ abonado: nuevoAbonado, pagado: quedaPagado, compra_id: compra.id }, { transaction: t });
            descuento += aDescontar;
            disponible -= aDescontar;
        }
        const neto = Math.max(0, parseFloat(compra.total) - descuento);
        const numeroDiario = await Compra.count({ where: { fecha: compra.fecha, bodega_id: compra.bodega_id, estado: 'finalizada' }, transaction: t }) + 1;
        await compra.update({ estado: 'finalizada', descuento_prestamo: descuento, neto, numero_diario: numeroDiario }, { transaction: t });

        // Actualizar saldo_prestamo del reciclador
        if (descuento > 0) {
            await Reciclador.decrement('saldo_prestamo', { by: descuento, where: { id: compra.reciclador_id }, transaction: t });
        }

        // Registrar egreso en caja: solo se CREA el movimiento (un INSERT nunca choca ni se pierde).
        // El total de la caja se suma atómicamente DESPUÉS del commit.
        let hayEgreso = false;
        if (neto > 0) {
            const hora = new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour12: false });
            await MovimientoCaja.create({ caja_id: caja.id, tipo: 'egreso', concepto: `Compra #${compra.numero || compra.id} - ${compra.reciclador?.nombre}`, monto: neto, hora, referencia: `compra:${compra.id}` }, { transaction: t });
            hayEgreso = true;
        }

        await t.commit(); // ← a partir de aquí ya está todo guardado en firme
        // Sumar el egreso a la caja de forma atómica y O(1), fuera de la transacción (rápido, sin trabar)
        if (hayEgreso) await sumarEnCaja(caja.id, 'egreso', neto);

        // Enviar por WhatsApp (FUERA de la transacción: es un envío externo, no debe
        // revertir la compra si WhatsApp falla).
        try {
            const enviado = await whatsappService.enviarCompra(compra);
            if (enviado) await compra.update({ whatsapp_enviado: true });
        } catch (_) { /* si WhatsApp falla, la compra igual quedó bien guardada */ }

        const full = await Compra.findByPk(compra.id, { include });
        res.json({ ok: true, compra: full });
    } catch (err) {
        await t.rollback();
        // Bajo mucha concurrencia MySQL puede dar deadlock (1213) o lock timeout (1205):
        // se reintenta la finalización unas veces antes de rendirse.
        const errno = err.original?.errno || err.parent?.errno;
        if ((errno === 1213 || errno === 1205) && _intento < 4) {
            await new Promise(r => setTimeout(r, 120 * (_intento + 1)));
            return exports.finalizar(req, res, _intento + 1);
        }
        res.status(500).json({ ok: false, msg: err.message });
    }
};

exports.eliminar = async (req, res) => {
    try {
        const compra = await Compra.findByPk(req.params.id);
        if (!compra) return res.status(404).json({ ok: false, msg: 'Compra no encontrada' });
        if (compra.estado === 'finalizada') return res.status(400).json({ ok: false, msg: 'No se puede eliminar una compra finalizada' });
        await CompraItem.destroy({ where: { compra_id: compra.id } });
        await compra.destroy();
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.resumenDia = async (req, res) => {
    try {
        const { fecha, bodega_id } = req.query;
        const fechaConsulta = fecha || hoy();
        const where = { fecha: fechaConsulta, estado: 'finalizada' };
        if (bodega_id) where.bodega_id = bodega_id;
        const compras = await Compra.findAll({ where, include });
        const totalKilos = compras.reduce((s, c) => s + c.items.reduce((a, i) => a + parseFloat(i.kilos), 0), 0);
        const totalPesos = compras.reduce((s, c) => s + parseFloat(c.total), 0);
        const totalNeto  = compras.reduce((s, c) => s + parseFloat(c.neto), 0);

        // Agrupar por material
        const porMaterial = {};
        for (const c of compras) {
            for (const item of c.items) {
                const nombre = item.material.nombre;
                if (!porMaterial[nombre]) porMaterial[nombre] = { kilos: 0, total: 0 };
                porMaterial[nombre].kilos += parseFloat(item.kilos);
                porMaterial[nombre].total += parseFloat(item.total);
            }
        }
        res.json({ ok: true, fecha: hoy, totalCompras: compras.length, totalKilos, totalPesos, totalNeto, porMaterial });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

async function recalcularTotal(compra_id) {
    const items = await CompraItem.findAll({ where: { compra_id } });
    const total = items.reduce((s, i) => s + parseFloat(i.total), 0);
    await Compra.update({ total, neto: total }, { where: { id: compra_id } });
}
