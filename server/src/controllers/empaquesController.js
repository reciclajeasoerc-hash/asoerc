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

exports.actualizar = async (req, res) => {
    try {
        const e = await Empaque.findByPk(req.params.id);
        if (!e) return res.status(404).json({ ok: false, msg: 'No encontrado' });
        if (req.body.cantidad_entregada !== undefined || req.body.cantidad_devuelta !== undefined) {
            const entregada = parseInt(req.body.cantidad_entregada ?? e.cantidad_entregada);
            const devuelta  = parseInt(req.body.cantidad_devuelta ?? e.cantidad_devuelta);
            req.body.saldo  = entregada - devuelta;
        }
        await e.update(req.body);
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
