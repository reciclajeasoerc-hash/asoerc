// Helpers de caja SEGUROS ante concurrencia (varias personas registrando a la vez).
const sequelize = require('../config/db');
const { Caja, MovimientoCaja } = require('../models');

// Recalcula los totales de la caja DESDE sus movimientos (no lee-modifica-escribe → no se pierde nada).
async function recalcularCaja(caja_id) {
    const ingresos = (await MovimientoCaja.sum('monto', { where: { caja_id, tipo: 'ingreso' } })) || 0;
    const egresos  = (await MovimientoCaja.sum('monto', { where: { caja_id, tipo: 'egreso' } })) || 0;
    const caja = await Caja.findByPk(caja_id);
    if (!caja) return;
    await caja.update({
        total_ingresos: ingresos,
        total_egresos: egresos,
        saldo_final: parseFloat(caja.saldo_inicial) + ingresos - egresos,
    });
}

// Obtiene (o crea) la caja del día de una bodega SIN duplicar ni deadlockear aunque lleguen
// muchas peticiones a la vez. Usa INSERT IGNORE (se apoya en el índice único bodega_id+fecha):
// si ya existe, no hace nada; si no, la crea. Luego la lee.
async function obtenerCajaDia(bodega_id, fecha) {
    const anterior = await Caja.findOne({ where: { bodega_id }, order: [['fecha', 'DESC']] });
    const saldo = anterior ? parseFloat(anterior.saldo_final) : 0;
    await sequelize.query(
        `INSERT IGNORE INTO Cajas (bodega_id, fecha, saldo_inicial, total_ingresos, total_egresos, saldo_final, estado, createdAt, updatedAt)
         VALUES (?, ?, ?, 0, 0, ?, 'abierta', NOW(), NOW())`,
        { replacements: [bodega_id, fecha, saldo, saldo] }
    );
    return await Caja.findOne({ where: { bodega_id, fecha } });
}

module.exports = { recalcularCaja, obtenerCajaDia };
