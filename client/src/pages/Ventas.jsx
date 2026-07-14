import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import PickerBuscable from '../components/PickerBuscable';
import { useBodegaActiva } from '../bodega';

const fmt = n => Number(n || 0).toLocaleString('es-CO');
// Kilos sin ceros sobrantes: 1520.000 → 1520, 700.500 → 700.5
const fmtKg = n => String(parseFloat(n) || 0);
const hoy = () => new Date().toISOString().slice(0, 10);

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
const CAT_ICONS = { 'Metales':'🔩','Electrónicos':'📱','Plásticos':'♻️','Papel y Cartón':'📦','Vidrio':'🍶','Madera':'🪵','Otros':'🔧','Varios':'🔧' };
const ESTADO_COLOR = {
    orden:     { bg: '#fef3c7', color: '#d97706' },
    facturada: { bg: '#eff6ff', color: '#2563eb' },
    pagada:    { bg: '#d1fae5', color: '#059669' },
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

export default function Ventas({ onCajaChange, bodegaId: propBodegaId } = {}) {
    const isMobile = useMobile();
    const { user } = useAuth();
    const esAdmin = ['superadmin', 'admin'].includes(user?.rol);
    // Bodega para FILTRAR la lista "de hoy": si está embebido en Caja usa esa bodega;
    // si no, la que el superadmin eligió en la barra ('' = todas).
    const filtroBodega = useBodegaActiva(user);
    const bodegaLista  = propBodegaId ? String(propBodegaId) : filtroBodega;
    const [clientes,   setClientes]   = useState([]);
    const [materiales, setMateriales] = useState([]);
    const [bodegas,    setBodegas]    = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [catActiva,  setCatActiva]  = useState('');
    const [busquedaMat, setBusquedaMat] = useState('');
    const [ventasHoy,  setVentasHoy]  = useState([]);

    const [cliente_id, setClienteId] = useState('');
    const [sede_id,    setSedeId]    = useState('');
    const [bodega_id,  setBodegaId]  = useState(() =>
        propBodegaId ? String(propBodegaId) : (user?.bodega_id ? String(user.bodega_id) : '')
    );
    const [fecha,      setFecha]     = useState(hoy());
    const [tipo_pago,  setTipoPago]  = useState('efectivo');
    const [sedes,      setSedes]     = useState([]);
    const [ordenAbierta, setOrdenAbierta] = useState(false);

    const [items,          setItems]          = useState([]);
    const [materialActivo, setMaterialActivo] = useState(null);
    const [cantidades,     setCantidades]     = useState({});
    const [precios,        setPrecios]        = useState({});

    const [showNuevoCliente, setShowNuevoCliente] = useState(false);
    const [cForm, setCForm] = useState({ nombre:'', nit:'', telefono:'', email:'' });
    const [msg,     setMsg]     = useState('');
    const [loading, setLoading] = useState(false);
    const [reciboVenta, setReciboVenta] = useState(null);
    const [tabMobile, setTabMobile] = useState('orden'); // 'orden' | 'historial'

    const inputRef = useRef(null);

    useEffect(() => {
        Promise.all([
            api.get('/clientes').then(d => setClientes(d.clientes || [])),
            api.get('/bodegas').then(d => {
                const bs = d.bodegas || [];
                setBodegas(bs);
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

    useEffect(() => { if (propBodegaId) setBodegaId(String(propBodegaId)); }, [propBodegaId]);
    useEffect(() => { if (materialActivo && inputRef.current) inputRef.current.focus(); }, [materialActivo]);
    // Refresca las órdenes de hoy cada 20s para ver las creadas desde el celular (bot Telegram)
    useEffect(() => {
        const t = setInterval(() => cargarHoy(), 20000);
        return () => clearInterval(t);
    }, []);

    const cargarHoy = () => {
        const q = bodegaLista ? `&bodega_id=${bodegaLista}` : '';
        return api.get(`/ventas?fecha=${hoy()}${q}`).then(d => setVentasHoy(d.items || [])).catch(() => {});
    };

    // Recargar la lista cuando cambia la bodega seleccionada, y que la nueva orden
    // salga por defecto en esa bodega.
    useEffect(() => { cargarHoy(); }, [bodegaLista]);
    useEffect(() => { if (!propBodegaId && filtroBodega) setBodegaId(filtroBodega); }, [filtroBodega]);

    const clienteSeleccionado = clientes.find(c => String(c.id) === String(cliente_id));

    const abrirOrden = () => {
        if (!cliente_id) return setMsg('Selecciona un cliente');
        if (esAdmin && !bodega_id) return setMsg('Selecciona una bodega');
        setOrdenAbierta(true); setMsg('');
    };
    const cancelarOrden = () => {
        setOrdenAbierta(false);
        setItems([]); setCantidades({}); setPrecios({});
        setMaterialActivo(null); setMsg('');
    };
    const clienteChange = id => {
        setClienteId(id); setSedeId('');
        const c = clientes.find(c => String(c.id) === id);
        setSedes(c?.sedes || []);
    };
    const seleccionarMaterial = mat => {
        if (!ordenAbierta) return setMsg('Primero abre una orden');
        setMaterialActivo(mat.id === materialActivo?.id ? null : mat);
    };
    const precioDefault = mat => {
        const esp = clienteSeleccionado?.precios?.find(p => p.material_id === mat.id);
        return esp ? esp.precio : mat.precio_compra;
    };
    const agregarItem = (mat, kg, precio) => {
        const kilos = parseFloat(kg);
        const pu    = parseFloat(precio) || parseFloat(precioDefault(mat));
        if (!kilos || kilos <= 0) { setMaterialActivo(null); return; }
        const existente = items.findIndex(i => i.material_id === mat.id);
        if (existente >= 0) {
            const copia = [...items];
            copia[existente].kilos += kilos;
            copia[existente].total  = copia[existente].kilos * copia[existente].precio_unitario;
            setItems(copia);
        } else {
            setItems(prev => [...prev, { material_id: mat.id, material_nombre: mat.nombre, kilos, precio_unitario: pu, total: kilos * pu }]);
        }
        setCantidades(p => ({ ...p, [mat.id]: '' }));
        setPrecios(p => ({ ...p, [mat.id]: '' }));
        setMaterialActivo(null);
    };
    const quitarItem = idx => setItems(items.filter((_, i) => i !== idx));
    const crearOrden = async () => {
        if (!items.length) return setMsg('Agrega al menos un material');
        setLoading(true);
        try {
            const d = await api.post('/ventas', {
                cliente_id, sede_id: sede_id || null, bodega_id, fecha, tipo_pago,
                items: items.map(i => ({ material_id: i.material_id, kilos: i.kilos, precio_unitario: i.precio_unitario })),
            });
            setReciboVenta(d.venta);
            cancelarOrden(); cargarHoy();
            if (tipo_pago !== 'pendiente') onCajaChange?.(bodega_id);
        } catch (e) { setMsg(e.msg || e.message); }
        finally { setLoading(false); }
    };
    const crearCliente = async () => {
        if (!cForm.nombre) return setMsg('Nombre requerido');
        try {
            const d = await api.post('/clientes', cForm);
            setClientes(prev => [...prev, d.cliente]);
            clienteChange(String(d.cliente.id));
            setCForm({ nombre:'', nit:'', telefono:'', email:'' });
            setShowNuevoCliente(false); setMsg('');
        } catch (e) { setMsg(e.msg || e.message); }
    };
    const cambiarEstado = async (id, estado, tp) => {
        const v = ventasHoy.find(x => x.id === id);
        await api.put(`/ventas/${id}/estado`, { estado, tipo_pago: tp });
        cargarHoy();
        if (estado === 'pagada') onCajaChange?.(v?.bodega_id || bodega_id);
    };

    const matsFiltrados = busquedaMat.trim()
        ? materiales.filter(m => m.activo !== false && `${m.nombre || ''} ${m.codigo || ''}`.toLowerCase().includes(busquedaMat.trim().toLowerCase()))
        : materiales.filter(m => m.categoria === catActiva && m.activo !== false);
    const total = items.reduce((s, i) => s + i.total, 0);

    if (reciboVenta) return (
        <div style={{ padding: 16 }}>
            <ReciboVenta venta={reciboVenta} onClose={() => setReciboVenta(null)} />
        </div>
    );

    // ── Bloque materiales (compartido) ────────────────────────────────────
    const BloqueCategoriasYMateriales = () => (
        <>
            {/* Buscar material */}
            <div style={{ position: 'relative', marginBottom: 8, flexShrink: 0 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: .6, fontSize: 14, pointerEvents: 'none' }}>🔍</span>
                <input value={busquedaMat} onChange={e => setBusquedaMat(e.target.value)} placeholder="Buscar material..."
                    style={{ width: '100%', padding: '9px 10px 9px 34px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            {/* Tabs categorías */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', paddingBottom: 4, flexShrink: 0, opacity: busquedaMat.trim() ? .5 : 1 }}>
                {categorias.map(cat => {
                    const c = CAT_COLORS[cat] || CAT_COLORS['Varios'];
                    const activa = catActiva === cat;
                    return (
                        <button key={cat} onClick={() => { setCatActiva(cat); setMaterialActivo(null); }}
                            style={{ padding: '6px 12px', borderRadius: 20, border: `2px solid ${activa ? c.active : '#ddd'}`,
                                background: activa ? c.bg : '#fff', color: activa ? c.text : '#888',
                                fontSize: 12, fontWeight: activa ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {CAT_ICONS[cat] || '📋'} {cat}
                        </button>
                    );
                })}
            </div>
            {/* Grid materiales */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
                    {matsFiltrados.map(mat => {
                        const c = CAT_COLORS[mat.categoria] || CAT_COLORS['Varios'];
                        const enCarrito = items.find(i => i.material_id === mat.id);
                        const esActivo  = materialActivo?.id === mat.id;
                        return (
                            <div key={mat.id}>
                                <button onClick={() => seleccionarMaterial(mat)}
                                    style={{ width: '100%', padding: '12px 8px', background: esActivo ? c.active : enCarrito ? c.bg : '#fff',
                                        border: `2px solid ${esActivo ? c.active : enCarrito ? c.border : '#e5e7eb'}`,
                                        borderRadius: 10, cursor: 'pointer', textAlign: 'center', transition: 'all .12s' }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: esActivo ? '#fff' : '#222', lineHeight: 1.3 }}>{mat.nombre}</div>
                                    {enCarrito && <div style={{ fontSize: 11, color: esActivo ? '#fff' : c.active, fontWeight: 700, marginTop: 3 }}>✓ {enCarrito.kilos} kg</div>}
                                </button>
                                {esActivo && (
                                    <div style={{ marginTop: 4, background: c.bg, border: `2px solid ${c.border}`, borderRadius: 8, padding: 10 }}>
                                        <div style={{ fontSize: 12, color: c.text, fontWeight: 600, marginBottom: 6 }}>{mat.nombre}</div>
                                        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                            <input ref={inputRef} type="number" step="0.1" min="0"
                                                value={cantidades[mat.id] || ''}
                                                onChange={e => setCantidades(p => ({ ...p, [mat.id]: e.target.value }))}
                                                onKeyDown={e => { if (e.key === 'Enter') agregarItem(mat, cantidades[mat.id], precios[mat.id]); if (e.key === 'Escape') setMaterialActivo(null); }}
                                                placeholder="Kg"
                                                style={{ flex: 1, padding: '8px', borderRadius: 6, border: `1px solid ${c.border}`, fontSize: 16, minWidth: 0 }} />
                                            <input type="number" step="1" min="0"
                                                value={precios[mat.id] || ''}
                                                onChange={e => setPrecios(p => ({ ...p, [mat.id]: e.target.value }))}
                                                onKeyDown={e => { if (e.key === 'Enter') agregarItem(mat, cantidades[mat.id], precios[mat.id]); if (e.key === 'Escape') setMaterialActivo(null); }}
                                                placeholder={`$${fmt(precioDefault(mat))}`}
                                                title="Precio de venta por kg (déjalo vacío para usar el precio por defecto)"
                                                style={{ flex: 1, padding: '8px', borderRadius: 6, border: `1px solid ${c.border}`, fontSize: 16, minWidth: 0 }} />
                                            <button onClick={() => agregarItem(mat, cantidades[mat.id], precios[mat.id])}
                                                style={{ padding: '8px 14px', background: c.active, color: '#fff', border: 'none', borderRadius: 6, fontSize: 18, cursor: 'pointer', fontWeight: 700 }}>✓</button>
                                        </div>
                                        {parseFloat(cantidades[mat.id]) > 0 && (
                                            <div style={{ fontSize: 12, color: c.text, fontWeight: 700 }}>
                                                = ${fmt(parseFloat(cantidades[mat.id]) * (parseFloat(precios[mat.id]) || parseFloat(precioDefault(mat))))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );

    // ══════════════════════════════════════════════════════════════════════
    // MÓVIL
    // ══════════════════════════════════════════════════════════════════════
    if (isMobile) return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f0faf0' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                {[['orden','📤','Nueva orden'],['historial','📋','Hoy']].map(([k,ic,lb]) => (
                    <button key={k} onClick={() => setTabMobile(k)}
                        style={{ flex: 1, padding: '11px 4px 9px', border: 'none', background: 'none', cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                            borderBottom: tabMobile === k ? '3px solid #059669' : '3px solid transparent',
                            color: tabMobile === k ? '#059669' : '#9ca3af' }}>
                        <span style={{ fontSize: 19 }}>{ic}</span>
                        <span style={{ fontSize: 10, fontWeight: tabMobile === k ? 700 : 400 }}>{lb}</span>
                    </button>
                ))}
            </div>

            {/* Tab: Nueva orden */}
            {tabMobile === 'orden' && (
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {/* Cabecera */}
                    <div style={{ padding: '12px 14px', background: '#fff', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
                        {!ordenAbierta ? (
                            <>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 11, color: '#666', marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Cliente *</span>
                                            <button onClick={() => setShowNuevoCliente(!showNuevoCliente)}
                                                style={{ fontSize: 10, color: '#1a5c2a', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                                                + Nuevo
                                            </button>
                                        </div>
                                        <PickerBuscable
                                            items={clientes}
                                            value={cliente_id}
                                            onChange={clienteChange}
                                            placeholder="Buscar cliente por nombre..."
                                            fontSize={14}
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <select value={tipo_pago} onChange={e => setTipoPago(e.target.value)}
                                        style={{ flex: 1, padding: '9px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}>
                                        <option value="efectivo">💵 Efectivo</option>
                                        <option value="transferencia">📲 Transferencia</option>
                                        <option value="pendiente">⏳ Pendiente</option>
                                    </select>
                                    <button onClick={abrirOrden}
                                        style={{ padding: '9px 20px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                                        Abrir
                                    </button>
                                </div>
                                {showNuevoCliente && (
                                    <div style={{ marginTop: 10, background: '#f0faf0', border: '2px solid #1a5c2a', borderRadius: 8, padding: 12 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1a5c2a', marginBottom: 8 }}>Nuevo cliente</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                                            {[['nombre','Nombre *'],['nit','NIT'],['telefono','Teléfono'],['email','Email']].map(([k,l]) => (
                                                <input key={k} placeholder={l} value={cForm[k]} onChange={e => setCForm({ ...cForm, [k]: e.target.value })}
                                                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #a7d7a7', fontSize: 13 }} />
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button onClick={crearCliente} style={{ padding: '8px 16px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Guardar</button>
                                            <button onClick={() => setShowNuevoCliente(false)} style={{ padding: '8px 12px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                                        </div>
                                    </div>
                                )}
                                {msg && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{msg}</div>}
                            </>
                        ) : (
                            <div style={{ background: '#1a5c2a', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ color: '#fff' }}>
                                    <div style={{ fontWeight: 700, fontSize: 15 }}>🏢 {clienteSeleccionado?.nombre}</div>
                                    <div style={{ fontSize: 12, opacity: .8 }}>{tipo_pago} · {items.length} materiales</div>
                                </div>
                                <button onClick={cancelarOrden} style={{ padding: '5px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.3)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                                    Cancelar
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Materiales */}
                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '10px 12px 0' }}>
                        <BloqueCategoriasYMateriales />
                    </div>

                    {/* Carrito + Botón crear */}
                    {(items.length > 0 || ordenAbierta) && (
                        <div style={{ background: '#fff', borderTop: '2px solid #e5e7eb', padding: 14, flexShrink: 0 }}>
                            {items.length > 0 && (
                                <div style={{ marginBottom: 10, maxHeight: 120, overflowY: 'auto' }}>
                                    {items.map((item, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.material_nombre}</div>
                                                <div style={{ fontSize: 11, color: '#888' }}>{item.kilos} kg × ${fmt(item.precio_unitario)}</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontWeight: 700, color: '#1a5c2a', fontSize: 13 }}>${fmt(item.total)}</span>
                                                <button onClick={() => quitarItem(idx)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <span style={{ fontSize: 15, fontWeight: 600, color: '#555' }}>TOTAL</span>
                                <span style={{ fontSize: 24, fontWeight: 800, color: '#1a5c2a' }}>${fmt(total)}</span>
                            </div>
                            {msg && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{msg}</div>}
                            <button onClick={crearOrden} disabled={loading || !items.length || !ordenAbierta}
                                style={{ width: '100%', padding: '14px', background: items.length && ordenAbierta ? '#1a5c2a' : '#d1d5db',
                                    color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700,
                                    cursor: items.length && ordenAbierta ? 'pointer' : 'default' }}>
                                {loading ? 'Procesando...' : '✅ Crear Orden'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Tab: Historial hoy */}
            {tabMobile === 'historial' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
                    <div style={{ background: '#1a5c2a', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ color: '#fff', fontSize: 13 }}>
                            <strong>{ventasHoy.length}</strong> órdenes hoy
                        </div>
                        <div style={{ color: '#6fcf8a', fontSize: 13, fontWeight: 700 }}>
                            Cobrado: ${fmt(ventasHoy.filter(v => v.estado === 'pagada').reduce((s, v) => s + parseFloat(v.total), 0))}
                        </div>
                    </div>
                    {!ventasHoy.length ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb' }}>
                            <div style={{ fontSize: 40 }}>📋</div>
                            <p style={{ fontSize: 13, marginTop: 8 }}>Sin órdenes hoy</p>
                        </div>
                    ) : ventasHoy.map(v => {
                        const ec = ESTADO_COLOR[v.estado] || ESTADO_COLOR.orden;
                        return (
                            <div key={v.id} style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 15 }}>{v.cliente?.nombre}</div>
                                        <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 10, background: ec.bg, color: ec.color, fontWeight: 600 }}>{v.estado}</span>
                                    </div>
                                    <div style={{ fontWeight: 800, color: '#1a5c2a', fontSize: 18 }}>${fmt(v.total)}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {v.estado === 'orden' && (
                                        <button onClick={() => cambiarEstado(v.id, 'facturada')}
                                            style={{ flex: 1, padding: '8px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                                            Facturar
                                        </button>
                                    )}
                                    {v.estado === 'facturada' && (
                                        <button onClick={() => cambiarEstado(v.id, 'pagada', 'efectivo')}
                                            style={{ flex: 1, padding: '8px', background: '#d1fae5', color: '#059669', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                                            ✅ Marcar pagada
                                        </button>
                                    )}
                                    <button onClick={() => setReciboVenta(v)}
                                        style={{ flex: 1, padding: '8px', background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                                        🖨️ Imprimir
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    // ══════════════════════════════════════════════════════════════════════
    // ESCRITORIO (layout original)
    // ══════════════════════════════════════════════════════════════════════
    return (
        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, height: 'calc(100vh - 48px)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {!ordenAbierta ? (
                    <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)', flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: '#1a5c2a' }}>📤 Nueva orden de venta</div>
                        <div style={{ display: 'grid', gridTemplateColumns: esAdmin ? '1fr 1fr 160px 110px 90px' : '1fr 1fr 110px 90px', gap: 10, alignItems: 'flex-end' }}>
                            <div>
                                <div style={{ fontSize: 11, color: '#666', marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Cliente *</span>
                                    <button onClick={() => setShowNuevoCliente(!showNuevoCliente)}
                                        style={{ fontSize: 10, color: '#1a5c2a', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Nuevo</button>
                                </div>
                                <PickerBuscable
                                    items={clientes}
                                    value={cliente_id}
                                    onChange={clienteChange}
                                    placeholder="Buscar cliente por nombre..."
                                    fontSize={13}
                                />
                            </div>
                            <label>
                                <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Sede</div>
                                <select value={sede_id} onChange={e => setSedeId(e.target.value)}
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                    <option value="">Sin sede</option>
                                    {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                </select>
                            </label>
                            {esAdmin && (
                                <label>
                                    <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Bodega *</div>
                                    <select value={bodega_id} onChange={e => setBodegaId(e.target.value)}
                                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                        {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                                    </select>
                                </label>
                            )}
                            <label>
                                <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Pago</div>
                                <select value={tipo_pago} onChange={e => setTipoPago(e.target.value)}
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                    <option value="efectivo">Efectivo</option>
                                    <option value="transferencia">Transferencia</option>
                                    <option value="pendiente">Pendiente</option>
                                </select>
                            </label>
                            <button onClick={abrirOrden} style={{ padding: '9px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Abrir</button>
                        </div>
                        {showNuevoCliente && (
                            <div style={{ marginTop: 12, background: '#f0faf0', border: '2px solid #1a5c2a', borderRadius: 8, padding: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#1a5c2a', marginBottom: 8 }}>Nuevo cliente</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 8 }}>
                                    {[['nombre','Nombre *'],['nit','NIT'],['telefono','Teléfono'],['email','Email']].map(([k,l]) => (
                                        <input key={k} placeholder={l} value={cForm[k]} onChange={e => setCForm({ ...cForm, [k]: e.target.value })}
                                            style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #a7d7a7', fontSize: 13 }} />
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={crearCliente} style={{ padding: '6px 16px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Guardar</button>
                                    <button onClick={() => setShowNuevoCliente(false)} style={{ padding: '6px 12px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                                </div>
                            </div>
                        )}
                        {msg && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{msg}</div>}
                    </div>
                ) : (
                    <div style={{ background: '#1a5c2a', borderRadius: 10, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                        <div style={{ color: '#fff' }}>
                            <span style={{ fontWeight: 700, fontSize: 15 }}>🏢 {clienteSeleccionado?.nombre}</span>
                            <span style={{ fontSize: 12, marginLeft: 12, opacity: .8 }}>{bodegas.find(b => String(b.id) === bodega_id)?.nombre} · {tipo_pago}</span>
                        </div>
                        <button onClick={cancelarOrden} style={{ padding: '5px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.3)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                )}
                <div style={{ position: 'relative', marginBottom: 10, flexShrink: 0 }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: .6, fontSize: 13, pointerEvents: 'none' }}>🔍</span>
                    <input value={busquedaMat} onChange={e => setBusquedaMat(e.target.value)} placeholder="Buscar material por nombre o código..."
                        style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', flexShrink: 0, opacity: busquedaMat.trim() ? .5 : 1 }}>
                    {categorias.map(cat => {
                        const c = CAT_COLORS[cat] || CAT_COLORS['Varios'];
                        const activa = catActiva === cat;
                        return (
                            <button key={cat} onClick={() => { setCatActiva(cat); setMaterialActivo(null); }}
                                style={{ padding: '6px 14px', borderRadius: 20, border: `2px solid ${activa ? c.active : '#ddd'}`,
                                    background: activa ? c.bg : '#fff', color: activa ? c.text : '#888',
                                    fontSize: 12, fontWeight: activa ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                {CAT_ICONS[cat] || '📋'} {cat}
                            </button>
                        );
                    })}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
                        {matsFiltrados.map(mat => {
                            const c = CAT_COLORS[mat.categoria] || CAT_COLORS['Varios'];
                            const enCarrito = items.find(i => i.material_id === mat.id);
                            const esActivo  = materialActivo?.id === mat.id;
                            return (
                                <div key={mat.id}>
                                    <button onClick={() => seleccionarMaterial(mat)}
                                        style={{ width: '100%', padding: '12px 8px', background: esActivo ? c.active : enCarrito ? c.bg : '#fff',
                                            border: `2px solid ${esActivo ? c.active : enCarrito ? c.border : '#e5e7eb'}`,
                                            borderRadius: 10, cursor: 'pointer', textAlign: 'center', transition: 'all .12s' }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: esActivo ? '#fff' : '#222', lineHeight: 1.3 }}>{mat.nombre}</div>
                                        {enCarrito && <div style={{ fontSize: 11, color: esActivo ? '#fff' : c.active, fontWeight: 700, marginTop: 3 }}>✓ {enCarrito.kilos} kg</div>}
                                    </button>
                                    {esActivo && (
                                        <div style={{ marginTop: 4, background: c.bg, border: `2px solid ${c.border}`, borderRadius: 8, padding: 10 }}>
                                            <div style={{ fontSize: 12, color: c.text, fontWeight: 600, marginBottom: 6 }}>{mat.nombre}</div>
                                            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                                <input ref={inputRef} type="number" step="0.1" min="0"
                                                    value={cantidades[mat.id] || ''}
                                                    onChange={e => setCantidades(p => ({ ...p, [mat.id]: e.target.value }))}
                                                    onKeyDown={e => { if (e.key === 'Enter') agregarItem(mat, cantidades[mat.id], precios[mat.id]); if (e.key === 'Escape') setMaterialActivo(null); }}
                                                    placeholder="Kg"
                                                    style={{ flex: 1, padding: '7px 8px', borderRadius: 6, border: `1px solid ${c.border}`, fontSize: 14, minWidth: 0 }} />
                                                <input type="number" step="1" min="0"
                                                    value={precios[mat.id] || ''}
                                                    onChange={e => setPrecios(p => ({ ...p, [mat.id]: e.target.value }))}
                                                    onKeyDown={e => { if (e.key === 'Enter') agregarItem(mat, cantidades[mat.id], precios[mat.id]); if (e.key === 'Escape') setMaterialActivo(null); }}
                                                    placeholder={`$${fmt(precioDefault(mat))}`}
                                                    title="Precio de venta por kg (déjalo vacío para usar el precio por defecto)"
                                                    style={{ flex: 1, padding: '7px 8px', borderRadius: 6, border: `1px solid ${c.border}`, fontSize: 14, minWidth: 0 }} />
                                                <button onClick={() => agregarItem(mat, cantidades[mat.id], precios[mat.id])}
                                                    style={{ padding: '7px 12px', background: c.active, color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, cursor: 'pointer', fontWeight: 700 }}>✓</button>
                                            </div>
                                            {parseFloat(cantidades[mat.id]) > 0 && (
                                                <div style={{ fontSize: 12, color: c.text, fontWeight: 700 }}>
                                                    = ${fmt(parseFloat(cantidades[mat.id]) * (parseFloat(precios[mat.id]) || parseFloat(precioDefault(mat))))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div style={{ marginTop: 10, background: '#f0faf0', borderRadius: 8, padding: '8px 14px', display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, color: '#555' }}>Hoy: <strong>{ventasHoy.length}</strong> órdenes · <strong>{ventasHoy.filter(v => v.estado === 'pagada').length}</strong> pagadas</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a5c2a', marginLeft: 'auto' }}>Cobrado: ${fmt(ventasHoy.filter(v => v.estado === 'pagada').reduce((s, v) => s + parseFloat(v.total), 0))}</div>
                </div>
            </div>

            {/* Panel derecho carrito */}
            <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: 15, color: '#1a5c2a' }}>
                    🛒 Carrito {ordenAbierta ? `· ${clienteSeleccionado?.nombre}` : ''}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
                    {!items.length ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb' }}>
                            <div style={{ fontSize: 40 }}>🛒</div>
                            <p style={{ fontSize: 13, marginTop: 8 }}>Sin materiales aún.<br/>Abre una orden y selecciona.</p>
                        </div>
                    ) : items.map((item, idx) => (
                        <div key={idx} style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{item.material_nombre}</div>
                                <div style={{ fontSize: 12, color: '#888' }}>{item.kilos} kg × ${fmt(item.precio_unitario)}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 700, color: '#1a5c2a' }}>${fmt(item.total)}</span>
                                <button onClick={() => quitarItem(idx)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{ padding: 16, borderTop: '2px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#555' }}>TOTAL</span>
                        <span style={{ fontSize: 24, fontWeight: 800, color: '#1a5c2a' }}>${fmt(total)}</span>
                    </div>
                    {msg && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{msg}</div>}
                    <button onClick={crearOrden} disabled={loading || !items.length || !ordenAbierta}
                        style={{ width: '100%', padding: '14px', background: items.length && ordenAbierta ? '#1a5c2a' : '#d1d5db',
                            color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700,
                            cursor: items.length && ordenAbierta ? 'pointer' : 'default' }}>
                        {loading ? 'Procesando...' : '✅ Crear Orden'}
                    </button>
                </div>
                {ventasHoy.length > 0 && (
                    <div style={{ borderTop: '1px solid #f0f0f0', maxHeight: 220, overflowY: 'auto' }}>
                        <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: .5 }}>ÓRDENES DE HOY</div>
                        {ventasHoy.map(v => {
                            const ec = ESTADO_COLOR[v.estado] || ESTADO_COLOR.orden;
                            return (
                                <div key={v.id} style={{ padding: '8px 16px', borderTop: '1px solid #f5f5f5' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>{v.cliente?.nombre}</span>
                                        <span style={{ fontWeight: 700, color: '#1a5c2a', fontSize: 12 }}>${fmt(v.total)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: ec.bg, color: ec.color, fontWeight: 600 }}>{v.estado}</span>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            {v.estado === 'orden' && <button onClick={() => cambiarEstado(v.id, 'facturada')} style={{ padding: '2px 8px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 4, fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>Facturar</button>}
                                            {v.estado === 'facturada' && <button onClick={() => cambiarEstado(v.id, 'pagada', 'efectivo')} style={{ padding: '2px 8px', background: '#d1fae5', color: '#059669', border: 'none', borderRadius: 4, fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>Pagada</button>}
                                            <button onClick={() => setReciboVenta(v)} style={{ padding: '2px 8px', background: '#f9fafb', color: '#6b7280', border: 'none', borderRadius: 4, fontSize: 10, cursor: 'pointer' }}>🖨️ Imprimir</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export function ReciboVenta({ venta, onClose }) {
    // Logo embebido en base64 para que SIEMPRE se imprima (sin depender de red/caché)
    const [logo, setLogo] = useState('/logo.png');
    useEffect(() => {
        fetch('/logo.png')
            .then(r => r.blob())
            .then(b => { const fr = new FileReader(); fr.onload = () => setLogo(fr.result); fr.readAsDataURL(b); })
            .catch(() => {});
    }, []);
    return (
        <div>
            <style>{`@page { size: 80mm auto; margin: 0; } @media print { html, body { width: 80mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; } body * { visibility: hidden !important; } .recibo-venta, .recibo-venta * { visibility: visible !important; } .recibo-venta { position: fixed !important; top: 0 !important; left: 0 !important; width: 80mm !important; max-width: 80mm !important; margin: 0 !important; padding: 4mm 3mm !important; box-shadow: none !important; border-radius: 0 !important; font-size: 12px !important; } .recibo-venta img { width: 60px !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button onClick={() => window.print()} style={{ padding: '9px 20px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🖨️ Imprimir</button>
                <button onClick={onClose} style={{ padding: '9px 16px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>← Volver</button>
            </div>
            <div className="recibo-venta" style={{ background: '#fff', borderRadius: 10, padding: 28, boxShadow: '0 2px 8px rgba(0,0,0,.08)', maxWidth: 460, fontFamily: 'monospace' }}>
                <div style={{ textAlign: 'center', marginBottom: 20, fontFamily: 'sans-serif' }}>
                    <img src={logo} alt="ASOERC" style={{ width: 80, marginBottom: 6 }} />
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#1a5c2a' }}>ASOERC ESP</div>
                    <div style={{ fontSize: 12, color: '#666' }}>NIT: 901.299.762-6</div>
                    <div style={{ fontWeight: 700, marginTop: 10, fontSize: 15 }}>COMPROBANTE DE VENTA</div>
                    <div style={{ fontSize: 12, color: '#888' }}>#{venta.numero || venta.id} · {venta.fecha}</div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>Generado: {new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</div>
                </div>
                <div style={{ borderTop: '1px dashed #ccc', borderBottom: '1px dashed #ccc', padding: '10px 0', marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span style={{ color: '#666' }}>Cliente:</span><strong>{venta.cliente?.nombre}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: '#666' }}>Pago:</span><span>{venta.tipo_pago}</span></div>
                </div>
                <table style={{ width: '100%', fontSize: 10.5, borderCollapse: 'collapse', marginBottom: 14, tableLayout: 'fixed' }}>
                    <colgroup>
                        <col style={{ width: '46%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '20%' }} />
                    </colgroup>
                    <thead><tr style={{ borderBottom: '1px dashed #ccc' }}>
                        <th style={{ textAlign: 'left', padding: '4px 0', color: '#666', fontWeight: 600 }}>Material</th>
                        <th style={{ textAlign: 'right', padding: '4px 0 4px 4px', color: '#666', fontWeight: 600 }}>Kg</th>
                        <th style={{ textAlign: 'right', padding: '4px 0 4px 6px', color: '#666', fontWeight: 600 }}>$/kg</th>
                        <th style={{ textAlign: 'right', padding: '4px 0 4px 6px', color: '#666', fontWeight: 600 }}>Total</th>
                    </tr></thead>
                    <tbody>{(venta.items || []).map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px dotted #eee' }}>
                            <td style={{ padding: '5px 4px 5px 0', lineHeight: 1.25 }}>{item.material?.nombre || item.material_nombre}</td>
                            <td style={{ textAlign: 'right', color: '#555', whiteSpace: 'nowrap', paddingLeft: 4 }}>{fmtKg(item.kilos)}</td>
                            <td style={{ textAlign: 'right', color: '#555', whiteSpace: 'nowrap', paddingLeft: 6 }}>${fmt(item.precio_unitario)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', paddingLeft: 6 }}>${fmt(item.total)}</td>
                        </tr>
                    ))}</tbody>
                </table>
                <div style={{ borderTop: '1px dashed #ccc', paddingTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 800, color: '#1a5c2a' }}>
                        <span>TOTAL:</span><span>${fmt(venta.total)}</span>
                    </div>
                </div>
                <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#aaa', borderTop: '1px dashed #ccc', paddingTop: 12 }}>
                    Gracias por su compra · ASOERC ESP<br/>{new Date().toLocaleString('es-CO')}
                </div>
            </div>
        </div>
    );
}
