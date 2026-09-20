const https = require('https');
const http  = require('http');

// Estado en memoria. valida=null = aún no se sabe (arranque).
let estadoLicencia = {
    valida: null, checkedAt: 0, diasRestantes: 0, pagoUrl: '', suscripcionActiva: false,
    ultimoOkAt: 0, fallosConfirmados: 0
};
const CACHE_MS          = 60 * 60 * 1000;   // todo normal: re-verificar cada hora
const CACHE_DUDOSO_MS   = 5 * 60 * 1000;    // el servidor dijo "inválida": confirmar cada 5 minutos
const FALLOS_PARA_BLOQUEAR = 2;             // dos negativas seguidas antes de apagar por vencimiento

// Antes había además 3 días de gracia tras la última verificación válida, y se
// aplicaban TAMBIÉN cuando el servidor respondía claramente "esta licencia está
// inválida". Eso hacía imposible cortarle el servicio a un cliente moroso: la
// plataforma decía "bloqueada" y el sistema seguía funcionando 3 días más.
//
// La gracia existía para que una caída del servidor de licencias no apagara a un
// cliente que sí paga. Ese caso ya está cubierto por el fail-open del veredicto
// 'desconocido', que nunca bloquea. Una respuesta explícita de "inválida" no es
// una falla: es una decisión del dueño, y debe obedecerse.

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
// ¿El dueño desactivó la licencia a mano? La plataforma lo dice en `estado`.
// Eso es una orden explícita, no un vencimiento: se obedece de inmediato.
function esDesactivacionManual(resp) {
    return !!(resp && resp.json && resp.json.estado === 'desactivada');
}

function interpretar(resp) {
    if (!resp || resp.json === null) return 'desconocido';          // inalcanzable / no-JSON
    if (resp.status && resp.status >= 400) return 'desconocido';    // 404/5xx = problema del servidor de licencias, no del cliente
    const d = resp.json;
    const esEstadoLicencia = ('dias_restantes' in d) || ('fecha_vencimiento' in d) || ('suscripcion_activa' in d) || ('pago_url' in d);

    // La negativa EXPLÍCITA manda sobre cualquier otra señal. Antes se miraba
    // primero `dias_restantes > 0`, así que desactivar a mano una licencia que
    // todavía no vencía no surtía efecto: el sistema la leía como válida.
    if (esEstadoLicencia && (d.ok === false || d.valida === false)) return 'invalida';

    // Señal positiva (tolerante a distintos nombres de campo)
    if (d.ok === true || d.valida === true || d.suscripcion_activa === true || Number(d.dias_restantes) > 0) return 'valida';

    return 'desconocido'; // p.ej. {status:'error',code:404,message:'Application not found'}
}

async function refrescarSiNecesario() {
    const ahora = Date.now();
    // Si la última respuesta fue negativa, se re-consulta mucho más seguido para
    // confirmar rápido; mientras todo va bien, basta una vez por hora.
    const espera = estadoLicencia.fallosConfirmados > 0 ? CACHE_DUDOSO_MS : CACHE_MS;
    if (ahora - estadoLicencia.checkedAt < espera && estadoLicencia.valida !== null) return;

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

        // Desactivación a mano: el dueño apretó el botón. Se obedece ya.
        if (esDesactivacionManual(resp)) {
            estadoLicencia.valida = false;
            console.warn('⛔ Licencia DESACTIVADA por el proveedor — acceso bloqueado');
            return;
        }

        // Vencimiento: se exige una segunda confirmación para no apagar a nadie
        // por una respuesta rara de una sola vez.
        if (estadoLicencia.fallosConfirmados >= FALLOS_PARA_BLOQUEAR) {
            estadoLicencia.valida = false;
            console.warn(`⛔ LICENCIA VENCIDA confirmada (${d.fecha_vencimiento || 's/f'}) — acceso bloqueado`);
        } else {
            if (estadoLicencia.valida === null) estadoLicencia.valida = true; // arranque: permitir
            console.warn(`⚠️  Licencia reportada inválida (${estadoLicencia.fallosConfirmados}/${FALLOS_PARA_BLOQUEAR}) — se confirma en ${CACHE_DUDOSO_MS / 60000} min`);
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
    // force=1 salta el caché para responder al instante, pero NO borra las
    // confirmaciones negativas: si las borrara, el contador nunca llegaría al
    // umbral y una licencia vencida jamás se bloquearía (el propio frontend
    // consulta con force=1).
    if (req.query.force === '1') estadoLicencia.checkedAt = 0;
    await refrescarSiNecesario(); // garantiza que siempre hay un resultado real
    res.json({
        valida:            estadoLicencia.valida,
        diasRestantes:     estadoLicencia.diasRestantes,
        suscripcionActiva: estadoLicencia.suscripcionActiva,
        pagoUrl:           estadoLicencia.pagoUrl,
        // Útil para diagnosticar por qué sigue (o no) disponible el sistema
        confirmacionesNegativas: estadoLicencia.fallosConfirmados,
        ultimaVerificacion: estadoLicencia.checkedAt ? new Date(estadoLicencia.checkedAt).toISOString() : null
    });
}

module.exports = { iniciarVerificacion, verificarLicencia, estadoEndpoint };
