const { Reciclador, Compra, PrestamoReciclador, Bodega, MaterialPrecioReciclador, Material, RecicladorSede } = require('../models');

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

exports.listarPrecios = async (req, res) => {
    try {
        const precios = await MaterialPrecioReciclador.findAll({
            where: { reciclador_id: req.params.id },
            include: [{ model: Material, as: 'material' }],
            order: [[{ model: Material, as: 'material' }, 'nombre', 'ASC']]
        });
        res.json({ ok: true, precios });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.guardarPrecio = async (req, res) => {
    try {
        const { material_id, precio } = req.body;
        if (!material_id || precio === undefined) return res.status(400).json({ ok: false, msg: 'material_id y precio requeridos' });
        const existente = await MaterialPrecioReciclador.findOne({ where: { reciclador_id: req.params.id, material_id } });
        if (existente) {
            await existente.update({ precio });
        } else {
            await MaterialPrecioReciclador.create({ reciclador_id: req.params.id, material_id, precio });
        }
        const precios = await MaterialPrecioReciclador.findAll({
            where: { reciclador_id: req.params.id },
            include: [{ model: Material, as: 'material' }],
            order: [[{ model: Material, as: 'material' }, 'nombre', 'ASC']]
        });
        res.json({ ok: true, precios });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.eliminarPrecio = async (req, res) => {
    try {
        await MaterialPrecioReciclador.destroy({ where: { reciclador_id: req.params.id, material_id: req.params.material_id } });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.listarSedes = async (req, res) => {
    try {
        const sedes = await RecicladorSede.findAll({ where: { reciclador_id: req.params.id, activa: true }, order: [['createdAt', 'ASC']] });
        res.json({ ok: true, sedes });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.crearSede = async (req, res) => {
    try {
        const { nombre, direccion } = req.body;
        if (!nombre) return res.status(400).json({ ok: false, msg: 'Nombre requerido' });
        const sede = await RecicladorSede.create({ reciclador_id: req.params.id, nombre, direccion });
        res.json({ ok: true, sede });
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

exports.marcarPrestamoPagado = async (req, res) => {
    try {
        const prestamo = await PrestamoReciclador.findByPk(req.params.prestamo_id);
        if (!prestamo) return res.status(404).json({ ok: false, msg: 'Préstamo no encontrado' });
        // Marcar como pagado (true) o revertir a pendiente (false).
        const pagado = req.body.pagado !== undefined ? !!req.body.pagado : true;
        if (pagado !== prestamo.pagado) {
            await prestamo.update({ pagado });
            // Pagar reduce el saldo pendiente del reciclador; revertir lo vuelve a sumar.
            const delta = pagado ? -parseFloat(prestamo.monto) : parseFloat(prestamo.monto);
            await Reciclador.increment('saldo_prestamo', { by: delta, where: { id: prestamo.reciclador_id } });
        }
        res.json({ ok: true, prestamo });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};
