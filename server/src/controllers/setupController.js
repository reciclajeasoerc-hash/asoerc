const bcrypt   = require('bcryptjs');
const { sequelize, Usuario, Bodega, Configuracion,
    Venta, VentaItem, Compra, CompraItem, Caja, MovimientoCaja, Reciclador,
    Remision, RemisionItem, PrestamoReciclador, PrestamoEmpleado } = require('../models');

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

// Limpia SOLO operaciones (datos de prueba): ventas, compras, cajas, movimientos,
// remisiones y préstamos. Mantiene usuarios, bodegas, materiales, clientes,
// recicladores y empleados. Se desactivan las FKs en una transacción para evitar
// que las remisiones/préstamos (que apuntan a ventas/compras) bloqueen el borrado.
exports.limpiarOperaciones = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction: t });
        const opts = { where: {}, transaction: t };
        const r = {};
        r.movimientos   = await MovimientoCaja.destroy(opts);
        r.cajas         = await Caja.destroy(opts);
        r.remisionItems = await RemisionItem.destroy(opts);
        r.remisiones    = await Remision.destroy(opts);
        r.ventaItems    = await VentaItem.destroy(opts);
        r.ventas        = await Venta.destroy(opts);
        r.compraItems   = await CompraItem.destroy(opts);
        r.compras       = await Compra.destroy(opts);
        r.prestamosRec  = await PrestamoReciclador.destroy(opts);
        r.prestamosEmp  = await PrestamoEmpleado.destroy(opts);
        // Los saldos de préstamo quedaron afectados por las compras de prueba → reset a 0
        await Reciclador.update({ saldo_prestamo: 0 }, { where: {}, transaction: t });
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction: t });
        await t.commit();
        res.json({ ok: true, msg: 'Datos de prueba eliminados (ventas, compras, cajas, movimientos, remisiones y préstamos).', detalle: r });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ ok: false, msg: err.message });
    }
};

// Audita (y opcionalmente repara) los saldos de préstamo de recicladores.
// El bug anterior descontaba el monto completo del préstamo al finalizar una compra,
// ignorando los abonos, lo que dejaba saldo_prestamo negativo o inflado ("fantasma").
// saldo correcto = Σ sobre préstamos PENDIENTES de max(0, monto − abonado).
// Con ?aplicar=1 (o body.aplicar) corrige; sin eso, solo devuelve el reporte (dry-run).
exports.auditarPrestamos = async (req, res) => {
    try {
        const aplicar = req.query.aplicar === '1' || req.body?.aplicar === true;
        const recicladores = await Reciclador.findAll({ where: { activo: true } });
        const problemas = [];
        let abonosCorregidos = 0;

        for (const r of recicladores) {
            const prestamos = await PrestamoReciclador.findAll({ where: { reciclador_id: r.id } });

            // 1) Corregir abonos que quedaron por encima del monto (abonado > monto)
            for (const p of prestamos) {
                const monto = parseFloat(p.monto);
                const abonado = parseFloat(p.abonado || 0);
                if (abonado > monto + 0.001) {
                    if (aplicar) await p.update({ abonado: monto, pagado: true });
                    abonosCorregidos++;
                }
            }

            // 2) Recalcular el saldo correcto sobre préstamos pendientes
            const saldoCorrecto = prestamos
                .filter(p => !p.pagado)
                .reduce((s, p) => s + Math.max(0, parseFloat(p.monto) - Math.min(parseFloat(p.abonado || 0), parseFloat(p.monto))), 0);
            const saldoActual = parseFloat(r.saldo_prestamo || 0);

            if (Math.abs(saldoActual - saldoCorrecto) > 0.5) {
                problemas.push({
                    reciclador_id: r.id, nombre: r.nombre,
                    saldo_actual: saldoActual, saldo_correcto: saldoCorrecto,
                    diferencia: +(saldoCorrecto - saldoActual).toFixed(2)
                });
                if (aplicar) await r.update({ saldo_prestamo: saldoCorrecto });
            }
        }

        res.json({
            ok: true,
            aplicado: aplicar,
            revisados: recicladores.length,
            saldos_inconsistentes: problemas.length,
            abonos_corregidos: abonosCorregidos,
            problemas,
            msg: aplicar
                ? `Reparados ${problemas.length} saldo(s) y ${abonosCorregidos} abono(s).`
                : `Se encontraron ${problemas.length} saldo(s) inconsistentes y ${abonosCorregidos} abono(s) por corregir. Nada se ha modificado.`
        });
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
