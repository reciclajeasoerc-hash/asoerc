const { Vehiculo, GastoVehiculo, Bodega } = require('../models');
const { Op } = require('sequelize');

exports.listar = async (req, res) => {
    try {
        const vehiculos = await Vehiculo.findAll({ where: { activo: true }, order: [['placa', 'ASC']] });
        res.json({ ok: true, vehiculos });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.crear = async (req, res) => {
    try {
        const v = await Vehiculo.create(req.body);
        res.json({ ok: true, vehiculo: v });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

// Lista blanca: solo lo que la pantalla realmente edita, para que una columna
// nueva del modelo no quede editable sin que nadie lo haya decidido.
const CAMPOS_EDITABLES = ['placa', 'descripcion', 'conductor', 'tipo', 'activo'];

exports.actualizar = async (req, res) => {
    try {
        const v = await Vehiculo.findByPk(req.params.id);
        if (!v) return res.status(404).json({ ok: false, msg: 'No encontrado' });

        const datos = {};
        for (const campo of CAMPOS_EDITABLES) {
            if (req.body[campo] !== undefined) datos[campo] = req.body[campo];
        }

        await v.update(datos);
        res.json({ ok: true, vehiculo: v });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.eliminar = async (req, res) => {
    try {
        const v = await Vehiculo.findByPk(req.params.id);
        if (!v) return res.status(404).json({ ok: false, msg: 'No encontrado' });
        await v.update({ activo: false });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.listarGastos = async (req, res) => {
    try {
        const { vehiculo_id, desde, hasta } = req.query;
        const where = {};
        if (vehiculo_id) where.vehiculo_id = vehiculo_id;
        if (desde && hasta) where.fecha = { [Op.between]: [desde, hasta] };
        const gastos = await GastoVehiculo.findAll({
            where,
            include: [{ model: Vehiculo, as: 'vehiculo' }],
            order: [['fecha', 'DESC'], ['createdAt', 'DESC']]
        });
        res.json({ ok: true, gastos });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.registrarGasto = async (req, res) => {
    try {
        const { id } = req.params;
        const g = await GastoVehiculo.create({ ...req.body, vehiculo_id: id });
        res.json({ ok: true, gasto: g });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.eliminarGasto = async (req, res) => {
    try {
        const g = await GastoVehiculo.findByPk(req.params.gasto_id);
        if (!g) return res.status(404).json({ ok: false, msg: 'No encontrado' });
        await g.destroy();
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};
