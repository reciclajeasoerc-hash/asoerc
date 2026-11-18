import React, { useEffect } from 'react';
import Icono from './Icono';

// ═══════════════════════════════════════════════════════════════════════════
// Piezas del diseño "Operación" — úsalas en TODAS las pantallas para que se vean iguales.
// Colores y letras salen de las variables de index.css (--noche, --verde, --fuente-tit…).
// ═══════════════════════════════════════════════════════════════════════════

// ── Encabezado de página ──────────────────────────────────────────────────────
// <EncabezadoPagina titulo="Recicladores" sub="Gestión de…" icono="recicladores"
//     volver={() => navigate('/bodegas')} textoVolver="Bodegas" acciones={<Boton>…</Boton>} />
export function EncabezadoPagina({ titulo, sub, icono, etiqueta, volver, textoVolver = 'Volver', acciones, style }) {
    return (
        <div className="encabezado-pagina" style={style}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                {volver && (
                    <button onClick={volver} aria-label={textoVolver} title={textoVolver}
                        style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 10, border: '1.5px solid var(--borde-fuerte)', background: '#fff', color: 'var(--texto)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                        ←
                    </button>
                )}
                {icono && (
                    <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 11, background: 'var(--noche)', color: 'var(--verde-vivo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icono nombre={icono} tam={23} />
                    </div>
                )}
                <div style={{ minWidth: 0 }}>
                    {etiqueta && <div className="etiqueta" style={{ color: 'var(--texto-3)' }}>{etiqueta}</div>}
                    <h1 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titulo}</h1>
                    {sub && <p>{sub}</p>}
                </div>
            </div>
            {acciones && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{acciones}</div>}
        </div>
    );
}

// ── Botón ─────────────────────────────────────────────────────────────────────
// variante: primario (verde) | noche | secundario (blanco) | peligro | fantasma
const VARIANTES = {
    primario:   { background: 'var(--verde)', color: '#fff', border: '2px solid var(--verde-osc)' },
    noche:      { background: 'var(--noche)', color: '#fff', border: '2px solid var(--noche)' },
    secundario: { background: '#fff', color: 'var(--texto)', border: '1.5px solid var(--borde-fuerte)' },
    peligro:    { background: 'var(--rojo-suave)', color: 'var(--rojo)', border: '1.5px solid var(--rojo-borde)' },
    fantasma:   { background: 'transparent', color: 'var(--verde-osc)', border: '1.5px solid transparent' },
};
export function Boton({ variante = 'primario', tam = 'md', icono, ancho, children, style, ...resto }) {
    const alto = tam === 'sm' ? 34 : tam === 'lg' ? 52 : 42;
    return (
        <button {...resto} style={{
            ...VARIANTES[variante], height: alto, padding: tam === 'sm' ? '0 11px' : '0 16px', borderRadius: tam === 'sm' ? 8 : 10,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: ancho ? '100%' : undefined,
            fontFamily: 'var(--fuente-tit)', fontWeight: 700, fontSize: tam === 'sm' ? 14 : tam === 'lg' ? 18 : 15.5, letterSpacing: .4,
            whiteSpace: 'nowrap', cursor: 'pointer', ...style,
        }}>
            {icono && <Icono nombre={icono} tam={tam === 'sm' ? 16 : 18} />}
            {children}
        </button>
    );
}

// ── Pestañas (se deslizan de lado en el celular) ──────────────────────────────
// <Pestanas items={[{ id, label, icono }]} activa={tab} onChange={setTab} />
export function Pestanas({ items, activa, onChange, style }) {
    return (
        <div role="tablist" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', padding: '2px 2px 10px', ...style }}>
            {items.map(t => {
                const on = activa === t.id;
                return (
                    <button key={t.id} role="tab" aria-selected={on} onClick={() => onChange(t.id)}
                        style={{
                            height: 42, padding: '0 15px', borderRadius: 10, flexShrink: 0, whiteSpace: 'nowrap',
                            display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                            border: on ? '2px solid var(--noche)' : '1.5px solid var(--borde)',
                            background: on ? 'var(--noche)' : '#fff', color: on ? '#fff' : 'var(--texto-2)',
                            fontFamily: 'var(--fuente-tit)', fontSize: 16, fontWeight: on ? 800 : 600, letterSpacing: .3,
                        }}>
                        {t.icono && <Icono nombre={t.icono} tam={18} style={{ color: on ? 'var(--verde-vivo)' : undefined }} />}
                        {t.label}
                        {t.cuenta != null && <span style={{ fontSize: 12.5, opacity: .75 }}>{t.cuenta}</span>}
                    </button>
                );
            })}
        </div>
    );
}

// ── Tarjeta con título ────────────────────────────────────────────────────────
export function Tarjeta({ titulo, sub, icono, accion, children, sinPadding, style, ...resto }) {
    // ...resto pasa onClick, id, etc. al <section> (p. ej. la tarjeta de Bodegas abre el detalle)
    return (
        <section className="tarjeta" {...resto} style={{ padding: sinPadding ? 0 : '16px 18px', minWidth: 0, overflow: sinPadding ? 'hidden' : undefined, cursor: resto.onClick ? 'pointer' : undefined, ...style }}>
            {(titulo || accion) && (
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14, padding: sinPadding ? '16px 18px 0' : 0 }}>
                    <div style={{ minWidth: 0 }}>
                        {titulo && <h2 className="tit-seccion">{icono && <Icono nombre={icono} tam={19} style={{ color: 'var(--verde)' }} />}{titulo}</h2>}
                        {sub && <div className="sub-seccion">{sub}</div>}
                    </div>
                    {accion}
                </div>
            )}
            {children}
        </section>
    );
}

// ── Indicador (KPI) ───────────────────────────────────────────────────────────
// tono: claro | marco (borde azul noche) | verde | rojo | noche | ambar
const TONOS = {
    claro: { fondo: 'var(--tarjeta)',     borde: 'var(--borde)',  tit: 'var(--texto-2)',    val: 'var(--texto)',     pie: 'var(--texto-3)' },
    marco: { fondo: 'var(--tarjeta)',     borde: 'var(--noche)',  tit: 'var(--texto-2)',    val: 'var(--texto)',     pie: 'var(--texto-3)' },
    verde: { fondo: 'var(--verde-suave)', borde: 'var(--verde)',  tit: 'var(--verde-osc)',  val: 'var(--verde-osc)', pie: 'var(--verde-osc)' },
    rojo:  { fondo: 'var(--rojo-suave)',  borde: 'var(--rojo)',   tit: 'var(--rojo)',       val: 'var(--rojo)',      pie: 'var(--rojo)' },
    ambar: { fondo: 'var(--ambar-suave)', borde: 'var(--ambar)',  tit: '#7a5600',           val: '#4a3300',          pie: '#7a5600' },
    noche: { fondo: 'var(--noche)',       borde: 'var(--noche)',  tit: 'var(--verde-vivo)', val: '#fff',             pie: 'var(--noche-texto)' },
};
export function Kpi({ titulo, valor, pie, icono, tono = 'claro', style }) {
    const t = TONOS[tono] || TONOS.claro;
    return (
        <div style={{ background: t.fondo, border: `2px solid ${t.borde}`, borderRadius: 'var(--radio)', padding: '14px 16px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: 'var(--sombra)', ...style }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span className="etiqueta" style={{ color: t.tit }}>{titulo}</span>
                {icono && <Icono nombre={icono} tam={19} style={{ color: t.tit, opacity: .85 }} />}
            </div>
            <div className="cifra" style={{ fontSize: 'clamp(21px, 2.2vw, 28px)', color: t.val, lineHeight: 1.05, overflowWrap: 'anywhere' }}>{valor}</div>
            {pie && <div style={{ fontSize: 12.5, color: t.pie }}>{pie}</div>}
        </div>
    );
}
// Rejilla de indicadores: 4 en computador, 2 en celular
export const RejillaKpi = ({ children, style }) => <div className="rejilla-kpi" style={{ marginBottom: 14, ...style }}>{children}</div>;

// ── Etiqueta de estado ────────────────────────────────────────────────────────
// tono: verde | rojo | ambar | azul | gris | noche
const CHIPS = {
    verde: { background: 'var(--verde-suave)', color: 'var(--verde-osc)' },
    rojo:  { background: 'var(--rojo-suave)',  color: 'var(--rojo)' },
    ambar: { background: 'var(--ambar-suave)', color: '#7a5600' },
    azul:  { background: 'var(--azul-suave)',  color: 'var(--azul)' },
    gris:  { background: '#f1f5f9',            color: 'var(--texto-2)' },
    noche: { background: 'var(--noche)',       color: '#fff' },
};
export const Chip = ({ tono = 'gris', children, style }) => <span className="chip" style={{ ...CHIPS[tono], ...style }}>{children}</span>;

// ── Tablas ────────────────────────────────────────────────────────────────────
// Envuelve la <table> en <ContenedorTabla> para que en el celular se deslice de lado.
export const ContenedorTabla = ({ children, style }) => <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', ...style }}>{children}</div>;
export const estiloTabla = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
export const estiloTh = { textAlign: 'left', padding: '10px 14px', background: '#f6f8fa', borderBottom: '1.5px solid var(--borde)', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1 };
export const estiloTd = { padding: '11px 14px', borderBottom: '1px solid #eef1f4', verticalAlign: 'middle' };
export const estiloTdNum = { ...estiloTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

// ── Campos de formulario ──────────────────────────────────────────────────────
export const estiloInput = { width: '100%', height: 42, padding: '0 12px', borderRadius: 9, border: '1.5px solid var(--borde-fuerte)', background: '#fff', fontSize: 14.5, color: 'var(--texto)' };
export function Campo({ etiqueta, ayuda, children, style }) {
    return (
        <label style={{ display: 'block', minWidth: 0, ...style }}>
            {etiqueta && <div className="etiqueta" style={{ color: 'var(--texto-2)', marginBottom: 5, fontSize: 12 }}>{etiqueta}</div>}
            {children}
            {ayuda && <div style={{ fontSize: 12, color: 'var(--texto-3)', marginTop: 4 }}>{ayuda}</div>}
        </label>
    );
}
// Buscador con lupa
export function Buscador({ value, onChange, placeholder = 'Buscar...', style }) {
    return (
        <div style={{ position: 'relative', flex: 1, minWidth: 0, ...style }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-3)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...estiloInput, paddingLeft: 38 }} />
        </div>
    );
}

// ── Ventana (modal) ───────────────────────────────────────────────────────────
// En el celular sube desde abajo y ocupa el ancho completo.
export function Modal({ abierto = true, titulo, onCerrar, children, pie, ancho = 520 }) {
    useEffect(() => {
        if (!abierto) return;
        const fn = e => { if (e.key === 'Escape') onCerrar?.(); };
        window.addEventListener('keydown', fn);
        return () => window.removeEventListener('keydown', fn);
    }, [abierto, onCerrar]);
    if (!abierto) return null;
    return (
        <div className="modal-fondo" onClick={e => { if (e.target === e.currentTarget) onCerrar?.(); }}>
            <div className="modal-caja" style={{ maxWidth: ancho }} role="dialog" aria-modal="true" aria-label={typeof titulo === 'string' ? titulo : undefined}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 16px', borderBottom: '1.5px solid var(--borde)' }}>
                    <h2 className="tit-seccion" style={{ fontSize: 18 }}>{titulo}</h2>
                    {onCerrar && (
                        <button onClick={onCerrar} aria-label="Cerrar" style={{ width: 40, height: 40, borderRadius: 9, border: '1.5px solid var(--borde)', background: '#f8fafc', color: 'var(--texto-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icono nombre="cerrar" tam={18} />
                        </button>
                    )}
                </div>
                <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>{children}</div>
                {pie && <div style={{ padding: '12px 16px', borderTop: '1.5px solid var(--borde)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>{pie}</div>}
            </div>
        </div>
    );
}

// ── Estado vacío / cargando ───────────────────────────────────────────────────
export function Vacio({ icono = 'materiales', texto = 'Sin datos todavía', children }) {
    return (
        <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--texto-3)' }}>
            <Icono nombre={icono} tam={36} grosor={1.5} style={{ opacity: .5 }} />
            <p style={{ fontSize: 14, marginTop: 8 }}>{texto}</p>
            {children}
        </div>
    );
}
export const Cargando = ({ texto = 'Cargando...' }) => (
    <div style={{ textAlign: 'center', padding: 36, color: 'var(--texto-3)', fontSize: 14 }}>{texto}</div>
);

// ── Avisos ────────────────────────────────────────────────────────────────────
const AVISOS = {
    error: { background: 'var(--rojo-suave)',  border: '1.5px solid var(--rojo-borde)', color: '#991b1b' },
    exito: { background: 'var(--verde-suave)', border: '1.5px solid var(--verde-borde)', color: 'var(--verde-osc)' },
    info:  { background: 'var(--azul-suave)',  border: '1.5px solid #bfdbfe',           color: '#1e40af' },
    alerta:{ background: 'var(--ambar-suave)', border: '2px solid var(--ambar)',         color: '#5c4100' },
};
export const Aviso = ({ tipo = 'info', children, style }) => (
    <div style={{ ...AVISOS[tipo], borderRadius: 9, padding: '10px 13px', fontSize: 13.5, ...style }}>{children}</div>
);

// Formatos comunes
export const pesos = n => { const v = Math.round(Number(n || 0)); return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('es-CO'); };
export const kilos = n => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' kg';
export const iniciales = n => (n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
