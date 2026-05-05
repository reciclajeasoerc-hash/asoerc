const { Empleado, PrestamoEmpleado, DiasNoLaborados, Bodega } = require('../models');

const include = [{ model: Bodega, as: 'bodega' }];

exports.listar = async (req, res) => {
    try {
        const { bodega_id } = req.query;
        const where = { activo: true };
        if (bodega_id) where.bodega_id = bodega_id;
        const empleados = await Empleado.findAll({ where, include, order: [['nombre', 'ASC']] });
        res.json({ ok: true, empleados });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.crear = async (req, res) => {
    try {
        const { nombre, cedula, telefono, bodega_id, cargo, salario } = req.body;
        if (!nombre) return res.status(400).json({ ok: false, msg: 'Nombre requerido' });
        const e = await Empleado.create({ nombre, cedula, telefono, bodega_id, cargo, salario });
        res.json({ ok: true, empleado: e });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.actualizar = async (req, res) => {
    try {
        const e = await Empleado.findByPk(req.params.id);
        if (!e) return res.status(404).json({ ok: false, msg: 'No encontrado' });
        await e.update(req.body);
        res.json({ ok: true, empleado: e });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.eliminar = async (req, res) => {
    try {
        await Empleado.update({ activo: false }, { where: { id: req.params.id } });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

// Préstamos
exports.listarPrestamos = async (req, res) => {
    try {
        const { quincena, descontado } = req.query;
        const where = { empleado_id: req.params.id };
        if (quincena) where.quincena = quincena;
        if (descontado !== undefined) where.descontado = descontado === 'true';
        const prestamos = await PrestamoEmpleado.findAll({ where, order: [['fecha', 'DESC']] });
        res.json({ ok: true, prestamos });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.crearPrestamo = async (req, res) => {
    try {
        const { monto, fecha, descripcion, quincena } = req.body;
        if (!monto) return res.status(400).json({ ok: false, msg: 'Monto requerido' });
        const p = await PrestamoEmpleado.create({
            empleado_id: req.params.id, monto, descripcion, quincena,
            fecha: fecha || new Date().toISOString().slice(0, 10)
        });
        res.json({ ok: true, prestamo: p });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.marcarPrestamoDescontado = async (req, res) => {
    try {
        await PrestamoEmpleado.update({ descontado: true }, { where: { id: req.params.prestamo_id } });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

// Días no laborados
exports.listarDiasNoLaborados = async (req, res) => {
    try {
        const { quincena } = req.query;
        const where = { empleado_id: req.params.id };
        if (quincena) where.quincena = quincena;
        const dias = await DiasNoLaborados.findAll({ where, order: [['fecha_inicio', 'DESC']] });
        res.json({ ok: true, dias });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.crearDiasNoLaborados = async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin, dias, motivo, quincena } = req.body;
        if (!fecha_inicio || !dias) return res.status(400).json({ ok: false, msg: 'Fecha y días requeridos' });
        const d = await DiasNoLaborados.create({
            empleado_id: req.params.id, fecha_inicio,
            fecha_fin: fecha_fin || fecha_inicio, dias, motivo, quincena
        });
        res.json({ ok: true, registro: d });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};
