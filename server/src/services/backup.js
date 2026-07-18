// Respaldo automático diario de la base de datos (snapshot JSON en la tabla `respaldos`).
// Da un punto de recuperación por si algo corrompe la data. Conserva 30 días.
const sequelize = require('../config/db');
const EXCLUIR = ['respaldos', 'SequelizeMeta'];

async function hacerRespaldo(origen = 'cron') {
    try {
        const [tablas] = await sequelize.query('SHOW TABLES');
        const key = Object.keys(tablas[0] || {})[0];
        const data = {};
        for (const row of tablas) {
            const t = row[key];
            if (!t || EXCLUIR.includes(t)) continue;
            try { const [rows] = await sequelize.query(`SELECT * FROM \`${t}\``); data[t] = rows; } catch { /* tabla ilegible: se omite */ }
        }
        const contenido = JSON.stringify(data);
        const fecha = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
        await sequelize.query('DELETE FROM respaldos WHERE fecha = ?', { replacements: [fecha] });
        await sequelize.query('INSERT INTO respaldos (fecha, contenido, created_at) VALUES (?, ?, NOW())', { replacements: [fecha, contenido] });
        await sequelize.query('DELETE FROM respaldos WHERE fecha < DATE_SUB(CURDATE(), INTERVAL 30 DAY)').catch(() => {});
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
