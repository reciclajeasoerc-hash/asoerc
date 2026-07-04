const { Material } = require('../models');

// Orden en que deben aparecer las familias (menor = primero)
const CAT_ORDEN = { 'Metales': 1, 'Electrónicos': 2, 'Plásticos': 3, 'Papel y Cartón': 4, 'Vidrio': 5, 'Madera': 6, 'Otros': 7, 'Varios': 7 };

exports.listar = async (req, res) => {
    try {
        const materiales = await Material.findAll({ where: { activo: true } });
        materiales.sort((a, b) => {
            const ca = CAT_ORDEN[a.categoria] ?? 99, cb = CAT_ORDEN[b.categoria] ?? 99;
            if (ca !== cb) return ca - cb;
            const oa = a.orden ?? 999, ob = b.orden ?? 999;
            if (oa !== ob) return oa - ob;
            return (a.nombre || '').localeCompare(b.nombre || '', 'es');
        });
        res.json({ ok: true, materiales });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.crear = async (req, res) => {
    try {
        const { codigo, nombre, precio_compra, unidad, categoria, orden } = req.body;
        if (!codigo || !nombre) return res.status(400).json({ ok: false, msg: 'Código y nombre requeridos' });
        const material = await Material.create({
            codigo, nombre, precio_compra: precio_compra || 0, unidad: unidad || 'kg',
            categoria: categoria || 'Otros', orden: orden !== undefined && orden !== '' ? orden : 999
        });
        res.json({ ok: true, material });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.actualizar = async (req, res) => {
    try {
        const material = await Material.findByPk(req.params.id);
        if (!material) return res.status(404).json({ ok: false, msg: 'Material no encontrado' });
        const datos = { ...req.body };
        if (datos.orden === '' || datos.orden === null || datos.orden === undefined) datos.orden = 999;
        await material.update(datos);
        res.json({ ok: true, material });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.eliminar = async (req, res) => {
    try {
        await Material.update({ activo: false }, { where: { id: req.params.id } });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};
