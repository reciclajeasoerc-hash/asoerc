// Verificación de licencia contra mi-plataforma. Es el modelo de cobro: sin
// esto el sistema es un regalo, no un producto.
//
// VERSIÓN CANÓNICA (2026-10-16). Une lo mejor de las dos que existían y tapa
// un hueco que ninguna cubría. Si se cambia, se cambia en TODOS los sistemas.
//
// Las tres reglas que no se negocian:
//   1. Una caída del servidor de licencias NUNCA apaga a un cliente que paga.
//   2. Una negativa EXPLÍCITA del servidor sí se obedece.
//   3. Si falta la configuración en producción, el sistema NO funciona gratis.
//
// PUBLICAS: rutas que nunca se bloquean. Cada sistema define las suyas —
// revisar los webhooks (WhatsApp/Telegram) antes de copiar esta lista.
const https = require('https');
const http  = require('http');

const PUBLICAS = (process.env.LICENCIA_RUTAS_PUBLICAS || '')
    .split(',').map(s => s.trim()).filter(Boolean);

// Rutas publicas propias del sistema, declaradas desde app.js. Se usa cuando la
// excepcion es una decision de producto y no de despliegue: por ejemplo la
// pantalla del torneo en Boton, que no se puede apagar a mitad de un torneo
// aunque el club deba el mes. Hay que llamarla ANTES de montar las rutas.
function rutasPublicas(...rutas) {
    for (const r of rutas.flat()) if (r) PUBLICAS.push(String(r).trim());
}

let estado = {
    valida: null,            // null = aún no se sabe (arranque)
    checkedAt: 0,
    diasRestantes: 0,
    pagoUrl: '',
    suscripcionActiva: false,
    sinConfigurar: false,
    fallosConfirmados: 0,
    ultimoMotivo: 'arranque'
};

const CACHE_MS        = 60 * 60 * 1000;  // todo normal: revisar cada hora
const CACHE_DUDOSO_MS = 5 * 60 * 1000;   // tras una negativa: confirmar cada 5 min
const FALLOS_PARA_BLOQUEAR = 2;          // dos negativas seguidas antes de apagar por vencimiento

const sinConfigurar = () => !process.env.LICENSE_SERVER_URL || !process.env.LICENSE_KEY;
const esProduccion  = () => process.env.NODE_ENV === 'production';

// Devuelve { status, json } o null si el servidor es inalcanzable.
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

// ¿La respuesta tiene forma de estado de licencia, o es un error genérico?
// Railway contesta {status:'error',code:404,message:'Application not found'}
// cuando la plataforma está caída o renombrada: eso NO es un veredicto.
const tieneFormaDeLicencia = d =>
    !!d && (('dias_restantes' in d) || ('fecha_vencimiento' in d) || ('suscripcion_activa' in d) || ('pago_url' in d));

// HUECO QUE TAPABA NADIE: si LICENSE_KEY apunta a una licencia borrada o mal
// escrita, la plataforma responde 404 {ok:false, msg:'Licencia no encontrada'}.
// Esa respuesta no tiene forma de licencia, así que las dos versiones anteriores
// la leían como "problema del servidor" y dejaban el sistema abierto para
// siempre. Es un veredicto real de un servidor sano: se trata como inválida.
const esClaveDesconocida = (resp) =>
    !!(resp && resp.status === 404 && resp.json && resp.json.ok === false &&
       typeof resp.json.msg === 'string' && /no encontrada/i.test(resp.json.msg));

// El dueño apretó el botón de desactivar. Es una orden, no un vencimiento.
const esDesactivacionManual = (resp) =>
    !!(resp && resp.json && resp.json.estado === 'desactivada');

// 'valida' | 'invalida' | 'desconocido'
function interpretar(resp) {
    if (!resp || resp.json === null) return 'desconocido';       // inalcanzable / no-JSON
    if (esClaveDesconocida(resp)) return 'invalida';
    if (resp.status && resp.status >= 400) return 'desconocido'; // 5xx y 404 genérico = problema del servidor
    const d = resp.json;
    if (!tieneFormaDeLicencia(d)) return 'desconocido';

    // La negativa explícita manda sobre cualquier otra señal. Si se mirara
    // primero dias_restantes>0, desactivar a mano una licencia aún vigente no
    // surtiría efecto.
    if (d.ok === false || d.valida === false) return 'invalida';
    if (d.ok === true || d.valida === true || d.suscripcion_activa === true || Number(d.dias_restantes) > 0) return 'valida';
    return 'desconocido';
}

async function refrescarSiNecesario() {
    const ahora = Date.now();
    const espera = estado.fallosConfirmados > 0 ? CACHE_DUDOSO_MS : CACHE_MS;
    if (ahora - estado.checkedAt < espera && estado.valida !== null) return;

    // Falta configuración. Distinto de "el servidor no responde": desplegar en
    // producción sin LICENSE_KEY dejaría el sistema gratis para siempre, que es
    // exactamente lo que pasó en Ferre Láser. En desarrollo sí se deja pasar.
    if (sinConfigurar()) {
        estado = {
            ...estado,
            valida: !esProduccion(), checkedAt: ahora, diasRestantes: 0,
            pagoUrl: '', suscripcionActiva: false, sinConfigurar: true,
            fallosConfirmados: 0,
            ultimoMotivo: esProduccion() ? 'sin LICENSE_KEY en produccion' : 'sin configurar (desarrollo)'
        };
        if (esProduccion()) console.error('⛔ Sin LICENSE_SERVER_URL/LICENSE_KEY en produccion — acceso bloqueado');
        return;
    }
    estado.sinConfigurar = false;

    const resp = await fetchLicencia();
    const veredicto = interpretar(resp);
    estado.checkedAt = ahora;

    if (veredicto === 'valida') {
        const d = resp.json;
        estado.valida            = true;
        estado.fallosConfirmados = 0;
        estado.diasRestantes     = Number(d.dias_restantes) || 0;
        estado.pagoUrl           = d.pago_url || '';
        estado.suscripcionActiva = d.suscripcion_activa || false;
        estado.ultimoMotivo      = 'licencia ' + (d.estado || 'valida');
        return;
    }

    if (veredicto === 'invalida') {
        const d = (resp && resp.json) || {};
        estado.diasRestantes     = Number(d.dias_restantes) || 0;
        estado.pagoUrl           = d.pago_url || '';
        estado.suscripcionActiva = d.suscripcion_activa || false;
        estado.fallosConfirmados++;

        if (esDesactivacionManual(resp)) {
            estado.valida = false;
            estado.ultimoMotivo = 'desactivada por el proveedor';
            console.warn('⛔ Licencia DESACTIVADA por el proveedor — acceso bloqueado');
            return;
        }
        if (esClaveDesconocida(resp)) {
            estado.valida = false;
            estado.ultimoMotivo = 'LICENSE_KEY no existe en la plataforma';
            console.error('⛔ La LICENSE_KEY no existe en mi-plataforma — acceso bloqueado');
            return;
        }
        // Vencimiento: se exige una segunda confirmación para no apagar a nadie
        // por una respuesta rara de una sola vez.
        if (estado.fallosConfirmados >= FALLOS_PARA_BLOQUEAR) {
            estado.valida = false;
            estado.ultimoMotivo = 'vencida (' + (d.fecha_vencimiento || 's/f') + ')';
            console.warn(`⛔ LICENCIA VENCIDA confirmada (${d.fecha_vencimiento || 's/f'}) — acceso bloqueado`);
        } else {
            if (estado.valida === null) estado.valida = true;   // arranque: permitir
            estado.ultimoMotivo = `invalida sin confirmar (${estado.fallosConfirmados}/${FALLOS_PARA_BLOQUEAR})`;
            console.warn(`⚠️  Licencia reportada invalida (${estado.fallosConfirmados}/${FALLOS_PARA_BLOQUEAR}) — se confirma en ${CACHE_DUDOSO_MS / 60000} min`);
        }
        return;
    }

    // 'desconocido' → FAIL-OPEN: jamás bloquear por una caída del servidor.
    estado.fallosConfirmados = 0;
    if (estado.valida === null) estado.valida = true;
    estado.ultimoMotivo = 'servidor de licencias inalcanzable (fail-open)';
    console.warn('⚠️  No se pudo verificar licencia — se permite el acceso (fail-open)');
}

async function iniciarVerificacion() {
    await refrescarSiNecesario();
    setInterval(refrescarSiNecesario, CACHE_DUDOSO_MS).unref?.();
}

function esPublica(p) {
    return p === '/auth/login' || p === '/health' || p === '/configuracion' ||
           p.startsWith('/setup') || PUBLICAS.some(r => p === r || p.startsWith(r));
}

async function verificarLicencia(req, res, next) {
    if (esPublica(req.path)) return next();
    await refrescarSiNecesario();
    if (estado.valida !== false) return next();   // null/true → pasa

    res.status(403).json({
        ok: false, licencia: false,
        msg: estado.sinConfigurar
            ? 'Este sistema no tiene licencia configurada. Contacte al proveedor.'
            : 'Licencia vencida. Renueve su suscripción para continuar.',
        pago_url: estado.pagoUrl, dias: estado.diasRestantes
    });
}

// Para que el estado real se vea desde fuera sin entrar a los logs. Un sistema
// mal configurado tiene que delatarse solo; si no, el hueco no lo marca nadie.
async function estadoEndpoint(req, res) {
    // force=1 salta el caché pero NO borra las confirmaciones negativas: si las
    // borrara, el contador nunca llegaría al umbral (el frontend llama con force).
    if (req.query.force === '1') estado.checkedAt = 0;
    await refrescarSiNecesario();
    res.json({
        valida: estado.valida,
        diasRestantes: estado.diasRestantes,
        suscripcionActiva: estado.suscripcionActiva,
        pagoUrl: estado.pagoUrl,
        sinConfigurar: !!estado.sinConfigurar,
        confirmacionesNegativas: estado.fallosConfirmados,
        motivo: estado.ultimoMotivo,
        ultimaVerificacion: estado.checkedAt ? new Date(estado.checkedAt).toISOString() : null
    });
}

module.exports = { iniciarVerificacion, verificarLicencia, estadoEndpoint, rutasPublicas };
