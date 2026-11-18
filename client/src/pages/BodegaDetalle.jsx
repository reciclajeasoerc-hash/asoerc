import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { EncabezadoPagina, Boton, Pestanas, Tarjeta, Kpi, RejillaKpi, Chip, ContenedorTabla, estiloTabla, estiloTh, estiloTd, Campo, estiloInput, Modal, Vacio, Cargando, Aviso } from '../components/ui';

const TABS = [
    { id: 'resumen',      label: 'Resumen',      icono: 'dashboard' },
    { id: 'compras',      label: 'Compras',       icono: 'compras' },
    { id: 'ventas',       label: 'Ventas',        icono: 'ventas' },
    { id: 'recicladores', label: 'Recicladores',  icono: 'recicladores' },
    { id: 'empleados',    label: 'Empleados',     icono: 'empleados' },
    { id: 'caja',         label: 'Caja',          icono: 'caja' },
    { id: 'remisiones',   label: 'Remisiones',    icono: 'remisiones' },
    { id: 'empaques',     label: 'Empaques',      icono: 'empaques' },
    { id: 'usuarios',     label: 'Usuarios',      icono: 'usuarios' },
];

const ROLES = ['admin', 'cajero', 'vendedor', 'operador'];
const ROLE_COLORS = { superadmin: 'ambar', admin: 'azul', cajero: 'verde', vendedor: 'noche', operador: 'gris' };
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

    if (!bodega) return <div className="pagina"><Cargando texto="Cargando bodega..." /></div>;

    const d = data[tab] || {};

    return (
        <div className="pagina">
            {/* Header */}
            <EncabezadoPagina titulo={bodega.nombre} sub={bodega.direccion} icono="bodegas"
                volver={() => navigate('/bodegas')} textoVolver="Bodegas" />

            {/* Tabs */}
            <Pestanas items={TABS} activa={tab} onChange={setTab} />

            {/* Content */}
            <div>
                {loading && <Cargando />}

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
        <Tarjeta titulo={`Resumen del día — ${dash.hoy || '...'}`} icono="dashboard">
            <RejillaKpi>
                <Kpi titulo="Compras hoy" valor={fmt(c.pesos)} pie={`${c.cantidad || 0} compras · ${fmtN(c.kilos)} kg`} icono="compras" tono="verde" />
                <Kpi titulo="Ventas hoy" valor={fmt(v.pesos)} pie={`${v.cantidad || 0} ventas · ${fmtN(v.kilos)} kg`} icono="ventas" tono="marco" />
                <Kpi titulo="Recicladores" valor={d.recicladores?.filter(r => r.activo).length || 0} pie="activos" icono="recicladores" tono="verde" />
                <Kpi titulo="Empleados" valor={d.empleados?.filter(e => e.activo).length || 0} pie="activos" icono="empleados" tono="claro" />
                <Kpi titulo="Usuarios" valor={d.usuarios?.filter(u => u.activo).length || 0} pie="con acceso" icono="usuarios" tono="ambar" />
            </RejillaKpi>
        </Tarjeta>
    );
}

// ── Tab Compras ───────────────────────────────────────────────────────────────
function TabCompras({ items, fmt, fmtN }) {
    return (
        <div>
            <h3 className="tit-seccion" style={secTitle}>Compras ({items.length})</h3>
            <DataTable
                cols={['#', 'Fecha', 'Reciclador', 'Total', 'Neto', 'Estado']}
                rows={items.map(c => [
                    c.numero,
                    c.fecha,
                    c.reciclador?.nombre || '—',
                    fmt(c.total),
                    fmt(c.neto),
                    <Badge text={c.estado} color={c.estado === 'finalizada' ? 'verde' : 'ambar'} />
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
            <h3 className="tit-seccion" style={secTitle}>Ventas ({items.length})</h3>
            <DataTable
                cols={['#', 'Fecha', 'Cliente', 'Total', 'Pago', 'Estado']}
                rows={items.map(v => [
                    v.numero,
                    v.fecha,
                    v.cliente?.nombre || '—',
                    fmt(v.total),
                    v.tipo_pago,
                    <Badge text={v.estado} color={v.estado === 'pagada' ? 'verde' : v.estado === 'facturada' ? 'azul' : 'ambar'} />
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
            <h3 className="tit-seccion" style={secTitle}>Recicladores ({items.length})</h3>
            <DataTable
                cols={['Nombre', 'Cédula', 'Teléfono', 'Saldo préstamo', 'Estado']}
                rows={items.map(r => [
                    r.nombre,
                    r.cedula || '—',
                    r.telefono || '—',
                    fmt(r.saldo_prestamo),
                    <Badge text={r.activo ? 'Activo' : 'Inactivo'} color={r.activo ? 'verde' : 'rojo'} />
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
            <h3 className="tit-seccion" style={secTitle}>Empleados ({items.length})</h3>
            <DataTable
                cols={['Nombre', 'Cédula', 'Cargo', 'Salario', 'Estado']}
                rows={items.map(e => [
                    e.nombre,
                    e.cedula || '—',
                    e.cargo || '—',
                    fmt(e.salario),
                    <Badge text={e.activo ? 'Activo' : 'Inactivo'} color={e.activo ? 'verde' : 'rojo'} />
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
            <h3 className="tit-seccion" style={secTitle}>Caja actual</h3>
            {caja ? (
                <RejillaKpi>
                    <Kpi titulo="Saldo inicial" valor={fmt(caja.saldo_inicial)} icono="caja" tono="claro" />
                    <Kpi titulo="Ingresos" valor={fmt(caja.total_ingresos)} icono="subir" tono="verde" />
                    <Kpi titulo="Egresos" valor={fmt(caja.total_egresos)} icono="bajar" tono="rojo" />
                    <Kpi titulo="Saldo actual" valor={fmt(caja.saldo_final)} icono="caja" tono="noche" />
                </RejillaKpi>
            ) : (
                <Tarjeta><Vacio icono="caja" texto="No hay caja abierta hoy" /></Tarjeta>
            )}

            <h3 className="tit-seccion" style={secTitle}>Historial de cajas</h3>
            <DataTable
                cols={['Fecha', 'Saldo inicial', 'Ingresos', 'Egresos', 'Saldo final', 'Estado']}
                rows={historial.map(c => [
                    c.fecha,
                    fmt(c.saldo_inicial),
                    fmt(c.total_ingresos),
                    fmt(c.total_egresos),
                    fmt(c.saldo_final),
                    <Badge text={c.estado} color={c.estado === 'cerrada' ? 'gris' : 'verde'} />
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
            <h3 className="tit-seccion" style={secTitle}>Remisiones ({items.length})</h3>
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
            <h3 className="tit-seccion" style={secTitle}>Empaques ({items.length})</h3>
            <DataTable
                cols={['Fecha', 'Actor', 'Tipo', 'Entregados', 'Devueltos', 'Saldo']}
                rows={items.map(e => [
                    e.fecha,
                    e.tipo_actor === 'reciclador' ? (e.reciclador?.nombre || '—') : (e.conductor || '—'),
                    e.tipo_actor,
                    e.cantidad_entregada,
                    e.cantidad_devuelta,
                    <span className="cifra" style={{ fontSize: 15, color: e.saldo > 0 ? 'var(--rojo)' : 'var(--verde-osc)' }}>{e.saldo}</span>
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
                <h3 className="tit-seccion" style={{ ...secTitle, margin: 0 }}>Usuarios ({items.length})</h3>
                <Boton onClick={() => abrir()} icono="usuarios">Nuevo usuario</Boton>
            </div>

            <DataTable
                cols={['Nombre', 'Email', 'Rol', 'Estado', 'Acciones']}
                rows={items.map(u => [
                    <span style={{ fontWeight: 600 }}>{u.nombre}</span>,
                    u.email,
                    <Badge text={ROLE_LABELS[u.rol] || u.rol} color={ROLE_COLORS[u.rol] || 'gris'} />,
                    <Badge text={u.activo ? 'Activo' : 'Inactivo'} color={u.activo ? 'verde' : 'rojo'} />,
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Boton tam="sm" variante="secundario" onClick={() => abrir(u)}>Editar</Boton>
                        <Boton tam="sm" variante={u.activo ? 'peligro' : 'primario'} onClick={() => toggleActivo(u)}>
                            {u.activo ? 'Desactivar' : 'Activar'}
                        </Boton>
                    </div>
                ])}
                empty="No hay usuarios para esta bodega"
            />

            <Modal abierto={modal} titulo={editId ? 'Editar usuario' : 'Nuevo usuario'} onCerrar={() => setModal(false)}
                pie={<>
                    <Boton variante="secundario" onClick={() => setModal(false)}>Cancelar</Boton>
                    <Boton onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : (editId ? 'Guardar' : 'Crear usuario')}</Boton>
                </>}>
                <div className="rejilla-form">
                    <Campo etiqueta="Nombre">
                        <input style={estiloInput} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre completo" />
                    </Campo>
                    <Campo etiqueta="Email">
                        <input style={estiloInput} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@empresa.com" />
                    </Campo>
                    <Campo etiqueta={editId ? 'Nueva contraseña (vacío = sin cambio)' : 'Contraseña'}>
                        <input style={estiloInput} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
                    </Campo>
                    <Campo etiqueta="Rol">
                        <select style={estiloInput} value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
                            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                    </Campo>
                    {error && <Aviso tipo="error">{error}</Aviso>}
                </div>
            </Modal>
        </div>
    );
}

// ── Componentes reutilizables ─────────────────────────────────────────────────
function DataTable({ cols, rows, empty }) {
    if (rows.length === 0) return <Tarjeta><Vacio texto={empty} /></Tarjeta>;
    return (
        <Tarjeta sinPadding>
            <div className="solo-pc">
                <ContenedorTabla>
                    <table style={estiloTabla}>
                        <thead>
                            <tr>
                                {cols.map((c, i) => <th key={i} style={estiloTh}>{c}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => (
                                <tr key={i}>
                                    {row.map((cell, j) => <td key={j} style={estiloTd}>{cell}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </ContenedorTabla>
            </div>
            <div className="solo-movil">
                {rows.map((row, i) => (
                    <div key={i} style={{ padding: '13px 14px', borderBottom: '1px solid var(--borde)' }}>
                        {row.map((cell, j) => (
                            <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '4px 0' }}>
                                <span className="etiqueta" style={{ color: 'var(--texto-3)', flexShrink: 0 }}>{cols[j]}</span>
                                <div style={{ minWidth: 0, textAlign: 'right', overflowWrap: 'anywhere' }}>{cell}</div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </Tarjeta>
    );
}

function Badge({ text, color }) {
    return (
        <Chip tono={color}>{text}</Chip>
    );
}

const secTitle = { fontSize: 16, fontWeight: 700, color: 'var(--texto)', marginBottom: 14, marginTop: 0 };
