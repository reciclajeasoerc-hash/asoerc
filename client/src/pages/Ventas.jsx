import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import PickerBuscable from '../components/PickerBuscable';
import Icono from '../components/Icono';
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
    orden:     { bg: 'var(--ambar)', color: 'var(--noche)' },
    facturada: { bg: 'var(--verde-suave)', color: 'var(--texto-2)' },
    pagada:    { bg: 'var(--verde-suave)', color: 'var(--verde-osc)' },
};

// Estilos del diseño "Operación", compartidos por escritorio y móvil.
const estiloCat = (activa, movil) => ({
    height: movil ? 40 : 42, padding: movil ? '0 14px' : '0 16px', borderRadius: 9, whiteSpace: 'nowrap', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
    border: activa ? '2px solid var(--noche)' : '1.5px solid var(--borde-fuerte)',
    background: activa ? 'var(--noche)' : '#fff', color: activa ? '#fff' : 'var(--texto-2)',
    fontFamily: 'var(--fuente-tit)', fontSize: movil ? 15 : 16, fontWeight: activa ? 800 : 600, letterSpacing: .3,
});
const estiloMat = (esActivo, enCarrito) => ({
    width: '100%', minHeight: 64, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', position: 'relative',
    background: esActivo ? 'var(--noche)' : enCarrito ? 'var(--verde-suave)' : '#fff',
    border: `2px solid ${esActivo ? 'var(--noche)' : enCarrito ? 'var(--verde)' : 'var(--borde)'}`,
    boxShadow: esActivo ? '0 6px 16px rgba(15,27,45,.25)' : 'var(--sombra)', transition: 'all .12s',
});
const tituloTarjeta = { display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--fuente-tit)', fontWeight: 800, fontSize: 18, letterSpacing: .5, textTransform: 'uppercase', color: 'var(--texto)', marginBottom: 12 };
const botonVerde = { background: 'var(--verde)', color: '#fff', border: '2px solid var(--verde-osc)', borderRadius: 10, fontFamily: 'var(--fuente-tit)', fontWeight: 800, letterSpacing: .5, textTransform: 'uppercase', cursor: 'pointer' };

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
    // Solo el superadmin (dueña) puede elegir/cambiar la bodega. Los demás perfiles
    // (admin de sede, cajera, vendedora, operario) quedan FIJOS a su propia bodega.
    const esSuper = user?.rol === 'superadmin';
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

    // La orden de venta solo existe en la pantalla hasta que se crea: se guarda en el
    // dispositivo para que una recarga (celular, actualización de la app) no la borre.
    const claveOrden = `ordenVenta:${user?.id || ''}`;
    const [ordenRecuperada, setOrdenRecuperada] = useState(false);
    // Bodega en la que se ABRIÓ la orden: la venta se registra ahí aunque después cambie el
    // selector de la barra o de Caja (antes una orden recuperada podía irse a la otra bodega).
    const [ordenBodega, setOrdenBodega] = useState('');
    useEffect(() => {
        try {
            const o = JSON.parse(localStorage.getItem(claveOrden) || 'null');
            if (o && o.ordenAbierta) {
                setClienteId(o.cliente_id || ''); setSedeId(o.sede_id || '');
                setTipoPago(o.tipo_pago || 'efectivo'); setItems(Array.isArray(o.items) ? o.items : []);
                setOrdenBodega(o.bodega_id ? String(o.bodega_id) : '');
                setOrdenAbierta(true);
            }
        } catch { /* sin almacenamiento o dato dañado */ }
        setOrdenRecuperada(true);
    }, []);
    useEffect(() => {
        if (!ordenRecuperada) return; // no pisar lo guardado antes de leerlo
        try {
            if (ordenAbierta) localStorage.setItem(claveOrden, JSON.stringify({ ordenAbierta, cliente_id, sede_id, tipo_pago, items, bodega_id: ordenBodega }));
            else localStorage.removeItem(claveOrden);
        } catch { /* sin almacenamiento */ }
    }, [ordenRecuperada, ordenAbierta, cliente_id, sede_id, tipo_pago, items, ordenBodega]);

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
    // Al recuperar una orden guardada, las sedes del cliente llegan cuando cargan los clientes
    useEffect(() => { if (cliente_id && clienteSeleccionado) setSedes(clienteSeleccionado.sedes || []); }, [clientes]);

    const abrirOrden = () => {
        if (!cliente_id) return setMsg('Selecciona un cliente');
        if (esSuper && !bodega_id) return setMsg('Selecciona una bodega');
        setOrdenBodega(bodega_id); setOrdenAbierta(true); setMsg('');
    };
    const cancelarOrden = () => {
        setOrdenAbierta(false); setOrdenBodega('');
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
                cliente_id, sede_id: sede_id || null, bodega_id: ordenBodega || bodega_id, fecha, tipo_pago,
                items: items.map(i => ({ material_id: i.material_id, kilos: i.kilos, precio_unitario: i.precio_unitario })),
            });
            setReciboVenta(d.venta);
            cancelarOrden(); cargarHoy();
            if (tipo_pago !== 'pendiente') onCajaChange?.(ordenBodega || bodega_id);
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

    const ContenidoMat = ({ mat, esActivo, enCarrito }) => (
        <>
            {enCarrito && !esActivo && <span style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: 'var(--verde)' }} />}
            <div style={{ fontFamily: 'var(--fuente-tit)', fontSize: 17, fontWeight: 700, color: esActivo ? '#fff' : 'var(--texto)', lineHeight: 1.15, paddingRight: 10 }}>{mat.nombre}</div>
            <div style={{ fontSize: 12.5, marginTop: 3, color: esActivo ? '#cbd5e1' : enCarrito ? 'var(--verde-osc)' : 'var(--texto-3)', fontWeight: enCarrito ? 700 : 500 }}>
                {enCarrito ? `✓ ${fmtKg(enCarrito.kilos)} kg · $${fmt(enCarrito.precio_unitario)} / kg` : `$${fmt(precioDefault(mat))} / kg`}
            </div>
        </>
    );

    // ── Bloque materiales (compartido) ────────────────────────────────────
    // Se llama como FUNCIÓN, no como <Componente/>: definido aquí adentro, React lo veía como un
    // componente nuevo en cada render y lo desmontaba entero → en el celular la lista saltaba
    // arriba y se cerraba el teclado con cada número y con el refresco automático de 20 s.
    const BloqueCategoriasYMateriales = () => (
        <>
            {/* Buscar material */}
            <div style={{ position: 'relative', marginBottom: 8, flexShrink: 0 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: .6, fontSize: 14, pointerEvents: 'none' }}>🔍</span>
                <input value={busquedaMat} onChange={e => setBusquedaMat(e.target.value)} placeholder="Buscar material..."
                    style={{ width: '100%', minHeight: 40, padding: '9px 10px 9px 34px', borderRadius: 8, border: '1px solid var(--borde-fuerte)', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            {/* Tabs categorías */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', paddingBottom: 4, flexShrink: 0, opacity: busquedaMat.trim() ? .5 : 1 }}>
                {categorias.map(cat => {
                    const activa = catActiva === cat;
                    return (
                        <button key={cat} onClick={() => { setCatActiva(cat); setMaterialActivo(null); }}
                            style={estiloCat(activa, isMobile)}>
                            {CAT_ICONS[cat] || '📋'} {cat}
                        </button>
                    );
                })}
            </div>
            {/* Grid materiales */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
                    {matsFiltrados.map(mat => {
                        const enCarrito = items.find(i => i.material_id === mat.id);
                        const esActivo  = materialActivo?.id === mat.id;
                        return (
                            <div key={mat.id}>
                                <button onClick={() => seleccionarMaterial(mat)}
                                    style={estiloMat(esActivo, enCarrito)}>
                                    {ContenidoMat({ mat, esActivo, enCarrito })}
                                </button>
                                {esActivo && (
                                    <div style={{ marginTop: 4, background: 'var(--verde-suave)', border: '2px solid var(--verde-borde)', borderRadius: 8, padding: 10 }}>
                                        <div style={{ fontSize: 12, color: 'var(--verde-osc)', fontWeight: 600, marginBottom: 6 }}>{mat.nombre}</div>
                                        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                            <input ref={inputRef} type="number" step="0.1" min="0"
                                                value={cantidades[mat.id] || ''}
                                                onChange={e => setCantidades(p => ({ ...p, [mat.id]: e.target.value }))}
                                                onKeyDown={e => { if (e.key === 'Enter') agregarItem(mat, cantidades[mat.id], precios[mat.id]); if (e.key === 'Escape') setMaterialActivo(null); }}
                                                placeholder="Kg"
                                                style={{ flex: 1, minHeight: 40, padding: '8px', borderRadius: 6, border: '1px solid var(--verde-borde)', fontSize: 16, minWidth: 0 }} />
                                            <input type="number" step="1" min="0"
                                                value={precios[mat.id] || ''}
                                                onChange={e => setPrecios(p => ({ ...p, [mat.id]: e.target.value }))}
                                                onKeyDown={e => { if (e.key === 'Enter') agregarItem(mat, cantidades[mat.id], precios[mat.id]); if (e.key === 'Escape') setMaterialActivo(null); }}
                                                placeholder={`$${fmt(precioDefault(mat))}`}
                                                title="Precio de venta por kg (déjalo vacío para usar el precio por defecto)"
                                                style={{ flex: 1, minHeight: 40, padding: '8px', borderRadius: 6, border: '1px solid var(--verde-borde)', fontSize: 16, minWidth: 0 }} />
                                            <button onClick={() => agregarItem(mat, cantidades[mat.id], precios[mat.id])}
                                                style={{ ...botonVerde, minHeight: 40, padding: '8px 14px', fontSize: 18 }}>✓</button>
                                        </div>
                                        {parseFloat(cantidades[mat.id]) > 0 && (
                                            <div style={{ fontSize: 12, color: 'var(--verde-osc)', fontWeight: 700 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--fondo)' }}>
            {/* Tabs: control segmentado (igual que Compras) */}
            <div style={{ padding: '10px 12px 0', flexShrink: 0 }}>
                <div style={{ display: 'flex', background: '#fff', border: '1.5px solid var(--borde)', borderRadius: 10, padding: 3 }}>
                    {[['orden', 'Nueva orden'], ['historial', 'Órdenes de hoy']].map(([k, lb]) => (
                        <button key={k} onClick={() => setTabMobile(k)} aria-pressed={tabMobile === k}
                            style={{ flex: 1, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer',
                                fontFamily: 'var(--fuente-tit)', fontSize: 15.5, letterSpacing: .3,
                                fontWeight: tabMobile === k ? 800 : 600,
                                background: tabMobile === k ? 'var(--noche)' : 'transparent',
                                color: tabMobile === k ? '#fff' : 'var(--texto-2)' }}>
                            {lb}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab: Nueva orden */}
            {tabMobile === 'orden' && (
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {/* Cabecera */}
                    <div className="tarjeta" style={{ padding: '12px 14px', borderRadius: 0, borderLeft: 'none', borderRight: 'none', flexShrink: 0 }}>
                        {!ordenAbierta ? (
                            <>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 11, color: '#666', marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Cliente *</span>
                                            <button onClick={() => setShowNuevoCliente(!showNuevoCliente)}
                                                style={{ fontSize: 10, color: 'var(--verde-osc)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
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
                                        style={{ flex: 1, minHeight: 40, padding: '9px 10px', borderRadius: 8, border: '1px solid var(--borde-fuerte)', fontSize: 14 }}>
                                        <option value="efectivo">💵 Efectivo</option>
                                        <option value="transferencia">📲 Transferencia</option>
                                        <option value="pendiente">⏳ Pendiente</option>
                                    </select>
                                    <button onClick={abrirOrden}
                                        style={{ ...botonVerde, minHeight: 40, padding: '9px 20px', fontSize: 14 }}>
                                        Abrir
                                    </button>
                                </div>
                                {showNuevoCliente && (
                                    <div style={{ marginTop: 10, background: 'var(--verde-suave)', border: '2px solid var(--verde-osc)', borderRadius: 8, padding: 12 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--verde-osc)', marginBottom: 8 }}>Nuevo cliente</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                                            {[['nombre','Nombre *'],['nit','NIT'],['telefono','Teléfono'],['email','Email']].map(([k,l]) => (
                                                <input key={k} placeholder={l} value={cForm[k]} onChange={e => setCForm({ ...cForm, [k]: e.target.value })}
                                                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #a7d7a7', fontSize: 13 }} />
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button onClick={crearCliente} style={{ padding: '8px 16px', background: 'var(--verde-osc)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Guardar</button>
                                            <button onClick={() => setShowNuevoCliente(false)} style={{ padding: '8px 12px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                                        </div>
                                    </div>
                                )}
                                {msg && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{msg}</div>}
                            </>
                        ) : (
                            <div style={{ background: 'var(--noche)', borderLeft: '4px solid var(--verde)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                        {BloqueCategoriasYMateriales()}
                    </div>

                    {/* Carrito + Botón crear */}
                    {(items.length > 0 || ordenAbierta) && (
                        <div className="tarjeta" style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', padding: 14, flexShrink: 0 }}>
                            {items.length > 0 && (
                                <div style={{ marginBottom: 10, maxHeight: 120, overflowY: 'auto' }}>
                                    {items.map((item, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.material_nombre}</div>
                                                <div style={{ fontSize: 11, color: '#888' }}>{item.kilos} kg × ${fmt(item.precio_unitario)}</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontWeight: 700, color: 'var(--verde-osc)', fontSize: 13 }}>${fmt(item.total)}</span>
                                                <button onClick={() => quitarItem(idx)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, border: '1px dashed var(--verde-borde)', borderRadius: 8, padding: '9px 10px' }}>
                                <span style={{ fontFamily: 'var(--fuente-tit)', fontSize: 16, fontWeight: 800, color: 'var(--texto)' }}>MONTO TOTAL</span>
                                <span className="cifra" style={{ fontSize: 24, color: 'var(--verde-osc)' }}>${fmt(total)}</span>
                            </div>
                            {msg && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{msg}</div>}
                            <button onClick={crearOrden} disabled={loading || !items.length || !ordenAbierta}
                                style={{ ...botonVerde, width: '100%', minHeight: 44, padding: '10px 14px', background: items.length && ordenAbierta ? 'var(--verde)' : 'var(--borde-fuerte)',
                                    color: '#fff', fontSize: 16,
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
                    <div style={{ background: 'var(--noche)', borderRadius: 12, padding: '13px 15px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderLeft: '5px solid var(--verde)' }}>
                        <div style={{ color: '#fff', fontFamily: 'var(--fuente-tit)', fontSize: 18, fontWeight: 800 }}>
                            {ventasHoy.length} órdenes hoy
                        </div>
                        <div className="cifra" style={{ color: 'var(--verde-vivo)', fontSize: 16 }}>
                            Cobrado: ${fmt(ventasHoy.filter(v => v.estado === 'pagada').reduce((s, v) => s + parseFloat(v.total), 0))}
                        </div>
                    </div>
                    {!ventasHoy.length ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--texto-3)' }}>
                            <div style={{ fontSize: 36, opacity: .5 }}>📋</div>
                            <p style={{ fontSize: 13, marginTop: 8 }}>Sin órdenes hoy</p>
                        </div>
                    ) : ventasHoy.map(v => {
                        const ec = ESTADO_COLOR[v.estado] || ESTADO_COLOR.orden;
                        return (
                            <div key={v.id} className="tarjeta" style={{ padding: '13px 14px', marginBottom: 9 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                    <div>
                                        <div style={{ fontFamily: 'var(--fuente-tit)', fontWeight: 700, fontSize: 17 }}>{v.cliente?.nombre}</div>
                                        <span className="chip" style={{ background: ec.bg, color: ec.color, marginTop: 3 }}>{v.estado}</span>
                                    </div>
                                    <div className="cifra" style={{ color: 'var(--texto)', fontSize: 19 }}>${fmt(v.total)}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {v.estado === 'orden' && (
                                        <button onClick={() => cambiarEstado(v.id, 'facturada')}
                                            style={{ flex: 1, minHeight: 40, padding: '8px', background: 'var(--azul-suave)', color: 'var(--azul)', border: '1px solid #bfdbfe', borderRadius: 9, fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
                                            Facturar
                                        </button>
                                    )}
                                    {v.estado === 'facturada' && (
                                        <button onClick={() => cambiarEstado(v.id, 'pagada', 'efectivo')}
                                        style={{ flex: 1, minHeight: 40, padding: '8px', background: 'var(--verde-suave)', color: 'var(--verde-osc)', border: '1px solid var(--verde-borde)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                                            ✅ Marcar pagada
                                        </button>
                                    )}
                                    <button onClick={() => setReciboVenta(v)}
                                        style={{ flex: 1, minHeight: 40, padding: '8px', background: '#fff', color: 'var(--texto-2)', border: '1px solid var(--borde)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
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
                    <div className="tarjeta" style={{ padding: 16, marginBottom: 12, flexShrink: 0 }}>
                        <div style={tituloTarjeta}><Icono nombre="ventas" tam={20} /> Nueva orden de venta</div>
                        <div style={{ display: 'grid', gridTemplateColumns: esSuper ? '1fr 1fr 160px 110px 90px' : '1fr 1fr 110px 90px', gap: 10, alignItems: 'flex-end' }}>
                            <div>
                                <div style={{ fontSize: 11, color: '#666', marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Cliente *</span>
                                    <button onClick={() => setShowNuevoCliente(!showNuevoCliente)}
                                        style={{ fontSize: 10, color: 'var(--verde-osc)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Nuevo</button>
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
                                    style={{ width: '100%', minHeight: 40, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--borde-fuerte)', fontSize: 13 }}>
                                    <option value="">Sin sede</option>
                                    {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                </select>
                            </label>
                            {esSuper && (
                                <label>
                                    <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Bodega *</div>
                                    <select value={bodega_id} onChange={e => setBodegaId(e.target.value)}
                                        style={{ width: '100%', minHeight: 40, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--borde-fuerte)', fontSize: 13 }}>
                                        {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                                    </select>
                                </label>
                            )}
                            <label>
                                <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>Pago</div>
                                <select value={tipo_pago} onChange={e => setTipoPago(e.target.value)}
                                    style={{ width: '100%', minHeight: 40, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--borde-fuerte)', fontSize: 13 }}>
                                    <option value="efectivo">Efectivo</option>
                                    <option value="transferencia">Transferencia</option>
                                    <option value="pendiente">Pendiente</option>
                                </select>
                            </label>
                            <button onClick={abrirOrden} style={{ ...botonVerde, minHeight: 40, padding: '9px', fontSize: 13 }}>Abrir</button>
                        </div>
                        {showNuevoCliente && (
                            <div style={{ marginTop: 12, background: 'var(--verde-suave)', border: '2px solid var(--verde-osc)', borderRadius: 8, padding: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--verde-osc)', marginBottom: 8 }}>Nuevo cliente</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 8 }}>
                                    {[['nombre','Nombre *'],['nit','NIT'],['telefono','Teléfono'],['email','Email']].map(([k,l]) => (
                                        <input key={k} placeholder={l} value={cForm[k]} onChange={e => setCForm({ ...cForm, [k]: e.target.value })}
                                            style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #a7d7a7', fontSize: 13 }} />
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={crearCliente} style={{ padding: '6px 16px', background: 'var(--verde-osc)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Guardar</button>
                                    <button onClick={() => setShowNuevoCliente(false)} style={{ padding: '6px 12px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                                </div>
                            </div>
                        )}
                        {msg && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{msg}</div>}
                    </div>
                ) : (
                    <div style={{ background: 'var(--noche)', borderLeft: '4px solid var(--verde)', borderRadius: 10, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                        <div style={{ color: '#fff' }}>
                            <span style={{ fontWeight: 700, fontSize: 15 }}>🏢 {clienteSeleccionado?.nombre}</span>
                            <span style={{ fontSize: 12, marginLeft: 12, opacity: .8 }}>{bodegas.find(b => String(b.id) === String(ordenBodega || bodega_id))?.nombre} · {tipo_pago}</span>
                        </div>
                        <button onClick={cancelarOrden} style={{ padding: '5px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.3)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                )}
                <div style={{ position: 'relative', marginBottom: 10, flexShrink: 0 }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: .6, fontSize: 13, pointerEvents: 'none' }}>🔍</span>
                    <input value={busquedaMat} onChange={e => setBusquedaMat(e.target.value)} placeholder="Buscar material por nombre o código..."
                        style={{ width: '100%', minHeight: 40, padding: '8px 10px 8px 32px', borderRadius: 6, border: '1px solid var(--borde-fuerte)', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', flexShrink: 0, opacity: busquedaMat.trim() ? .5 : 1 }}>
                    {categorias.map(cat => {
                        const activa = catActiva === cat;
                        return (
                            <button key={cat} onClick={() => { setCatActiva(cat); setMaterialActivo(null); }}
                            style={estiloCat(activa, false)}>
                                {CAT_ICONS[cat] || '📋'} {cat}
                            </button>
                        );
                    })}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
                        {matsFiltrados.map(mat => {
                            const enCarrito = items.find(i => i.material_id === mat.id);
                            const esActivo  = materialActivo?.id === mat.id;
                            return (
                                <div key={mat.id}>
                                    <button onClick={() => seleccionarMaterial(mat)}
                                        style={estiloMat(esActivo, enCarrito)}>
                                        {ContenidoMat({ mat, esActivo, enCarrito })}
                                    </button>
                                    {esActivo && (
                                        <div style={{ marginTop: 4, background: 'var(--verde-suave)', border: '2px solid var(--verde-borde)', borderRadius: 8, padding: 10 }}>
                                            <div style={{ fontSize: 12, color: 'var(--verde-osc)', fontWeight: 600, marginBottom: 6 }}>{mat.nombre}</div>
                                            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                                <input ref={inputRef} type="number" step="0.1" min="0"
                                                    value={cantidades[mat.id] || ''}
                                                    onChange={e => setCantidades(p => ({ ...p, [mat.id]: e.target.value }))}
                                                    onKeyDown={e => { if (e.key === 'Enter') agregarItem(mat, cantidades[mat.id], precios[mat.id]); if (e.key === 'Escape') setMaterialActivo(null); }}
                                                    placeholder="Kg"
                                                    style={{ flex: 1, minHeight: 40, padding: '7px 8px', borderRadius: 6, border: '1px solid var(--verde-borde)', fontSize: 14, minWidth: 0 }} />
                                                <input type="number" step="1" min="0"
                                                    value={precios[mat.id] || ''}
                                                    onChange={e => setPrecios(p => ({ ...p, [mat.id]: e.target.value }))}
                                                    onKeyDown={e => { if (e.key === 'Enter') agregarItem(mat, cantidades[mat.id], precios[mat.id]); if (e.key === 'Escape') setMaterialActivo(null); }}
                                                    placeholder={`$${fmt(precioDefault(mat))}`}
                                                    title="Precio de venta por kg (déjalo vacío para usar el precio por defecto)"
                                                    style={{ flex: 1, minHeight: 40, padding: '7px 8px', borderRadius: 6, border: '1px solid var(--verde-borde)', fontSize: 14, minWidth: 0 }} />
                                                <button onClick={() => agregarItem(mat, cantidades[mat.id], precios[mat.id])}
                                                    style={{ ...botonVerde, minHeight: 40, padding: '7px 12px', fontSize: 16 }}>✓</button>
                                            </div>
                                            {parseFloat(cantidades[mat.id]) > 0 && (
                                                <div style={{ fontSize: 12, color: 'var(--verde-osc)', fontWeight: 700 }}>
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
                <div style={{ marginTop: 10, background: 'var(--verde-suave)', borderRadius: 8, padding: '8px 14px', display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, color: '#555' }}>Hoy: <strong>{ventasHoy.length}</strong> órdenes · <strong>{ventasHoy.filter(v => v.estado === 'pagada').length}</strong> pagadas</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--verde-osc)', marginLeft: 'auto' }}>Cobrado: ${fmt(ventasHoy.filter(v => v.estado === 'pagada').reduce((s, v) => s + parseFloat(v.total), 0))}</div>
                </div>
            </div>

            {/* Panel derecho carrito */}
            <div className="tarjeta" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ ...tituloTarjeta, marginBottom: 0, padding: '14px 16px', borderBottom: '1.5px solid var(--borde)', fontSize: 17 }}>
                    <Icono nombre="ventas" tam={19} /> Orden {ordenAbierta ? `· ${clienteSeleccionado?.nombre}` : ''}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
                    {!items.length ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb' }}>
                            <div style={{ fontSize: 40 }}>🛒</div>
                            <p style={{ fontSize: 13, marginTop: 8 }}>Sin materiales aún.<br/>Abre una orden y selecciona.</p>
                        </div>
                    ) : items.map((item, idx) => (
                        <div key={idx} style={{ padding: '10px 0', borderBottom: '1px solid #eef1f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>{item.material_nombre}</div>
                                <div style={{ fontSize: 12.5, color: 'var(--texto-3)' }}>{item.kilos} kg × ${fmt(item.precio_unitario)}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                <span className="cifra" style={{ fontSize: 16, color: 'var(--texto)' }}>${fmt(item.total)}</span>
                                <button onClick={() => quitarItem(idx)} aria-label="Quitar" style={{ background: 'var(--rojo-suave)', border: '1px solid var(--rojo-borde)', borderRadius: 7, color: 'var(--rojo)', cursor: 'pointer', fontSize: 14, width: 32, height: 32 }}>✕</button>
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{ padding: 14, borderTop: '1.5px solid var(--borde)' }}>
                    <div style={{ padding: '10px 12px', marginBottom: 12, textAlign: 'center', border: '2px dashed var(--borde-fuerte)', borderRadius: 10, background: '#f8fafc' }}>
                        <div className="etiqueta" style={{ color: 'var(--texto-2)' }}>Monto total</div>
                        <div className="cifra" style={{ fontSize: 34, color: 'var(--texto)', lineHeight: 1.1 }}>${fmt(total)}</div>
                    </div>
                    {msg && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{msg}</div>}
                    <button onClick={crearOrden} disabled={loading || !items.length || !ordenAbierta}
                        style={{ ...botonVerde, width: '100%', height: 54, fontSize: 17, ...(items.length && ordenAbierta ? {} : { background: '#cbd5e1', borderColor: '#cbd5e1', cursor: 'default' }) }}>
                        {loading ? 'Procesando...' : '✅ Crear orden'}
                    </button>
                </div>
                {ventasHoy.length > 0 && (
                    <div style={{ borderTop: '1.5px solid var(--borde)', maxHeight: 220, overflowY: 'auto' }}>
                        <div className="tit-seccion" style={{ padding: '10px 16px 6px', fontSize: 14 }}>Órdenes de hoy</div>
                        {ventasHoy.map(v => {
                            const ec = ESTADO_COLOR[v.estado] || ESTADO_COLOR.orden;
                            return (
                                <div key={v.id} style={{ padding: '8px 16px', borderTop: '1px solid #f5f5f5' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>{v.cliente?.nombre}</span>
                                        <span style={{ fontWeight: 700, color: 'var(--verde-osc)', fontSize: 12 }}>${fmt(v.total)}</span>
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
                <button onClick={() => window.print()} style={{ padding: '9px 20px', background: 'var(--verde-osc)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🖨️ Imprimir</button>
                <button onClick={onClose} style={{ padding: '9px 16px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>← Volver</button>
            </div>
            <div className="recibo-venta" style={{ background: '#fff', borderRadius: 10, padding: 28, boxShadow: '0 2px 8px rgba(0,0,0,.08)', maxWidth: 460, fontFamily: 'monospace' }}>
                <div style={{ textAlign: 'center', marginBottom: 20, fontFamily: 'sans-serif' }}>
                    <img src={logo} alt="ASOERC" style={{ width: 80, marginBottom: 6 }} />
                    <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--verde-osc)' }}>ASOERC ESP</div>
                    <div style={{ fontSize: 12, color: '#666' }}>NIT: 901.299.762-6</div>
                    <div style={{ fontWeight: 700, marginTop: 10, fontSize: 15 }}>COMPROBANTE DE VENTA</div>
                    <div style={{ fontSize: 12, color: '#888' }}>#{String(venta.numero_diario || venta.numero || venta.id).padStart(5, '0')} · {venta.fecha}</div>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 800, color: 'var(--verde-osc)' }}>
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
