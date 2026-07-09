const https = require('https');
const http  = require('http');

// Estado en memoria. valida=null = aún no se sabe (arranque).
let estadoLicencia = {
    valida: null, checkedAt: 0, diasRestantes: 0, pagoUrl: '', suscripcionActiva: false,
    ultimoOkAt: 0, fallosConfirmados: 0
};
const CACHE_MS            = 60 * 60 * 1000;          // re-verificar cada 1 hora
const GRACIA_TRAS_OK_MS   = 3 * 24 * 60 * 60 * 1000; // 3 días de gracia tras la última verificación válida
const FALLOS_PARA_BLOQUEAR = 3;                      // exige 3 "inválido" confirmados seguidos antes de bloquear

// Devuelve { status, json } o null si el servidor es inalcanzable / no responde.
function fetchLicencia() {
    return new Promise((resolve) => {
        const url = `${process.env.LICENSE_SERVER_URL}/api/pagos/mp/validar/${process.env.LICENSE_KEY}`;
        const mod = url.startsWith('https') ? https : http;
        const req = mod.get(url, { timeout: 8000 }, (res) => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => {
                let json = null;
                try { json = JSON.parse(raw); } catch { json = null; }
                resolve({ status: res.statusCode, json });
            });
        });
        req.on('error',   () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

// Interpreta la respuesta en 3 estados, NUNCA bloquea por errores del servidor:
//  'valida'      -> el servidor confirma que la licencia está activa
//  'invalida'    -> el servidor confirma CLARAMENTE (con forma de estado de licencia) que venció
//  'desconocido' -> inalcanzable, 404/5xx, cuerpo raro/de error → no se puede afirmar nada
function interpretar(resp) {
    if (!resp || resp.json === null) return 'desconocido';          // inalcanzable / no-JSON
    if (resp.status && resp.status >= 400) return 'desconocido';    // 404/5xx = problema del servidor de licencias, no del cliente
    const d = resp.json;
    // Cualquier señal positiva = válida (tolerante a distintos nombres de campo)
    if (d.ok === true || d.valida === true || d.suscripcion_activa === true || Number(d.dias_restantes) > 0) return 'valida';
    // Inválida SOLO si la respuesta tiene forma de estado de licencia y dice explícitamente que no.
    const esEstadoLicencia = ('dias_restantes' in d) || ('fecha_vencimiento' in d) || ('suscripcion_activa' in d) || ('pago_url' in d);
    if (esEstadoLicencia && (d.ok === false || d.valida === false)) return 'invalida';
    return 'desconocido'; // p.ej. {status:'error',code:404,message:'Application not found'}
}

async function refrescarSiNecesario() {
    const ahora = Date.now();
    if (ahora - estadoLicencia.checkedAt < CACHE_MS && estadoLicencia.valida !== null) return;

    const resp = await fetchLicencia();
    const veredicto = interpretar(resp);
    estadoLicencia.checkedAt = ahora;

    if (veredicto === 'valida') {
        const d = resp.json;
        estadoLicencia.valida             = true;
        estadoLicencia.ultimoOkAt         = ahora;
        estadoLicencia.fallosConfirmados  = 0;
        estadoLicencia.diasRestantes      = Number(d.dias_restantes) || 0;
        estadoLicencia.pagoUrl            = d.pago_url || '';
        estadoLicencia.suscripcionActiva  = d.suscripcion_activa || false;
        return;
    }

    if (veredicto === 'invalida') {
        const d = resp.json;
        estadoLicencia.diasRestantes     = Number(d.dias_restantes) || 0;
        estadoLicencia.pagoUrl           = d.pago_url || '';
        estadoLicencia.suscripcionActiva = d.suscripcion_activa || false;
        estadoLicencia.fallosConfirmados++;
        // No bloquear si estuvo válida hace poco (gracia) ni ante un solo reporte negativo.
        const dentroDeGracia = estadoLicencia.ultimoOkAt && (ahora - estadoLicencia.ultimoOkAt < GRACIA_TRAS_OK_MS);
        if (estadoLicencia.fallosConfirmados >= FALLOS_PARA_BLOQUEAR && !dentroDeGracia) {
            estadoLicencia.valida = false;
            console.warn(`⚠️  LICENCIA VENCIDA confirmada (${d.fecha_vencimiento || 's/f'})`);
        } else {
            if (estadoLicencia.valida === null) estadoLicencia.valida = true; // arranque: permitir
            console.warn(`⚠️  Licencia reportada inválida (${estadoLicencia.fallosConfirmados}/${FALLOS_PARA_BLOQUEAR})${dentroDeGracia ? ' — en periodo de gracia, no se bloquea' : ''}`);
        }
        return;
    }

    // 'desconocido' → FAIL-OPEN: jamás bloquear por un error/caída del servidor de licencias.
    estadoLicencia.fallosConfirmados = 0;
    if (estadoLicencia.valida === null) estadoLicencia.valida = true;
    console.warn('⚠️  No se pudo verificar licencia (inalcanzable/404/cuerpo inválido) — se permite el acceso (fail-open)');
}

// Verificar licencia al arrancar y cada hora
async function iniciarVerificacion() {
    await refrescarSiNecesario();
    setInterval(refrescarSiNecesario, CACHE_MS);
}

// Middleware para rutas de API
async function verificarLicencia(req, res, next) {
    // Siempre permitir login, health, setup y configuracion pública
    if (req.path === '/auth/login' ||
        req.path === '/health' ||
        req.path.startsWith('/setup') ||
        req.path === '/configuracion') return next();

    await refrescarSiNecesario();

    // Solo bloquea si está CONFIRMADO como inválido (valida === false). null/true → pasa.
    if (estadoLicencia.valida !== false) return next();

    res.status(403).json({
        ok:      false,
        licencia: false,
        msg:     'Licencia vencida. Renueve su suscripción para continuar.',
        pago_url: estadoLicencia.pagoUrl,
        dias:    estadoLicencia.diasRestantes
    });
}

// Endpoint interno para que el frontend sepa el estado
// Siempre espera la primera verificación antes de responder
async function estadoEndpoint(req, res) {
    if (req.query.force === '1') { estadoLicencia.checkedAt = 0; estadoLicencia.fallosConfirmados = 0; }
    await refrescarSiNecesario(); // garantiza que siempre hay un resultado real
    res.json({
        valida:            estadoLicencia.valida,
        diasRestantes:     estadoLicencia.diasRestantes,
        suscripcionActiva: estadoLicencia.suscripcionActiva,
        pagoUrl:           estadoLicencia.pagoUrl
    });
}

module.exports = { iniciarVerificacion, verificarLicencia, estadoEndpoint };
