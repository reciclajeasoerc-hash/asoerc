// Helpers de caja SEGUROS ante concurrencia (varias personas registrando a la vez).
const { Caja, MovimientoCaja } = require('../models');

// Recalcula los totales de la caja DESDE sus movimientos (no lee-modifica-escribe → no se pierde nada).
// Llamar SIEMPRE después de crear un MovimientoCaja.
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

// Obtiene (o crea) la caja del día de una bodega SIN duplicar aunque dos peticiones lleguen a la vez.
// Requiere el índice único (bodega_id, fecha) para ser 100% seguro (findOrCreate se apoya en él).
async function obtenerCajaDia(bodega_id, fecha) {
    const anterior = await Caja.findOne({ where: { bodega_id }, order: [['fecha', 'DESC']] });
    const [caja] = await Caja.findOrCreate({
        where: { bodega_id, fecha },
        defaults: { saldo_inicial: anterior ? parseFloat(anterior.saldo_final) : 0, estado: 'abierta' },
    });
    return caja;
}

module.exports = { recalcularCaja, obtenerCajaDia };
