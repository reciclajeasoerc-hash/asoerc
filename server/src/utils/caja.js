// Helpers de caja SEGUROS ante concurrencia (varias personas registrando a la vez).
const sequelize = require('../config/db');
const { Op } = require('sequelize');
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
    // Base sugerida = lo que quedó en la caja del día ANTERIOR a esta fecha (no la última que
    // exista: una compra con fecha pasada no puede heredar el saldo de un día posterior).
    // Plata física no puede ser negativa: si el día anterior cerró en rojo (se registraron
    // compras sin registrar la base), el día nuevo arranca en 0 y la administradora confirma
    // la base real. Antes se arrastraba el negativo y se iba acumulando día tras día.
    const anterior = await Caja.findOne({ where: { bodega_id, fecha: { [Op.lt]: fecha } }, order: [['fecha', 'DESC']] });
    const previo = anterior ? parseFloat(anterior.saldo_final) || 0 : 0;
    const saldo = previo > 0 ? previo : 0;
    await sequelize.query(
        `INSERT IGNORE INTO Cajas (bodega_id, fecha, saldo_inicial, total_ingresos, total_egresos, saldo_final, estado, createdAt, updatedAt)
         VALUES (?, ?, ?, 0, 0, ?, 'abierta', NOW(), NOW())`,
        { replacements: [bodega_id, fecha, saldo, saldo] }
    );
    return await Caja.findOne({ where: { bodega_id, fecha } });
}

// Suma UN monto a la caja de forma ATÓMICA y O(1) (un solo UPDATE de una fila, con la fila
// bloqueada solo ese instante). Es lo que se usa en el camino caliente (tras el commit):
// rápido y a prueba de carreras aunque haya 50 a la vez.
async function sumarEnCaja(caja_id, tipo, monto) {
    const campo = tipo === 'ingreso' ? 'total_ingresos' : 'total_egresos';
    await sequelize.query(
        `UPDATE Cajas SET ${campo} = ${campo} + ?, saldo_final = saldo_inicial + total_ingresos - total_egresos WHERE id = ?`,
        { replacements: [monto, caja_id] }
    );
}

// ── Plata que sale del cajón por algo que NO es una compra (préstamos, gastos de vehículo) ──

// De qué bodega sale la plata: la del usuario; el superadmin la elige (bodega_id del cuerpo).
function bodegaDeLaOperacion(user, body) {
    if (user?.rol === 'superadmin') {
        const b = parseInt(body?.bodega_id);
        if (!b) { const e = new Error('Elige de qué bodega sale la plata'); e.status = 400; throw e; }
        return b;
    }
    if (!user?.bodega_id) { const e = new Error('Tu usuario no tiene bodega asignada. Pide al superadministrador que te asigne una.'); e.status = 403; throw e; }
    return user.bodega_id;
}

// Caja del día donde se va a registrar la salida. Se llama ANTES de abrir la transacción
// (igual que en compras). Si esa caja ya está cerrada, no se mete plata por detrás.
async function cajaParaEgreso(bodega_id, fecha) {
    const caja = await obtenerCajaDia(bodega_id, fecha);
    if (caja.estado === 'cerrada') {
        const e = new Error(`La caja del ${fecha} ya está cerrada. Reábrela para registrar esta salida.`); e.status = 400; throw e;
    }
    return caja;
}

// Crea el movimiento de egreso dentro de la transacción de quien llama. Después del commit,
// quien llama hace sumarEnCaja(caja.id, 'egreso', monto).
async function crearEgreso(caja, { concepto, monto, referencia }, t) {
    // Se vuelve a mirar la caja DENTRO de la transacción y con la fila bloqueada: si alguien
    // la cerró entre la revisión previa y este momento, no entra la salida.
    const fila = await Caja.findByPk(caja.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!fila || fila.estado === 'cerrada') {
        const e = new Error(`La caja del ${caja.fecha} ya está cerrada. Reábrela para registrar esta salida.`); e.status = 400; throw e;
    }
    const hora = new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour12: false });
    return MovimientoCaja.create({ caja_id: caja.id, tipo: 'egreso', concepto, monto, hora, referencia }, { transaction: t });
}

// Quita los movimientos de una referencia (p. ej. al borrar un gasto) y recalcula sus cajas.
async function quitarMovimientos(referencia, t) {
    const movs = await MovimientoCaja.findAll({ where: { referencia }, transaction: t });
    const cajas = [...new Set(movs.map(m => m.caja_id))];
    await MovimientoCaja.destroy({ where: { referencia }, transaction: t });
    return cajas;
}

module.exports = { recalcularCaja, obtenerCajaDia, sumarEnCaja, bodegaDeLaOperacion, cajaParaEgreso, crearEgreso, quitarMovimientos };
