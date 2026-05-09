import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Bodegas() {
    const [bodegas, setBodegas] = useState([]);
    const [stats, setStats] = useState({});
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState({ nombre: '', direccion: '', telefono: '' });
    const [editId, setEditId] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const cargar = async () => {
        const d = await api.get('/bodegas');
        const lista = d.bodegas || [];
        setBodegas(lista);
        // Cargar stats de dashboard por bodega
        const statsMap = {};
        await Promise.all(lista.map(async b => {
            try {
                const r = await api.get(`/informes/dashboard?bodega_id=${b.id}`);
                statsMap[b.id] = r;
            } catch { statsMap[b.id] = null; }
        }));
        setStats(statsMap);
    };

    useEffect(() => { cargar(); }, []);

    const abrirNueva = () => {
        setForm({ nombre: '', direccion: '', telefono: '' });
        setEditId(null);
        setError('');
        setModal(true);
    };

    const abrirEditar = (b, e) => {
        e.stopPropagation();
        setForm({ nombre: b.nombre, direccion: b.direccion || '', telefono: b.telefono || '' });
        setEditId(b.id);
        setError('');
        setModal(true);
    };

    const guardar = async () => {
        if (!form.nombre.trim()) return setError('El nombre es requerido');
        setLoading(true);
        setError('');
        try {
            if (editId) {
                await api.put(`/bodegas/${editId}`, form);
            } else {
                await api.post('/bodegas', form);
            }
            setModal(false);
            cargar();
        } catch (e) {
            setError(e.msg || e.message || 'Error al guardar');
        } finally {
            setLoading(false);
        }
    };

    const fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>🏭 Bodegas</h2>
                    <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
                        Administra y monitorea todas las bodegas del sistema
                    </p>
                </div>
                <button onClick={abrirNueva} style={btnPrimary}>+ Nueva bodega</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
                {bodegas.map(b => {
                    const s = stats[b.id];
                    return (
                        <div
                            key={b.id}
                            onClick={() => navigate(`/bodegas/${b.id}`)}
                            style={card}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                                <div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 2 }}>
                                        🏭 {b.nombre}
                                    </div>
                                    {b.direccion && (
                                        <div style={{ fontSize: 13, color: '#6b7280' }}>📍 {b.direccion}</div>
                                    )}
                                    {b.telefono && (
                                        <div style={{ fontSize: 13, color: '#6b7280' }}>📞 {b.telefono}</div>
                                    )}
                                </div>
                                <button
                                    onClick={e => abrirEditar(b, e)}
                                    style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: '#374151', fontWeight: 600 }}
                                >
                                    Editar
                                </button>
                            </div>

                            {/* Stats del día */}
                            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>
                                    Hoy
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    <StatMini
                                        label="Compras"
                                        valor={s ? fmt(s.compras?.pesos) : '—'}
                                        sub={s ? `${s.compras?.cantidad || 0} transacciones` : 'Cargando...'}
                                        color="#1a5c2a"
                                    />
                                    <StatMini
                                        label="Ventas"
                                        valor={s ? fmt(s.ventas?.pesos) : '—'}
                                        sub={s ? `${s.ventas?.cantidad || 0} transacciones` : 'Cargando...'}
                                        color="#3b82f6"
                                    />
                                </div>
                            </div>

                            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 12, color: '#9ca3af' }}>
                                    {b.activa ? '● Activa' : '● Inactiva'}
                                </span>
                                <span style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600 }}>
                                    Ver detalle →
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {modal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', borderRadius: 10, padding: 28, width: 400, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
                        <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>
                            {editId ? 'Editar bodega' : 'Nueva bodega'}
                        </h3>
                        <label style={lbl}>Nombre</label>
                        <input style={inp} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: El Diamante" />
                        <label style={lbl}>Dirección</label>
                        <input style={inp} value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} placeholder="Dirección de la bodega" />
                        <label style={lbl}>Teléfono</label>
                        <input style={inp} value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} placeholder="Teléfono de contacto" />

                        {error && <p style={{ color: '#ef4444', fontSize: 13, margin: '8px 0' }}>{error}</p>}

                        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                            <button onClick={guardar} disabled={loading} style={btnPrimary}>
                                {loading ? 'Guardando...' : (editId ? 'Guardar cambios' : 'Crear bodega')}
                            </button>
                            <button onClick={() => setModal(false)} style={btnSecondary}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatMini({ label, valor, sub, color }) {
    return (
        <div style={{ background: '#fff', borderRadius: 6, padding: '10px 12px', border: `1px solid #e5e7eb` }}>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color }}>{valor}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>
        </div>
    );
}

const card = {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20,
    cursor: 'pointer', transition: 'box-shadow .15s, transform .15s',
    boxShadow: '0 1px 4px rgba(0,0,0,.06)',
};
const btnPrimary = { background: '#1a5c2a', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 600 };
const btnSecondary = { background: '#f3f4f6', color: '#374151', border: 'none', padding: '9px 18px', borderRadius: 6, fontSize: 14, cursor: 'pointer', fontWeight: 600 };
const lbl = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4, marginTop: 12 };
const inp = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };
