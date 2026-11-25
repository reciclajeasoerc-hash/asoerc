// ── Mantenimiento TEMPORAL (incidente 25/11/2026: disco de MySQL lleno) ──────────
// Permite descargar las copias de la tabla `respaldos` y un volcado completo, y luego
// liberar el espacio. Solo responde si existe la variable MANTENIMIENTO_TOKEN (≥ 40
// caracteres) y la petición trae la misma clave en el encabezado x-mantenimiento.
// Sin la variable, todas estas rutas responden 404. Se quita al terminar el incidente.
const express = require('express');
const crypto = require('crypto');
const zlib = require('zlib');
const sequelize = require('../config/db');

const router = express.Router();

router.use((req, res, next) => {
    const esperado = process.env.MANTENIMIENTO_TOKEN || '';
    const dado = String(req.headers['x-mantenimiento'] || '');
    const ok = esperado.length >= 40 && dado.length === esperado.length &&
        crypto.timingSafeEqual(Buffer.from(dado), Buffer.from(esperado));
    if (!ok) return res.status(404).json({ ok: false, msg: 'No encontrado' });
    next();
});

const q = async (sql, replacements) => (await sequelize.query(sql, { replacements }))[0];

// Cuánto ocupa cada tabla, copias guardadas y binlogs
router.get('/espacio', async (req, res) => {
    try {
        const tablas = await q(`SELECT table_name t, ROUND((data_length+index_length)/1048576,1) mb, ROUND(data_free/1048576,1) libre_mb, table_rows filas
            FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY (data_length+index_length) DESC`);
        const respaldos = await q('SELECT fecha, LENGTH(contenido) bytes FROM respaldos ORDER BY fecha');
        let binlogs = null;
        try { const b = await q('SHOW BINARY LOGS'); binlogs = { archivos: b.length, mb: Math.round(b.reduce((a, x) => a + Number(x.File_size), 0) / 1048576) }; }
        catch (e) { binlogs = { error: e.message }; }
        const vars = (await q('SELECT @@innodb_file_per_table fpt, @@binlog_expire_logs_seconds exp, @@log_bin logbin, CURRENT_USER() usuario'))[0];
        res.json({ ok: true, tablas, respaldos, binlogs, vars });
    } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// Una copia de la tabla respaldos (tal cual: el JSON guardado ese día), comprimida
router.get('/respaldos/:fecha', async (req, res) => {
    try {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.fecha)) return res.status(400).json({ ok: false, msg: 'fecha AAAA-MM-DD' });
        const [fila] = await q('SELECT contenido FROM respaldos WHERE fecha = ?', [req.params.fecha]);
        if (!fila) return res.status(404).json({ ok: false, msg: 'Sin copia ese día' });
        res.setHeader('Content-Type', 'application/gzip');
        res.end(zlib.gzipSync(Buffer.from(fila.contenido || '', 'utf8')));
    } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// Volcado completo de la base ACTUAL (todas las tablas menos respaldos), comprimido
router.get('/volcado', async (req, res) => {
    try {
        const tablas = await q('SHOW TABLES');
        const key = Object.keys(tablas[0] || {})[0];
        const data = {};
        for (const row of tablas) {
            const t = row[key];
            if (!t || t === 'respaldos') continue;
            data[t] = await q(`SELECT * FROM \`${t}\``);
        }
        // Estructura de cada tabla, para poder reconstruirla
        const estructura = {};
        for (const t of Object.keys(data)) estructura[t] = (await q(`SHOW CREATE TABLE \`${t}\``))[0]['Create Table'];
        res.setHeader('Content-Type', 'application/gzip');
        res.end(zlib.gzipSync(Buffer.from(JSON.stringify({ generado: new Date().toISOString(), estructura, data }), 'utf8')));
    } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// Liberar espacio: vaciar respaldos (TRUNCATE devuelve el archivo al disco) y purgar binlogs
router.post('/limpiar', async (req, res) => {
    const r = {};
    try { await q('TRUNCATE TABLE respaldos'); r.respaldos = 'vaciada'; } catch (e) { r.respaldos = 'error: ' + e.message; }
    try { await q('PURGE BINARY LOGS BEFORE NOW()'); r.binlogs = 'purgados'; } catch (e) { r.binlogs = 'error: ' + e.message; }
    res.json({ ok: true, ...r });
});

// Con el disco lleno, TRUNCATE falla ("Create tablespace failed, disk is full") porque crea
// un archivo nuevo antes de soltar el viejo. DROP suelta el archivo sin crear nada; luego se
// vuelve a crear la tabla vacía (ya hay espacio). Solo después de descargar las copias.
router.post('/soltar-respaldos', async (req, res) => {
    const r = {};
    try { await q('DROP TABLE IF EXISTS respaldos'); r.drop = 'ok'; } catch (e) { r.drop = 'error: ' + e.message; }
    try { await q('CREATE TABLE IF NOT EXISTS respaldos (fecha DATE PRIMARY KEY, contenido LONGTEXT, created_at DATETIME)'); r.create = 'ok'; } catch (e) { r.create = 'error: ' + e.message; }
    res.json({ ok: !String(r.drop).startsWith('error'), ...r });
});

// Prueba de escritura real en Compras sin dejar rastro (transacción que se deshace)
router.post('/probar-escritura', async (req, res) => {
    const t = await sequelize.transaction();
    try {
        await sequelize.query(`INSERT INTO Compras (reciclador_id, bodega_id, fecha, total, neto, estado, createdAt, updatedAt)
            SELECT r.id, b.id, CURDATE(), 0, 0, 'borrador', NOW(), NOW() FROM Recicladors r, Bodegas b LIMIT 1`, { transaction: t });
        await t.rollback();
        res.json({ ok: true, msg: 'Compras acepta registros (prueba deshecha)' });
    } catch (e) { await t.rollback().catch(() => {}); res.json({ ok: false, msg: e.message }); }
});

module.exports = router;
