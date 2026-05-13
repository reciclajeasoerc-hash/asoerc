const https = require('https');
const http  = require('http');

let estadoLicencia = { valida: null, checkedAt: 0, diasRestantes: 0, pagoUrl: '' };
const CACHE_MS = 60 * 60 * 1000; // re-verificar cada 1 hora

function fetchLicencia() {
    return new Promise((resolve) => {
        const url = `${process.env.LICENSE_SERVER_URL}/api/pagos/mp/validar/${process.env.LICENSE_KEY}`;
        const mod = url.startsWith('https') ? https : http;
        const req = mod.get(url, { timeout: 8000 }, (res) => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => {
                try { resolve(JSON.parse(raw)); } catch { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

async function refrescarSiNecesario() {
    const ahora = Date.now();
    if (ahora - estadoLicencia.checkedAt < CACHE_MS && estadoLicencia.valida !== null) return;
    const data = await fetchLicencia();
    if (data) {
        estadoLicencia = {
            valida:          data.ok === true,
            checkedAt:       ahora,
            diasRestantes:   data.dias_restantes || 0,
            pagoUrl:         data.pago_url || '',
            suscripcionActiva: data.suscripcion_activa || false
        };
        if (!estadoLicencia.valida) {
            console.warn(`⚠️  LICENCIA VENCIDA — ${data.fecha_vencimiento}`);
        }
    } else {
        // Si no se puede contactar el servidor, permitir acceso con advertencia (grace period)
        if (estadoLicencia.valida === null) estadoLicencia.valida = true;
        estadoLicencia.checkedAt = ahora;
        console.warn('⚠️  No se pudo verificar licencia — usando caché');
    }
}

// Verificar licencia al arrancar y cada hora
async function iniciarVerificacion() {
    await refrescarSiNecesario();
    setInterval(refrescarSiNecesario, CACHE_MS);
}

// Middleware para rutas de API
async function verificarLicencia(req, res, next) {
    // Siempre permitir login y health
    if (req.path === '/auth/login' || req.path === '/health') return next();

    await refrescarSiNecesario();

    if (estadoLicencia.valida) return next();

    res.status(403).json({
        ok:      false,
        licencia: false,
        msg:     'Licencia vencida. Renueve su suscripción para continuar.',
        pago_url: estadoLicencia.pagoUrl,
        dias:    estadoLicencia.diasRestantes
    });
}

// Endpoint interno para que el frontend sepa el estado
function estadoEndpoint(req, res) {
    res.json({
        valida:            estadoLicencia.valida,
        diasRestantes:     estadoLicencia.diasRestantes,
        suscripcionActiva: estadoLicencia.suscripcionActiva,
        pagoUrl:           estadoLicencia.pagoUrl
    });
}

module.exports = { iniciarVerificacion, verificarLicencia, estadoEndpoint };
