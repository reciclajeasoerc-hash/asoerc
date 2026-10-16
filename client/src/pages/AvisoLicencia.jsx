import React, { useState, useEffect } from 'react';

// Franja de aviso ANTES de que se apague el sistema. No bloquea nada.
//
// Hoy el cliente trabaja normal y de un momento a otro se encuentra la pantalla
// de bloqueo, sin haber visto venir nada. Esto le avisa con tiempo y le deja el
// botón de pago a la mano.
//
// EL CORTE ES A LAS 00:00 DE BOGOTÁ de `fechaBloqueo`. No a una hora de oficina.
// Por eso el aviso fuerte es el día ANTES: es la última jornada completa en que
// el dueño puede pagar. Un aviso "2 horas antes" saltaría a las 22:00, con el
// negocio cerrado, y no lo vería nadie.
//
// MISMO ARCHIVO en los cuatro sistemas. Si se cambia, se cambia en todos.

const WA = '573224807767';
const C = {
    violeta: '#7024C4', violetaHondo: '#4C168E', grafito: '#191923',
    lavanda: '#F0E5FA', ambar: '#8A5D00', ambarSuave: '#FFF4DC', ambarBorde: '#F2DCA8',
    rojo: '#A3311F', rojoSuave: '#FDECE8', rojoBorde: '#F3C9BF',
};
const CUERPO = "'Inter',system-ui,-apple-system,'Segoe UI',sans-serif";

// Medianoche de Bogotá del día `fecha` (YYYY-MM-DD), en milisegundos UTC.
// Bogotá es UTC-5 todo el año (no tiene horario de verano), así que las 00:00
// locales son las 05:00 UTC de ese mismo día. Se calcula así y no con la hora
// local del equipo: un computador con la zona mal puesta mostraría un reloj falso.
function corteEnMs(fecha) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) return null;
    // El patron de 4-2-2 digitos no basta: '2026-13-45' lo pasa y Date.parse
    // devuelve NaN, que se colaba hasta pintarle "NaN" al cliente.
    const ms = Date.parse(fecha + 'T05:00:00Z');
    return Number.isFinite(ms) ? ms : null;
}

function formatear(ms) {
    if (ms <= 0) return 'ya';
    const t = Math.floor(ms / 1000);
    const d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600);
    const m = Math.floor((t % 3600) / 60), s = t % 60;
    if (d >= 1) return d === 1 ? `1 día y ${h} h` : `${d} días`;
    if (h >= 1) return `${h} h ${String(m).padStart(2, '0')} min`;
    return `${m} min ${String(s).padStart(2, '0')} s`;
}

export default function AvisoLicencia({ sistema = '', estado: estadoProp }) {
    // Consulta su propio estado para poder soltarse en cualquier parte sin
    // enhebrar props por toda la aplicacion. Si falla, no se muestra nada.
    const [estadoLocal, setEstadoLocal] = useState(null);
    useEffect(() => {
        if (estadoProp) return;
        let vivo = true;
        const pedir = () => fetch('/api/licencia/estado')
            .then(r => r.json())
            .then(d => { if (vivo && d && typeof d === 'object') setEstadoLocal(d); })
            .catch(() => {});
        pedir();
        // Si pagan con el sistema abierto, el aviso debe desaparecer solo.
        const t = setInterval(pedir, 10 * 60 * 1000);
        return () => { vivo = false; clearInterval(t); };
    }, [estadoProp]);

    const estado = estadoProp || estadoLocal;
    const corte = corteEnMs(estado && estado.fechaBloqueo);
    const [ahora, setAhora] = useState(() => Date.now());
    const [cerrado, setCerrado] = useState(false);

    // El reloj solo corre el último día; antes basta con refrescar de vez en cuando.
    const restante = corte == null ? null : corte - ahora;
    const urgente = restante != null && restante <= 36 * 3600 * 1000;

    useEffect(() => {
        if (corte == null) return;
        const cada = urgente ? 1000 : 60000;
        const t = setInterval(() => setAhora(Date.now()), cada);
        return () => clearInterval(t);
    }, [corte, urgente]);

    // No se muestra si: no hay licencia válida (ahí manda la pantalla de bloqueo),
    // si el servidor no dio fecha de corte, si la licencia nunca bloquea, o si
    // todavía falta mucho. Ante cualquier duda, no se muestra: es un aviso, y no
    // puede estorbar la operación.
    if (!estado || estado.valida === false || estado.sinConfigurar) return null;
    if (corte == null || restante == null) return null;
    if (restante <= 0) return null;                 // ya pasó: lo cubre el bloqueo
    if (restante > 5 * 86400 * 1000) return null;   // faltan más de 5 días

    const ultimoDia = restante <= 36 * 3600 * 1000;   // el día antes del corte
    const vencida = estado.estadoLicencia === 'en_gracia' || Number(estado.diasRestantes) < 0;

    // El último día no se puede cerrar: es la última oportunidad de pagar.
    if (cerrado && !ultimoDia) return null;

    const col = ultimoDia
        ? { fondo: C.rojoSuave, borde: C.rojoBorde, texto: C.rojo }
        : { fondo: C.ambarSuave, borde: C.ambarBorde, texto: C.ambar };

    const titulo = ultimoDia
        ? 'El sistema se bloquea por falta de pago'
        : vencida ? 'Tu licencia está vencida' : 'Tu licencia está por vencer';

    const cuenta = formatear(restante);
    const textoWa = `Hola, quiero renovar la licencia${sistema ? ' de ' + sistema : ''} antes de que se bloquee el sistema.`;

    return (
        <div role="status" style={{
            position: 'sticky', top: 0, zIndex: 5,
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            background: col.fondo, borderBottom: `1px solid ${col.borde}`,
            padding: '11px 16px', fontFamily: CUERPO, fontSize: 14, color: col.texto,
            lineHeight: 1.45
        }}>
            <span style={{ flex: 1, minWidth: 200 }}>
                <strong style={{ fontWeight: 600 }}>{titulo}.</strong>{' '}
                Se apaga en <strong style={{
                    fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap'
                }}>{cuenta}</strong>. Renueva y sigue trabajando sin interrupción.
            </span>

            {estado.pagoUrl ? (
                <a href={estado.pagoUrl} target="_blank" rel="noopener noreferrer" style={botonPagar}>
                    Pagar ahora
                </a>
            ) : (
                <a href={`https://wa.me/${WA}?text=${encodeURIComponent(textoWa)}`}
                    target="_blank" rel="noopener noreferrer" style={botonPagar}>
                    Escríbenos para renovar
                </a>
            )}

            {!ultimoDia && (
                <button type="button" onClick={() => setCerrado(true)} aria-label="Ocultar aviso"
                    style={{
                        background: 'none', border: 0, color: col.texto, opacity: .65,
                        cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '4px 6px',
                        minHeight: 32, minWidth: 32, fontFamily: 'inherit'
                    }}>×</button>
            )}
        </div>
    );
}

const botonPagar = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: C.violeta, color: '#fff', textDecoration: 'none',
    font: `600 13.5px/1 ${CUERPO}`, padding: '11px 18px', borderRadius: 9,
    minHeight: 40, whiteSpace: 'nowrap', boxSizing: 'border-box'
};
