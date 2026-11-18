import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import { useBodegaActiva } from '../bodega';
import Ventas, { ReciboVenta } from './Ventas';
import Compras, { Recibo as ReciboCompra } from './Compras';
import { exportarCajaExcel, exportarCajaPDF } from '../utils/exportar';
import Icono from '../components/Icono';

// Tarjetas del resumen de caja (colores del diseño "Operación")
const TONOS_CAJA = {
    base:     { fondo: '#fff',               borde: 'var(--noche)',  tit: 'var(--texto-2)',    val: 'var(--texto)',     sub: 'var(--texto-3)' },
    ingresos: { fondo: 'var(--verde-suave)', borde: 'var(--verde)',  tit: 'var(--verde-osc)',  val: 'var(--verde-osc)', sub: 'var(--verde-osc)' },
    salidas:  { fondo: 'var(--rojo-suave)',  borde: 'var(--rojo)',   tit: 'var(--rojo)',       val: 'var(--rojo)',      sub: 'var(--rojo)' },
    saldo:    { fondo: 'var(--noche)',       borde: 'var(--noche)',  tit: 'var(--ambar)',      val: '#fff',             sub: 'var(--verde-vivo)' },
};

const fmt    = n => Number(n || 0).toLocaleString('es-CO');
const fmtCOP = n => (Number(n) < 0 ? '-$' + fmt(-Number(n)) : '$' + fmt(n));
// Fecha del negocio (Colombia), igual que el servidor: después de las 7pm no salta a "mañana".
const hoyCO  = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

const CONCEPTOS_MANUAL = {
    ingreso: [
        { label: 'Abono cliente', icon: '💚' },
        { label: 'Devolución',    icon: '🔄' },
        { label: 'Otro ingreso',  icon: '💵' },
    ],
    egreso: [
        { label: 'Gastos operativos',   icon: '🔧' },
        { label: 'Pago nómina',         icon: '💼' },
        { label: 'Otro egreso',         icon: '💸' },
    ],
};

function useMobile() {
    const [m, setM] = useState(window.innerWidth < 900);
    useEffect(() => {
        const fn = () => setM(window.innerWidth < 900);
        window.addEventListener('resize', fn);
        return () => window.removeEventListener('resize', fn);
    }, []);
    return m;
}

export default function Caja() {
    const { user } = useAuth();
    const filtroBodega = useBodegaActiva(user); // bodega elegida en la barra lateral
    const isMobile = useMobile();
    const [caja, setCaja]         = useState(null);
    const [bodegas, setBodegas]   = useState([]);
    const [bodega_id, setBodegaId]= useState('');
    const [tab, setTab]           = useState('compras');
    // Ver la caja de otro día (solo lectura). fechaVer === hoy → la caja de trabajo normal.
    const [fechaVer, setFechaVer] = useState(hoyCO());
    const [cajaVer, setCajaVer]   = useState(null);
    const [cargandoVer, setCargandoVer] = useState(false);

    const [montoApertura, setMontoApertura] = useState('');
    const [loadingApertura, setLoadingApertura] = useState(false);
    const [aperturaHecha, setAperturaHecha] = useState(false);
    const aperturaRef = useRef(null);

    const [tipo, setTipo]           = useState('ingreso');
    const [paso, setPaso]           = useState('concepto');
    const [concepto, setConcepto]   = useState('');
    const [customConcepto, setCustomConcepto] = useState('');
    const [monto, setMonto]         = useState('');
    const [msg, setMsg]             = useState('');
    const [loading, setLoading]     = useState(false);
    const [mostrarDescarga, setMostrarDescarga] = useState(false);
    const [recibo, setRecibo] = useState(null); // { tipo: 'venta'|'compra', data }
    const montoRef = useRef(null);

    // Abre el recibo de la venta/compra enlazada a un movimiento de caja (referencia = "venta:ID" / "compra:ID")
    const abrirReciboDesdeMov = async (referencia) => {
        if (!referencia) return;
        const [tipo, id] = String(referencia).split(':');
        if (!id) return;
        try {
            if (tipo === 'venta') {
                const d = await api.get(`/ventas/${id}`);
                setRecibo({ tipo: 'venta', data: d.venta });
            } else if (tipo === 'compra') {
                const d = await api.get(`/compras/${id}`);
                setRecibo({ tipo: 'compra', data: d.compra });
            }
        } catch (e) { alert('No se pudo cargar el recibo: ' + (e.msg || e.message)); }
    };

    useEffect(() => {
        if (user?.rol === 'superadmin') {
            api.get('/bodegas').then(d => {
                setBodegas(d.bodegas || []);
                const inicial = filtroBodega || (d.bodegas[0] ? String(d.bodegas[0].id) : '');
                if (inicial) setBodegaId(inicial);
            });
        } else {
            setBodegaId(String(user?.bodega_id || ''));
        }
    }, []);

    // Cuando el superadmin cambia la bodega en la barra lateral, la caja cambia también.
    useEffect(() => { if (user?.rol === 'superadmin' && filtroBodega) setBodegaId(filtroBodega); }, [filtroBodega]);

    useEffect(() => { if (bodega_id) cargar(); }, [bodega_id]);
    useEffect(() => {
        if (necesitaApertura && aperturaRef.current) aperturaRef.current.focus();
    }, [caja]);

    const cargar = async (bId) => {
        const bid = bId ? String(bId) : bodega_id;
        if (bId && String(bId) !== bodega_id) setBodegaId(String(bId));
        const d = await api.get(`/caja?bodega_id=${bid}`).catch(() => null);
        if (d) {
            setCaja(d.caja); setAperturaHecha(false);
            // Sugerir en la apertura lo que quedó del día anterior (si quedó plata)
            const sug = parseFloat(d.caja?.saldo_inicial) || 0;
            setMontoApertura(sug > 0 ? String(sug) : '');
        }
    };

    const viendoHoy = fechaVer === hoyCO();
    useEffect(() => {
        if (!bodega_id || viendoHoy) { setCajaVer(null); return; }
        let vigente = true; // descarta respuestas de una fecha/bodega que ya no está elegida
        setCargandoVer(true); setCajaVer(null);
        api.get(`/caja/dia?bodega_id=${bodega_id}&fecha=${fechaVer}`)
            .then(d => { if (vigente) setCajaVer(d.caja || null); })
            .catch(() => { if (vigente) setCajaVer(null); })
            .finally(() => { if (vigente) setCargandoVer(false); });
        return () => { vigente = false; };
    }, [fechaVer, bodega_id]);

    // La base se pide mientras nadie la haya confirmado hoy (antes se comparaba el DECIMAL,
    // que llega como texto "0.00", contra el número 0 → nunca se pedía).
    const necesitaApertura = viendoHoy
        && caja?.estado === 'abierta'
        && !caja?.base_confirmada
        && !aperturaHecha;

    // Registra la BASE del día (saldo inicial), no un movimiento de ingreso.
    const registrarApertura = async () => {
        const valor = parseFloat(montoApertura) || 0;
        setLoadingApertura(true);
        try {
            const d = await api.put(`/caja/${caja.id}/base`, { saldo_inicial: valor });
            setCaja(d.caja); setMontoApertura(''); setAperturaHecha(true);
        } catch (e) { alert(e.msg || e.message); }
        finally { setLoadingApertura(false); }
    };

    // Editar/corregir la base del día en cualquier momento mientras la caja esté abierta.
    const editarBase = async () => {
        if (!caja || caja.estado === 'cerrada') return;
        const actual = parseFloat(caja.saldo_inicial || 0);
        const entrada = window.prompt(`Base del día — efectivo con el que arranca ${caja?.bodega?.nombre || bodegaNombre || 'la caja'} hoy:`, actual ? String(actual) : '');
        if (entrada === null) return;
        const valor = parseFloat(String(entrada).replace(/[^\d.]/g, ''));
        if (isNaN(valor) || valor < 0) return alert('Base inválida');
        try {
            const d = await api.put(`/caja/${caja.id}/base`, { saldo_inicial: valor });
            setCaja(d.caja);
        } catch (e) { alert(e.msg || e.message); }
    };

    const seleccionarConcepto = (c) => {
        setConcepto(c); setCustomConcepto(''); setPaso('monto');
        setTimeout(() => montoRef.current?.focus(), 80);
    };
    const usarCustom = () => {
        const c = customConcepto.trim();
        if (!c) return;
        setConcepto(c); setPaso('monto');
        setTimeout(() => montoRef.current?.focus(), 80);
    };
    const registrar = async () => {
        const conceptoFinal = concepto || customConcepto.trim();
        if (!conceptoFinal) return setMsg('Selecciona o escribe un concepto');
        if (!monto || parseFloat(monto) <= 0) return setMsg('Ingresa un monto válido');
        setLoading(true);
        try {
            const d = await api.post(`/caja/${caja.id}/movimientos`, { tipo, concepto: conceptoFinal, monto: parseFloat(monto), referencia: '' });
            setCaja(d.caja);
            setConcepto(''); setCustomConcepto(''); setMonto(''); setMsg(''); setPaso('concepto');
        } catch (e) { setMsg(e.msg || e.message); }
        finally { setLoading(false); }
    };

    const cerrar = async () => {
        if (!window.confirm('¿Cerrar la caja del día?')) return;
        const d = await api.post(`/caja/${caja.id}/cerrar`, {});
        setCaja(d.caja); setMostrarDescarga(true);
    };

    const bodegaNombre = bodegas.find(b => String(b.id) === bodega_id)?.nombre || '';
    const colorManual  = tipo === 'ingreso' ? '#059669' : '#dc2626';

    // ── Panel Resumen (compartido móvil+escritorio) ─────────────────────────
    const PanelResumen = ({ compact = false }) => {
        const cm = viendoHoy ? caja : cajaVer; // caja mostrada
        const enRojo = cm && parseFloat(cm.saldo_final) < 0;
        // Una vez registrada la base, solo el superadmin la corrige (igual lo valida el servidor)
        const puedeEditarBase = viendoHoy && (user?.rol === 'superadmin' || !cm?.base_confirmada);
        return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Selector bodega superadmin */}
            {user?.rol === 'superadmin' && bodegas.length > 0 && (
                <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
                    <select value={bodega_id} onChange={e => setBodegaId(e.target.value)} aria-label="Bodega de la caja"
                        style={{ width: '100%', height: 40, padding: '0 10px', borderRadius: 8, border: '1.5px solid var(--borde-fuerte)', fontFamily: 'var(--fuente-tit)', fontWeight: 700, fontSize: 15 }}>
                        {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                </div>
            )}

            {/* 4 tarjetas */}
            <div style={{ padding: compact ? '12px 14px' : '14px 16px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                    <div className="etiqueta" style={{ color: 'var(--texto-2)' }}>
                        {viendoHoy ? 'Resumen de hoy' : 'Resumen del día'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="date" value={fechaVer} max={hoyCO()} onChange={e => e.target.value && setFechaVer(e.target.value)}
                            title="Ver la caja de otro día" aria-label="Ver la caja de otro día"
                            style={{ height: 34, padding: '0 8px', borderRadius: 7, border: '1.5px solid var(--borde-fuerte)', fontSize: 13 }} />
                        {!viendoHoy && (
                            <button onClick={() => setFechaVer(hoyCO())}
                                style={{ height: 34, padding: '0 10px', borderRadius: 7, border: '1.5px solid var(--noche)', background: 'var(--noche)', color: '#fff', fontSize: 13 }}>Hoy</button>
                        )}
                    </div>
                </div>
                {!viendoHoy && !cargandoVer && !cajaVer && (
                    <div style={{ background: '#f1f5f9', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--texto-2)', marginBottom: 10 }}>
                        Ese día no hubo caja en esta bodega.
                    </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: compact ? 8 : 10 }}>
                    {[
                        { label: 'Base del día', v: cm?.saldo_inicial, tono: 'base', editable: puedeEditarBase,
                          sub: cm?.base_confirmada ? 'Registrada' : 'Sin registrar' },
                        { label: 'Ingresos (+)', v: cm?.total_ingresos, tono: 'ingresos',
                          sub: `${(cm?.movimientos || []).filter(m => m.tipo === 'ingreso').length} movimientos` },
                        { label: 'Salidas (−)', v: cm?.total_egresos, tono: 'salidas',
                          sub: `${(cm?.movimientos || []).filter(m => m.tipo === 'egreso').length} movimientos` },
                        { label: viendoHoy && cm?.estado !== 'cerrada' ? 'Saldo actual' : 'Saldo final', v: cm?.saldo_final, tono: 'saldo',
                          sub: 'En efectivo', rojo: enRojo },
                    ].map(({ label, v, tono, editable, sub, rojo }) => {
                        const t = TONOS_CAJA[tono];
                        return (
                            <div key={label} style={{ background: t.fondo, border: `2px solid ${t.borde}`, borderRadius: 10, padding: compact ? '10px 11px' : '12px 13px', minWidth: 0 }}>
                                <div className="etiqueta" style={{ fontSize: 12, color: t.tit, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {label}
                                    {editable && caja?.estado === 'abierta' && (
                                        <button onClick={editarBase} title="Editar la base del día" aria-label="Editar la base del día"
                                            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>✏️</button>
                                    )}
                                </div>
                                <div className="cifra" style={{ fontSize: compact ? 'clamp(17px, 5vw, 21px)' : 'clamp(16px, 1.3vw, 22px)', color: rojo ? '#fca5a5' : t.val, lineHeight: 1.05, whiteSpace: 'nowrap' }}>{fmtCOP(v)}</div>
                                <div className="etiqueta" style={{ fontSize: 11, color: t.sub, marginTop: 5, opacity: .9 }}>{sub}</div>
                            </div>
                        );
                    })}
                </div>
                {viendoHoy && cm?.base_confirmada && user?.rol !== 'superadmin' && (
                    <div style={{ fontSize: 12, color: 'var(--texto-3)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Icono nombre="candado" tam={14} /> La base ya se registró. Si hay que corregirla, la cambia el superadministrador.</div>
                )}
                {enRojo && (
                    <div style={{ background: 'var(--ambar-suave)', border: '2px solid var(--ambar)', borderRadius: 9, padding: '9px 11px', fontSize: 12.5, color: '#6b4a00', marginTop: 10 }}>
                        <b className="etiqueta" style={{ display: 'block', color: '#4a3300', marginBottom: 2 }}>⚠️ La caja da negativo</b>
                        Salió más plata de la que se registró. {!viendoHoy ? 'Ese día faltó registrar la base o algún ingreso.' : puedeEditarBase ? 'Revisa la base del día (✏️) o registra el ingreso que falta en Manual.' : 'Registra el ingreso que falta en Manual o avisa al superadministrador.'}
                    </div>
                )}
            </div>

            {/* Movimientos */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 16px 8px', flexShrink: 0 }}>
                <span className="tit-seccion" style={{ fontSize: 15 }}>{viendoHoy ? 'Movimientos de hoy' : `Movimientos del ${fechaVer}`}</span>
                <span style={{ fontSize: 12.5, color: 'var(--texto-3)' }}>{cm?.movimientos?.length || 0}</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {!(cm?.movimientos?.length) ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--texto-3)' }}>
                        <Icono nombre="caja" tam={34} grosor={1.5} style={{ opacity: .5 }} />
                        <p style={{ fontSize: 13, marginTop: 8 }}>Sin movimientos aún</p>
                    </div>
                ) : [...(cm.movimientos)].reverse().map(m => {
                    const ing = m.tipo === 'ingreso';
                    return (
                        <div key={m.id} style={{ padding: '9px 10px', border: '1.5px solid var(--borde)', borderRadius: 9, background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.concepto}</div>
                                <div style={{ fontSize: 12, color: 'var(--texto-3)' }}>{m.hora}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                <span className="cifra" style={{ fontSize: 14.5, padding: '4px 8px', borderRadius: 6, background: ing ? 'var(--verde-suave)' : 'var(--rojo-suave)', border: `1px solid ${ing ? 'var(--verde-borde)' : 'var(--rojo-borde)'}`, color: ing ? 'var(--verde-osc)' : 'var(--rojo)' }}>
                                    {ing ? '+' : '−'}{fmtCOP(m.monto)}
                                </span>
                                {/^(venta|compra):/.test(m.referencia || '') && (
                                    <button onClick={() => abrirReciboDesdeMov(m.referencia)} title="Imprimir recibo" aria-label="Imprimir recibo"
                                        style={{ background: '#f1f5f9', border: '1.5px solid var(--borde)', borderRadius: 7, cursor: 'pointer', fontSize: 14, width: 40, height: 38, lineHeight: 1 }}>
                                        🖨️
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Días anteriores: solo lectura + descarga */}
            {!viendoHoy && cm && (
                <div style={{ padding: 12, borderTop: '1px solid #e5e7eb', flexShrink: 0, display: 'flex', gap: 6 }}>
                    <button onClick={() => exportarCajaExcel({ caja: cm, movimientos: cm.movimientos || [], fecha: cm.fecha })}
                        style={{ flex: 1, padding: '9px 4px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        📊 Excel
                    </button>
                    <button onClick={() => exportarCajaPDF({ caja: cm, movimientos: cm.movimientos || [], fecha: cm.fecha })}
                        style={{ flex: 1, padding: '9px 4px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        📄 PDF
                    </button>
                </div>
            )}

            {/* Cerrar / Reabrir (solo la caja de hoy) */}
            {viendoHoy && (
            <div style={{ padding: 12, borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
                {caja?.estado === 'abierta' && (
                    <button onClick={cerrar}
                        style={{ width: '100%', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--noche)', color: 'var(--ambar)', border: 'none', borderRadius: 10, fontFamily: 'var(--fuente-tit)', fontSize: 18, fontWeight: 800, letterSpacing: .6, textTransform: 'uppercase', cursor: 'pointer' }}>
                        <Icono nombre="candado" tam={21} grosor={2.2} /> Cerrar caja del día
                    </button>
                )}
                {caja?.estado === 'cerrada' && (
                    <>
                        <div style={{ background: '#d1fae5', borderRadius: 8, padding: '10px 12px', textAlign: 'center', marginBottom: 8 }}>
                            <div style={{ fontWeight: 700, color: '#059669', fontSize: 14 }}>✅ Caja cerrada</div>
                            <div style={{ fontSize: 12, color: '#065f46', marginTop: 2 }}>Saldo final: {fmtCOP(caja.saldo_final)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                            <button onClick={() => exportarCajaExcel({ caja, movimientos: caja.movimientos || [], fecha: caja.fecha })}
                                style={{ flex: 1, padding: '9px 4px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                📊 Excel
                            </button>
                            <button onClick={() => exportarCajaPDF({ caja, movimientos: caja.movimientos || [], fecha: caja.fecha })}
                                style={{ flex: 1, padding: '9px 4px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                📄 PDF
                            </button>
                        </div>
                        <button onClick={async () => {
                            if (!window.confirm('¿Reabrir la caja?')) return;
                            const d = await api.post(`/caja/${caja.id}/reabrir`, {});
                            setCaja(d.caja); setMostrarDescarga(false);
                        }} style={{ width: '100%', padding: '9px', background: '#fff', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            🔓 Reabrir caja
                        </button>
                    </>
                )}
            </div>
            )}
        </div>
        );
    };

    // ── Panel Manual ───────────────────────────────────────────────────────
    const PanelManual = () => (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
            <div style={{ display: 'flex', background: '#e5e7eb', borderRadius: 10, padding: 4, marginBottom: 20 }}>
                {['ingreso','egreso'].map(t => (
                    <button key={t} onClick={() => { setTipo(t); setPaso('concepto'); setConcepto(''); setCustomConcepto(''); setMonto(''); setMsg(''); }}
                        style={{ flex: 1, padding: '12px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14,
                            background: tipo === t ? (t === 'ingreso' ? '#059669' : '#dc2626') : 'transparent',
                            color: tipo === t ? '#fff' : '#6b7280', transition: 'all .15s' }}>
                        {t === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}
                    </button>
                ))}
            </div>

            {paso === 'concepto' ? (
                <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 12 }}>
                        ¿Qué vas a registrar?
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                        {CONCEPTOS_MANUAL[tipo].map(c => (
                            <button key={c.label} onClick={() => seleccionarConcepto(c.label)}
                                style={{ padding: '18px 10px', background: '#fff', border: '2px solid #e5e7eb', borderRadius: 12, cursor: 'pointer', textAlign: 'center' }}>
                                <div style={{ fontSize: 26, marginBottom: 6 }}>{c.icon}</div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{c.label}</div>
                            </button>
                        ))}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 8 }}>
                        O escribe un concepto
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input value={customConcepto} onChange={e => setCustomConcepto(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && usarCustom()}
                            placeholder="Concepto personalizado..."
                            style={{ flex: 1, padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none' }} />
                        <button onClick={usarCustom}
                            style={{ padding: '12px 18px', background: colorManual, color: '#fff', border: 'none', borderRadius: 8, fontSize: 18, cursor: 'pointer', fontWeight: 700 }}>→</button>
                    </div>
                </>
            ) : (
                <>
                    <button onClick={() => { setPaso('concepto'); setMonto(''); setMsg(''); }}
                        style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 14, marginBottom: 14, padding: 0 }}>
                        ← Cambiar concepto
                    </button>
                    <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 10px rgba(0,0,0,.08)' }}>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Concepto</div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: colorManual, marginBottom: 20 }}>{concepto}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Monto ($) *</div>
                        <input ref={montoRef} type="number" min="0" step="1000" value={monto}
                            onChange={e => setMonto(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && registrar()}
                            placeholder="0"
                            style={{ width: '100%', padding: '12px 14px', border: `2px solid ${monto ? colorManual : '#d1d5db'}`, borderRadius: 8,
                                fontSize: 28, fontWeight: 700, textAlign: 'right', color: colorManual, boxSizing: 'border-box', outline: 'none' }} />
                        {parseFloat(monto) > 0 && <div style={{ textAlign: 'right', fontSize: 13, color: '#9ca3af', marginTop: 6 }}>{fmtCOP(monto)}</div>}
                        {msg && <p style={{ color: '#dc2626', fontSize: 13, margin: '10px 0 0' }}>{msg}</p>}
                        <button onClick={registrar} disabled={loading}
                            style={{ width: '100%', marginTop: 18, padding: '14px', background: colorManual, color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                            {loading ? 'Registrando...' : (tipo === 'ingreso' ? '↑ Registrar ingreso' : '↓ Registrar egreso')}
                        </button>
                    </div>
                </>
            )}
        </div>
    );

    // ── Modal apertura ─────────────────────────────────────────────────────
    const ModalApertura = () => necesitaApertura ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 420, boxShadow: '0 24px 60px rgba(0,0,0,.25)', textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--verde-suave)', border: '2px solid var(--verde)', color: 'var(--verde-osc)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><Icono nombre="caja" tam={32} /></div>
                <h2 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5 }}>Apertura de caja</h2>
                <div style={{ display: 'inline-block', background: '#dcfce7', color: '#166534', borderRadius: 999, padding: '4px 12px', fontSize: 14, fontWeight: 700, marginBottom: 10 }}>🏭 {caja?.bodega?.nombre || bodegaNombre || 'Bodega'}</div>
                <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: 14 }}>¿Con cuánto dinero inicia la caja hoy?{parseFloat(caja?.saldo_inicial) > 0 ? <><br /><span style={{ fontSize: 12 }}>Sugerido: lo que quedó al cerrar el día anterior. Corrígelo si no es lo que hay.</span></> : null}</p>
                <input ref={aperturaRef} type="number" min="0" step="1000" value={montoApertura}
                    onChange={e => setMontoApertura(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && registrarApertura()}
                    placeholder="$ 0"
                    style={{ width: '100%', padding: '14px 16px', border: '2px solid #d1d5db', borderRadius: 10, fontSize: 28, fontWeight: 700, textAlign: 'right', color: 'var(--verde-osc)', boxSizing: 'border-box', outline: 'none', marginBottom: 8 }} />
                {parseFloat(montoApertura) > 0 && <div style={{ textAlign: 'right', fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>{fmtCOP(montoApertura)}</div>}
                <button onClick={registrarApertura} disabled={loadingApertura}
                    style={{ width: '100%', padding: '14px', background: 'var(--verde-osc)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                    {loadingApertura ? 'Abriendo...' : '✅ Abrir caja'}
                </button>
                <p style={{ margin: '12px 0 0', fontSize: 12, color: '#9ca3af' }}>Si no hay efectivo inicial, presiona Abrir caja con $0</p>
            </div>
        </div>
    ) : null;

    // ── Overlay recibo (reimprimir venta/compra desde un movimiento) ────────
    const reciboOverlay = recibo ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, overflowY: 'auto', padding: 16 }}>
            <div style={{ maxWidth: 520, margin: '0 auto' }}>
                {recibo.tipo === 'venta'
                    ? <ReciboVenta  venta={recibo.data}  onClose={() => setRecibo(null)} />
                    : <ReciboCompra compra={recibo.data} onClose={() => setRecibo(null)} />}
            </div>
        </div>
    ) : null;

    // ══════════════════════════════════════════════════════════════════════
    // MÓVIL: 4 tabs en barra superior
    // ══════════════════════════════════════════════════════════════════════
    if (isMobile) {
        const TABS = [
            { key: 'compras', icono: 'compras', label: 'Compras' },
            { key: 'ventas',  icono: 'ventas',  label: 'Ventas' },
            { key: 'manual',  icono: 'remisiones', label: 'Manual' },
            { key: 'resumen', icono: 'caja',    label: 'Caja' },
        ];
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--fondo)' }}>
                {ModalApertura()}
                {reciboOverlay}

                {/* Pestañas superiores */}
                <div role="tablist" style={{ display: 'flex', gap: 6, background: '#fff', borderBottom: '1.5px solid var(--borde)', flexShrink: 0, padding: '8px 8px' }}>
                    {TABS.map(t => {
                        const activo = tab === t.key;
                        return (
                            <button key={t.key} role="tab" aria-selected={activo} onClick={() => setTab(t.key)}
                                style={{ flex: 1, minHeight: 52, border: activo ? '2px solid var(--verde)' : '1.5px solid var(--borde)', borderRadius: 10, cursor: 'pointer',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                                    background: activo ? 'var(--verde)' : '#fff', color: activo ? '#fff' : 'var(--texto-2)' }}>
                                <Icono nombre={t.icono} tam={20} grosor={activo ? 2.2 : 1.9} />
                                <span style={{ fontFamily: 'var(--fuente-tit)', fontSize: 13.5, fontWeight: activo ? 800 : 600, letterSpacing: .3 }}>{t.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Contenido */}
                <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column', background: '#fff' }}>
                    {tab === 'compras' && <div style={{ flex: 1, overflow: 'hidden' }}><Compras onCajaChange={cargar} bodegaId={bodega_id} /></div>}
                    {tab === 'ventas'  && <div style={{ flex: 1, overflow: 'auto'  }}><Ventas  onCajaChange={cargar} bodegaId={bodega_id} /></div>}
                    {tab === 'manual'  && <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{PanelManual()}</div>}
                    {tab === 'resumen' && <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{PanelResumen({ compact: true })}</div>}
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════════
    // ESCRITORIO: panel izquierdo + panel derecho resumen
    // ══════════════════════════════════════════════════════════════════════
    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            {ModalApertura()}
            {reciboOverlay}

            {/* Panel izquierdo */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div role="tablist" style={{ display: 'flex', background: '#fff', borderBottom: '2px solid var(--borde)', flexShrink: 0, padding: '0 8px' }}>
                    <TabBtn active={tab === 'compras'} icono="compras" onClick={() => setTab('compras')}>Compras</TabBtn>
                    <TabBtn active={tab === 'ventas'}  icono="ventas" onClick={() => setTab('ventas')}>Ventas</TabBtn>
                    <TabBtn active={tab === 'manual'}  icono="remisiones" onClick={() => setTab('manual')}>Manual</TabBtn>
                </div>
                {user?.rol === 'superadmin' && bodegas.length > 0 && tab !== 'compras' && tab !== 'ventas' && (
                    <div style={{ padding: '10px 20px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                        <select value={bodega_id} onChange={e => setBodegaId(e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}>
                            {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                        </select>
                    </div>
                )}
                <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    {tab === 'compras' && <div style={{ flex: 1, overflow: 'hidden' }}><Compras onCajaChange={cargar} bodegaId={bodega_id} /></div>}
                    {tab === 'ventas'  && <div style={{ flex: 1, overflow: 'auto'  }}><Ventas  onCajaChange={cargar} bodegaId={bodega_id} /></div>}
                    {tab === 'manual'  && <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{PanelManual()}</div>}
                </div>
            </div>

            {/* Panel derecho resumen */}
            <div style={{ width: 'clamp(290px, 23vw, 360px)', background: '#fff', borderLeft: '1.5px solid var(--borde)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <div style={{ padding: '14px 16px 12px', borderBottom: '1.5px solid var(--borde)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--fuente-tit)', fontWeight: 800, fontSize: 21, letterSpacing: .5, textTransform: 'uppercase', color: 'var(--texto)' }}>
                            <Icono nombre="caja" tam={22} style={{ color: 'var(--verde)' }} />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Caja{(bodegaNombre || caja?.bodega?.nombre) ? ' · ' + (bodegaNombre || caja?.bodega?.nombre) : ''}</span>
                        </div>
                    </div>
                    {viendoHoy && caja && (caja.estado === 'abierta'
                        ? <span className="chip" style={{ background: 'var(--verde-suave)', color: 'var(--verde-osc)', border: '1.5px solid var(--verde)', whiteSpace: 'nowrap' }}>● Abierta</span>
                        : <span className="chip" style={{ background: '#f1f5f9', color: 'var(--texto-2)', border: '1.5px solid var(--borde-fuerte)', whiteSpace: 'nowrap' }}>Cerrada</span>)}
                </div>
                {PanelResumen({})}
            </div>
        </div>
    );
}

function TabBtn({ active, icono, onClick, children }) {
    return (
        <button role="tab" aria-selected={active} onClick={onClick} style={{
            flex: 1, maxWidth: 240, height: 58, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            border: 'none', borderBottom: active ? '4px solid var(--noche)' : '4px solid transparent', borderRadius: 0,
            background: active ? 'var(--verde)' : 'transparent', color: active ? '#fff' : 'var(--texto-2)', cursor: 'pointer',
            fontFamily: 'var(--fuente-tit)', fontWeight: active ? 800 : 600, fontSize: 21, letterSpacing: .4, whiteSpace: 'nowrap',
        }}>
            <Icono nombre={icono} tam={23} grosor={active ? 2.2 : 1.9} /> {children}
        </button>
    );
}
