import React, { useState, useEffect } from 'react';
import { api } from '../api';

const hoy = () => new Date().toISOString().slice(0, 10);

export default function Remisiones() {
    const [remisiones, setRemisiones] = useState([]);
    const [bodegas, setBodegas] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ conductor: '', placa: '', bodega_id: '', fecha: hoy(), observaciones: '' });
    const [foto, setFoto] = useState(null);
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState(null);

    useEffect(() => {
        api.get('/bodegas').then(d => { setBodegas(d.bodegas); if (d.bodegas[0]) setForm(f => ({ ...f, bodega_id: d.bodegas[0].id })); });
        cargar();
    }, []);

    const cargar = () => api.get('/remisiones').then(d => setRemisiones(d.remisiones || [])).catch(() => {});

    const handleFoto = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setFoto(file);
        const reader = new FileReader();
        reader.onload = ev => setPreview(ev.target.result);
        reader.readAsDataURL(file);
    };

    const guardar = async () => {
        if (!form.conductor || !form.placa) return setMsg('Conductor y placa son requeridos');
        setLoading(true);
        try {
            const fd = new FormData();
            Object.entries(form).forEach(([k, v]) => fd.append(k, v));
            if (foto) fd.append('foto', foto);
            await api.upload('/remisiones', fd);
            setForm({ conductor: '', placa: '', bodega_id: bodegas[0]?.id || '', fecha: hoy(), observaciones: '' });
            setFoto(null); setPreview(null); setShowForm(false); setMsg(''); cargar();
        } catch (err) { setMsg(err.message); }
        finally { setLoading(false); }
    };

    const BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700 }}>🚛 Remisiones</h1>
                    <p style={{ color: '#666', fontSize: 13 }}>Registro de conductores y fotos de remisión</p>
                </div>
                <button onClick={() => setShowForm(!showForm)} style={{ padding: '9px 18px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>+ Nueva Remisión</button>
            </div>

            {showForm && (
                <div style={{ background: '#fff', borderRadius: 10, padding: 20, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Nueva Remisión</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                        {[['conductor','Conductor*'],['placa','Placa*']].map(([k,l]) => (
                            <label key={k}>
                                <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>{l}</div>
                                <input value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                            </label>
                        ))}
                        <label>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Bodega</div>
                            <select value={form.bodega_id} onChange={e => setForm({ ...form, bodega_id: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                            </select>
                        </label>
                        <label>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Fecha</div>
                            <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                        </label>
                        <label style={{ gridColumn: 'span 2' }}>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Observaciones</div>
                            <input value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                        </label>
                    </div>

                    <label style={{ display: 'block', marginBottom: 14 }}>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>Foto de remisión</div>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                            <label style={{ cursor: 'pointer', padding: '8px 16px', background: '#f0faf0', border: '2px dashed #1a5c2a', borderRadius: 8, fontSize: 13, color: '#1a5c2a', fontWeight: 600 }}>
                                📷 Seleccionar foto
                                <input type="file" accept="image/*" onChange={handleFoto} style={{ display: 'none' }} />
                            </label>
                            {preview && <img src={preview} alt="preview" style={{ height: 80, borderRadius: 6, border: '1px solid #ddd' }} />}
                        </div>
                    </label>

                    {msg && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{msg}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={guardar} disabled={loading} style={{ padding: '9px 20px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                            {loading ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button onClick={() => { setShowForm(false); setFoto(null); setPreview(null); }} style={{ padding: '9px 16px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 13 }}>Cancelar</button>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
                {remisiones.map(r => (
                    <div key={r.id} style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                        {r.foto_url && (
                            <img src={`${BASE}${r.foto_url}`} alt="remision" style={{ width: '100%', height: 180, objectFit: 'cover' }} />
                        )}
                        {!r.foto_url && (
                            <div style={{ width: '100%', height: 120, background: '#f0faf0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🚛</div>
                        )}
                        <div style={{ padding: 14 }}>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{r.conductor}</div>
                            <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>Placa: <strong>{r.placa}</strong></div>
                            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{r.fecha} • {r.bodega?.nombre}</div>
                            {r.observaciones && <div style={{ fontSize: 12, color: '#555', marginTop: 6, borderTop: '1px solid #f0f0f0', paddingTop: 6 }}>{r.observaciones}</div>}
                        </div>
                    </div>
                ))}
            </div>
            {remisiones.length === 0 && (
                <div style={{ background: '#fff', borderRadius: 10, padding: 40, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                    <div style={{ fontSize: 40 }}>🚛</div>
                    <p style={{ color: '#999', marginTop: 12, fontSize: 13 }}>No hay remisiones registradas</p>
                </div>
            )}
        </div>
    );
}
