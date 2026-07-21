import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import PickerBuscable from '../components/PickerBuscable';
import { useBodegaActiva } from '../bodega';

const fmt  = n => Number(n || 0).toLocaleString('es-CO');
// Kilos sin ceros sobrantes: 1520.000 → 1520, 700.500 → 700.5
const fmtKg = n => String(parseFloat(n) || 0);
const hoy  = () => new Date().toISOString().slice(0, 10);

const CAT_ICONS = {
    'Metales':       '🔩',
    'Electrónicos':  '📱',
    'Plásticos':     '♻️',
    'Papel y Cartón':'📦',
    'Vidrio':        '🍶',
    'Madera':        '🪵',
    'Otros':         '🔧',
    'Varios':        '🔧',
};
const CAT_COLORS = {
    'Metales':       { bg: '#fef3c7', border: '#d97706', text: '#92400e', active: '#d97706' },
    'Electrónicos':  { bg: '#eff6ff', border: '#2563eb', text: '#1e40af', active: '#2563eb' },
    'Plásticos':     { bg: '#ecfdf5', border: '#059669', text: '#065f46', active: '#059669' },
    'Papel y Cartón':{ bg: '#fff7ed', border: '#ea580c', text: '#9a3412', active: '#ea580c' },
    'Vidrio':        { bg: '#f5f3ff', border: '#7c3aed', text: '#4c1d95', active: '#7c3aed' },
    'Madera':        { bg: '#fef3e2', border: '#a16207', text: '#713f12', active: '#a16207' },
    'Otros':         { bg: '#f0f9ff', border: '#0284c7', text: '#0c4a6e', active: '#0284c7' },
    'Varios':        { bg: '#f0f9ff', border: '#0284c7', text: '#0c4a6e', active: '#0284c7' },
};

function useMobile() {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 900);
    useEffect(() => {
        const fn = () => setIsMobile(window.innerWidth < 900);
        window.addEventListener('resize', fn);
        return () => window.removeEventListener('resize', fn);
    }, []);
    return isMobile;
}

export default function Compras({ onCajaChange, bodegaId: propBodegaId } = {}) {
    const isMobile = useMobile();
    const { user } = useAuth();
    // Solo el superadmin (dueña) puede elegir/cambiar la bodega. Los demás perfiles
    // (admin de sede, cajera, vendedora, operario) quedan FIJOS a su propia bodega.
    const esSuper = user?.rol === 'superadmin';
    // Bodega para filtrar "compras de hoy" y el resumen del día.
    const filtroBodega = useBodegaActiva(user);
    const bodegaLista  = propBodegaId ? String(propBodegaId) : filtroBodega;
    const [recicladores, setRecicladores] = useState([]);
    const [bodegas, setBodegas] = useState([]);
    const [filtroBodegaRec, setFiltroBodegaRec] = useState('');
    const [materiales, setMateriales] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [catActiva, setCatActiva] = useState('');
    const [busquedaMat, setBusquedaMat] = useState('');
    const [reciclador_id, setRecicladorId] = useState('');
    const [bodega_id, setBodegaId] = useState(() =>
        propBodegaId ? String(propBodegaId) : (user?.bodega_id ? String(user.bodega_id) : '')
    );
    const [fecha, setFecha] = useState(hoy());
    const [compraActiva, setCompraActiva] = useState(null);
    const [cantidades, setCantidades] = useState({});
    const [materialActivo, setMaterialActivo] = useState(null);
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [comprasHoy, setComprasHoy] = useState([]);
    const [resumen, setResumen] = useState(null);
    const [mostrarRecibo, setMostrarRecibo] = useState(null);
    const [showNuevoRec, setShowNuevoRec] = useState(false);
    const [recForm, setRecForm] = useState({ nombre: '', cedula: '', telefono: '' });
    const [tabMobile, setTabMobile] = useState('nueva');
    const inputRef = useRef(null);
    const kgInputRef = useRef(null);

    useEffect(() => { if (propBodegaId) setBodegaId(String(propBodegaId)); }, [propBodegaId]);

    useEffect(() => {
        Promise.all([
            api.get('/recicladores').then(d => setRecicladores(d.recicladores || [])),
            api.get('/bodegas').then(d => {
                const bs = d.bodegas || [];
                setBodegas(bs);
                // Solo asignar si aún no hay bodega_id (p.ej. usuario sin bodega asignada)
                setBodegaId(prev => prev || (bs[0] ? String(bs[0].id) : ''));
            }),
            api.get('/materiales').then(d => {
                const mats = d.materiales || [];
                setMateriales(mats);
                const cats = [...new Set(mats.map(m => m.categoria).filter(Boolean))];
                setCategorias(cats);
                if (cats[0]) setCatActiva(cats[0]);
            }),
        ]);
        cargarHoy();
    }, []);

    useEffect(() => { if (materialActivo && inputRef.current) inputRef.current.focus(); }, [materialActivo]);
    useEffect(() => { if (materialActivo && kgInputRef.current) kgInputRef.current.focus(); }, [materialActivo]);
    // Refresca las compras de hoy cada 20s para ver las creadas desde el celular (bot Telegram)
    useEffect(() => {
        const t = setInterval(() => cargarHoy(), 20000);
        return () => clearInterval(t);
    }, []);

    const cargarHoy = async () => {
        const q = bodegaLista ? `&bodega_id=${bodegaLista}` : '';
        const d = await api.get(`/compras?fecha=${hoy()}&estado=finalizada${q}`).catch(() => null);
        if (d) setComprasHoy(d.items || []);
        const r = await api.get(`/compras/resumen-dia?fecha=${hoy()}${q}`).catch(() => null);
        if (r) setResumen(r);
    };

    // Recargar cuando cambia la bodega seleccionada; nueva compra sale por defecto en esa bodega.
    useEffect(() => { cargarHoy(); }, [bodegaLista]);
    useEffect(() => { if (!propBodegaId && filtroBodega) setBodegaId(filtroBodega); }, [filtroBodega]);

    const matsFiltrados = busquedaMat.trim()
        ? materiales.filter(m => m.activo !== false && `${m.nombre || ''} ${m.codigo || ''}`.toLowerCase().includes(busquedaMat.trim().toLowerCase()))
        : materiales.filter(m => m.categoria === catActiva && m.activo !== false);

    const abrirCuenta = async () => {
        if (!reciclador_id) return setMsg('Selecciona un reciclador');
        if (esSuper && !bodega_id) return setMsg('Selecciona una bodega');
        setLoading(true);
        try {
            const d = await api.post('/compras', { reciclador_id, bodega_id, fecha });
            setCompraActiva(d.compra);
            setCantidades({});
            setMsg('');
        } catch (err) { setMsg(err.message); }
        finally { setLoading(false); }
    };

    const crearReciclador = async () => {
        if (!recForm.nombre.trim()) return setMsg('Nombre del reciclador requerido');
        try {
            const d = await api.post('/recicladores', { ...recForm, bodega_id: bodega_id || null });
            setRecicladores(prev => [...prev, d.reciclador]);
            setRecicladorId(String(d.reciclador.id));
            setRecForm({ nombre: '', cedula: '', telefono: '' });
            setShowNuevoRec(false); setMsg('');
        } catch (e) { setMsg(e.msg || e.message); }
    };

    const seleccionarMaterial = (mat) => {
        if (!compraActiva) return setMsg('Primero abre una cuenta para un reciclador');
        setMaterialActivo(mat.id === materialActivo?.id ? null : mat);
        setCantidades(prev => ({ ...prev, [mat.id]: '' }));
    };

    const agregarKg = async (mat, kg) => {
        const kilos = parseFloat(kg);
        if (!kilos || kilos <= 0) { setMaterialActivo(null); return; }
        setLoading(true);
        try {
            const d = await api.post(`/compras/${compraActiva.id}/items`, { material_id: mat.id, kilos });
            setCompraActiva(d.compra);
            setCantidades(prev => ({ ...prev, [mat.id]: '' }));
            setMaterialActivo(null);
        } catch (err) { setMsg(err.message); }
        finally { setLoading(false); }
    };

    const quitarItem = async (item_id) => {
        const d = await api.delete(`/compras/${compraActiva.id}/items/${item_id}`);
        setCompraActiva(d.compra);
    };

    const finalizar = async (confirmarDuplicado = false) => {
        if (!compraActiva?.items?.length) return setMsg('Agrega al menos un material');
        setLoading(true);
        try {
            const d = await api.post(`/compras/${compraActiva.id}/finalizar`, confirmarDuplicado ? { confirmar_duplicado: true } : {});
            // El servidor detectó una posible compra repetida: preguntar antes de registrar.
            if (d && d.duplicado) {
                setLoading(false);
                if (window.confirm(d.msg)) finalizar(true);
                return;
            }
            setMostrarRecibo(d.compra);
            setCompraActiva(null);
            setCantidades({});
            setMsg('');
            cargarHoy();
            onCajaChange?.(bodega_id);
            setLoading(false);
        } catch (err) { setMsg(err.message); setLoading(false); }
    };

    const cancelar = async () => {
        if (!compraActiva) return;
        if (!window.confirm('¿Cancelar esta compra?')) return;
        await api.delete(`/compras/${compraActiva.id}`);
        setCompraActiva(null); setCantidades({});
    };

    const totalCarrito = compraActiva?.items?.reduce((s, i) => s + parseFloat(i.total), 0) || 0;
    const c = materialActivo ? (CAT_COLORS[materialActivo.categoria] || CAT_COLORS['Varios']) : null;

    // Formulario inline para crear un reciclador nuevo (compartido móvil + escritorio)
    const formNuevoRec = showNuevoRec && (
        <div style={{ marginTop: 10, background: '#f0faf0', border: '2px solid #1a5c2a', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a5c2a', marginBottom: 8 }}>Nuevo reciclador</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 8 }}>
                {[['nombre','Nombre *'],['cedula','Cédula'],['telefono','Teléfono']].map(([k,l]) => (
                    <input key={k} placeholder={l} value={recForm[k]} onChange={e => setRecForm({ ...recForm, [k]: e.target.value })}
                        style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #a7d7a7', fontSize: 13, minWidth: 0 }} />
                ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={crearReciclador} style={{ padding: '7px 16px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Guardar</button>
                <button onClick={() => setShowNuevoRec(false)} style={{ padding: '7px 12px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
            </div>
        </div>
    );

    if (mostrarRecibo) return (
        <div style={{ padding: isMobile ? 16 : 24 }}>
            <Recibo compra={mostrarRecibo} onClose={() => setMostrarRecibo(null)} onEliminado={() => { setMostrarRecibo(null); cargarHoy(); }} />
        </div>
    );

    // ── MÓVIL ─────────────────────────────────────────────────────────────────
    if (isMobile) return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f0faf0', position: 'relative' }}>

            {/* Tabs superiores */}
            <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                {[{ id: 'nueva', label: '♻️ Nueva' }, { id: 'hoy', label: '📋 Hoy' }].map(t => (
                    <button key={t.id} onClick={() => setTabMobile(t.id)}
                        style={{
                            flex: 1, padding: '12px 4px', border: 'none', background: 'none', cursor: 'pointer',
                            fontWeight: tabMobile === t.id ? 700 : 400,
                            color: tabMobile === t.id ? '#1a5c2a' : '#6b7280',
                            borderBottom: tabMobile === t.id ? '2px solid #1a5c2a' : '2px solid transparent',
                            fontSize: 13, transition: 'all .15s'
                        }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── Tab Nueva ── */}
            {tabMobile === 'nueva' && (
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingBottom: materialActivo ? 140 : 0 }}>

                    {/* Abrir cuenta / banner activo */}
                    {!compraActiva ? (
                        <div style={{ background: '#fff', margin: 12, borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: '#1a5c2a' }}>♻️ Abrir cuenta de compra</div>
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                                    <span style={{ fontSize: 11, color: '#666' }}>Filtrar sede:</span>
                                    <select value={filtroBodegaRec} onChange={e => setFiltroBodegaRec(e.target.value)}
                                        style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                        <option value="">Todas</option>
                                        {bodegas.map(b => <option key={b.id} value={String(b.id)}>{b.nombre}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <span style={{ fontSize: 11, color: '#666' }}>Reciclador *</span>
                                    <button onClick={() => setShowNuevoRec(!showNuevoRec)}
                                        style={{ fontSize: 11, color: '#1a5c2a', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>+ Nuevo</button>
                                </div>
                                <PickerBuscable
                                    items={recicladores.filter(r => !filtroBodegaRec || String(r.bodega_id) === filtroBodegaRec)}
                                    value={reciclador_id}
                                    onChange={setRecicladorId}
                                    placeholder="Buscar reciclador por nombre..."
                                    fontSize={15}
                                />
                                {formNuevoRec}
                            </div>
                            {esSuper && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                                    <div>
                                        <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Bodega *</div>
                                        <select value={bodega_id} onChange={e => setBodegaId(e.target.value)}
                                            style={{ width: '100%', padding: '10px 8px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}>
                                            {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Fecha</div>
                                        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                                            style={{ width: '100%', padding: '10px 8px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }} />
                                    </div>
                                </div>
                            )}
                            {msg && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{msg}</div>}
                            <button onClick={abrirCuenta} disabled={loading}
                                style={{ width: '100%', padding: '13px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                                {loading ? 'Abriendo...' : 'Abrir cuenta ♻️'}
                            </button>
                        </div>
                    ) : (
                        <div style={{ background: '#1a5c2a', margin: 12, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                            <div style={{ color: '#fff' }}>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>👤 {compraActiva.reciclador?.nombre}</div>
                                <div style={{ fontSize: 11, opacity: .8, marginTop: 2 }}>{compraActiva.bodega?.nombre} · {compraActiva.fecha}</div>
                            </div>
                            <button onClick={cancelar}
                                style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.3)', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                                Cancelar
                            </button>
                        </div>
                    )}

                    {/* Buscar material */}
                    <div style={{ padding: '0 12px 8px', flexShrink: 0, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', opacity: .6, fontSize: 14, pointerEvents: 'none' }}>🔍</span>
                        <input value={busquedaMat} onChange={e => setBusquedaMat(e.target.value)} placeholder="Buscar material..."
                            style={{ width: '100%', padding: '9px 10px 9px 34px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }} />
                    </div>

                    {/* Tabs de categorías */}
                    <div style={{ overflowX: 'auto', display: 'flex', gap: 8, padding: '0 12px 8px', flexShrink: 0, scrollbarWidth: 'none', opacity: busquedaMat.trim() ? .5 : 1 }}>
                        {categorias.map(cat => {
                            const cc = CAT_COLORS[cat] || CAT_COLORS['Varios'];
                            const activa = catActiva === cat;
                            return (
                                <button key={cat} onClick={() => { setCatActiva(cat); setMaterialActivo(null); }}
                                    style={{ padding: '7px 14px', borderRadius: 20, border: `2px solid ${activa ? cc.active : '#ddd'}`, background: activa ? cc.bg : '#fff', color: activa ? cc.text : '#888', fontSize: 12, fontWeight: activa ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                    {CAT_ICONS[cat] || '📋'} {cat}
                                </button>
                            );
                        })}
                    </div>

                    {/* Grid de materiales 2 columnas */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 12px', flexShrink: 0 }}>
                        {matsFiltrados.map(mat => {
                            const cc = CAT_COLORS[mat.categoria] || CAT_COLORS['Varios'];
                            const enCarrito = compraActiva?.items?.find(i => i.material_id === mat.id);
                            const esActivo = materialActivo?.id === mat.id;
                            return (
                                <button key={mat.id} onClick={() => seleccionarMaterial(mat)}
                                    style={{
                                        padding: '14px 10px', background: esActivo ? cc.active : enCarrito ? cc.bg : '#fff',
                                        border: `2px solid ${esActivo ? cc.active : enCarrito ? cc.border : '#e5e7eb'}`,
                                        borderRadius: 10, cursor: 'pointer', textAlign: 'center', transition: 'all .12s',
                                        boxShadow: esActivo ? `0 4px 12px ${cc.active}44` : '0 1px 4px rgba(0,0,0,.06)'
                                    }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: esActivo ? '#fff' : '#222', lineHeight: 1.3 }}>{mat.nombre}</div>
                                    {enCarrito && <div style={{ fontSize: 11, color: esActivo ? '#fff' : cc.active, fontWeight: 700, marginTop: 3 }}>✓ {fmtKg(enCarrito.kilos)} kg</div>}
                                </button>
                            );
                        })}
                    </div>

                    {/* Carrito */}
                    {compraActiva?.items?.length > 0 && (
                        <div style={{ margin: 12, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'hidden', flexShrink: 0 }}>
                            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: 14, color: '#1a5c2a' }}>
                                🛒 Carrito #{compraActiva.numero || compraActiva.id}
                            </div>
                            {compraActiva.items.map(item => (
                                <div key={item.id} style={{ padding: '10px 16px', borderBottom: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{item.material?.nombre}</div>
                                        <div style={{ fontSize: 12, color: '#888' }}>{fmtKg(item.kilos)} kg × ${fmt(item.precio_unitario)}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontWeight: 700, color: '#1a5c2a', fontSize: 14 }}>${fmt(item.total)}</span>
                                        <button onClick={() => quitarItem(item.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 18, padding: 0 }}>✕</button>
                                    </div>
                                </div>
                            ))}
                            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa' }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: '#555' }}>TOTAL</span>
                                <span style={{ fontSize: 22, fontWeight: 800, color: '#1a5c2a' }}>${fmt(totalCarrito)}</span>
                            </div>
                            {msg && <div style={{ color: '#dc2626', fontSize: 12, padding: '0 16px 8px' }}>{msg}</div>}
                            <div style={{ padding: '0 12px 12px' }}>
                                <button onClick={() => finalizar()} disabled={loading}
                                    style={{ width: '100%', padding: '14px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                                    {loading ? 'Procesando...' : '✅ Finalizar y Generar Recibo'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Resumen del día */}
                    {resumen && (
                        <div style={{ margin: '0 12px 12px', background: '#e8f5e9', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: 12, color: '#555' }}>Hoy: <strong>{resumen.totalCompras}</strong> compras · <strong>{fmt(resumen.totalKilos)} kg</strong></div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a5c2a' }}>Pagado: ${fmt(resumen.totalNeto)}</div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Tab Hoy ── */}
            {tabMobile === 'hoy' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                    {resumen && (
                        <div style={{ background: '#1a5c2a', borderRadius: 12, padding: '14px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                            <div style={{ color: '#fff' }}>
                                <div style={{ fontWeight: 700, fontSize: 15 }}>{resumen.totalCompras} compras hoy</div>
                                <div style={{ fontSize: 12, opacity: .8, marginTop: 2 }}>{fmt(resumen.totalKilos)} kg recolectados</div>
                            </div>
                            <div style={{ color: '#fff', textAlign: 'right' }}>
                                <div style={{ fontSize: 11, opacity: .7 }}>Total pagado</div>
                                <div style={{ fontSize: 20, fontWeight: 800 }}>${fmt(resumen.totalNeto)}</div>
                            </div>
                        </div>
                    )}
                    {comprasHoy.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb' }}>
                            <div style={{ fontSize: 48 }}>♻️</div>
                            <p style={{ fontSize: 14, marginTop: 12 }}>No hay compras hoy</p>
                        </div>
                    ) : (
                        comprasHoy.map(c => (
                            <div key={c.id} onClick={() => setMostrarRecibo(c)}
                                style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,.08)', cursor: 'pointer' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 15, color: '#1a5c2a' }}>👤 {c.reciclador?.nombre}</div>
                                        <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{c.bodega?.nombre} · #{c.numero || c.id}</div>
                                        {c.items?.length > 0 && (
                                            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                                                {c.items.map(i => `${i.material?.nombre} ${fmtKg(i.kilos)}kg`).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a5c2a' }}>${fmt(c.neto)}</div>
                                        {parseFloat(c.descuento_prestamo) > 0 && (
                                            <div style={{ fontSize: 11, color: '#dc2626' }}>-${fmt(c.descuento_prestamo)} préstamo</div>
                                        )}
                                        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Ver recibo →</div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Bottom sheet para ingresar kg */}
            {materialActivo && c && (
                <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 300, background: '#fff', borderTop: `3px solid ${c.active}`, padding: '16px 16px 32px', boxShadow: '0 -4px 20px rgba(0,0,0,.15)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: c.active }}>{materialActivo.nombre}</div>
                            <div style={{ fontSize: 12, color: '#888' }}>${fmt(materialActivo.precio_compra)} / kg</div>
                        </div>
                        <button onClick={() => setMaterialActivo(null)}
                            style={{ background: '#f5f5f5', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ✕
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input
                            ref={kgInputRef}
                            type="number" step="0.1" min="0"
                            value={cantidades[materialActivo.id] || ''}
                            onChange={e => setCantidades(p => ({ ...p, [materialActivo.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') agregarKg(materialActivo, cantidades[materialActivo.id]); }}
                            placeholder="0.0 kg"
                            style={{ flex: 1, padding: '14px 16px', borderRadius: 10, border: `2px solid ${c.border}`, fontSize: 20, fontWeight: 700, textAlign: 'center' }}
                        />
                        <button onClick={() => agregarKg(materialActivo, cantidades[materialActivo.id])}
                            style={{ padding: '14px 20px', background: c.active, color: '#fff', border: 'none', borderRadius: 10, fontSize: 22, cursor: 'pointer', fontWeight: 700 }}>
                            ✓
                        </button>
                    </div>
                    {parseFloat(cantidades[materialActivo.id]) > 0 && (
                        <div style={{ marginTop: 8, textAlign: 'center', fontSize: 14, fontWeight: 700, color: c.active }}>
                            = ${fmt(parseFloat(cantidades[materialActivo.id]) * parseFloat(materialActivo.precio_compra))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    // ── ESCRITORIO ─────────────────────────────────────────────────────────────
    return (
        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, height: 'calc(100vh - 48px)', overflow: 'hidden' }}>

            {/* ── PANEL IZQUIERDO ───────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {!compraActiva ? (
                    <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: '#1a5c2a' }}>♻️ Abrir cuenta de compra</div>
                        <div style={{ display: 'grid', gridTemplateColumns: esSuper ? '120px 1fr 1fr 140px 90px' : '120px 1fr 90px', gap: 10, alignItems: 'flex-end' }}>
                            <label>
                                <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Sede</div>
                                <select value={filtroBodegaRec} onChange={e => setFiltroBodegaRec(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                    <option value="">Todas</option>
                                    {bodegas.map(b => <option key={b.id} value={String(b.id)}>{b.nombre}</option>)}
                                </select>
                            </label>
                            <div>
                                <div style={{ fontSize: 11, color: '#666', marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Reciclador*</span>
                                    <button type="button" onClick={() => setShowNuevoRec(!showNuevoRec)}
                                        style={{ fontSize: 10, color: '#1a5c2a', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>+ Nuevo</button>
                                </div>
                                <PickerBuscable
                                    items={recicladores.filter(r => !filtroBodegaRec || String(r.bodega_id) === filtroBodegaRec)}
                                    value={reciclador_id}
                                    onChange={setRecicladorId}
                                    placeholder="Buscar reciclador por nombre..."
                                    fontSize={13}
                                />
                            </div>
                            {esSuper && (
                                <label>
                                    <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Bodega*</div>
                                    <select value={bodega_id} onChange={e => setBodegaId(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                        {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                                    </select>
                                </label>
                            )}
                            {esSuper && (
                                <label>
                                    <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Fecha</div>
                                    <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                                </label>
                            )}
                            <button onClick={abrirCuenta} disabled={loading} style={{ padding: '9px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Abrir</button>
                        </div>
                        {formNuevoRec}
                        {msg && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{msg}</div>}
                    </div>
                ) : (
                    <div style={{ background: '#1a5c2a', borderRadius: 10, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ color: '#fff' }}>
                            <span style={{ fontWeight: 700, fontSize: 15 }}>👤 {compraActiva.reciclador?.nombre}</span>
                            <span style={{ fontSize: 12, marginLeft: 12, opacity: .8 }}>{compraActiva.bodega?.nombre} · {compraActiva.fecha}</span>
                        </div>
                        <button onClick={cancelar} style={{ padding: '5px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.3)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                )}

                <div style={{ position: 'relative', marginBottom: 10, flexShrink: 0 }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: .6, fontSize: 13, pointerEvents: 'none' }}>🔍</span>
                    <input value={busquedaMat} onChange={e => setBusquedaMat(e.target.value)} placeholder="Buscar material por nombre o código..."
                        style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', opacity: busquedaMat.trim() ? .5 : 1 }}>
                    {categorias.map(cat => {
                        const cc = CAT_COLORS[cat] || CAT_COLORS['Varios'];
                        const activa = catActiva === cat;
                        return (
                            <button key={cat} onClick={() => { setCatActiva(cat); setMaterialActivo(null); }}
                                style={{ padding: '6px 14px', borderRadius: 20, border: `2px solid ${activa ? cc.active : '#ddd'}`, background: activa ? cc.bg : '#fff', color: activa ? cc.text : '#888', fontSize: 12, fontWeight: activa ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                {CAT_ICONS[cat] || '📋'} {cat}
                            </button>
                        );
                    })}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
                        {matsFiltrados.map(mat => {
                            const cc = CAT_COLORS[mat.categoria] || CAT_COLORS['Varios'];
                            const enCarrito = compraActiva?.items?.find(i => i.material_id === mat.id);
                            const esActivo = materialActivo?.id === mat.id;
                            return (
                                <div key={mat.id}>
                                    <button onClick={() => seleccionarMaterial(mat)}
                                        style={{ width: '100%', padding: '12px 8px', background: esActivo ? cc.active : enCarrito ? cc.bg : '#fff', border: `2px solid ${esActivo ? cc.active : enCarrito ? cc.border : '#e5e7eb'}`, borderRadius: 10, cursor: 'pointer', textAlign: 'center', transition: 'all .12s' }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: esActivo ? '#fff' : '#222', lineHeight: 1.3 }}>{mat.nombre}</div>
                                        {enCarrito && <div style={{ fontSize: 11, color: esActivo ? '#fff' : cc.active, fontWeight: 700, marginTop: 3 }}>✓ {fmtKg(enCarrito.kilos)} kg</div>}
                                    </button>
                                    {esActivo && (
                                        <div style={{ marginTop: 4, background: cc.bg, border: `2px solid ${cc.border}`, borderRadius: 8, padding: 10 }}>
                                            <div style={{ fontSize: 12, color: cc.text, fontWeight: 600, marginBottom: 6 }}>¿Cuántos kg de {mat.nombre}?</div>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <input
                                                    ref={inputRef}
                                                    type="number" step="0.1" min="0"
                                                    value={cantidades[mat.id] || ''}
                                                    onChange={e => setCantidades(p => ({ ...p, [mat.id]: e.target.value }))}
                                                    onKeyDown={e => { if (e.key === 'Enter') agregarKg(mat, cantidades[mat.id]); if (e.key === 'Escape') setMaterialActivo(null); }}
                                                    placeholder="0.0"
                                                    style={{ flex: 1, padding: '7px 8px', borderRadius: 6, border: `1px solid ${cc.border}`, fontSize: 14, minWidth: 0 }}
                                                />
                                                <button onClick={() => agregarKg(mat, cantidades[mat.id])} style={{ padding: '7px 12px', background: cc.active, color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, cursor: 'pointer', fontWeight: 700 }}>✓</button>
                                            </div>
                                            {parseFloat(cantidades[mat.id]) > 0 && (
                                                <div style={{ fontSize: 12, color: cc.text, marginTop: 5, fontWeight: 700 }}>
                                                    = ${fmt(parseFloat(cantidades[mat.id]) * parseFloat(mat.precio_compra))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {resumen && (
                    <div style={{ marginTop: 10, background: '#f0faf0', borderRadius: 8, padding: '8px 14px', display: 'flex', gap: 20, alignItems: 'center' }}>
                        <div style={{ fontSize: 12, color: '#555' }}>Hoy: <strong>{resumen.totalCompras}</strong> compras · <strong>{fmt(resumen.totalKilos)} kg</strong></div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a5c2a', marginLeft: 'auto' }}>Pagado: ${fmt(resumen.totalNeto)}</div>
                    </div>
                )}
            </div>

            {/* ── PANEL DERECHO: carrito ────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: 15, color: '#1a5c2a' }}>
                    🛒 Carrito {compraActiva ? `· #${compraActiva.numero || compraActiva.id}` : ''}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
                    {!compraActiva?.items?.length ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb' }}>
                            <div style={{ fontSize: 40 }}>🛒</div>
                            <p style={{ fontSize: 13, marginTop: 8 }}>Sin materiales aún.<br/>Abre una cuenta y selecciona.</p>
                        </div>
                    ) : (
                        compraActiva.items.map(item => (
                            <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{item.material?.nombre}</div>
                                    <div style={{ fontSize: 12, color: '#888' }}>{fmtKg(item.kilos)} kg × ${fmt(item.precio_unitario)}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontWeight: 700, color: '#1a5c2a' }}>${fmt(item.total)}</span>
                                    <button onClick={() => quitarItem(item.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>✕</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div style={{ padding: 16, borderTop: '2px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#555' }}>TOTAL</span>
                        <span style={{ fontSize: 24, fontWeight: 800, color: '#1a5c2a' }}>${fmt(totalCarrito)}</span>
                    </div>
                    {msg && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{msg}</div>}
                    <button onClick={() => finalizar()} disabled={loading || !compraActiva?.items?.length}
                        style={{ width: '100%', padding: '14px', background: compraActiva?.items?.length ? '#1a5c2a' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: compraActiva?.items?.length ? 'pointer' : 'default' }}>
                        {loading ? 'Procesando...' : '✅ Finalizar y Generar Recibo'}
                    </button>
                </div>

                {comprasHoy.length > 0 && (
                    <div style={{ borderTop: '1px solid #f0f0f0', maxHeight: 180, overflowY: 'auto' }}>
                        <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: .5 }}>COMPRAS DE HOY</div>
                        {comprasHoy.map(c => (
                            <div key={c.id} onClick={() => setMostrarRecibo(c)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 16px', borderTop: '1px solid #f5f5f5', fontSize: 12 }}>
                                <span style={{ color: '#555' }}>{c.reciclador?.nombre}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontWeight: 700, color: '#1a5c2a' }}>${fmt(c.neto)}</span>
                                    <span title="Imprimir recibo" style={{ fontSize: 13 }}>🖨️</span>
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Recibo ──────────────────────────────────────────────────────────────── */
export function Recibo({ compra, onClose, onEliminado }) {
    // Logo embebido en base64 para que SIEMPRE se imprima (sin depender de red/caché)
    const [logo, setLogo] = useState('/logo.png');
    const [borrando, setBorrando] = useState(false);
    const { user } = useAuth();
    const puedeEliminar = (user?.rol === 'admin' || user?.rol === 'superadmin');
    useEffect(() => {
        fetch('/logo.png')
            .then(r => r.blob())
            .then(b => { const fr = new FileReader(); fr.onload = () => setLogo(fr.result); fr.readAsDataURL(b); })
            .catch(() => {});
    }, []);

    async function eliminarCompra() {
        if (!window.confirm(`¿ELIMINAR esta compra de ${compra.reciclador?.nombre} por $${fmt(compra.neto)}?\n\nSe revertirá el egreso de la caja. Úsalo solo para corregir un registro duplicado o equivocado.\nEsta acción NO se puede deshacer.`)) return;
        setBorrando(true);
        try {
            await api.delete(`/compras/${compra.id}`);
            onEliminado?.(compra.id);
        } catch (e) {
            alert(e?.message || 'No se pudo eliminar la compra.');
            setBorrando(false);
        }
    }
    return (
        <div>
            <style>{`
                @page { size: 80mm auto; margin: 0; }
                @media print {
                    html, body { width: 80mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
                    body * { visibility: hidden !important; }
                    .recibo-contenido, .recibo-contenido * { visibility: visible !important; }
                    .recibo-contenido {
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 80mm !important;
                        max-width: 80mm !important;
                        margin: 0 !important;
                        padding: 4mm 3mm !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                        font-size: 12px !important;
                    }
                    .recibo-contenido img {
                        width: 60px !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button onClick={() => window.print()} style={{ padding: '9px 20px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🖨️ Imprimir recibo</button>
                <button onClick={onClose} style={{ padding: '9px 16px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>← Volver</button>
                {puedeEliminar && (
                    <button onClick={eliminarCompra} disabled={borrando} title="Eliminar compra (solo administrador)" style={{ padding: '9px 16px', background: borrando ? '#fca5a5' : '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: borrando ? 'default' : 'pointer', marginLeft: 'auto' }}>{borrando ? 'Eliminando…' : '🗑️ Eliminar'}</button>
                )}
            </div>

            <div className="recibo-contenido" style={{ background: '#fff', borderRadius: 10, padding: 32, boxShadow: '0 2px 8px rgba(0,0,0,.08)', maxWidth: 460, fontFamily: 'monospace' }}>
                <div style={{ textAlign: 'center', marginBottom: 20, fontFamily: 'sans-serif' }}>
                    <img src={logo} alt="ASOERC" style={{ width: 80, marginBottom: 6 }} />
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#1a5c2a' }}>ASOERC ESP</div>
                    <div style={{ fontSize: 12, color: '#666' }}>NIT: 901.299.762-6</div>
                    <div style={{ fontWeight: 700, marginTop: 10, fontSize: 15 }}>COMPROBANTE DE COMPRA</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#1a5c2a', letterSpacing: 1 }}>
                        #{String(compra.numero_diario || compra.numero || compra.id).padStart(5, '0')}
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>{compra.fecha} · {compra.updatedAt ? new Date(compra.updatedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>Impreso: {new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</div>
                </div>

                <div style={{ borderTop: '1px dashed #ccc', borderBottom: '1px dashed #ccc', padding: '10px 0', marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: '#666' }}>Reciclador:</span>
                        <strong>{compra.reciclador?.nombre}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: '#666' }}>Bodega:</span>
                        <span>{compra.bodega?.nombre}</span>
                    </div>
                </div>

                <table style={{ width: '100%', fontSize: 10.5, borderCollapse: 'collapse', marginBottom: 14, tableLayout: 'fixed' }}>
                    <colgroup>
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '37%' }} />
                        <col style={{ width: '13%' }} />
                        <col style={{ width: '17%' }} />
                        <col style={{ width: '18%' }} />
                    </colgroup>
                    <thead>
                        <tr style={{ borderBottom: '1px dashed #ccc' }}>
                            <th style={{ textAlign: 'left', padding: '4px 0', color: '#666', fontWeight: 600 }}>Cód.</th>
                            <th style={{ textAlign: 'left', padding: '4px 0', color: '#666', fontWeight: 600 }}>Material</th>
                            <th style={{ textAlign: 'right', padding: '4px 0 4px 4px', color: '#666', fontWeight: 600 }}>Kg</th>
                            <th style={{ textAlign: 'right', padding: '4px 0 4px 6px', color: '#666', fontWeight: 600 }}>$/kg</th>
                            <th style={{ textAlign: 'right', padding: '4px 0 4px 6px', color: '#666', fontWeight: 600 }}>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(compra.items || []).map(item => (
                            <tr key={item.id} style={{ borderBottom: '1px dotted #eee' }}>
                                <td style={{ padding: '5px 0', color: '#999', fontSize: 9, wordBreak: 'break-word', lineHeight: 1.25 }}>{item.material?.codigo}</td>
                                <td style={{ padding: '5px 4px 5px 0', lineHeight: 1.25 }}>{item.material?.nombre}</td>
                                <td style={{ textAlign: 'right', color: '#555', whiteSpace: 'nowrap', paddingLeft: 4 }}>{fmtKg(item.kilos)}</td>
                                <td style={{ textAlign: 'right', color: '#555', whiteSpace: 'nowrap', paddingLeft: 6 }}>${fmt(item.precio_unitario)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', paddingLeft: 6 }}>${fmt(item.total)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div style={{ borderTop: '1px dashed #ccc', paddingTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: '#666' }}>Subtotal:</span>
                        <span>${fmt(compra.total)}</span>
                    </div>
                    {parseFloat(compra.descuento_prestamo) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#dc2626', marginBottom: 4 }}>
                            <span>Descuento préstamo:</span>
                            <span>- ${fmt(compra.descuento_prestamo)}</span>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 800, marginTop: 10, color: '#1a5c2a' }}>
                        <span>NETO A PAGAR:</span>
                        <span>${fmt(compra.neto)}</span>
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#aaa', borderTop: '1px dashed #ccc', paddingTop: 12 }}>
                    Gracias por reciclar · ASOERC ESP<br/>{new Date().toLocaleString('es-CO')}
                </div>
            </div>
        </div>
    );
}
