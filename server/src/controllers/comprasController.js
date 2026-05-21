const { Compra, CompraItem, Reciclador, Material, Bodega, PrestamoReciclador, Caja, MovimientoCaja, MaterialPrecioReciclador } = require('../models');
const { Op } = require('sequelize');
const whatsappService = require('../services/whatsappService');

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
            fecha: fecha || new Date().toISOString().slice(0, 10),
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

        // Si ya existe ese material en la compra, actualizar
        const existente = await CompraItem.findOne({ where: { compra_id: compra.id, material_id } });
        if (existente) {
            const nuevosKilos = parseFloat(existente.kilos) + parseFloat(kilos);
            await existente.update({ kilos: nuevosKilos, total: nuevosKilos * precio_unitario });
        } else {
            await CompraItem.create({ compra_id: compra.id, material_id, kilos, precio_unitario, total });
        }
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

exports.finalizar = async (req, res) => {
    try {
        const compra = await Compra.findByPk(req.params.id, { include });
        if (!compra) return res.status(404).json({ ok: false, msg: 'Compra no encontrada' });
        if (compra.estado === 'finalizada') return res.status(400).json({ ok: false, msg: 'Ya finalizada' });

        // Descontar préstamos pendientes del reciclador
        const prestamos = await PrestamoReciclador.findAll({
            where: { reciclador_id: compra.reciclador_id, pagado: false }
        });
        let descuento = 0;
        for (const p of prestamos) {
            descuento += parseFloat(p.monto);
            await p.update({ pagado: true, compra_id: compra.id });
        }
        const neto = Math.max(0, parseFloat(compra.total) - descuento);
        await compra.update({ estado: 'finalizada', descuento_prestamo: descuento, neto });

        // Actualizar saldo_prestamo del reciclador
        if (descuento > 0) {
            await Reciclador.decrement('saldo_prestamo', { by: descuento, where: { id: compra.reciclador_id } });
        }

        // Registrar egreso en caja automáticamente
        if (neto > 0) {
            const fechaHoy = compra.fecha;
            let caja = await Caja.findOne({ where: { bodega_id: compra.bodega_id, fecha: fechaHoy } });
            if (!caja) {
                const anterior = await Caja.findOne({ where: { bodega_id: compra.bodega_id }, order: [['fecha', 'DESC']] });
                caja = await Caja.create({ bodega_id: compra.bodega_id, fecha: fechaHoy, saldo_inicial: anterior ? parseFloat(anterior.saldo_final) : 0 });
            }
            const hora = new Date().toTimeString().slice(0, 8);
            await MovimientoCaja.create({ caja_id: caja.id, tipo: 'egreso', concepto: `Compra #${compra.numero || compra.id} - ${compra.reciclador?.nombre}`, monto: neto, hora });
            await caja.update({ total_egresos: parseFloat(caja.total_egresos) + neto, saldo_final: parseFloat(caja.saldo_inicial) + parseFloat(caja.total_ingresos) - (parseFloat(caja.total_egresos) + neto) });
        }

        // Enviar por WhatsApp
        const enviado = await whatsappService.enviarCompra(compra);
        if (enviado) await compra.update({ whatsapp_enviado: true });

        const full = await Compra.findByPk(compra.id, { include });
        res.json({ ok: true, compra: full });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
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
        const hoy = fecha || new Date().toISOString().slice(0, 10);
        const where = { fecha: hoy, estado: 'finalizada' };
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
