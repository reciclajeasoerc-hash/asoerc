const { Reciclador, Compra, PrestamoReciclador, Bodega, MaterialPrecioReciclador, Material, RecicladorSede } = require('../models');

exports.listar = async (req, res) => {
    try {
        // Los recicladores son COMPARTIDOS entre todas las bodegas: el mismo reciclador
        // puede venderle a cualquier bodega, así que NO se filtra por bodega (evita que
        // el mismo se tenga que repetir en cada bodega). La compra sí guarda su bodega.
        const recicladores = await Reciclador.findAll({ where: { activo: true }, include: [{ model: Bodega, as: 'bodega' }], order: [['nombre', 'ASC']] });
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
        // Si ya existe por cédula, no se duplica: ya está disponible en todas las bodegas.
        if (cedula) {
            const existe = await Reciclador.findOne({ where: { cedula } });
            if (existe) return res.status(400).json({ ok: false, msg: `Ya existe el reciclador "${existe.nombre}" con la cédula ${cedula}. Ya puedes usarlo en cualquier bodega (no hay que crearlo otra vez).` });
        }
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
            reciclador_id, monto, fecha: fecha || require("../utils/fecha").hoy(), descripcion
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
            // Solo se mueve el saldo por lo que FALTABA (monto − abonado), para no
            // descontar dos veces lo ya abonado.
            const restante = parseFloat(prestamo.monto) - parseFloat(prestamo.abonado || 0);
            await prestamo.update({ pagado });
            const delta = pagado ? -restante : restante;
            await Reciclador.increment('saldo_prestamo', { by: delta, where: { id: prestamo.reciclador_id } });
        }
        res.json({ ok: true, prestamo });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

// Abono (pago parcial) a un préstamo de reciclador.
exports.abonarPrestamo = async (req, res) => {
    try {
        const prestamo = await PrestamoReciclador.findByPk(req.params.prestamo_id);
        if (!prestamo) return res.status(404).json({ ok: false, msg: 'Préstamo no encontrado' });
        if (prestamo.pagado) return res.status(400).json({ ok: false, msg: 'Este préstamo ya está pagado' });
        const monto = parseFloat(req.body.monto);
        if (!monto || monto <= 0) return res.status(400).json({ ok: false, msg: 'Monto de abono inválido' });
        const restante = parseFloat(prestamo.monto) - parseFloat(prestamo.abonado || 0);
        const abono = Math.min(monto, restante); // no abonar más de lo que falta
        const nuevoAbonado = parseFloat(prestamo.abonado || 0) + abono;
        const quedaPagado = nuevoAbonado >= parseFloat(prestamo.monto) - 0.001;
        await prestamo.update({ abonado: nuevoAbonado, pagado: quedaPagado });
        await Reciclador.increment('saldo_prestamo', { by: -abono, where: { id: prestamo.reciclador_id } });
        res.json({ ok: true, prestamo, abonado_ahora: abono, pagado: quedaPagado });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};
