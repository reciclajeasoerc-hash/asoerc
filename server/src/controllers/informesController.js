const { Compra, CompraItem, Venta, VentaItem, Material, Reciclador, Bodega } = require('../models');
const { Op } = require('sequelize');

exports.dashboard = async (req, res) => {
    try {
        const { bodega_id } = req.query;
        const hoy = new Date().toISOString().slice(0, 10);
        const whereCompra = { fecha: hoy, estado: 'finalizada' };
        const whereVenta  = { fecha: hoy };
        if (bodega_id) { whereCompra.bodega_id = bodega_id; whereVenta.bodega_id = bodega_id; }

        const compras = await Compra.findAll({ where: whereCompra, include: [{ model: CompraItem, as: 'items' }, { model: Reciclador, as: 'reciclador' }] });
        const ventas  = await Venta.findAll({ where: whereVenta,  include: [{ model: VentaItem,  as: 'items' }] });

        const totalComprasKg  = compras.reduce((s, c) => s + c.items.reduce((a, i) => a + parseFloat(i.kilos), 0), 0);
        const totalComprasPesos= compras.reduce((s, c) => s + parseFloat(c.neto), 0);
        const totalVentasKg   = ventas.reduce((s, v) => s + v.items.reduce((a, i) => a + parseFloat(i.kilos), 0), 0);
        const totalVentasPesos = ventas.reduce((s, v) => s + parseFloat(v.total), 0);

        res.json({ ok: true, hoy, compras: { cantidad: compras.length, kilos: totalComprasKg, pesos: totalComprasPesos }, ventas: { cantidad: ventas.length, kilos: totalVentasKg, pesos: totalVentasPesos } });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.comprasPorPeriodo = async (req, res) => {
    try {
        const { desde, hasta, bodega_id } = req.query;
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
        const totalKilos = compras.reduce((s, c) => s + c.items.reduce((a, i) => a + parseFloat(i.kilos), 0), 0);
        const totalPesos = compras.reduce((s, c) => s + parseFloat(c.total), 0);
        const porMaterial = {};
        for (const c of compras) {
            for (const item of c.items) {
                const n = item.material.nombre;
                if (!porMaterial[n]) porMaterial[n] = { kilos: 0, total: 0 };
                porMaterial[n].kilos += parseFloat(item.kilos);
                porMaterial[n].total += parseFloat(item.total);
            }
        }
        res.json({ ok: true, compras, totalKilos, totalPesos, porMaterial });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.certificadoCliente = async (req, res) => {
    try {
        const { cliente_id, mes, anio } = req.query;
        const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
        const hasta = new Date(anio, mes, 0).toISOString().slice(0, 10);
        const ventas = await Venta.findAll({
            where: { cliente_id, fecha: { [Op.between]: [desde, hasta] } },
            include: [{ model: VentaItem, as: 'items', include: [{ model: Material, as: 'material' }] }]
        });
        const porMaterial = {};
        let totalKilos = 0, totalValor = 0;
        for (const v of ventas) {
            for (const item of v.items) {
                const n = item.material.nombre;
                if (!porMaterial[n]) porMaterial[n] = { kilos: 0, valor: 0 };
                porMaterial[n].kilos += parseFloat(item.kilos);
                porMaterial[n].valor += parseFloat(item.total);
                totalKilos += parseFloat(item.kilos);
                totalValor += parseFloat(item.total);
            }
        }
        res.json({ ok: true, desde, hasta, porMaterial, totalKilos, totalValor });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};
