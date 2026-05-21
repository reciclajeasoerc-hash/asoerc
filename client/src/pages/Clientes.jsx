import React, { useState, useEffect } from 'react';
import { api } from '../api';

const fmt = n => Number(n || 0).toLocaleString('es-CO');

export default function Clientes() {
    const [clientes, setClientes] = useState([]);
    const [materiales, setMateriales] = useState([]);
    const [selected, setSelected] = useState(null);
    const [sedes, setSedes] = useState([]);
    const [precios, setPrecios] = useState([]);
    const [tabDetalle, setTabDetalle] = useState('sedes');
    const [showForm, setShowForm] = useState(false);
    const [showSedeForm, setShowSedeForm] = useState(false);
    const [form, setForm] = useState({ nombre: '', nit: '', telefono: '', email: '', contacto: '', tipo_precio: 'fijo' });
    const [sedeForm, setSedeForm] = useState({ nombre: '', direccion: '' });
    const [precioForm, setPrecioForm] = useState({ material_id: '', precio: '' });
    const [buscar, setBuscar] = useState('');
    const [msg, setMsg] = useState('');

    useEffect(() => {
        api.get('/materiales').then(d => setMateriales(d.materiales || []));
        cargar();
    }, []);

    const cargar = () => api.get('/clientes').then(d => setClientes(d.clientes || [])).catch(() => {});

    const seleccionar = async (c) => {
        setSelected(c);
        setTabDetalle('sedes');
        setSedes(c.sedes || []);
        const p = await api.get(`/clientes/${c.id}/precios`).catch(() => ({ precios: [] }));
        setPrecios(p.precios || []);
    };

    const guardar = async () => {
        if (!form.nombre.trim()) { setMsg('El nombre es requerido'); return; }
        try {
            await api.post('/clientes', form);
            setForm({ nombre: '', nit: '', telefono: '', email: '', contacto: '', tipo_precio: 'fijo' });
            setShowForm(false); setMsg(''); cargar();
        } catch (err) { setMsg(err.message); }
    };

    const guardarSede = async () => {
        if (!sedeForm.nombre.trim()) return;
        try {
            const d = await api.post(`/clientes/${selected.id}/sedes`, sedeForm);
            setSedes(prev => [...prev, d.sede]);
            setSedeForm({ nombre: '', direccion: '' });
            setShowSedeForm(false);
        } catch (err) { setMsg(err.message); }
    };

    const guardarPrecio = async () => {
        if (!precioForm.material_id || precioForm.precio === '') return;
        try {
            const d = await api.post(`/clientes/${selected.id}/precios`, precioForm);
            setPrecios(d.precios);
            setPrecioForm({ material_id: '', precio: '' });
        } catch (err) { setMsg(err.message); }
    };

    const eliminarPrecio = async (material_id) => {
        await api.delete(`/clientes/${selected.id}/precios/${material_id}`);
        setPrecios(prev => prev.filter(p => p.material_id !== material_id));
    };

    const clientesFiltrados = clientes.filter(c =>
        !buscar || c.nombre.toLowerCase().includes(buscar.toLowerCase()) ||
        (c.nit || '').includes(buscar) || (c.telefono || '').includes(buscar)
    );

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700 }}>🏢 Clientes</h1>
                    <p style={{ color: '#666', fontSize: 13 }}>Gestión de clientes, sedes y precios especiales</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    style={{ padding: '9px 18px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                    + Nuevo cliente
                </button>
            </div>

            {showForm && (
                <div style={{ background: '#fff', borderRadius: 10, padding: 20, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                    <h3 style={{ marginBottom: 14, fontSize: 15 }}>Nuevo Cliente</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                        {[['nombre','Nombre*'],['nit','NIT'],['telefono','Teléfono'],['email','Email'],['contacto','Contacto']].map(([k,l]) => (
                            <label key={k}>
                                <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>{l}</div>
                                <input value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                            </label>
                        ))}
                        <label>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Tipo precio</div>
                            <select value={form.tipo_precio} onChange={e => setForm({ ...form, tipo_precio: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                <option value="fijo">Fijo</option>
                                <option value="semanal">Semanal</option>
                            </select>
                        </label>
                    </div>
                    {msg && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{msg}</div>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                        <button onClick={guardar}
                            style={{ padding: '8px 20px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13 }}>
                            Guardar
                        </button>
                        <button onClick={() => { setShowForm(false); setMsg(''); }}
                            style={{ padding: '8px 20px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 13 }}>
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Buscador */}
            <div style={{ marginBottom: 12 }}>
                <input placeholder="Buscar por nombre, NIT o teléfono..." value={buscar} onChange={e => setBuscar(e.target.value)}
                    style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, width: 300 }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 20 }}>
                {/* Lista de clientes */}
                <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#f0faf0' }}>
                                {['Nombre','NIT','Teléfono','Sedes',''].map(h => (
                                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {clientesFiltrados.map(c => (
                                <tr key={c.id} onClick={() => seleccionar(c)}
                                    style={{ borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: selected?.id === c.id ? '#f0faf0' : 'transparent' }}>
                                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{c.nombre}</td>
                                    <td style={{ padding: '10px 12px', color: '#666' }}>{c.nit || '—'}</td>
                                    <td style={{ padding: '10px 12px', color: '#666' }}>{c.telefono || '—'}</td>
                                    <td style={{ padding: '10px 12px', color: '#888', fontSize: 12 }}>
                                        {(c.sedes || []).length} sede{(c.sedes || []).length !== 1 ? 's' : ''}
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <button onClick={e => { e.stopPropagation(); seleccionar(c); }}
                                            style={{ padding: '4px 10px', background: '#e0f2e9', color: '#1a5c2a', border: 'none', borderRadius: 4, fontSize: 11 }}>
                                            Ver
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {clientesFiltrados.length === 0 && (
                        <p style={{ color: '#999', textAlign: 'center', padding: 20, fontSize: 13 }}>
                            {buscar ? 'Sin resultados' : 'No hay clientes registrados'}
                        </p>
                    )}
                </div>

                {/* Panel de detalle */}
                {selected && (
                    <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                            <div>
                                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{selected.nombre}</h3>
                                <div style={{ fontSize: 13, color: '#666' }}>
                                    {selected.nit && <span>NIT: {selected.nit} · </span>}
                                    {selected.telefono && <span>📞 {selected.telefono}</span>}
                                </div>
                                {selected.email && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{selected.email}</div>}
                            </div>
                            <button onClick={() => setSelected(null)}
                                style={{ padding: '6px 10px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 12 }}>
                                ✕
                            </button>
                        </div>

                        {/* Tabs */}
                        <div style={{ display: 'flex', borderBottom: '2px solid #f0f0f0', marginBottom: 14, gap: 4 }}>
                            {[['sedes','📍 Sedes'],['precios','🏷️ Precios especiales']].map(([k,l]) => (
                                <button key={k} onClick={() => setTabDetalle(k)}
                                    style={{ padding: '7px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12,
                                        fontWeight: tabDetalle === k ? 700 : 400,
                                        color: tabDetalle === k ? '#1a5c2a' : '#888',
                                        borderBottom: tabDetalle === k ? '2px solid #1a5c2a' : '2px solid transparent',
                                        marginBottom: -2 }}>
                                    {l}
                                </button>
                            ))}
                        </div>

                        {/* Tab: Sedes */}
                        {tabDetalle === 'sedes' && (
                            <>
                                <button onClick={() => setShowSedeForm(!showSedeForm)}
                                    style={{ padding: '6px 12px', background: '#e0f2e9', color: '#1a5c2a', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                                    + Nueva sede
                                </button>
                                {showSedeForm && (
                                    <div style={{ background: '#f0faf0', border: '1px solid #a7d7a7', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                                            <input placeholder="Nombre sede*" value={sedeForm.nombre} onChange={e => setSedeForm({ ...sedeForm, nombre: e.target.value })}
                                                style={{ padding: '8px', borderRadius: 6, border: '1px solid #a7d7a7', fontSize: 13 }} />
                                            <input placeholder="Dirección" value={sedeForm.direccion} onChange={e => setSedeForm({ ...sedeForm, direccion: e.target.value })}
                                                style={{ padding: '8px', borderRadius: 6, border: '1px solid #a7d7a7', fontSize: 13 }} />
                                        </div>
                                        <button onClick={guardarSede}
                                            style={{ padding: '7px 16px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13 }}>
                                            Agregar sede
                                        </button>
                                    </div>
                                )}
                                {sedes.length === 0 ? (
                                    <p style={{ color: '#999', fontSize: 13 }}>Sin sedes registradas</p>
                                ) : (
                                    sedes.map(s => (
                                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                                            <div>
                                                <span style={{ fontWeight: 600 }}>{s.nombre}</span>
                                                {s.direccion && <span style={{ color: '#888', marginLeft: 8 }}>{s.direccion}</span>}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </>
                        )}

                        {/* Tab: Precios especiales */}
                        {tabDetalle === 'precios' && (
                            <>
                                <div style={{ background: '#f0faf0', borderRadius: 8, padding: 12, marginBottom: 14 }}>
                                    <div style={{ fontSize: 12, color: '#555', marginBottom: 8, fontWeight: 600 }}>Asignar precio especial de venta</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: 8, alignItems: 'center' }}>
                                        <select value={precioForm.material_id} onChange={e => setPrecioForm({ ...precioForm, material_id: e.target.value })}
                                            style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #a7d7a7', fontSize: 13 }}>
                                            <option value="">-- Material --</option>
                                            {materiales.filter(m => m.activo !== false).map(m => (
                                                <option key={m.id} value={m.id}>{m.nombre}</option>
                                            ))}
                                        </select>
                                        <input type="number" placeholder="$/kg" value={precioForm.precio}
                                            onChange={e => setPrecioForm({ ...precioForm, precio: e.target.value })}
                                            style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #a7d7a7', fontSize: 13 }} />
                                        <button onClick={guardarPrecio}
                                            style={{ padding: '7px 14px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                            Guardar
                                        </button>
                                    </div>
                                </div>
                                {precios.length === 0 ? (
                                    <p style={{ color: '#999', fontSize: 13 }}>Sin precios especiales. Se usa el precio general de cada material.</p>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ background: '#f0faf0' }}>
                                                <th style={{ padding: '8px 10px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>Material</th>
                                                <th style={{ padding: '8px 10px', textAlign: 'right', color: '#1a5c2a', fontWeight: 600 }}>Precio especial</th>
                                                <th style={{ padding: '8px 10px', textAlign: 'right', color: '#1a5c2a', fontWeight: 600 }}>Precio general</th>
                                                <th style={{ width: 40 }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {precios.map(p => (
                                                <tr key={p.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{p.material?.nombre}</td>
                                                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#1a5c2a', fontWeight: 700 }}>${fmt(p.precio)}/kg</td>
                                                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#888' }}>${fmt(p.material?.precio_compra)}/kg</td>
                                                    <td style={{ padding: '8px 10px' }}>
                                                        <button onClick={() => eliminarPrecio(p.material_id)}
                                                            style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 15 }}>✕</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
