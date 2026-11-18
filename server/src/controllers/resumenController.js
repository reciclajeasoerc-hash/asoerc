// ── Resumen para el panel de inicio (gráficas) ─────────────────────────────────
// Solo lectura: agrega datos que ya existen (compras, ventas, caja, préstamos, gastos).
// Quien no es superadmin ve SOLO su bodega (se ignora lo que mande en la consulta).
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const { hoy: hoyColombia } = require('../utils/fecha');

const ROLES_PRESTAMOS = ['superadmin', 'admin', 'cajero'];
const sumarDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const num = v => Number(v || 0);
const isoFecha = f => (f instanceof Date ? f.toISOString() : String(f)).slice(0, 10);

exports.resumen = async (req, res) => {
    try {
        const esSuper = req.user?.rol === 'superadmin';
        if (!esSuper && !req.user?.bodega_id) return res.status(403).json({ ok: false, msg: 'Tu usuario no tiene bodega asignada' });
        const bodega = esSuper ? (parseInt(req.query.bodega_id) || null) : req.user.bodega_id;
        const dias = Math.min(Math.max(parseInt(req.query.dias) || 14, 7), 90);
        const hoy = hoyColombia();
        const desde = sumarDias(hoy, -(dias - 1));
        const inicioMes = hoy.slice(0, 8) + '01';
        const q = sql => sequelize.query(sql, { replacements: { bodega, desde, hoy, inicioMes }, type: QueryTypes.SELECT });
        const fb = alias => bodega ? ` AND ${alias}.bodega_id = :bodega` : '';

        const [comprasDia, kilosCompraDia, ventasDia, kilosVentaDia, materiales, top, cajas, gastos] = await Promise.all([
            q(`SELECT c.fecha, SUM(c.total) valor, COUNT(*) cantidad FROM Compras c
                WHERE c.estado = 'finalizada' AND c.fecha BETWEEN :desde AND :hoy${fb('c')} GROUP BY c.fecha`),
            q(`SELECT c.fecha, SUM(i.kilos) kilos FROM CompraItems i JOIN Compras c ON c.id = i.compra_id
                WHERE c.estado = 'finalizada' AND c.fecha BETWEEN :desde AND :hoy${fb('c')} GROUP BY c.fecha`),
            q(`SELECT v.fecha, SUM(v.total) valor, COUNT(*) cantidad FROM Venta v
                WHERE v.fecha BETWEEN :desde AND :hoy${fb('v')} GROUP BY v.fecha`),
            q(`SELECT v.fecha, SUM(i.kilos) kilos FROM VentaItems i JOIN Venta v ON v.id = i.venta_id
                WHERE v.fecha BETWEEN :desde AND :hoy${fb('v')} GROUP BY v.fecha`),
            q(`SELECT m.nombre, m.categoria, SUM(i.kilos) kilos, SUM(i.total) valor
                 FROM CompraItems i JOIN Compras c ON c.id = i.compra_id JOIN Materials m ON m.id = i.material_id
                WHERE c.estado = 'finalizada' AND c.fecha BETWEEN :desde AND :hoy${fb('c')}
                GROUP BY m.id, m.nombre, m.categoria ORDER BY kilos DESC`),
            q(`SELECT r.nombre, SUM(i.kilos) kilos, SUM(i.total) valor, COUNT(DISTINCT c.id) compras
                 FROM CompraItems i JOIN Compras c ON c.id = i.compra_id JOIN Recicladors r ON r.id = c.reciclador_id
                WHERE c.estado = 'finalizada' AND c.fecha BETWEEN :inicioMes AND :hoy${fb('c')}
                GROUP BY r.id, r.nombre ORDER BY kilos DESC LIMIT 5`),
            q(`SELECT b.id bodega_id, b.nombre, k.id caja_id, k.saldo_inicial, k.total_ingresos, k.total_egresos,
                      k.saldo_final, k.estado, k.base_confirmada
                 FROM Bodegas b LEFT JOIN Cajas k ON k.bodega_id = b.id AND k.fecha = :hoy
                WHERE b.activa = 1${bodega ? ' AND b.id = :bodega' : ''} ORDER BY b.id`),
            q(`SELECT g.tipo, SUM(g.monto) total FROM GastoVehiculos g
                WHERE g.fecha BETWEEN :inicioMes AND :hoy${fb('g')} GROUP BY g.tipo`),
        ]);

        // Serie diaria completa: los días sin movimiento van en cero
        const mapa = rows => Object.fromEntries(rows.map(r => [isoFecha(r.fecha), r]));
        const cM = mapa(comprasDia), ckM = mapa(kilosCompraDia), vM = mapa(ventasDia), vkM = mapa(kilosVentaDia);
        const serie = [];
        for (let i = 0; i < dias; i++) {
            const f = sumarDias(desde, i);
            serie.push({
                fecha: f,
                compras: num(cM[f]?.valor), num_compras: num(cM[f]?.cantidad), kilos_compra: num(ckM[f]?.kilos),
                ventas: num(vM[f]?.valor), num_ventas: num(vM[f]?.cantidad), kilos_venta: num(vkM[f]?.kilos),
            });
        }
        const dHoy = serie[serie.length - 1];
        const dAyer = serie[serie.length - 2];

        // Préstamos: como en la pantalla de Préstamos, son de la persona (compartida entre bodegas),
        // no de la bodega; los anteriores al 19/10/2026 ni siquiera tienen bodega_id.
        let prestamos = null;
        if (ROLES_PRESTAMOS.includes(req.user?.rol)) {
            const [recs, emps] = await Promise.all([
                q(`SELECT r.id, r.nombre, SUM(p.monto - COALESCE(p.abonado,0)) saldo FROM PrestamoRecicladors p
                     JOIN Recicladors r ON r.id = p.reciclador_id
                    WHERE p.pagado = 0 AND p.monto > COALESCE(p.abonado,0) GROUP BY r.id, r.nombre`),
                q(`SELECT e.id, e.nombre, SUM(p.monto - COALESCE(p.abonado,0)) saldo FROM PrestamoEmpleados p
                     JOIN Empleados e ON e.id = p.empleado_id
                    WHERE p.descontado = 0 AND p.monto > COALESCE(p.abonado,0) GROUP BY e.id, e.nombre`),
            ]);
            const todos = [
                ...recs.map(p => ({ nombre: p.nombre, tipo: 'Reciclador', saldo: num(p.saldo) })),
                ...emps.map(p => ({ nombre: p.nombre, tipo: 'Empleado', saldo: num(p.saldo) })),
            ].sort((a, b) => b.saldo - a.saldo);
            prestamos = { total: todos.reduce((s, p) => s + p.saldo, 0), personas: todos.length, top: todos.slice(0, 5) };
        }

        res.json({
            ok: true, hoy, desde, dias, bodega_id: bodega,
            kpis: {
                compras_hoy: dHoy.compras, compras_ayer: dAyer.compras, num_compras_hoy: dHoy.num_compras,
                ventas_hoy: dHoy.ventas, ventas_ayer: dAyer.ventas, num_ventas_hoy: dHoy.num_ventas,
                kilos_hoy: dHoy.kilos_compra, kilos_ayer: dAyer.kilos_compra, kilos_venta_hoy: dHoy.kilos_venta,
            },
            serie,
            materiales: materiales.map(m => ({ nombre: m.nombre, categoria: m.categoria, kilos: num(m.kilos), valor: num(m.valor) })),
            top_recicladores: top.map(r => ({ nombre: r.nombre, kilos: num(r.kilos), valor: num(r.valor), compras: num(r.compras) })),
            cajas: cajas.map(k => ({
                bodega_id: k.bodega_id, bodega: k.nombre, existe: !!k.caja_id, abierta: !!k.caja_id && k.estado === 'abierta',
                base: num(k.saldo_inicial), ingresos: num(k.total_ingresos), egresos: num(k.total_egresos), saldo: num(k.saldo_final),
                base_confirmada: !!k.base_confirmada,
            })),
            gastos_vehiculos: { total: gastos.reduce((s, g) => s + num(g.total), 0), por_tipo: gastos.map(g => ({ tipo: g.tipo, total: num(g.total) })) },
            prestamos,
        });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};
