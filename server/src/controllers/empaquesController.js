const { Empaque, Reciclador, Bodega } = require('../models');

exports.listar = async (req, res) => {
    try {
        const { bodega_id, tipo_actor, fecha } = req.query;
        const where = {};
        if (bodega_id) where.bodega_id = bodega_id;
        if (tipo_actor) where.tipo_actor = tipo_actor;
        if (fecha) where.fecha = fecha;
        const empaques = await Empaque.findAll({
            where,
            include: [{ model: Reciclador, as: 'reciclador' }, { model: Bodega, as: 'bodega' }],
            order: [['fecha', 'DESC']]
        });
        res.json({ ok: true, empaques });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.registrar = async (req, res) => {
    try {
        const { tipo_actor, reciclador_id, conductor, bodega_id, fecha, cantidad_entregada, cantidad_devuelta, observaciones } = req.body;
        if (!tipo_actor || !bodega_id) return res.status(400).json({ ok: false, msg: 'Tipo actor y bodega requeridos' });
        const entregada = parseInt(cantidad_entregada) || 0;
        const devuelta  = parseInt(cantidad_devuelta) || 0;
        const saldo     = entregada - devuelta;
        const e = await Empaque.create({
            tipo_actor, reciclador_id, conductor, bodega_id, observaciones,
            fecha: fecha || require("../utils/fecha").hoy(),
            cantidad_entregada: entregada, cantidad_devuelta: devuelta, saldo
        });
        res.json({ ok: true, empaque: e });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

// `saldo` NO se recibe del cliente: siempre se deriva de entregada - devuelta.
// Antes se hacía update(req.body) directo, así que se podía mandar un saldo
// suelto que no cuadrara con las cantidades y dejar empaques descuadrados.
const CAMPOS_EDITABLES = ['tipo_actor', 'reciclador_id', 'conductor', 'bodega_id',
    'fecha', 'cantidad_entregada', 'cantidad_devuelta', 'observaciones'];

exports.actualizar = async (req, res) => {
    try {
        const e = await Empaque.findByPk(req.params.id);
        if (!e) return res.status(404).json({ ok: false, msg: 'No encontrado' });

        const datos = {};
        for (const campo of CAMPOS_EDITABLES) {
            if (req.body[campo] !== undefined) datos[campo] = req.body[campo];
        }

        if (datos.cantidad_entregada !== undefined || datos.cantidad_devuelta !== undefined) {
            const entregada = parseInt(datos.cantidad_entregada ?? e.cantidad_entregada);
            const devuelta  = parseInt(datos.cantidad_devuelta ?? e.cantidad_devuelta);
            datos.saldo = entregada - devuelta;
        }

        await e.update(datos);
        res.json({ ok: true, empaque: e });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.resumen = async (req, res) => {
    try {
        const { bodega_id } = req.query;
        const where = {};
        if (bodega_id) where.bodega_id = bodega_id;
        const empaques = await Empaque.findAll({ where, include: [{ model: Reciclador, as: 'reciclador' }] });
        const porActor = {};
        for (const e of empaques) {
            const key = e.tipo_actor === 'reciclador' ? (e.reciclador?.nombre || 'Desconocido') : (e.conductor || 'Conductor');
            if (!porActor[key]) porActor[key] = { entregado: 0, devuelto: 0, saldo: 0 };
            porActor[key].entregado += e.cantidad_entregada;
            porActor[key].devuelto  += e.cantidad_devuelta;
            porActor[key].saldo     += e.saldo;
        }
        res.json({ ok: true, porActor });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};
