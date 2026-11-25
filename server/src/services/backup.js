// Respaldo automático diario de la base de datos (snapshot JSON en la tabla `respaldos`).
// Da un punto de recuperación por si algo corrompe la data.
//
// OJO (incidente 25/11/2026): cada copia es la base COMPLETA y vive en el mismo disco que la
// base. Con 30 copias + los binlogs de MySQL el volumen de Railway se llenó y MySQL respondió
// "The table 'Compras' is full": nadie podía abrir cuentas. Por eso ahora:
//   - se conservan solo DIAS_RETENER copias, y las viejas se borran ANTES de escribir la nueva;
//   - al arrancar no se vuelve a copiar si ya hay copia de hoy (cada despliegue sumaba una);
//   - se purgan los binlogs viejos (si el usuario de la BD tiene permiso; si no, se ignora).
// El respaldo de verdad, fuera del servidor, es el que el bot manda por Telegram.
const sequelize = require('../config/db');
const EXCLUIR = ['respaldos', 'SequelizeMeta'];
const DIAS_RETENER = 3;

async function hacerRespaldo(origen = 'cron') {
    try {
        const fecha = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
        if (origen === 'arranque') {
            const [[ya]] = await sequelize.query('SELECT COUNT(*) n FROM respaldos WHERE fecha = ?', { replacements: [fecha] });
            if (Number(ya?.n) > 0) { console.log(`  [Respaldo] ya hay copia de ${fecha}; no se repite al arrancar`); return; }
        }
        // Primero liberar: borrar las viejas (y la de hoy, que se reemplaza) antes de escribir.
        // Con la fecha de Bogotá (MySQL en Railway va en UTC: con CURDATE() de 0 a 5 a. m. se borraba una de más).
        await sequelize.query(`DELETE FROM respaldos WHERE fecha < DATE_SUB(?, INTERVAL ${DIAS_RETENER - 1} DAY) OR fecha = ?`, { replacements: [fecha, fecha] });
        await sequelize.query('PURGE BINARY LOGS BEFORE DATE_SUB(NOW(), INTERVAL 1 DAY)')
            .catch(e => console.warn('  [Respaldo] no se pudieron purgar los binlogs:', e.message));
        const [tablas] = await sequelize.query('SHOW TABLES');
        const key = Object.keys(tablas[0] || {})[0];
        const data = {};
        for (const row of tablas) {
            const t = row[key];
            if (!t || EXCLUIR.includes(t)) continue;
            try { const [rows] = await sequelize.query(`SELECT * FROM \`${t}\``); data[t] = rows; } catch { /* tabla ilegible: se omite */ }
        }
        const contenido = JSON.stringify(data);
        await sequelize.query('INSERT INTO respaldos (fecha, contenido, created_at) VALUES (?, ?, NOW())', { replacements: [fecha, contenido] });
        console.log(`  [Respaldo] ✅ ${fecha} (${(contenido.length / 1024).toFixed(0)} KB) [${origen}]`);
    } catch (e) {
        console.error('  [Respaldo] error:', e.message);
    }
}

function initBackup() {
    console.log('  [Respaldo] Programado: diario + al arrancar');
    setTimeout(() => hacerRespaldo('arranque'), 20000);       // uno poco después de cada arranque
    setInterval(() => hacerRespaldo('cron'), 24 * 60 * 60 * 1000); // y cada 24h
}

module.exports = { initBackup, hacerRespaldo };
