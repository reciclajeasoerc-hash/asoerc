const { Material } = require('../models');

exports.listar = async (req, res) => {
    try {
        const materiales = await Material.findAll({ where: { activo: true }, order: [['nombre', 'ASC']] });
        res.json({ ok: true, materiales });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.crear = async (req, res) => {
    try {
        const { codigo, nombre, precio_compra, unidad } = req.body;
        if (!codigo || !nombre) return res.status(400).json({ ok: false, msg: 'Código y nombre requeridos' });
        const material = await Material.create({ codigo, nombre, precio_compra: precio_compra || 0, unidad: unidad || 'kg' });
        res.json({ ok: true, material });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.actualizar = async (req, res) => {
    try {
        const material = await Material.findByPk(req.params.id);
        if (!material) return res.status(404).json({ ok: false, msg: 'Material no encontrado' });
        await material.update(req.body);
        res.json({ ok: true, material });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.eliminar = async (req, res) => {
    try {
        await Material.update({ activo: false }, { where: { id: req.params.id } });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};
