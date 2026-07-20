// Helpers de caja SEGUROS ante concurrencia (varias personas registrando a la vez).
const sequelize = require('../config/db');
const { Caja, MovimientoCaja } = require('../models');

// Recalcula los totales de la caja DESDE sus movimientos, en UN SOLO UPDATE atómico:
// la suma se evalúa con la fila bloqueada, así nunca se escribe un total viejo aunque
// haya muchas recalculaciones a la vez (a prueba de carreras y sin trabar la BD).
async function recalcularCaja(caja_id) {
    await sequelize.query(
        `UPDATE Cajas c SET
            total_ingresos = (SELECT COALESCE(SUM(monto),0) FROM MovimientoCajas WHERE caja_id = c.id AND tipo='ingreso'),
            total_egresos  = (SELECT COALESCE(SUM(monto),0) FROM MovimientoCajas WHERE caja_id = c.id AND tipo='egreso'),
            saldo_final    = c.saldo_inicial
                           + (SELECT COALESCE(SUM(monto),0) FROM MovimientoCajas WHERE caja_id = c.id AND tipo='ingreso')
                           - (SELECT COALESCE(SUM(monto),0) FROM MovimientoCajas WHERE caja_id = c.id AND tipo='egreso')
         WHERE c.id = ?`,
        { replacements: [caja_id] }
    );
}

// Obtiene (o crea) la caja del día de una bodega SIN duplicar ni deadlockear aunque lleguen
// muchas peticiones a la vez. Usa INSERT IGNORE (se apoya en el índice único bodega_id+fecha):
// si ya existe, no hace nada; si no, la crea. Luego la lee.
async function obtenerCajaDia(bodega_id, fecha) {
    // BUSCA primero (sin lock): si ya existe la caja del día, la devuelve sin intentar insertar
    // → cero contención en el caso normal (la caja se crea una vez al día).
    let caja = await Caja.findOne({ where: { bodega_id, fecha } });
    if (caja) return caja;
    // No existe: la crea con INSERT IGNORE (índice único evita duplicados si dos la crean a la vez).
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
