import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import { useBodegaActiva } from '../bodega';
import Ventas, { ReciboVenta } from './Ventas';
import Compras, { Recibo as ReciboCompra } from './Compras';
import { exportarCajaExcel, exportarCajaPDF } from '../utils/exportar';

const fmt    = n => Number(n || 0).toLocaleString('es-CO');
const fmtCOP = n => '$' + fmt(n);

const CONCEPTOS_MANUAL = {
    ingreso: [
        { label: 'Abono cliente', icon: '💚' },
        { label: 'Devolución',    icon: '🔄' },
        { label: 'Otro ingreso',  icon: '💵' },
    ],
    egreso: [
        { label: 'Gastos operativos',   icon: '🔧' },
        { label: 'Préstamo reciclador', icon: '👤' },
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
        if (d) { setCaja(d.caja); setAperturaHecha(false); }
    };

    const necesitaApertura = caja?.estado === 'abierta'
        && (caja?.saldo_inicial ?? 0) === 0
        && !(caja?.movimientos?.length)
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
        const entrada = window.prompt(`Base del día — efectivo con el que arranca ${bodegaNombre || 'la caja'} hoy:`, actual ? String(actual) : '');
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
    const PanelResumen = ({ compact = false }) => (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Selector bodega superadmin */}
            {user?.rol === 'superadmin' && bodegas.length > 0 && (
                <div style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
                    <select value={bodega_id} onChange={e => setBodegaId(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}>
                        {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                </div>
            )}

            {/* 4 tarjetas */}
            <div style={{ padding: compact ? '12px 16px' : '14px 16px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>
                    Resumen del día
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: compact ? 8 : 10 }}>
                    {[
                        { label: 'Base del día', v: caja?.saldo_inicial, c: '#6b7280', editable: true },
                        { label: 'Ingresos',      v: caja?.total_ingresos, c: '#059669' },
                        { label: 'Salidas',       v: caja?.total_egresos,  c: '#dc2626' },
                        { label: 'Saldo actual',  v: caja?.saldo_final,    c: '#1a5c2a' },
                    ].map(({ label, v, c, editable }) => (
                        <div key={label} style={{ background: '#f9fafb', borderRadius: 10, padding: compact ? '10px 12px' : '12px 14px', position: 'relative' }}>
                            <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .3, display: 'flex', alignItems: 'center', gap: 6 }}>
                                {label}
                                {editable && caja?.estado === 'abierta' && (
                                    <button onClick={editarBase} title="Editar la base del día"
                                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>✏️</button>
                                )}
                            </div>
                            <div style={{ fontSize: compact ? 16 : 17, fontWeight: 800, color: c }}>{fmtCOP(v)}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Movimientos */}
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .5, padding: '10px 16px 6px', flexShrink: 0 }}>
                Movimientos de hoy
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
                {!(caja?.movimientos?.length) ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: '#d1d5db' }}>
                        <div style={{ fontSize: 36 }}>📋</div>
                        <p style={{ fontSize: 12, marginTop: 8 }}>Sin movimientos aún</p>
                    </div>
                ) : [...(caja.movimientos)].reverse().map(m => (
                    <div key={m.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.concepto}</div>
                            <div style={{ fontSize: 11, color: '#9ca3af' }}>{m.hora}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: m.tipo === 'ingreso' ? '#059669' : '#dc2626' }}>
                                {m.tipo === 'ingreso' ? '+' : '-'}{fmtCOP(m.monto)}
                            </div>
                            {/^(venta|compra):/.test(m.referencia || '') && (
                                <button onClick={() => abrirReciboDesdeMov(m.referencia)} title="Imprimir recibo"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 2, lineHeight: 1 }}>
                                    🖨️
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Cerrar / Reabrir */}
            <div style={{ padding: 12, borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
                {caja?.estado === 'abierta' && (
                    <button onClick={cerrar}
                        style={{ width: '100%', padding: '12px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                        🔒 Cerrar caja del día
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
        </div>
    );

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
                <div style={{ fontSize: 48, marginBottom: 12 }}>🏦</div>
                <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>Apertura de caja</h2>
                <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: 14 }}>¿Con cuánto dinero inicia la caja hoy?</p>
                <input ref={aperturaRef} type="number" min="0" step="1000" value={montoApertura}
                    onChange={e => setMontoApertura(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && registrarApertura()}
                    placeholder="$ 0"
                    style={{ width: '100%', padding: '14px 16px', border: '2px solid #d1d5db', borderRadius: 10, fontSize: 28, fontWeight: 700, textAlign: 'right', color: '#1a5c2a', boxSizing: 'border-box', outline: 'none', marginBottom: 8 }} />
                {parseFloat(montoApertura) > 0 && <div style={{ textAlign: 'right', fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>{fmtCOP(montoApertura)}</div>}
                <button onClick={registrarApertura} disabled={loadingApertura}
                    style={{ width: '100%', padding: '14px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
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
            { key: 'compras', icon: '⚖️', label: 'Compras', color: '#d97706' },
            { key: 'ventas',  icon: '📤', label: 'Ventas',  color: '#059669' },
            { key: 'manual',  icon: '💵', label: 'Manual',  color: '#3b82f6' },
            { key: 'resumen', icon: '💰', label: 'Caja',    color: '#1a5c2a' },
        ];
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f0faf0' }}>
                <ModalApertura />
                {reciboOverlay}

                {/* Tab bar superior */}
                <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #e5e7eb', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
                    {TABS.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            style={{ flex: 1, padding: '11px 4px 9px', border: 'none', background: 'none', cursor: 'pointer',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                                borderBottom: tab === t.key ? `3px solid ${t.color}` : '3px solid transparent',
                                color: tab === t.key ? t.color : '#9ca3af' }}>
                            <span style={{ fontSize: 19 }}>{t.icon}</span>
                            <span style={{ fontSize: 10, fontWeight: tab === t.key ? 700 : 400 }}>{t.label}</span>
                        </button>
                    ))}
                </div>

                {/* Contenido */}
                <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column', background: '#fff' }}>
                    {tab === 'compras' && <div style={{ flex: 1, overflow: 'hidden' }}><Compras onCajaChange={cargar} bodegaId={bodega_id} /></div>}
                    {tab === 'ventas'  && <div style={{ flex: 1, overflow: 'auto'  }}><Ventas  onCajaChange={cargar} bodegaId={bodega_id} /></div>}
                    {tab === 'manual'  && <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}><PanelManual /></div>}
                    {tab === 'resumen' && <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}><PanelResumen compact /></div>}
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════════
    // ESCRITORIO: panel izquierdo + panel derecho resumen
    // ══════════════════════════════════════════════════════════════════════
    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <ModalApertura />
            {reciboOverlay}

            {/* Panel izquierdo */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ display: 'flex', background: '#fff', borderBottom: '2px solid #e5e7eb', flexShrink: 0 }}>
                    <TabBtn active={tab === 'compras'} color="#d97706" onClick={() => setTab('compras')}>⚖️ Compras</TabBtn>
                    <TabBtn active={tab === 'ventas'}  color="#059669" onClick={() => setTab('ventas')}>📤 Ventas</TabBtn>
                    <TabBtn active={tab === 'manual'}  color="#3b82f6" onClick={() => setTab('manual')}>💵 Manual</TabBtn>
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
                    {tab === 'manual'  && <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}><PanelManual /></div>}
                </div>
            </div>

            {/* Panel derecho resumen */}
            <div style={{ width: 270, background: '#fff', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>💰 Caja</div>
                    {bodegaNombre && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{bodegaNombre}</div>}
                </div>
                <PanelResumen />
            </div>
        </div>
    );
}

function TabBtn({ active, color, onClick, children }) {
    return (
        <button onClick={onClick} style={{
            flex: 1, padding: '13px 8px', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 13, borderBottom: active ? `3px solid ${color}` : '3px solid transparent',
            color: active ? color : '#6b7280', transition: 'all .15s', whiteSpace: 'nowrap',
        }}>
            {children}
        </button>
    );
}
