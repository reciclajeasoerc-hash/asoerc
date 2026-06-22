const bcrypt   = require('bcryptjs');
const { sequelize, Usuario, Bodega, Configuracion,
    Venta, VentaItem, Compra, CompraItem, Caja, MovimientoCaja, Reciclador } = require('../models');

exports.estado = async (req, res) => {
    try {
        const total = await Usuario.count();
        res.json({ ok: true, configurado: total > 0 });
    } catch (err) {
        res.status(500).json({ ok: false, msg: err.message });
    }
};

exports.configurar = async (req, res) => {
    try {
        const total = await Usuario.count();
        if (total > 0) return res.status(400).json({ ok: false, msg: 'El sistema ya está configurado.' });

        const { nombre_empresa, email, password, nombre_admin } = req.body;
        if (!email || !password || !nombre_empresa)
            return res.status(400).json({ ok: false, msg: 'Nombre de empresa, email y contraseña son requeridos.' });
        if (password.length < 6)
            return res.status(400).json({ ok: false, msg: 'La contraseña debe tener al menos 6 caracteres.' });

        let bodega = await Bodega.findOne({ where: { nombre: 'Bodega Principal' } });
        if (bodega) await bodega.update({ nombre: nombre_empresa });
        else bodega = await Bodega.create({ nombre: nombre_empresa, direccion: '' });

        // Guardar nombre en tabla configuracion (patrón clave-valor)
        await Configuracion.upsert({ clave: 'empresa_nombre', valor: nombre_empresa });

        const hash = await bcrypt.hash(password, 10);
        await Usuario.create({
            nombre:    nombre_admin || 'Administrador',
            email:     email.toLowerCase().trim(),
            password:  hash,
            rol:       'superadmin',
            bodega_id: bodega.id
        });

        res.json({ ok: true, msg: 'Sistema configurado correctamente. Ya puede iniciar sesión.' });
    } catch (err) {
        res.status(500).json({ ok: false, msg: err.message });
    }
};

// Limpia SOLO operaciones (datos de prueba): ventas, compras, cajas y movimientos.
// Mantiene usuarios, bodegas, materiales, clientes, recicladores y empleados.
exports.limpiarOperaciones = async (req, res) => {
    try {
        const r = {};
        r.movimientos = await MovimientoCaja.destroy({ where: {} });
        r.cajas       = await Caja.destroy({ where: {} });
        r.ventaItems  = await VentaItem.destroy({ where: {} });
        r.ventas      = await Venta.destroy({ where: {} });
        r.compraItems = await CompraItem.destroy({ where: {} });
        r.compras     = await Compra.destroy({ where: {} });
        // Los descuentos de préstamo de las compras de prueba quedaron reflejados en el saldo → reset a 0
        await Reciclador.update({ saldo_prestamo: 0 }, { where: {} });
        res.json({ ok: true, msg: 'Datos de prueba eliminados (ventas, compras, cajas y movimientos).', detalle: r });
    } catch (err) {
        res.status(500).json({ ok: false, msg: err.message });
    }
};

exports.reset = async (req, res) => {
    const secret = req.body?.secret || req.query?.secret;
    const envSecret = process.env.RESET_SECRET;

    if (!envSecret || secret !== envSecret) {
        return res.status(403).json({ ok: false, msg: 'Acceso denegado. Configure RESET_SECRET en Railway.' });
    }

    try {
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        const [tables] = await sequelize.query('SHOW TABLES');
        for (const row of tables) {
            const tabla = Object.values(row)[0];
            await sequelize.query(`TRUNCATE TABLE \`${tabla}\``).catch(() => {});
        }
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

        // Recrear Bodega Principal para que el seed y setup funcionen
        await Bodega.create({ nombre: 'Bodega Principal', direccion: '' });

        res.json({ ok: true, msg: 'Sistema limpio. Abra el sistema para hacer la configuración inicial.' });
    } catch (err) {
        res.status(500).json({ ok: false, msg: err.message });
    }
};
