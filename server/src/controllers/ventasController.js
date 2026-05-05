const { Venta, VentaItem, Cliente, ClienteSede, Material, MaterialPrecioCliente, Bodega } = require('../models');

const include = [
    { model: Cliente, as: 'cliente', include: [{ model: MaterialPrecioCliente, as: 'precios', include: [{ model: Material, as: 'material' }] }] },
    { model: ClienteSede, as: 'sede' },
    { model: Bodega, as: 'bodega' },
    { model: VentaItem, as: 'items', include: [{ model: Material, as: 'material' }] }
];

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
    try {
        const { cliente_id, sede_id, bodega_id, fecha, items, tipo_pago, observaciones } = req.body;
        if (!cliente_id || !bodega_id || !items?.length)
            return res.status(400).json({ ok: false, msg: 'Cliente, bodega e items requeridos' });

        const cliente = await Cliente.findByPk(cliente_id, { include: [{ model: MaterialPrecioCliente, as: 'precios' }] });
        let total = 0;
        const ventaData = await Venta.create({
            cliente_id, sede_id, bodega_id,
            fecha: fecha || new Date().toISOString().slice(0, 10),
            tipo_pago: tipo_pago || 'pendiente', observaciones, estado: 'orden'
        });

        for (const item of items) {
            const material = await Material.findByPk(item.material_id);
            // Precio especial del cliente o precio base del material
            const precioEspecial = cliente.precios?.find(p => p.material_id === item.material_id);
            const precio_unitario = precioEspecial ? parseFloat(precioEspecial.precio) : parseFloat(material.precio_compra);
            const subtotal = parseFloat(item.kilos) * precio_unitario;
            total += subtotal;
            await VentaItem.create({ venta_id: ventaData.id, material_id: item.material_id, kilos: item.kilos, precio_unitario, total: subtotal });
        }
        await ventaData.update({ total });
        const full = await Venta.findByPk(ventaData.id, { include });
        res.json({ ok: true, venta: full });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.actualizarEstado = async (req, res) => {
    try {
        const { estado, tipo_pago } = req.body;
        const venta = await Venta.findByPk(req.params.id);
        if (!venta) return res.status(404).json({ ok: false, msg: 'No encontrada' });
        const update = {};
        if (estado) update.estado = estado;
        if (tipo_pago) update.tipo_pago = tipo_pago;
        await venta.update(update);
        res.json({ ok: true, venta });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
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
