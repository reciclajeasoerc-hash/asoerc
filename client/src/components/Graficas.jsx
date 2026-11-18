import React, { useEffect, useRef, useState } from 'react';

export const pesos = n => { const v = Math.round(Number(n || 0)); return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('es-CO'); };
export const kilos = n => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' kg';
export const compacto = n => {
    const v = Math.abs(Number(n || 0));
    if (v >= 1e9) return '$' + (n / 1e9).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' MM';
    if (v >= 1e6) return '$' + (n / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' M';
    if (v >= 1e3) return '$' + Math.round(n / 1e3).toLocaleString('es-CO') + ' mil';
    return '$' + Math.round(n);
};
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const fechaCorta = iso => { const [, m, d] = iso.split('-'); return `${Number(d)} ${MESES[Number(m) - 1]}`; };

// Ancho real del contenedor (las gráficas se redibujan al girar el celular)
function useAncho() {
    const ref = useRef(null);
    const [ancho, setAncho] = useState(0);
    useEffect(() => {
        if (!ref.current) return;
        const ro = new ResizeObserver(([e]) => setAncho(Math.floor(e.contentRect.width)));
        ro.observe(ref.current);
        return () => ro.disconnect();
    }, []);
    return [ref, ancho];
}

// Escala "bonita" del eje: 0 → máximo redondeado, en 4 pasos
function escala(max) {
    if (max <= 0) return { tope: 1, pasos: [0] };
    const bruto = max / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    const paso = [1, 2, 2.5, 5, 10].map(f => f * mag).find(p => p >= bruto);
    return { tope: paso * 4, pasos: [0, 1, 2, 3, 4].map(i => i * paso) };
}

export const SERIES = [
    { clave: 'compras', nombre: 'Compras', color: '#16a34a' },
    { clave: 'ventas',  nombre: 'Ventas',  color: '#2563eb' },
];

// ── Línea con área: compras vs ventas por día ────────────────────────────────
export function LineaDiaria({ serie, alto = 260, campo = v => v }) {
    const [ref, ancho] = useAncho();
    const [hover, setHover] = useState(null);
    const movil = ancho < 520;
    const m = { izq: movil ? 46 : 58, der: 12, arr: 14, aba: 28 };
    const w = Math.max(ancho - m.izq - m.der, 10);
    const h = alto - m.arr - m.aba;
    const datos = serie.map(campo);
    const max = Math.max(...datos.flatMap(d => [d.compras, d.ventas]), 0);
    const { tope, pasos } = escala(max);
    const x = i => m.izq + (serie.length <= 1 ? w / 2 : (i * w) / (serie.length - 1));
    const y = v => m.arr + h - (v / tope) * h;
    const linea = k => datos.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join('');
    const area = k => `${linea(k)}L${x(datos.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
    const cadaCuanto = Math.ceil(serie.length / (movil ? 4 : 7));

    const mover = e => {
        const r = e.currentTarget.getBoundingClientRect();
        const px = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
        const i = Math.round(((px - m.izq) / w) * (serie.length - 1));
        setHover(Math.min(Math.max(i, 0), serie.length - 1));
    };

    const d = hover != null ? datos[hover] : null;
    const tipIzq = hover != null && x(hover) > ancho / 2;

    return (
        <div ref={ref} style={{ position: 'relative', width: '100%' }}>
            {ancho > 0 && (
                <svg width={ancho} height={alto} style={{ display: 'block', touchAction: 'pan-y' }}
                    onMouseMove={mover} onMouseLeave={() => setHover(null)} onTouchStart={mover} onTouchMove={mover}
                    role="img" aria-label="Compras y ventas por día">
                    <defs>
                        {SERIES.map(s => (
                            <linearGradient key={s.clave} id={`g-${s.clave}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={s.color} stopOpacity=".18" />
                                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                            </linearGradient>
                        ))}
                    </defs>
                    {pasos.map(p => (
                        <g key={p}>
                            <line x1={m.izq} x2={ancho - m.der} y1={y(p)} y2={y(p)} stroke="#e6eaf0" strokeDasharray={p ? '3 4' : ''} />
                            <text x={m.izq - 8} y={y(p) + 4} textAnchor="end" fontSize="11.5" fill="#8592a6">{compacto(p)}</text>
                        </g>
                    ))}
                    {serie.map((s, i) => ((i % cadaCuanto === 0 && serie.length - 1 - i >= cadaCuanto * .6) || i === serie.length - 1) && (
                        <text key={s.fecha} x={x(i)} y={alto - 8} textAnchor={i === 0 ? 'start' : i === serie.length - 1 ? 'end' : 'middle'} fontSize="11.5" fill="#8592a6">{fechaCorta(s.fecha)}</text>
                    ))}
                    {SERIES.map(s => <path key={'a' + s.clave} d={area(s.clave)} fill={`url(#g-${s.clave})`} />)}
                    {SERIES.map(s => <path key={'l' + s.clave} d={linea(s.clave)} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />)}
                    {/* último punto marcado */}
                    {SERIES.map(s => <circle key={'p' + s.clave} cx={x(datos.length - 1)} cy={y(datos[datos.length - 1][s.clave])} r="4.5" fill="#fff" stroke={s.color} strokeWidth="2.2" />)}
                    {hover != null && (
                        <g pointerEvents="none">
                            <line x1={x(hover)} x2={x(hover)} y1={m.arr} y2={y(0)} stroke="#94a3b8" strokeDasharray="3 3" />
                            {SERIES.map(s => <circle key={'h' + s.clave} cx={x(hover)} cy={y(d[s.clave])} r="5" fill={s.color} stroke="#fff" strokeWidth="2" />)}
                        </g>
                    )}
                </svg>
            )}
            {d && (
                <div style={{ position: 'absolute', top: 6, [tipIzq ? 'right' : 'left']: tipIzq ? ancho - x(hover) + 12 : x(hover) + 12, background: 'var(--noche)', color: '#fff', borderRadius: 9, padding: '9px 12px', fontSize: 13, pointerEvents: 'none', boxShadow: 'var(--sombra-alta)', minWidth: 150, zIndex: 2 }}>
                    <div className="etiqueta" style={{ color: 'var(--noche-tenue)', marginBottom: 5 }}>{fechaCorta(serie[hover].fecha)}</div>
                    {SERIES.map(s => (
                        <div key={s.clave} style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'space-between', marginTop: 2 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#cbd5e1' }}><span style={{ width: 9, height: 9, borderRadius: 2, background: s.color }} />{s.nombre}</span>
                            <b className="cifra" style={{ fontSize: 15 }}>{pesos(d[s.clave])}</b>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Barras horizontales (un solo color: la longitud es lo que se compara) ────
export function BarrasH({ filas, valor, etiqueta, detalle, color = 'var(--verde)', vacio = 'Sin datos en el periodo' }) {
    if (!filas.length) return <div style={{ color: 'var(--texto-3)', fontSize: 13.5, padding: '18px 0', textAlign: 'center' }}>{vacio}</div>;
    const max = Math.max(...filas.map(valor), 1);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {filas.map((f, i) => (
                <div key={i} title={`${f.nombre}: ${etiqueta(f)}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5, marginBottom: 5 }}>
                        <span style={{ fontWeight: 600, color: 'var(--texto)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.nombre}</span>
                        <span style={{ whiteSpace: 'nowrap' }}>
                            <b className="cifra" style={{ fontSize: 15, color: 'var(--texto)' }}>{etiqueta(f)}</b>
                            {detalle && <span style={{ color: 'var(--texto-3)', fontSize: 12, marginLeft: 6 }}>{detalle(f)}</span>}
                        </span>
                    </div>
                    <div style={{ height: 8, background: '#edf1f5', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max((valor(f) / max) * 100, 1.5)}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .4s ease' }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Minigráfica para los indicadores ─────────────────────────────────────────
export function Mini({ valores, color, alto = 34, ancho = 96 }) {
    if (!valores.length) return null;
    const max = Math.max(...valores, 1);
    const pts = valores.map((v, i) => [(i * ancho) / Math.max(valores.length - 1, 1), alto - 3 - (v / max) * (alto - 6)]);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
    return (
        <svg width={ancho} height={alto} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
            <path d={`${d}L${ancho},${alto}L0,${alto}Z`} fill={color} opacity=".12" />
            <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}
