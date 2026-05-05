import React, { useState, useEffect } from 'react';
import { api } from '../api';

const fmt = n => Number(n || 0).toLocaleString('es-CO');

export default function Recicladores() {
    const [recicladores, setRecicladores] = useState([]);
    const [bodegas, setBodegas] = useState([]);
    const [selected, setSelected] = useState(null);
    const [prestamos, setPrestamos] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [showPrestamo, setShowPrestamo] = useState(false);
    const [form, setForm] = useState({ nombre: '', cedula: '', telefono: '', whatsapp: '', bodega_id: '' });
    const [pForm, setPForm] = useState({ monto: '', descripcion: '', fecha: new Date().toISOString().slice(0, 10) });
    const [msg, setMsg] = useState('');

    useEffect(() => {
        api.get('/bodegas').then(d => setBodegas(d.bodegas));
        cargar();
    }, []);

    const cargar = () => api.get('/recicladores').then(d => setRecicladores(d.recicladores)).catch(() => {});

    const seleccionar = async (r) => {
        setSelected(r);
        const d = await api.get(`/recicladores/${r.id}/prestamos`).catch(() => ({ prestamos: [] }));
        setPrestamos(d.prestamos || []);
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
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#f0faf0' }}>
                                {['Nombre','Cédula','Teléfono','Préstamo','Bodega',''].map(h => (
                                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {recicladores.map(r => (
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <div>
                                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{selected.nombre}</h3>
                                <div style={{ fontSize: 13, color: '#666' }}>📞 {selected.telefono}</div>
                                <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 600, marginTop: 4 }}>Saldo préstamo: ${fmt(selected.saldo_prestamo)}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => setShowPrestamo(!showPrestamo)} style={{ padding: '6px 12px', background: '#fef3c7', color: '#d97706', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>+ Préstamo</button>
                                <button onClick={() => setSelected(null)} style={{ padding: '6px 10px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 12 }}>✕</button>
                            </div>
                        </div>

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

                        <h4 style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 10 }}>Historial de préstamos</h4>
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
                    </div>
                )}
            </div>
        </div>
    );
}
