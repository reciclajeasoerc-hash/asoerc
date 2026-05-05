const { Reciclador, Compra, PrestamoReciclador, Bodega } = require('../models');

exports.listar = async (req, res) => {
    try {
        const { bodega_id } = req.query;
        const where = { activo: true };
        if (bodega_id) where.bodega_id = bodega_id;
        const recicladores = await Reciclador.findAll({ where, include: [{ model: Bodega, as: 'bodega' }], order: [['nombre', 'ASC']] });
        res.json({ ok: true, recicladores });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.obtener = async (req, res) => {
    try {
        const r = await Reciclador.findByPk(req.params.id, { include: [{ model: Bodega, as: 'bodega' }] });
        if (!r) return res.status(404).json({ ok: false, msg: 'Reciclador no encontrado' });
        const prestamos = await PrestamoReciclador.findAll({ where: { reciclador_id: r.id, pagado: false } });
        res.json({ ok: true, reciclador: r, prestamos });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.crear = async (req, res) => {
    try {
        const { nombre, cedula, telefono, whatsapp, bodega_id } = req.body;
        if (!nombre) return res.status(400).json({ ok: false, msg: 'Nombre requerido' });
        const r = await Reciclador.create({ nombre, cedula, telefono, whatsapp: whatsapp || telefono, bodega_id });
        res.json({ ok: true, reciclador: r });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.actualizar = async (req, res) => {
    try {
        const r = await Reciclador.findByPk(req.params.id);
        if (!r) return res.status(404).json({ ok: false, msg: 'No encontrado' });
        await r.update(req.body);
        res.json({ ok: true, reciclador: r });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.eliminar = async (req, res) => {
    try {
        await Reciclador.update({ activo: false }, { where: { id: req.params.id } });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.prestamos = async (req, res) => {
    try {
        const { reciclador_id } = req.params;
        const prestamos = await PrestamoReciclador.findAll({
            where: { reciclador_id }, order: [['fecha', 'DESC']],
            include: [{ model: Reciclador, as: 'reciclador' }]
        });
        res.json({ ok: true, prestamos });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.crearPrestamo = async (req, res) => {
    try {
        const { reciclador_id } = req.params;
        const { monto, fecha, descripcion } = req.body;
        if (!monto) return res.status(400).json({ ok: false, msg: 'Monto requerido' });
        const prestamo = await PrestamoReciclador.create({
            reciclador_id, monto, fecha: fecha || new Date().toISOString().slice(0, 10), descripcion
        });
        await Reciclador.increment('saldo_prestamo', { by: parseFloat(monto), where: { id: reciclador_id } });
        res.json({ ok: true, prestamo });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};
