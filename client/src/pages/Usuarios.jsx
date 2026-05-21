import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { api } from '../api';

const ROLES = ['superadmin', 'admin', 'cajero', 'vendedor', 'operador'];
const ROLE_COLORS = {
    superadmin: '#f59e0b', admin: '#3b82f6', cajero: '#10b981',
    vendedor: '#8b5cf6', operador: '#6b7280'
};

const ROLE_LABELS = {
    superadmin: 'Super Admin', admin: 'Admin', cajero: 'Cajero',
    vendedor: 'Vendedor', operador: 'Operador'
};

const EMPTY = { nombre: '', email: '', password: '', rol: 'operador', bodega_id: '', telegram_chat_id: '' };

export default function Usuarios() {
    const { user } = useAuth();
    const [usuarios, setUsuarios] = useState([]);
    const [bodegas, setBodegas] = useState([]);
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState(EMPTY);
    const [editId, setEditId] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [busqueda, setBusqueda] = useState('');

    const cargar = () => {
        api.get('/usuarios').then(d => setUsuarios(d.usuarios || [])).catch(() => {});
    };

    useEffect(() => {
        cargar();
        api.get('/bodegas').then(d => setBodegas(d.bodegas || [])).catch(() => {});
    }, []);

    const abrirNuevo = () => {
        setForm({ ...EMPTY, bodega_id: user?.rol === 'admin' ? (user.bodega_id || '') : '' });
        setEditId(null);
        setError('');
        setModal(true);
    };

    const abrirEditar = (u) => {
        setForm({ nombre: u.nombre, email: u.email, password: '', rol: u.rol, bodega_id: u.bodega_id || '', telegram_chat_id: u.telegram_chat_id || '' });
        setEditId(u.id);
        setError('');
        setModal(true);
    };

    const guardar = async () => {
        if (!form.nombre.trim() || !form.email.trim()) return setError('Nombre y email son requeridos');
        if (!editId && !form.password.trim()) return setError('La contraseña es requerida para usuarios nuevos');
        if (user?.rol === 'superadmin' && !form.bodega_id) return setError('Selecciona una bodega');

        setLoading(true);
        setError('');
        try {
            const payload = { ...form };
            if (!payload.password) delete payload.password;
            if (!payload.bodega_id) delete payload.bodega_id;

            if (editId) {
                await api.put(`/usuarios/${editId}`, payload);
            } else {
                await api.post('/usuarios', payload);
            }
            setModal(false);
            cargar();
        } catch (e) {
            setError(e.msg || e.message || 'Error al guardar');
        } finally {
            setLoading(false);
        }
    };

    const toggleActivo = async (u) => {
        if (!window.confirm(`¿${u.activo ? 'Desactivar' : 'Activar'} a ${u.nombre}?`)) return;
        try {
            await api.put(`/usuarios/${u.id}`, { activo: !u.activo });
            cargar();
        } catch (e) {
            alert(e.msg || 'Error');
        }
    };

    const rolesDisponibles = user?.rol === 'superadmin' ? ROLES : ROLES.filter(r => r !== 'superadmin');
    const bodegaNombre = (id) => bodegas.find(b => b.id === id)?.nombre || '—';

    const filtrados = usuarios.filter(u =>
        u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.email.toLowerCase().includes(busqueda.toLowerCase())
    );

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>👥 Usuarios</h2>
                    <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
                        Gestión de perfiles y accesos al sistema
                    </p>
                </div>
                <button onClick={abrirNuevo} style={btnStyle('#1a5c2a')}>
                    + Nuevo usuario
                </button>
            </div>

            <input
                placeholder="Buscar por nombre o email..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{ width: '100%', maxWidth: 380, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }}
            />

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <th style={th}>Nombre</th>
                            <th style={th}>Email</th>
                            <th style={th}>Rol</th>
                            {user?.rol === 'superadmin' && <th style={th}>Bodega</th>}
                            <th style={th}>Estado</th>
                            <th style={th}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtrados.length === 0 && (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>Sin usuarios</td></tr>
                        )}
                        {filtrados.map(u => (
                            <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: u.activo ? 1 : 0.5 }}>
                                <td style={td}>
                                    <div style={{ fontWeight: 600 }}>{u.nombre}</div>
                                    {u.telegram_chat_id && (
                                        <div style={{ fontSize: 11, color: '#229ed9', marginTop: 2 }}>
                                            ✈️ Telegram vinculado
                                        </div>
                                    )}
                                </td>
                                <td style={td}>{u.email}</td>
                                <td style={td}>
                                    <span style={{ background: ROLE_COLORS[u.rol] || '#6b7280', color: '#fff', fontSize: 11, padding: '2px 10px', borderRadius: 12, fontWeight: 600 }}>
                                        {ROLE_LABELS[u.rol] || u.rol}
                                    </span>
                                </td>
                                {user?.rol === 'superadmin' && (
                                    <td style={td}>{bodegaNombre(u.bodega_id)}</td>
                                )}
                                <td style={td}>
                                    <span style={{ color: u.activo ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: 12 }}>
                                        {u.activo ? '● Activo' : '● Inactivo'}
                                    </span>
                                </td>
                                <td style={td}>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button onClick={() => abrirEditar(u)} style={btnSm('#3b82f6')}>Editar</button>
                                        <button onClick={() => toggleActivo(u)} style={btnSm(u.activo ? '#ef4444' : '#10b981')}>
                                            {u.activo ? 'Desactivar' : 'Activar'}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {modal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', borderRadius: 10, padding: 28, width: 420, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
                        <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>
                            {editId ? 'Editar usuario' : 'Nuevo usuario'}
                        </h3>

                        <label style={lbl}>Nombre completo</label>
                        <input style={inp} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Juan Pérez" />

                        <label style={lbl}>Email</label>
                        <input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@empresa.com" />

                        <label style={lbl}>{editId ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}</label>
                        <input style={inp} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />

                        <label style={lbl}>Rol</label>
                        <select style={inp} value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
                            {rolesDisponibles.map(r => (
                                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                        </select>

                        {user?.rol === 'superadmin' && (
                            <>
                                <label style={lbl}>Bodega</label>
                                <select style={inp} value={form.bodega_id} onChange={e => setForm(f => ({ ...f, bodega_id: e.target.value }))}>
                                    <option value="">-- Seleccionar bodega --</option>
                                    {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                                </select>
                            </>
                        )}

                        <label style={lbl}>
                            Chat ID de Telegram <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opcional — para usar el bot)</span>
                        </label>
                        <input style={inp} value={form.telegram_chat_id}
                            onChange={e => setForm(f => ({ ...f, telegram_chat_id: e.target.value }))}
                            placeholder="Ej: 123456789 — se obtiene enviando /start al bot" />
                        <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>
                            El usuario debe abrir el bot en Telegram y enviar /start para ver su Chat ID.
                        </p>

                        {error && <p style={{ color: '#ef4444', fontSize: 13, margin: '8px 0' }}>{error}</p>}

                        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                            <button onClick={guardar} disabled={loading} style={btnStyle('#1a5c2a', '1')}>
                                {loading ? 'Guardando...' : (editId ? 'Guardar cambios' : 'Crear usuario')}
                            </button>
                            <button onClick={() => setModal(false)} style={btnStyle('#6b7280', '1')}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const th = { textAlign: 'left', padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .5 };
const td = { padding: '12px 14px', verticalAlign: 'middle' };
const lbl = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4, marginTop: 12 };
const inp = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box', outline: 'none' };
const btnStyle = (bg, flex) => ({ background: bg, color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 600, flex: flex || undefined });
const btnSm = (bg) => ({ background: bg, color: '#fff', border: 'none', padding: '5px 10px', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontWeight: 600 });
