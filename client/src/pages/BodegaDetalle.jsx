import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

const TABS = [
    { id: 'resumen',      label: 'Resumen',      icon: '📊' },
    { id: 'compras',      label: 'Compras',       icon: '⚖️' },
    { id: 'ventas',       label: 'Ventas',        icon: '📤' },
    { id: 'recicladores', label: 'Recicladores',  icon: '♻️' },
    { id: 'empleados',    label: 'Empleados',     icon: '👷' },
    { id: 'caja',         label: 'Caja',          icon: '💰' },
    { id: 'remisiones',   label: 'Remisiones',    icon: '🚛' },
    { id: 'empaques',     label: 'Empaques',      icon: '🛍️' },
    { id: 'usuarios',     label: 'Usuarios',      icon: '👥' },
];

const ROLES = ['admin', 'cajero', 'vendedor', 'operador'];
const ROLE_COLORS = { superadmin: '#f59e0b', admin: '#3b82f6', cajero: '#10b981', vendedor: '#8b5cf6', operador: '#6b7280' };
const ROLE_LABELS = { superadmin: 'Super Admin', admin: 'Admin', cajero: 'Cajero', vendedor: 'Vendedor', operador: 'Operador' };

const fmt  = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const fmtN = n => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(n || 0);

export default function BodegaDetalle() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [bodega, setBodega] = useState(null);
    const [tab, setTab] = useState('resumen');
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(false);

    // Carga la bodega
    useEffect(() => {
        api.get(`/bodegas/${id}`).then(d => setBodega(d.bodega)).catch(() => navigate('/bodegas'));
    }, [id]);

    // Carga datos del tab activo
    const cargarTab = useCallback(async (t) => {
        setLoading(true);
        try {
            const q = `bodega_id=${id}`;
            let result = {};
            if (t === 'resumen') {
                const [dash, recs, emps, usrs] = await Promise.all([
                    api.get(`/informes/dashboard?${q}`),
                    api.get(`/recicladores?${q}`),
                    api.get(`/empleados?${q}`),
                    api.get(`/usuarios?${q}`).catch(() => ({ usuarios: [] })),
                ]);
                result = { dash, recicladores: recs.recicladores || [], empleados: emps.empleados || [], usuarios: usrs.usuarios || [] };
            } else if (t === 'compras') {
                const r = await api.get(`/compras?${q}`);
                result = { items: r.items || [], total: r.total || 0 };
            } else if (t === 'ventas') {
                const r = await api.get(`/ventas?${q}`);
                result = { items: r.items || [], total: r.total || 0 };
            } else if (t === 'recicladores') {
                const r = await api.get(`/recicladores?${q}`);
                result = { items: r.recicladores || [] };
            } else if (t === 'empleados') {
                const r = await api.get(`/empleados?${q}`);
                result = { items: r.empleados || [] };
            } else if (t === 'caja') {
                const [caja, hist] = await Promise.all([
                    api.get(`/caja?${q}`).catch(() => null),
                    api.get(`/caja/historial?${q}`).catch(() => ({ cajas: [] })),
                ]);
                result = { caja: caja?.caja, historial: hist.cajas || [] };
            } else if (t === 'remisiones') {
                const r = await api.get(`/remisiones?${q}`);
                result = { items: r.remisiones || [] };
            } else if (t === 'empaques') {
                const r = await api.get(`/empaques?${q}`);
                result = { items: r.empaques || [] };
            } else if (t === 'usuarios') {
                const r = await api.get(`/usuarios?${q}`).catch(() => ({ usuarios: [] }));
                result = { items: r.usuarios || [] };
            }
            setData(prev => ({ ...prev, [t]: result }));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { if (bodega) cargarTab(tab); }, [tab, bodega]);

    if (!bodega) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Cargando bodega...</div>;

    const d = data[tab] || {};

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{ background: '#1a5c2a', color: '#fff', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                <button onClick={() => navigate('/bodegas')} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    ← Bodegas
                </button>
                <div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>🏭 {bodega.nombre}</div>
                    {bodega.direccion && <div style={{ fontSize: 13, color: '#a8d5b5' }}>📍 {bodega.direccion}</div>}
                </div>
            </div>

            {/* Tabs */}
            <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', overflowX: 'auto', flexShrink: 0 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{
                        border: 'none', background: 'none', padding: '12px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        color: tab === t.id ? '#1a5c2a' : '#6b7280',
                        borderBottom: tab === t.id ? '2px solid #1a5c2a' : '2px solid transparent',
                        whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
                        transition: 'color .15s'
                    }}>
                        <span>{t.icon}</span> {t.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
                {loading && <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Cargando...</div>}

                {!loading && tab === 'resumen' && <TabResumen d={d} fmt={fmt} fmtN={fmtN} />}
                {!loading && tab === 'compras' && <TabCompras items={d.items || []} fmt={fmt} fmtN={fmtN} />}
                {!loading && tab === 'ventas' && <TabVentas items={d.items || []} fmt={fmt} fmtN={fmtN} />}
                {!loading && tab === 'recicladores' && <TabRecicladores items={d.items || []} fmt={fmt} />}
                {!loading && tab === 'empleados' && <TabEmpleados items={d.items || []} fmt={fmt} />}
                {!loading && tab === 'caja' && <TabCaja caja={d.caja} historial={d.historial || []} fmt={fmt} />}
                {!loading && tab === 'remisiones' && <TabRemisiones items={d.items || []} fmtN={fmtN} />}
                {!loading && tab === 'empaques' && <TabEmpaques items={d.items || []} />}
                {!loading && tab === 'usuarios' && <TabUsuarios items={d.items || []} bodegaId={parseInt(id)} onRefresh={() => cargarTab('usuarios')} />}
            </div>
        </div>
    );
}

// ── Tab Resumen ───────────────────────────────────────────────────────────────
function TabResumen({ d, fmt, fmtN }) {
    const dash = d.dash || {};
    const c = dash.compras || {};
    const v = dash.ventas  || {};
    return (
        <div>
            <h3 style={secTitle}>Resumen del día — {dash.hoy || '...'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
                <StatCard label="Compras hoy" valor={fmt(c.pesos)} sub={`${c.cantidad || 0} compras · ${fmtN(c.kilos)} kg`} color="#1a5c2a" icon="⚖️" />
                <StatCard label="Ventas hoy" valor={fmt(v.pesos)} sub={`${v.cantidad || 0} ventas · ${fmtN(v.kilos)} kg`} color="#3b82f6" icon="📤" />
                <StatCard label="Recicladores" valor={d.recicladores?.filter(r => r.activo).length || 0} sub="activos" color="#10b981" icon="♻️" />
                <StatCard label="Empleados" valor={d.empleados?.filter(e => e.activo).length || 0} sub="activos" color="#8b5cf6" icon="👷" />
                <StatCard label="Usuarios" valor={d.usuarios?.filter(u => u.activo).length || 0} sub="con acceso" color="#f59e0b" icon="👥" />
            </div>
        </div>
    );
}

// ── Tab Compras ───────────────────────────────────────────────────────────────
function TabCompras({ items, fmt, fmtN }) {
    return (
        <div>
            <h3 style={secTitle}>Compras ({items.length})</h3>
            <DataTable
                cols={['#', 'Fecha', 'Reciclador', 'Total', 'Neto', 'Estado']}
                rows={items.map(c => [
                    c.numero,
                    c.fecha,
                    c.reciclador?.nombre || '—',
                    fmt(c.total),
                    fmt(c.neto),
                    <Badge text={c.estado} color={c.estado === 'finalizada' ? '#10b981' : '#f59e0b'} />
                ])}
                empty="No hay compras registradas"
            />
        </div>
    );
}

// ── Tab Ventas ────────────────────────────────────────────────────────────────
function TabVentas({ items, fmt }) {
    return (
        <div>
            <h3 style={secTitle}>Ventas ({items.length})</h3>
            <DataTable
                cols={['#', 'Fecha', 'Cliente', 'Total', 'Pago', 'Estado']}
                rows={items.map(v => [
                    v.numero,
                    v.fecha,
                    v.cliente?.nombre || '—',
                    fmt(v.total),
                    v.tipo_pago,
                    <Badge text={v.estado} color={v.estado === 'pagada' ? '#10b981' : v.estado === 'facturada' ? '#3b82f6' : '#f59e0b'} />
                ])}
                empty="No hay ventas registradas"
            />
        </div>
    );
}

// ── Tab Recicladores ──────────────────────────────────────────────────────────
function TabRecicladores({ items, fmt }) {
    return (
        <div>
            <h3 style={secTitle}>Recicladores ({items.length})</h3>
            <DataTable
                cols={['Nombre', 'Cédula', 'Teléfono', 'Saldo préstamo', 'Estado']}
                rows={items.map(r => [
                    r.nombre,
                    r.cedula || '—',
                    r.telefono || '—',
                    fmt(r.saldo_prestamo),
                    <Badge text={r.activo ? 'Activo' : 'Inactivo'} color={r.activo ? '#10b981' : '#ef4444'} />
                ])}
                empty="No hay recicladores registrados"
            />
        </div>
    );
}

// ── Tab Empleados ─────────────────────────────────────────────────────────────
function TabEmpleados({ items, fmt }) {
    return (
        <div>
            <h3 style={secTitle}>Empleados ({items.length})</h3>
            <DataTable
                cols={['Nombre', 'Cédula', 'Cargo', 'Salario', 'Estado']}
                rows={items.map(e => [
                    e.nombre,
                    e.cedula || '—',
                    e.cargo || '—',
                    fmt(e.salario),
                    <Badge text={e.activo ? 'Activo' : 'Inactivo'} color={e.activo ? '#10b981' : '#ef4444'} />
                ])}
                empty="No hay empleados registrados"
            />
        </div>
    );
}

// ── Tab Caja ──────────────────────────────────────────────────────────────────
function TabCaja({ caja, historial, fmt }) {
    return (
        <div>
            <h3 style={secTitle}>Caja actual</h3>
            {caja ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
                    <StatCard label="Saldo inicial"   valor={fmt(caja.saldo_inicial)}   color="#6b7280" icon="🏦" />
                    <StatCard label="Ingresos"        valor={fmt(caja.total_ingresos)}  color="#10b981" icon="⬆️" />
                    <StatCard label="Egresos"         valor={fmt(caja.total_egresos)}   color="#ef4444" icon="⬇️" />
                    <StatCard label="Saldo actual"    valor={fmt(caja.saldo_final)}     color="#1a5c2a" icon="💰" />
                </div>
            ) : (
                <div style={emptyStyle}>No hay caja abierta hoy</div>
            )}

            <h3 style={secTitle}>Historial de cajas</h3>
            <DataTable
                cols={['Fecha', 'Saldo inicial', 'Ingresos', 'Egresos', 'Saldo final', 'Estado']}
                rows={historial.map(c => [
                    c.fecha,
                    fmt(c.saldo_inicial),
                    fmt(c.total_ingresos),
                    fmt(c.total_egresos),
                    fmt(c.saldo_final),
                    <Badge text={c.estado} color={c.estado === 'cerrada' ? '#6b7280' : '#10b981'} />
                ])}
                empty="Sin historial de cajas"
            />
        </div>
    );
}

// ── Tab Remisiones ────────────────────────────────────────────────────────────
function TabRemisiones({ items, fmtN }) {
    return (
        <div>
            <h3 style={secTitle}>Remisiones ({items.length})</h3>
            <DataTable
                cols={['#', 'Fecha', 'Conductor', 'Cliente', 'Vehículo', 'Total kg']}
                rows={items.map(r => [
                    r.numero,
                    r.fecha,
                    r.conductor,
                    r.cliente?.nombre || '—',
                    r.vehiculo || '—',
                    `${fmtN(r.total_kilos)} kg`
                ])}
                empty="No hay remisiones registradas"
            />
        </div>
    );
}

// ── Tab Empaques ──────────────────────────────────────────────────────────────
function TabEmpaques({ items }) {
    return (
        <div>
            <h3 style={secTitle}>Empaques ({items.length})</h3>
            <DataTable
                cols={['Fecha', 'Actor', 'Tipo', 'Entregados', 'Devueltos', 'Saldo']}
                rows={items.map(e => [
                    e.fecha,
                    e.tipo_actor === 'reciclador' ? (e.reciclador?.nombre || '—') : (e.conductor || '—'),
                    e.tipo_actor,
                    e.cantidad_entregada,
                    e.cantidad_devuelta,
                    <span style={{ fontWeight: 700, color: e.saldo > 0 ? '#ef4444' : '#10b981' }}>{e.saldo}</span>
                ])}
                empty="No hay registros de empaques"
            />
        </div>
    );
}

// ── Tab Usuarios ──────────────────────────────────────────────────────────────
function TabUsuarios({ items, bodegaId, onRefresh }) {
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'operador' });
    const [editId, setEditId] = useState(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const abrir = (u = null) => {
        setForm(u ? { nombre: u.nombre, email: u.email, password: '', rol: u.rol } : { nombre: '', email: '', password: '', rol: 'operador' });
        setEditId(u?.id || null);
        setError('');
        setModal(true);
    };

    const guardar = async () => {
        if (!form.nombre.trim() || !form.email.trim()) return setError('Nombre y email requeridos');
        if (!editId && !form.password.trim()) return setError('Contraseña requerida');
        setSaving(true);
        setError('');
        try {
            const payload = { ...form, bodega_id: bodegaId };
            if (!payload.password) delete payload.password;
            if (editId) await api.put(`/usuarios/${editId}`, payload);
            else await api.post('/usuarios', payload);
            setModal(false);
            onRefresh();
        } catch (e) { setError(e.msg || e.message || 'Error'); }
        finally { setSaving(false); }
    };

    const toggleActivo = async (u) => {
        if (!window.confirm(`¿${u.activo ? 'Desactivar' : 'Activar'} a ${u.nombre}?`)) return;
        try { await api.put(`/usuarios/${u.id}`, { activo: !u.activo }); onRefresh(); }
        catch (e) { alert(e.msg || 'Error'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ ...secTitle, margin: 0 }}>Usuarios ({items.length})</h3>
                <button onClick={() => abrir()} style={btnP}>+ Nuevo usuario</button>
            </div>

            <DataTable
                cols={['Nombre', 'Email', 'Rol', 'Estado', 'Acciones']}
                rows={items.map(u => [
                    <span style={{ fontWeight: 600 }}>{u.nombre}</span>,
                    u.email,
                    <Badge text={ROLE_LABELS[u.rol] || u.rol} color={ROLE_COLORS[u.rol] || '#6b7280'} />,
                    <Badge text={u.activo ? 'Activo' : 'Inactivo'} color={u.activo ? '#10b981' : '#ef4444'} />,
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => abrir(u)} style={btnSm('#3b82f6')}>Editar</button>
                        <button onClick={() => toggleActivo(u)} style={btnSm(u.activo ? '#ef4444' : '#10b981')}>
                            {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                    </div>
                ])}
                empty="No hay usuarios para esta bodega"
            />

            {modal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', borderRadius: 10, padding: 28, width: 400, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
                        <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>
                            {editId ? 'Editar usuario' : 'Nuevo usuario'}
                        </h3>
                        <label style={lbl}>Nombre</label>
                        <input style={inp} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre completo" />
                        <label style={lbl}>Email</label>
                        <input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@empresa.com" />
                        <label style={lbl}>{editId ? 'Nueva contraseña (vacío = sin cambio)' : 'Contraseña'}</label>
                        <input style={inp} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
                        <label style={lbl}>Rol</label>
                        <select style={inp} value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
                            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                        {error && <p style={{ color: '#ef4444', fontSize: 13, margin: '8px 0' }}>{error}</p>}
                        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                            <button onClick={guardar} disabled={saving} style={btnP}>
                                {saving ? 'Guardando...' : (editId ? 'Guardar' : 'Crear usuario')}
                            </button>
                            <button onClick={() => setModal(false)} style={btnSec}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Componentes reutilizables ─────────────────────────────────────────────────
function StatCard({ label, valor, sub, color, icon }) {
    return (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 18px', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{valor}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{label}</div>
            {sub && <div style={{ fontSize: 11, color: '#b0b7c3', marginTop: 2 }}>{sub}</div>}
        </div>
    );
}

function DataTable({ cols, rows, empty }) {
    if (rows.length === 0) return <div style={emptyStyle}>{empty}</div>;
    return (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        {cols.map((c, i) => <th key={i} style={th}>{c}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            {row.map((cell, j) => <td key={j} style={td}>{cell}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Badge({ text, color }) {
    return (
        <span style={{ background: color, color: '#fff', fontSize: 11, padding: '2px 10px', borderRadius: 12, fontWeight: 600, display: 'inline-block' }}>
            {text}
        </span>
    );
}

const secTitle = { fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 14, marginTop: 0 };
const emptyStyle = { textAlign: 'center', padding: 40, color: '#9ca3af', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' };
const th = { textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .5 };
const td = { padding: '11px 14px', verticalAlign: 'middle' };
const lbl = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4, marginTop: 12 };
const inp = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };
const btnP   = { background: '#1a5c2a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600 };
const btnSec = { background: '#f3f4f6', color: '#374151', border: 'none', padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600 };
const btnSm  = (bg) => ({ background: bg, color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontWeight: 600 });
