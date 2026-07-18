const { sequelize, Venta, VentaItem, Cliente, ClienteSede, Material, MaterialPrecioCliente, Bodega, Caja, MovimientoCaja } = require('../models');
const { obtenerCajaDia } = require('../utils/caja');

const include = [
    { model: Cliente, as: 'cliente', include: [{ model: MaterialPrecioCliente, as: 'precios', include: [{ model: Material, as: 'material' }] }] },
    { model: ClienteSede, as: 'sede' },
    { model: Bodega, as: 'bodega' },
    { model: VentaItem, as: 'items', include: [{ model: Material, as: 'material' }] }
];

async function registrarEnCaja(bodega_id, fecha, total, concepto, referencia = '', t = null) {
    if (!total || total <= 0) return;
    // Caja del día resiliente ante concurrencia (findOrCreate + índice único: no duplica ni falla).
    const caja = await obtenerCajaDia(bodega_id, fecha);
    const hora = new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour12: false });
    await MovimientoCaja.create({ caja_id: caja.id, tipo: 'ingreso', concepto, monto: total, hora, referencia }, { transaction: t });
    // Ajuste ATÓMICO de la caja (no lee-modifica-escribe → no se pierden ingresos simultáneos)
    await sequelize.query(
        'UPDATE Cajas SET total_ingresos = total_ingresos + ?, saldo_final = saldo_inicial + total_ingresos - total_egresos WHERE id = ?',
        { replacements: [total, caja.id], transaction: t });
}

exports.listar = async (req, res) => {
    try {
        const { cliente_id, bodega_id, estado, fecha, page = 1 } = req.query;
        const where = {};
        if (cliente_id) where.cliente_id = cliente_id;
        if (bodega_id) where.bodega_id = bodega_id;
        if (estado) where.estado = estado;
        if (fecha) where.fecha = fecha;
        const limit = 50, offset = (page - 1) * limit;
        const { rows, count } = await Venta.findAndCountAll({ where, include, order: [['createdAt', 'DESC']], limit, offset });
        res.json({ ok: true, items: rows, total: count });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.obtener = async (req, res) => {
    try {
        const venta = await Venta.findByPk(req.params.id, { include });
        if (!venta) return res.status(404).json({ ok: false, msg: 'Venta no encontrada' });
        res.json({ ok: true, venta });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.crear = async (req, res) => {
    const { cliente_id, sede_id, bodega_id, fecha, items, tipo_pago, observaciones } = req.body;
    if (!cliente_id || !bodega_id || !items?.length)
        return res.status(400).json({ ok: false, msg: 'Cliente, bodega e items requeridos' });

    // Venta + ítems + caja en una TRANSACCIÓN: todo o nada.
    const t = await sequelize.transaction();
    try {
        const cliente = await Cliente.findByPk(cliente_id, { include: [{ model: MaterialPrecioCliente, as: 'precios' }], transaction: t });
        let total = 0;
        const ventaData = await Venta.create({
            cliente_id, sede_id, bodega_id,
            fecha: fecha || require("../utils/fecha").hoy(),
            tipo_pago: tipo_pago || 'pendiente', observaciones, estado: 'orden'
        }, { transaction: t });

        for (const item of items) {
            const material = await Material.findByPk(item.material_id, { transaction: t });
            // Precio especial del cliente o precio base del material
            const precioEspecial = cliente.precios?.find(p => p.material_id === item.material_id);
            const precio_unitario = precioEspecial ? parseFloat(precioEspecial.precio) : parseFloat(material.precio_compra);
            const subtotal = parseFloat(item.kilos) * precio_unitario;
            total += subtotal;
            await VentaItem.create({ venta_id: ventaData.id, material_id: item.material_id, kilos: item.kilos, precio_unitario, total: subtotal }, { transaction: t });
        }
        await ventaData.update({ total }, { transaction: t });

        // Registrar en caja si el pago ya fue recibido
        if (tipo_pago && tipo_pago !== 'pendiente') {
            const fechaVenta = fecha || require("../utils/fecha").hoy();
            await registrarEnCaja(bodega_id, fechaVenta, total, `Venta #${ventaData.numero || ventaData.id} - ${cliente?.nombre}`, `venta:${ventaData.id}`, t);
            await ventaData.update({ estado: 'pagada' }, { transaction: t });
        }

        await t.commit();
        const full = await Venta.findByPk(ventaData.id, { include });
        res.json({ ok: true, venta: full });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ ok: false, msg: err.message });
    }
};

exports.actualizarEstado = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { estado, tipo_pago } = req.body;
        const venta = await Venta.findByPk(req.params.id, { include, transaction: t });
        if (!venta) { await t.rollback(); return res.status(404).json({ ok: false, msg: 'No encontrada' }); }
        const estadoAnterior = venta.estado; // capturar ANTES de actualizar (si no, el chequeo de abajo siempre falla)
        const update = {};
        if (estado) update.estado = estado;
        if (tipo_pago) update.tipo_pago = tipo_pago;
        await venta.update(update, { transaction: t });

        // Si marcan como pagada y aún no estaba pagada → registrar el ingreso en caja (una sola vez)
        if (estado === 'pagada' && estadoAnterior !== 'pagada') {
            const tp = tipo_pago || venta.tipo_pago;
            await registrarEnCaja(venta.bodega_id, venta.fecha, parseFloat(venta.total),
                `Venta #${venta.numero || venta.id} - ${venta.cliente?.nombre} (${tp})`, `venta:${venta.id}`, t);
        }

        await t.commit();
        res.json({ ok: true, venta });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ ok: false, msg: err.message });
    }
};

exports.eliminar = async (req, res) => {
    try {
        const venta = await Venta.findByPk(req.params.id);
        if (!venta) return res.status(404).json({ ok: false, msg: 'No encontrada' });
        if (venta.estado === 'pagada') return res.status(400).json({ ok: false, msg: 'No se puede eliminar una venta pagada' });
        await VentaItem.destroy({ where: { venta_id: venta.id } });
        await venta.destroy();
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

// Clientes
exports.listarClientes = async (req, res) => {
    try {
        const clientes = await Cliente.findAll({
            where: { activo: true },
            include: [
                { model: ClienteSede, as: 'sedes' },
                { model: MaterialPrecioCliente, as: 'precios', include: [{ model: Material, as: 'material' }] }
            ],
            order: [['nombre', 'ASC']]
        });
        res.json({ ok: true, clientes });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.crearCliente = async (req, res) => {
    try {
        const { nombre, nit, telefono, email, contacto, tipo_precio, sedes, precios } = req.body;
        if (!nombre) return res.status(400).json({ ok: false, msg: 'Nombre requerido' });
        const cliente = await Cliente.create({ nombre, nit, telefono, email, contacto, tipo_precio: tipo_precio || 'fijo' });
        if (sedes?.length) {
            for (const s of sedes) await ClienteSede.create({ cliente_id: cliente.id, nombre: s.nombre, direccion: s.direccion });
        }
        if (precios?.length) {
            for (const p of precios) await MaterialPrecioCliente.create({ cliente_id: cliente.id, material_id: p.material_id, precio: p.precio });
        }
        const full = await Cliente.findByPk(cliente.id, { include: [{ model: ClienteSede, as: 'sedes' }, { model: MaterialPrecioCliente, as: 'precios', include: [{ model: Material, as: 'material' }] }] });
        res.json({ ok: true, cliente: full });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.actualizarCliente = async (req, res) => {
    try {
        const cliente = await Cliente.findByPk(req.params.id);
        if (!cliente) return res.status(404).json({ ok: false, msg: 'No encontrado' });
        await cliente.update(req.body);
        res.json({ ok: true, cliente });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.crearSede = async (req, res) => {
    try {
        const { nombre, direccion } = req.body;
        if (!nombre) return res.status(400).json({ ok: false, msg: 'Nombre de sede requerido' });
        const sede = await ClienteSede.create({ cliente_id: req.params.id, nombre, direccion });
        res.json({ ok: true, sede });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.obtenerCliente = async (req, res) => {
    try {
        const cliente = await Cliente.findByPk(req.params.id, {
            include: [
                { model: ClienteSede, as: 'sedes' },
                { model: MaterialPrecioCliente, as: 'precios', include: [{ model: Material, as: 'material' }] }
            ]
        });
        if (!cliente) return res.status(404).json({ ok: false, msg: 'No encontrado' });
        res.json({ ok: true, cliente });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.eliminarCliente = async (req, res) => {
    try {
        await Cliente.update({ activo: false }, { where: { id: req.params.id } });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.listarPrecios = async (req, res) => {
    try {
        const precios = await MaterialPrecioCliente.findAll({
            where: { cliente_id: req.params.id },
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
        const existente = await MaterialPrecioCliente.findOne({ where: { cliente_id: req.params.id, material_id } });
        if (existente) {
            await existente.update({ precio });
        } else {
            await MaterialPrecioCliente.create({ cliente_id: req.params.id, material_id, precio });
        }
        const precios = await MaterialPrecioCliente.findAll({
            where: { cliente_id: req.params.id },
            include: [{ model: Material, as: 'material' }],
            order: [[{ model: Material, as: 'material' }, 'nombre', 'ASC']]
        });
        res.json({ ok: true, precios });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.eliminarPrecio = async (req, res) => {
    try {
        await MaterialPrecioCliente.destroy({ where: { cliente_id: req.params.id, material_id: req.params.material_id } });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};
