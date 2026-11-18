import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { api } from '../api';
import { EncabezadoPagina, Boton, Buscador, Tarjeta, ContenedorTabla, estiloTabla, estiloTh, estiloTd, estiloInput, Campo, Modal, Chip, Aviso, Vacio, iniciales } from '../components/ui';

const ROLES = ['superadmin', 'admin', 'cajero', 'vendedor', 'operador'];
// Tono del chip de cada rol (ver Chip en components/ui.jsx)
const ROLE_TONOS = { superadmin: 'ambar', admin: 'azul', cajero: 'verde', vendedor: 'noche', operador: 'gris' };

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
        <div className="pagina">
            <EncabezadoPagina titulo="Usuarios" sub="Perfiles y accesos al sistema" icono="usuarios"
                acciones={<Boton onClick={abrirNuevo}>+ Nuevo usuario</Boton>} />

            <Tarjeta sinPadding>
                <div style={{ padding: 14, borderBottom: '1.5px solid var(--borde)' }}>
                    <Buscador value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre o email..." style={{ maxWidth: 420 }} />
                </div>

                {filtrados.length === 0 && <Vacio icono="usuarios" texto="Sin usuarios" />}

                {/* Computador: tabla */}
                {filtrados.length > 0 && (
                    <div className="solo-pc">
                        <ContenedorTabla>
                            <table style={estiloTabla}>
                                <thead>
                                    <tr>
                                        <th style={estiloTh}>Nombre</th>
                                        <th style={estiloTh}>Email</th>
                                        <th style={estiloTh}>Rol</th>
                                        {user?.rol === 'superadmin' && <th style={estiloTh}>Bodega</th>}
                                        <th style={estiloTh}>Estado</th>
                                        <th style={{ ...estiloTh, textAlign: 'right' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtrados.map(u => (
                                        <tr key={u.id} style={{ opacity: u.activo ? 1 : 0.55 }}>
                                            <td style={estiloTd}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <Avatar nombre={u.nombre} />
                                                    <div>
                                                        <div style={{ fontWeight: 700 }}>{u.nombre}</div>
                                                        {u.telegram_chat_id && <div style={{ fontSize: 12, color: 'var(--azul)', marginTop: 1 }}>Telegram vinculado</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ ...estiloTd, color: 'var(--texto-2)' }}>{u.email}</td>
                                            <td style={estiloTd}><Chip tono={ROLE_TONOS[u.rol] || 'gris'}>{ROLE_LABELS[u.rol] || u.rol}</Chip></td>
                                            {user?.rol === 'superadmin' && <td style={estiloTd}>{bodegaNombre(u.bodega_id)}</td>}
                                            <td style={estiloTd}><Chip tono={u.activo ? 'verde' : 'rojo'}>{u.activo ? '● Activo' : '● Inactivo'}</Chip></td>
                                            <td style={{ ...estiloTd, textAlign: 'right' }}>
                                                <div style={{ display: 'inline-flex', gap: 6 }}>
                                                    <Boton tam="sm" variante="secundario" onClick={() => abrirEditar(u)}>Editar</Boton>
                                                    <Boton tam="sm" variante={u.activo ? 'peligro' : 'primario'} onClick={() => toggleActivo(u)}>{u.activo ? 'Desactivar' : 'Activar'}</Boton>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </ContenedorTabla>
                    </div>
                )}

                {/* Celular: tarjetas */}
                <div className="solo-movil">
                    {filtrados.map(u => (
                        <div key={u.id} style={{ padding: '12px 14px', borderBottom: '1px solid #eef1f4', opacity: u.activo ? 1 : 0.55 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Avatar nombre={u.nombre} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 15 }}>{u.nombre}</div>
                                    <div style={{ fontSize: 13, color: 'var(--texto-2)', overflowWrap: 'anywhere' }}>{u.email}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0' }}>
                                <Chip tono={ROLE_TONOS[u.rol] || 'gris'}>{ROLE_LABELS[u.rol] || u.rol}</Chip>
                                <Chip tono={u.activo ? 'verde' : 'rojo'}>{u.activo ? '● Activo' : '● Inactivo'}</Chip>
                                {user?.rol === 'superadmin' && <Chip tono="gris">{bodegaNombre(u.bodega_id)}</Chip>}
                                {u.telegram_chat_id && <Chip tono="azul">Telegram</Chip>}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <Boton variante="secundario" onClick={() => abrirEditar(u)}>Editar</Boton>
                                <Boton variante={u.activo ? 'peligro' : 'primario'} onClick={() => toggleActivo(u)}>{u.activo ? 'Desactivar' : 'Activar'}</Boton>
                            </div>
                        </div>
                    ))}
                </div>
            </Tarjeta>

            <Modal abierto={modal} titulo={editId ? 'Editar usuario' : 'Nuevo usuario'} onCerrar={() => setModal(false)}
                pie={<>
                    <Boton variante="secundario" onClick={() => setModal(false)}>Cancelar</Boton>
                    <Boton onClick={guardar} disabled={loading}>{loading ? 'Guardando...' : (editId ? 'Guardar cambios' : 'Crear usuario')}</Boton>
                </>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Campo etiqueta="Nombre completo">
                        <input style={estiloInput} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Juan Pérez" />
                    </Campo>
                    <Campo etiqueta="Email">
                        <input style={estiloInput} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@empresa.com" />
                    </Campo>
                    <Campo etiqueta={editId ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}>
                        <input style={estiloInput} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
                    </Campo>
                    <Campo etiqueta="Rol">
                        <select style={estiloInput} value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
                            {rolesDisponibles.map(r => (
                                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                        </select>
                    </Campo>
                    {user?.rol === 'superadmin' && (
                        <Campo etiqueta="Bodega / Sede * (obligatorio)"
                            ayuda="Esta persona quedará fija a esta bodega: todo lo que registre (compras, ventas, caja) se guarda aquí y no podrá cambiarla.">
                            <select style={estiloInput} value={form.bodega_id} onChange={e => setForm(f => ({ ...f, bodega_id: e.target.value }))}>
                                <option value="">-- Seleccionar bodega --</option>
                                {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                            </select>
                        </Campo>
                    )}
                    <Campo etiqueta="Chat ID de Telegram (opcional, para usar el bot)"
                        ayuda="El usuario debe abrir el bot en Telegram y enviar /start para ver su Chat ID.">
                        <input style={estiloInput} value={form.telegram_chat_id}
                            onChange={e => setForm(f => ({ ...f, telegram_chat_id: e.target.value }))}
                            placeholder="Ej: 123456789" />
                    </Campo>
                    {error && <Aviso tipo="error">{error}</Aviso>}
                </div>
            </Modal>
        </div>
    );
}

function Avatar({ nombre }) {
    return (
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--noche)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fuente-tit)', fontWeight: 700, fontSize: 13.5, flexShrink: 0 }}>
            {iniciales(nombre)}
        </div>
    );
}
