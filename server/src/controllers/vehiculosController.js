const { sequelize, Vehiculo, GastoVehiculo, Bodega } = require('../models');
const { bodegaDeLaOperacion, cajaParaEgreso, crearEgreso, sumarEnCaja, quitarMovimientos, recalcularCaja } = require('../utils/caja');
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
        // Los vehículos son compartidos, pero cada gasto es de una bodega
        if (req.user?.rol !== 'superadmin') where.bodega_id = req.user?.bodega_id || -1;
        if (desde && hasta) where.fecha = { [Op.between]: [desde, hasta] };
        const gastos = await GastoVehiculo.findAll({
            where,
            include: [{ model: Vehiculo, as: 'vehiculo' }],
            order: [['fecha', 'DESC'], ['createdAt', 'DESC']]
        });
        res.json({ ok: true, gastos });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

const TIPOS_GASTO = { gasolina: 'Gasolina', viatico: 'Viático', mantenimiento: 'Mantenimiento', otro: 'Otro' };

// Por defecto el gasto se paga con plata de la caja → egreso en la caja de la bodega.
// sale_de_caja:false = se pagó de otra forma (transferencia, etc.) y la caja no se toca.
exports.registrarGasto = async (req, res) => {
    let t;
    try {
        const vehiculo = await Vehiculo.findByPk(req.params.id);
        if (!vehiculo) return res.status(404).json({ ok: false, msg: 'Vehículo no encontrado' });
        const monto = parseFloat(req.body.monto);
        if (!(monto > 0)) return res.status(400).json({ ok: false, msg: 'El monto es requerido' });
        const tipo = TIPOS_GASTO[req.body.tipo] ? req.body.tipo : 'otro';
        const fecha = req.body.fecha || require('../utils/fecha').hoy();
        const sale_de_caja = req.body.sale_de_caja !== false && req.body.sale_de_caja !== 'false';
        const bodega_id = bodegaDeLaOperacion(req.user, req.body);
        const caja = sale_de_caja ? await cajaParaEgreso(bodega_id, fecha) : null;

        t = await sequelize.transaction();
        // Lista blanca (antes se guardaba req.body tal cual)
        const g = await GastoVehiculo.create({
            vehiculo_id: vehiculo.id, bodega_id, fecha, tipo, monto, sale_de_caja,
            descripcion: req.body.descripcion || null,
            km_actual: req.body.km_actual ? parseInt(req.body.km_actual) : null,
        }, { transaction: t });
        if (caja) await crearEgreso(caja, { concepto: `${TIPOS_GASTO[tipo]} vehículo ${vehiculo.placa}${g.descripcion ? ' — ' + g.descripcion : ''}`, monto, referencia: `gasto_veh:${g.id}` }, t);
        await t.commit();
        if (caja) await recalcularCaja(caja.id);
        res.json({ ok: true, gasto: g });
    } catch (err) {
        if (t && !t.finished) await t.rollback();
        res.status(err.status || 500).json({ ok: false, msg: err.message });
    }
};

exports.eliminarGasto = async (req, res) => {
    try {
        const g = await GastoVehiculo.findByPk(req.params.gasto_id);
        if (!g || String(g.vehiculo_id) !== String(req.params.id)) return res.status(404).json({ ok: false, msg: 'No encontrado' });
        if (req.user?.rol !== 'superadmin' && String(g.bodega_id) !== String(req.user?.bodega_id))
            return res.status(403).json({ ok: false, msg: 'Ese gasto es de otra bodega' });
        // Si salió de la caja, la plata vuelve a la caja (se borra su egreso y se recalcula)
        const cajas = await sequelize.transaction(async t => {
            const ids = await quitarMovimientos(`gasto_veh:${g.id}`, t);
            await g.destroy({ transaction: t });
            return ids;
        });
        for (const cid of cajas) await recalcularCaja(cid);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};
