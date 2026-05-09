const { Remision, RemisionItem, Material, Cliente, ClienteSede, Bodega, Venta, Compra, Reciclador } = require('../models');
const path = require('path');

const includeRemision = [
    { model: RemisionItem, as: 'items', include: [{ model: Material, as: 'material' }] },
    { model: Cliente,     as: 'cliente' },
    { model: ClienteSede, as: 'sede' },
    { model: Bodega,      as: 'bodega' },
    { model: Venta,       as: 'venta',  required: false },
    { model: Compra,      as: 'compra', required: false, include: [{ model: Reciclador, as: 'reciclador' }] }
];

exports.listar = async (req, res) => {
    try {
        const { bodega_id, cliente_id, fecha, page = 1 } = req.query;
        const where = {};
        if (bodega_id) where.bodega_id = bodega_id;
        if (cliente_id) where.cliente_id = cliente_id;
        if (fecha) where.fecha = fecha;
        const limit = 50, offset = (page - 1) * limit;
        const { rows, count } = await Remision.findAndCountAll({ where, include: includeRemision, order: [['createdAt', 'DESC']], limit, offset });
        res.json({ ok: true, items: rows, total: count });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.obtener = async (req, res) => {
    try {
        const r = await Remision.findByPk(req.params.id, { include: includeRemision });
        if (!r) return res.status(404).json({ ok: false, msg: 'No encontrada' });
        res.json({ ok: true, remision: r });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.crear = async (req, res) => {
    try {
        const { conductor, cliente_id, sede_id, bodega_id, fecha, hora_llegada, vehiculo, items, observaciones } = req.body;
        if (!conductor || !bodega_id) return res.status(400).json({ ok: false, msg: 'Conductor y bodega requeridos' });
        const foto_url = req.file ? `/uploads/${req.file.filename}` : null;
        let total_kilos = 0;
        const remision = await Remision.create({
            conductor, cliente_id, sede_id, bodega_id, foto_url,
            fecha: fecha || new Date().toISOString().slice(0, 10),
            hora_llegada, vehiculo, observaciones, total_kilos
        });
        if (items) {
            const parsed = typeof items === 'string' ? JSON.parse(items) : items;
            for (const item of parsed) {
                await RemisionItem.create({ remision_id: remision.id, material_id: item.material_id, kilos: item.kilos });
                total_kilos += parseFloat(item.kilos);
            }
            await remision.update({ total_kilos });
        }
        const full = await Remision.findByPk(remision.id, { include: includeRemision });
        res.json({ ok: true, remision: full });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.actualizar = async (req, res) => {
    try {
        const remision = await Remision.findByPk(req.params.id);
        if (!remision) return res.status(404).json({ ok: false, msg: 'No encontrada' });
        if (req.file) req.body.foto_url = `/uploads/${req.file.filename}`;
        await remision.update(req.body);
        res.json({ ok: true, remision });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.eliminar = async (req, res) => {
    try {
        const remision = await Remision.findByPk(req.params.id);
        if (!remision) return res.status(404).json({ ok: false, msg: 'No encontrada' });
        await RemisionItem.destroy({ where: { remision_id: remision.id } });
        await remision.destroy();
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};
