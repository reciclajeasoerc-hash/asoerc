const { Compra, CompraItem, Venta, VentaItem, Material, Reciclador, Cliente, Bodega } = require('../models');
const { Op } = require('sequelize');

exports.dashboard = async (req, res) => {
    try {
        const { bodega_id } = req.query;
        const hoy = require("../utils/fecha").hoy();
        const whereCompra = { fecha: hoy, estado: 'finalizada' };
        const whereVenta  = { fecha: hoy };
        if (bodega_id) { whereCompra.bodega_id = bodega_id; whereVenta.bodega_id = bodega_id; }

        const compras = await Compra.findAll({ where: whereCompra, include: [{ model: CompraItem, as: 'items' }, { model: Reciclador, as: 'reciclador' }] });
        const ventas  = await Venta.findAll({ where: whereVenta,  include: [{ model: VentaItem,  as: 'items' }] });

        const totalComprasKg   = compras.reduce((s, c) => s + c.items.reduce((a, i) => a + parseFloat(i.kilos), 0), 0);
        const totalComprasPesos = compras.reduce((s, c) => s + parseFloat(c.neto), 0);
        const totalVentasKg    = ventas.reduce((s, v) => s + v.items.reduce((a, i) => a + parseFloat(i.kilos), 0), 0);
        const totalVentasPesos  = ventas.reduce((s, v) => s + parseFloat(v.total), 0);

        res.json({ ok: true, hoy,
            compras: { cantidad: compras.length, kilos: totalComprasKg, pesos: totalComprasPesos },
            ventas:  { cantidad: ventas.length,  kilos: totalVentasKg,  pesos: totalVentasPesos  }
        });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.comprasPorPeriodo = async (req, res) => {
    try {
        const { desde, hasta, bodega_id } = req.query;
        if (!desde || !hasta) return res.status(400).json({ ok: false, msg: 'desde y hasta son requeridos' });

        const where = { estado: 'finalizada', fecha: { [Op.between]: [desde, hasta] } };
        if (bodega_id) where.bodega_id = bodega_id;

        const compras = await Compra.findAll({
            where,
            include: [
                { model: CompraItem, as: 'items', include: [{ model: Material, as: 'material' }] },
                { model: Reciclador, as: 'reciclador' },
                { model: Bodega, as: 'bodega' }
            ],
            order: [['fecha', 'ASC']]
        });

        // Resumen general
        const total_pagado     = compras.reduce((s, c) => s + parseFloat(c.total || 0), 0);
        const total_kilos      = compras.reduce((s, c) => s + c.items.reduce((a, i) => a + parseFloat(i.kilos || 0), 0), 0);
        const recicladores_ids = new Set(compras.map(c => c.reciclador_id));
        const resumen = { total_pagado, total_compras: compras.length, total_kilos, total_recicladores: recicladores_ids.size };

        // Por material (array)
        const matMap = {};
        for (const c of compras) {
            for (const item of c.items) {
                const n = item.material?.nombre || 'Desconocido';
                if (!matMap[n]) matMap[n] = { material: n, total_kilos: 0, total_pagado: 0 };
                matMap[n].total_kilos  += parseFloat(item.kilos || 0);
                matMap[n].total_pagado += parseFloat(item.total || 0);
            }
        }
        const por_material = Object.values(matMap).map(m => ({
            ...m,
            precio_promedio: m.total_kilos > 0 ? Math.round(m.total_pagado / m.total_kilos) : 0
        })).sort((a, b) => b.total_pagado - a.total_pagado);

        // Por reciclador (array)
        const recMap = {};
        for (const c of compras) {
            const n = c.reciclador?.nombre || 'Sin nombre';
            if (!recMap[n]) recMap[n] = { reciclador: n, total_compras: 0, total_kilos: 0, total_pagado: 0 };
            recMap[n].total_compras++;
            recMap[n].total_kilos  += c.items.reduce((a, i) => a + parseFloat(i.kilos || 0), 0);
            recMap[n].total_pagado += parseFloat(c.total || 0);
        }
        const por_reciclador = Object.values(recMap).sort((a, b) => b.total_pagado - a.total_pagado);

        // Detalle línea a línea para Excel
        const detalle = [];
        for (const c of compras) {
            for (const item of c.items) {
                detalle.push({
                    numero_diario: c.numero_diario || null,
                    fecha: c.fecha,
                    hora: c.updatedAt ? new Date(c.updatedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '',
                    reciclador: c.reciclador?.nombre || 'Sin nombre',
                    codigo: item.material?.codigo || '',
                    material: item.material?.nombre || 'Desconocido',
                    kilos: parseFloat(item.kilos || 0),
                    precio_unitario: parseFloat(item.precio_unitario || 0),
                    total: parseFloat(item.total || 0)
                });
            }
        }

        res.json({ ok: true, resumen, por_material, por_reciclador, detalle });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.certificadoCliente = async (req, res) => {
    try {
        const { cliente_id, desde, hasta } = req.query;
        if (!cliente_id || !desde || !hasta) return res.status(400).json({ ok: false, msg: 'cliente_id, desde y hasta son requeridos' });

        const cliente = await Cliente.findByPk(cliente_id);
        if (!cliente) return res.status(404).json({ ok: false, msg: 'Cliente no encontrado' });

        const ventas = await Venta.findAll({
            where: { cliente_id, fecha: { [Op.between]: [desde, hasta] } },
            include: [{ model: VentaItem, as: 'items', include: [{ model: Material, as: 'material' }] }]
        });

        const matMap = {};
        let total = 0;
        for (const v of ventas) {
            for (const item of v.items) {
                const n = item.material?.nombre || 'Desconocido';
                if (!matMap[n]) matMap[n] = { material: n, kilos: 0, total: 0 };
                matMap[n].kilos += parseFloat(item.kilos || 0);
                matMap[n].total += parseFloat(item.total || 0);
                total += parseFloat(item.total || 0);
            }
        }

        const detalle = Object.values(matMap).map(m => ({
            ...m,
            precio_promedio: m.kilos > 0 ? Math.round(m.total / m.kilos) : 0
        })).sort((a, b) => b.total - a.total);

        res.json({ ok: true, cliente: { nombre: cliente.nombre, nit: cliente.nit || null }, detalle, total, desde, hasta });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};
