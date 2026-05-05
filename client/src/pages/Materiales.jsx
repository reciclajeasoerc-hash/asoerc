import React, { useState, useEffect } from 'react';
import { api } from '../api';

const fmt = n => Number(n || 0).toLocaleString('es-CO');

export default function Materiales() {
    const [materiales, setMateriales] = useState([]);
    const [form, setForm] = useState({ codigo: '', nombre: '', precio_compra: '', unidad: 'kg' });
    const [editando, setEditando] = useState(null);
    const [msg, setMsg] = useState('');

    useEffect(() => { cargar(); }, []);
    const cargar = () => api.get('/materiales').then(d => setMateriales(d.materiales)).catch(() => {});

    const guardar = async () => {
        if (!form.codigo || !form.nombre) return setMsg('Código y nombre requeridos');
        try {
            if (editando) {
                await api.put(`/materiales/${editando}`, form);
                setEditando(null);
            } else {
                await api.post('/materiales', form);
            }
            setForm({ codigo: '', nombre: '', precio_compra: '', unidad: 'kg' });
            setMsg(''); cargar();
        } catch (err) { setMsg(err.message); }
    };

    const editar = (m) => {
        setEditando(m.id);
        setForm({ codigo: m.codigo, nombre: m.nombre, precio_compra: m.precio_compra, unidad: m.unidad });
    };

    const eliminar = async (id) => {
        if (!window.confirm('¿Desactivar este material?')) return;
        await api.delete(`/materiales/${id}`);
        cargar();
    };

    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>📋 Materiales</h1>
            <p style={{ color: '#666', fontSize: 13, marginBottom: 20 }}>Precios de compra por material (precios fijos)</p>

            <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>
                <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)', height: 'fit-content' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>{editando ? 'Editar Material' : 'Nuevo Material'}</h3>
                    {[['codigo','Código*'],['nombre','Nombre*']].map(([k,l]) => (
                        <label key={k} style={{ display: 'block', marginBottom: 10 }}>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>{l}</div>
                            <input value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                        </label>
                    ))}
                    <label style={{ display: 'block', marginBottom: 10 }}>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Precio compra ($/kg)</div>
                        <input type="number" value={form.precio_compra} onChange={e => setForm({ ...form, precio_compra: e.target.value })} min="0"
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                    </label>
                    {msg && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{msg}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={guardar} style={{ flex: 1, padding: '9px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                            {editando ? 'Actualizar' : 'Guardar'}
                        </button>
                        {editando && <button onClick={() => { setEditando(null); setForm({ codigo: '', nombre: '', precio_compra: '', unidad: 'kg' }); }} style={{ padding: '9px 14px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 13 }}>✕</button>}
                    </div>
                </div>

                <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#f0faf0' }}>
                                {['Código','Nombre','Precio compra','Unidad',''].map(h => (
                                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {materiales.map(m => (
                                <tr key={m.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                    <td style={{ padding: '10px 14px', color: '#666' }}>{m.codigo}</td>
                                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{m.nombre}</td>
                                    <td style={{ padding: '10px 14px', color: '#1a5c2a', fontWeight: 700 }}>${fmt(m.precio_compra)}</td>
                                    <td style={{ padding: '10px 14px', color: '#888' }}>{m.unidad}</td>
                                    <td style={{ padding: '10px 14px' }}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button onClick={() => editar(m)} style={{ padding: '4px 10px', background: '#e0f2e9', color: '#1a5c2a', border: 'none', borderRadius: 4, fontSize: 11 }}>Editar</button>
                                            <button onClick={() => eliminar(m.id)} style={{ padding: '4px 10px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4, fontSize: 11 }}>Quitar</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
