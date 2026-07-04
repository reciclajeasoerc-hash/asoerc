import React, { useState, useEffect } from 'react';
import { api } from '../api';

const fmt = n => Number(n || 0).toLocaleString('es-CO');

const CATEGORIAS = ['Metales', 'Electrónicos', 'Plásticos', 'Papel y Cartón', 'Vidrio', 'Madera', 'Otros'];
const CAT_ICON = { 'Metales': '🔩', 'Electrónicos': '📱', 'Plásticos': '♻️', 'Papel y Cartón': '📦', 'Vidrio': '🍶', 'Madera': '🪵', 'Otros': '🔧', 'Varios': '🔧' };
const VACIO = { codigo: '', nombre: '', precio_compra: '', unidad: 'kg', categoria: 'Otros', orden: '' };

export default function Materiales() {
    const [materiales, setMateriales] = useState([]);
    const [form, setForm] = useState(VACIO);
    const [editando, setEditando] = useState(null);
    const [busqueda, setBusqueda] = useState('');
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
            setForm(VACIO);
            setMsg(''); cargar();
        } catch (err) { setMsg(err.message); }
    };

    const editar = (m) => {
        setEditando(m.id);
        setForm({ codigo: m.codigo, nombre: m.nombre, precio_compra: m.precio_compra, unidad: m.unidad, categoria: m.categoria || 'Otros', orden: m.orden ?? '' });
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
                    <label style={{ display: 'block', marginBottom: 10 }}>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Familia</div>
                        <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                            {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_ICON[c]} {c}</option>)}
                        </select>
                    </label>
                    <label style={{ display: 'block', marginBottom: 10 }}>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Orden dentro de la familia</div>
                        <input type="number" value={form.orden} onChange={e => setForm({ ...form, orden: e.target.value })} min="0" placeholder="ej: 1, 2, 3…"
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                        <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>Menor número = aparece primero. Déjalo vacío para el final.</div>
                    </label>
                    {msg && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{msg}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={guardar} style={{ flex: 1, padding: '9px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                            {editando ? 'Actualizar' : 'Guardar'}
                        </button>
                        {editando && <button onClick={() => { setEditando(null); setForm(VACIO); }} style={{ padding: '9px 14px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 13 }}>✕</button>}
                    </div>
                </div>

                <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #f0f0f0', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', opacity: .6, fontSize: 13, pointerEvents: 'none' }}>🔍</span>
                        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar material por nombre o código..."
                            style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#f0faf0' }}>
                                {['Familia','#','Código','Nombre','Precio compra',''].map(h => (
                                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {(busqueda.trim() ? materiales.filter(m => `${m.nombre || ''} ${m.codigo || ''}`.toLowerCase().includes(busqueda.trim().toLowerCase())) : materiales).map((m, i, arr) => {
                                const nuevaFamilia = i === 0 || arr[i - 1].categoria !== m.categoria;
                                return (
                                <tr key={m.id} style={{ borderBottom: '1px solid #f5f5f5', borderTop: nuevaFamilia && i > 0 ? '2px solid #e0efe0' : undefined }}>
                                    <td style={{ padding: '10px 14px', color: '#666', fontSize: 12 }}>{nuevaFamilia ? `${CAT_ICON[m.categoria] || '📋'} ${m.categoria || '—'}` : ''}</td>
                                    <td style={{ padding: '10px 14px', color: '#aaa', fontSize: 12 }}>{m.orden === 999 ? '—' : m.orden}</td>
                                    <td style={{ padding: '10px 14px', color: '#666' }}>{m.codigo}</td>
                                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{m.nombre}</td>
                                    <td style={{ padding: '10px 14px', color: '#1a5c2a', fontWeight: 700 }}>${fmt(m.precio_compra)}</td>
                                    <td style={{ padding: '10px 14px' }}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button onClick={() => editar(m)} style={{ padding: '4px 10px', background: '#e0f2e9', color: '#1a5c2a', border: 'none', borderRadius: 4, fontSize: 11 }}>Editar</button>
                                            <button onClick={() => eliminar(m.id)} style={{ padding: '4px 10px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4, fontSize: 11 }}>Quitar</button>
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
