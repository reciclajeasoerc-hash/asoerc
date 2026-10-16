import React, { useState, useEffect } from 'react';

// Pantalla de bloqueo por licencia — diseño aprobado por Cristian el 16/10/2026.
//
// Es el único momento en que AI Company le habla directo al cliente final, así
// que tiene que decir tres cosas sin que las busque: qué pasó, que sus datos
// están intactos, y cómo pagar. Un bloqueo sin salida de pago es un sistema
// roto, no un cobro.
//
// MISMO ARCHIVO en los cinco sistemas. Si se cambia, se cambia en todos.
//
// Props:
//   estado      el objeto de /api/licencia/estado (valida, sinConfigurar, pagoUrl, diasRestantes…)
//   onVerificar se llama cuando el backend confirma que ya abrió
//   sistema     nombre del sistema, para que el WhatsApp diga quién escribe
//   logo        ruta del logotipo de AI Company dentro de este sistema

const WA = '573224807767';
const WA_VISIBLE = '322 480 7767';

const C = {
    violeta: '#7024C4', violetaHondo: '#4C168E', grafito: '#191923',
    hielo: '#F7F8FA', lavanda: '#F0E5FA', blanco: '#FFFFFF',
    tinta2: '#55555f', tinta3: '#7b7b86', borde: '#E4E2EC',
    ambar: '#9A6A00', ambarSuave: '#FFF4DC',
};
const TITULAR = "'Manrope',system-ui,-apple-system,'Segoe UI',sans-serif";
const CUERPO  = "'Inter',system-ui,-apple-system,'Segoe UI',sans-serif";

// Las tipografías de marca se cargan desde el propio componente para no tener
// que tocar el index.html de cada repositorio. Si la red falla, el stack de
// respaldo deja la pantalla perfectamente legible.
function useFuentes() {
    useEffect(() => {
        const id = 'fuentes-ai-company';
        if (document.getElementById(id)) return;
        const l = document.createElement('link');
        l.id = id; l.rel = 'stylesheet';
        l.href = 'https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700&family=Inter:wght@400;500;600&display=swap';
        document.head.appendChild(l);
    }, []);
}

export default function LicenciaVencida({ estado = {}, onVerificar, sistema = '', logo = '/ai-company.webp' }) {
    useFuentes();
    const [verificando, setVerificando] = useState(false);
    const [aviso, setAviso] = useState('');
    const [anchoCorto, setAnchoCorto] = useState(
        typeof window !== 'undefined' && window.innerWidth < 860
    );

    useEffect(() => {
        const f = () => setAnchoCorto(window.innerWidth < 860);
        window.addEventListener('resize', f);
        return () => window.removeEventListener('resize', f);
    }, []);

    const sinLicencia = !!estado.sinConfigurar;
    const pagoUrl = estado.pagoUrl || '';
    const dias = Number(estado.diasRestantes);

    const textoWa = sinLicencia
        ? `Hola, mi sistema${sistema ? ' (' + sistema + ')' : ''} dice que no tiene licencia asignada. ¿Me la pueden activar?`
        : pagoUrl
            ? `Hola, tengo una duda con la licencia de mi sistema${sistema ? ' (' + sistema + ')' : ''}.`
            : `Hola, quiero renovar mi licencia${sistema ? ' de ' + sistema : ''} pero no me carga el enlace de pago.`;
    const enlaceWa = `https://wa.me/${WA}?text=${encodeURIComponent(textoWa)}`;

    async function verificarAhora() {
        setVerificando(true); setAviso('');
        try {
            // force=1 salta el caché del servidor: si acaban de pagar, se nota ya.
            const r = await fetch('/api/licencia/estado?force=1');
            const d = await r.json();
            if (d.valida) { onVerificar ? onVerificar() : window.location.reload(); return; }
            setAviso('Todavía no vemos el pago. Si acabas de hacerlo, espera un momento y vuelve a intentar.');
        } catch {
            setAviso('No pudimos verificar. Revisa tu conexión e intenta de nuevo.');
        }
        setVerificando(false);
    }

    return (
        <div style={{ minHeight: '100vh', background: C.hielo, color: C.grafito, fontFamily: CUERPO, WebkitFontSmoothing: 'antialiased' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: anchoCorto ? '22px 16px 32px' : '28px 24px 40px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

                <div style={{ marginBottom: anchoCorto ? 8 : 'auto' }}>
                    <img src={logo} alt="AI Company · Ingeniería de software" style={{ height: 48, width: 'auto', display: 'block', maxWidth: '100%' }} />
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: anchoCorto ? '1fr' : '1.05fr .95fr',
                    gap: anchoCorto ? 30 : 56, alignItems: 'center',
                    padding: anchoCorto ? '30px 0' : '60px 0'
                }}>
                    <div>
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            background: sinLicencia ? '#EFEFF3' : C.ambarSuave,
                            color: sinLicencia ? C.tinta2 : C.ambar,
                            font: `600 12px/1 ${CUERPO}`, letterSpacing: '.07em', textTransform: 'uppercase',
                            padding: '8px 14px', borderRadius: 999, marginBottom: 22
                        }}>
                            <i style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', display: 'block' }} />
                            {sinLicencia ? 'Instalación sin licencia' : 'Acceso en pausa'}
                        </span>

                        <h1 style={{
                            fontFamily: TITULAR, fontSize: anchoCorto ? '2rem' : '3.1rem', lineHeight: 1.08,
                            letterSpacing: '-.025em', margin: '0 0 18px', fontWeight: 700, textWrap: 'balance'
                        }}>
                            {sinLicencia ? 'Esta instalación todavía no tiene licencia.' : 'Volvamos a poner tu negocio en marcha.'}
                        </h1>

                        <p style={{ fontSize: anchoCorto ? '.98rem' : '1.08rem', lineHeight: 1.68, color: C.tinta2, margin: 0, maxWidth: '46ch' }}>
                            {sinLicencia
                                ? 'No es un pago pendiente: a este sistema aún no se le ha asignado una licencia. Lo activamos nosotros.'
                                : pagoUrl
                                    ? 'Tu licencia venció y el acceso quedó en pausa. Renuévala y el sistema vuelve a abrir de inmediato.'
                                    : 'Tu licencia venció y el acceso quedó en pausa. Escríbenos y te pasamos el enlace para renovarla.'}
                        </p>

                        <p style={{ display: 'flex', gap: 11, alignItems: 'flex-start', marginTop: 26, fontSize: '.92rem', lineHeight: 1.6, color: C.tinta2, maxWidth: anchoCorto ? 'none' : '44ch' }}>
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.violeta} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginTop: 2 }} aria-hidden="true">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                            <span>Tu información está intacta. Todo sigue donde lo dejaste.</span>
                        </p>
                    </div>

                    <div style={{ background: C.blanco, border: `1px solid ${C.borde}`, borderRadius: 20, padding: anchoCorto ? 26 : 36, boxShadow: '0 18px 44px rgba(25,25,35,.07)' }}>
                        <h2 style={{ fontFamily: TITULAR, fontSize: '1.32rem', lineHeight: 1.25, margin: '0 0 8px', letterSpacing: '-.015em', fontWeight: 700 }}>
                            {sinLicencia ? 'Pide la activación' : 'Renueva tu licencia'}
                        </h2>
                        <p style={{ fontSize: '.93rem', lineHeight: 1.62, color: C.tinta2, margin: '0 0 22px' }}>
                            {sinLicencia
                                ? 'Escríbenos y te asignamos la licencia. Suele tomar unos minutos.'
                                : pagoUrl
                                    ? 'Abre tu página de pago, haz la transferencia y vuelve. El sistema se reactiva solo.'
                                    : 'No pudimos cargar tu enlace de pago. Escríbenos y te lo enviamos al instante.'}
                        </p>

                        {!sinLicencia && (
                            <dl style={{ borderTop: `1px solid ${C.borde}`, margin: '0 0 24px', paddingTop: 18, display: 'grid', gap: 11 }}>
                                {sistema && <Fila etiqueta="Sistema" valor={sistema} />}
                                {estado.fechaVencimiento && <Fila etiqueta="Venció" valor={estado.fechaVencimiento} />}
                                {Number.isFinite(dias) && dias < 0 && <Fila etiqueta="Días en pausa" valor={String(Math.abs(dias))} />}
                            </dl>
                        )}

                        {pagoUrl && !sinLicencia ? (
                            <a href={pagoUrl} target="_blank" rel="noopener noreferrer" style={estiloBoton}>
                                Continuar al pago
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                            </a>
                        ) : (
                            // Sin enlace de pago el cliente no puede quedarse sin acción.
                            <a href={enlaceWa} target="_blank" rel="noopener noreferrer" style={estiloBoton}>
                                <IconoWa />
                                Escríbenos por WhatsApp
                            </a>
                        )}

                        <button type="button" onClick={verificarAhora} disabled={verificando} style={estiloBoton2(verificando)}>
                            {verificando ? 'Verificando…' : 'Ya pagué, verificar'}
                        </button>

                        {aviso && <p style={{ margin: '16px 0 0', fontSize: '.84rem', lineHeight: 1.55, color: C.tinta3, textAlign: 'center' }}>{aviso}</p>}

                        <p style={{ borderTop: `1px solid ${C.borde}`, marginTop: 22, paddingTop: 18, fontSize: '.85rem', lineHeight: 1.6, color: C.tinta3 }}>
                            {sinLicencia ? 'Escríbenos por WhatsApp al ' : '¿Algo no cuadra? Escríbenos por WhatsApp al '}
                            <a href={enlaceWa} target="_blank" rel="noopener noreferrer" style={{ color: C.violeta, fontWeight: 600, textDecoration: 'none', borderBottom: '1px solid rgba(112,36,196,.3)', whiteSpace: 'nowrap' }}>{WA_VISIBLE}</a>
                            {sinLicencia ? ' y te la activamos.' : ' y lo revisamos contigo.'}
                        </p>
                    </div>
                </div>

                <p style={{ marginTop: 'auto', paddingTop: 34, fontSize: '.8rem', color: C.tinta3 }}>
                    AI Company · Ingeniería de software
                </p>
            </div>
        </div>
    );
}

function Fila({ etiqueta, valor }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: '.87rem', alignItems: 'baseline' }}>
            <dt style={{ color: C.tinta3 }}>{etiqueta}</dt>
            <dd style={{ margin: 0, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{valor}</dd>
        </div>
    );
}

function IconoWa() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 1.67c2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.25 8.24a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24zm4.52 10.31c-.25-.12-1.46-.72-1.69-.8-.22-.08-.39-.12-.55.13-.16.25-.63.8-.77.96-.14.17-.28.19-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.71-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42l-.47-.01c-.16 0-.43.06-.65.31-.22.25-.85.84-.85 2.04s.88 2.37 1 2.53c.12.17 1.72 2.63 4.17 3.69.58.25 1.04.4 1.39.51.59.19 1.12.16 1.54.1.47-.07 1.46-.6 1.66-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z" />
        </svg>
    );
}

const estiloBoton = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%',
    minHeight: 52, padding: '15px 22px', borderRadius: 12, border: 0, cursor: 'pointer',
    font: `600 1rem/1 ${CUERPO}`, background: C.violeta, color: '#fff', textDecoration: 'none',
    boxSizing: 'border-box'
};

const estiloBoton2 = (ocupado) => ({
    display: 'block', width: '100%', minHeight: 48, marginTop: 11, padding: 14,
    borderRadius: 12, border: `1px solid ${C.borde}`, background: 'transparent',
    color: ocupado ? C.tinta3 : C.grafito, font: `500 .93rem/1 ${CUERPO}`,
    cursor: ocupado ? 'wait' : 'pointer', boxSizing: 'border-box'
});
