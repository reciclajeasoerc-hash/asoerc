import React, { useState, useEffect } from 'react';
import { api } from '../api';

const fmt = n => Number(n || 0).toLocaleString('es-CO');

export default function Recicladores() {
    const [recicladores, setRecicladores] = useState([]);
    const [bodegas, setBodegas] = useState([]);
    const [materiales, setMateriales] = useState([]);
    const [filtroBodega, setFiltroBodega] = useState('');
    const [selected, setSelected] = useState(null);
    const [prestamos, setPrestamos] = useState([]);
    const [precios, setPrecios] = useState([]);
    const [tabDetalle, setTabDetalle] = useState('prestamos');
    const [showForm, setShowForm] = useState(false);
    const [showPrestamo, setShowPrestamo] = useState(false);
    const [form, setForm] = useState({ nombre: '', cedula: '', telefono: '', whatsapp: '', bodega_id: '' });
    const [pForm, setPForm] = useState({ monto: '', descripcion: '', fecha: new Date().toISOString().slice(0, 10) });
    const [precioForm, setPrecioForm] = useState({ material_id: '', precio: '' });
    const [msg, setMsg] = useState('');

    useEffect(() => {
        api.get('/bodegas').then(d => setBodegas(d.bodegas));
        api.get('/materiales').then(d => setMateriales(d.materiales || []));
        cargar();
    }, []);

    const cargar = () => api.get('/recicladores').then(d => setRecicladores(d.recicladores)).catch(() => {});

    const seleccionar = async (r) => {
        setSelected(r);
        setTabDetalle('prestamos');
        const d = await api.get(`/recicladores/${r.id}/prestamos`).catch(() => ({ prestamos: [] }));
        setPrestamos(d.prestamos || []);
        const p = await api.get(`/recicladores/${r.id}/precios`).catch(() => ({ precios: [] }));
        setPrecios(p.precios || []);
    };

    const guardarPrecioEspecial = async () => {
        if (!precioForm.material_id || precioForm.precio === '') return;
        try {
            const d = await api.post(`/recicladores/${selected.id}/precios`, precioForm);
            setPrecios(d.precios);
            setPrecioForm({ material_id: '', precio: '' });
        } catch (err) { setMsg(err.message); }
    };

    const eliminarPrecioEspecial = async (material_id) => {
        await api.delete(`/recicladores/${selected.id}/precios/${material_id}`);
        setPrecios(prev => prev.filter(p => p.material_id !== material_id));
    };

    const guardar = async () => {
        try {
            await api.post('/recicladores', form);
            setForm({ nombre: '', cedula: '', telefono: '', whatsapp: '', bodega_id: '' });
            setShowForm(false); setMsg(''); cargar();
        } catch (err) { setMsg(err.message); }
    };

    const guardarPrestamo = async () => {
        if (!selected) return;
        try {
            await api.post(`/recicladores/${selected.id}/prestamos`, pForm);
            setPForm({ monto: '', descripcion: '', fecha: new Date().toISOString().slice(0, 10) });
            setShowPrestamo(false);
            seleccionar(selected); cargar();
        } catch (err) { setMsg(err.message); }
    };

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700 }}>♻️ Recicladores</h1>
                    <p style={{ color: '#666', fontSize: 13 }}>Gestión de recicladores y préstamos</p>
                </div>
                <button onClick={() => setShowForm(!showForm)} style={{ padding: '9px 18px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>+ Nuevo</button>
            </div>

            {showForm && (
                <div style={{ background: '#fff', borderRadius: 10, padding: 20, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                    <h3 style={{ marginBottom: 14, fontSize: 15 }}>Nuevo Reciclador</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                        {[['nombre','Nombre*'],['cedula','Cédula'],['telefono','Teléfono'],['whatsapp','WhatsApp']].map(([k,l]) => (
                            <label key={k}>
                                <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>{l}</div>
                                <input value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                            </label>
                        ))}
                        <label>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Bodega</div>
                            <select value={form.bodega_id} onChange={e => setForm({ ...form, bodega_id: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                <option value="">-- Selecciona --</option>
                                {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                            </select>
                        </label>
                    </div>
                    {msg && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{msg}</div>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                        <button onClick={guardar} style={{ padding: '8px 20px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13 }}>Guardar</button>
                        <button onClick={() => setShowForm(false)} style={{ padding: '8px 20px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 13 }}>Cancelar</button>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 20 }}>
                <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, color: '#666' }}>Filtrar por bodega:</span>
                        <select value={filtroBodega} onChange={e => setFiltroBodega(e.target.value)}
                            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12 }}>
                            <option value="">Todas</option>
                            {bodegas.map(b => <option key={b.id} value={String(b.id)}>{b.nombre}</option>)}
                        </select>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#f0faf0' }}>
                                {['Nombre','Cédula','Teléfono','Préstamo','Bodega',''].map(h => (
                                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {recicladores.filter(r => !filtroBodega || String(r.bodega_id) === filtroBodega).map(r => (
                                <tr key={r.id} onClick={() => seleccionar(r)} style={{ borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: selected?.id === r.id ? '#f0faf0' : 'transparent' }}>
                                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.nombre}</td>
                                    <td style={{ padding: '10px 12px', color: '#666' }}>{r.cedula}</td>
                                    <td style={{ padding: '10px 12px', color: '#666' }}>{r.telefono}</td>
                                    <td style={{ padding: '10px 12px', color: parseFloat(r.saldo_prestamo) > 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>
                                        ${fmt(r.saldo_prestamo)}
                                    </td>
                                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#888' }}>{r.bodega?.nombre || '—'}</td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <button onClick={e => { e.stopPropagation(); seleccionar(r); }} style={{ padding: '4px 10px', background: '#e0f2e9', color: '#1a5c2a', border: 'none', borderRadius: 4, fontSize: 11 }}>Ver</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {recicladores.length === 0 && <p style={{ color: '#999', textAlign: 'center', padding: 20, fontSize: 13 }}>No hay recicladores registrados</p>}
                </div>

                {selected && (
                    <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                            <div>
                                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{selected.nombre}</h3>
                                <div style={{ fontSize: 13, color: '#666' }}>📞 {selected.telefono} · {selected.bodega?.nombre || 'Sin bodega'}</div>
                                <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 600, marginTop: 4 }}>Saldo préstamo: ${fmt(selected.saldo_prestamo)}</div>
                            </div>
                            <button onClick={() => setSelected(null)} style={{ padding: '6px 10px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 12 }}>✕</button>
                        </div>

                        {/* Tabs */}
                        <div style={{ display: 'flex', borderBottom: '2px solid #f0f0f0', marginBottom: 14, gap: 4 }}>
                            {[['prestamos','💰 Préstamos'],['precios','🏷️ Precios especiales']].map(([k,l]) => (
                                <button key={k} onClick={() => setTabDetalle(k)}
                                    style={{ padding: '7px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: tabDetalle === k ? 700 : 400,
                                        color: tabDetalle === k ? '#1a5c2a' : '#888',
                                        borderBottom: tabDetalle === k ? '2px solid #1a5c2a' : '2px solid transparent', marginBottom: -2 }}>
                                    {l}
                                </button>
                            ))}
                        </div>

                        {/* Tab: Préstamos */}
                        {tabDetalle === 'prestamos' && (
                            <>
                                <button onClick={() => setShowPrestamo(!showPrestamo)}
                                    style={{ padding: '6px 12px', background: '#fef3c7', color: '#d97706', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                                    + Nuevo préstamo
                                </button>
                                {showPrestamo && (
                                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                                            <input type="number" placeholder="Monto $" value={pForm.monto} onChange={e => setPForm({ ...pForm, monto: e.target.value })}
                                                style={{ padding: '8px', borderRadius: 6, border: '1px solid #fde68a', fontSize: 13 }} />
                                            <input type="date" value={pForm.fecha} onChange={e => setPForm({ ...pForm, fecha: e.target.value })}
                                                style={{ padding: '8px', borderRadius: 6, border: '1px solid #fde68a', fontSize: 13 }} />
                                        </div>
                                        <input placeholder="Descripción" value={pForm.descripcion} onChange={e => setPForm({ ...pForm, descripcion: e.target.value })}
                                            style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #fde68a', fontSize: 13, marginBottom: 8 }} />
                                        <button onClick={guardarPrestamo} style={{ padding: '7px 16px', background: '#d97706', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13 }}>Registrar préstamo</button>
                                    </div>
                                )}
                                {prestamos.length === 0 ? <p style={{ color: '#999', fontSize: 13 }}>Sin préstamos registrados</p> : (
                                    prestamos.map(p => (
                                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                                            <div>
                                                <span style={{ fontWeight: 600 }}>${fmt(p.monto)}</span>
                                                <span style={{ color: '#888', marginLeft: 8 }}>{p.descripcion}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                                <span style={{ color: '#888' }}>{p.fecha}</span>
                                                <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: p.pagado ? '#d1fae5' : '#fee2e2', color: p.pagado ? '#059669' : '#dc2626' }}>
                                                    {p.pagado ? 'Pagado' : 'Pendiente'}
                                                </span>
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
                                    <div style={{ fontSize: 12, color: '#555', marginBottom: 8, fontWeight: 600 }}>Asignar precio especial</div>
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
                                        <button onClick={guardarPrecioEspecial}
                                            style={{ padding: '7px 14px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                            Guardar
                                        </button>
                                    </div>
                                </div>
                                {precios.length === 0 ? (
                                    <p style={{ color: '#999', fontSize: 13 }}>Sin precios especiales. Usa el precio general de cada material.</p>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead><tr style={{ background: '#f0faf0' }}>
                                            <th style={{ padding: '8px 10px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>Material</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'right', color: '#1a5c2a', fontWeight: 600 }}>Precio especial</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'right', color: '#1a5c2a', fontWeight: 600 }}>Precio general</th>
                                            <th style={{ width: 40 }}></th>
                                        </tr></thead>
                                        <tbody>
                                            {precios.map(p => (
                                                <tr key={p.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{p.material?.nombre}</td>
                                                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#1a5c2a', fontWeight: 700 }}>${fmt(p.precio)}/kg</td>
                                                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#888' }}>${fmt(p.material?.precio_compra)}/kg</td>
                                                    <td style={{ padding: '8px 10px' }}>
                                                        <button onClick={() => eliminarPrecioEspecial(p.material_id)}
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
