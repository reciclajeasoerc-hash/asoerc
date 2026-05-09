import React, { useState, useEffect } from 'react';
import { api } from '../api';

const hoy = () => new Date().toISOString().slice(0, 10);

export default function Empaques() {
    const [empaques, setEmpaques] = useState([]);
    const [recicladores, setRecicladores] = useState([]);
    const [bodegas, setBodegas] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        reciclador_id: '', conductor: '', tipo: 'entrega',
        cantidad: '', bodega_id: '', fecha: hoy(), observaciones: ''
    });
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [filtro, setFiltro] = useState('');

    useEffect(() => {
        Promise.all([
            api.get('/recicladores').then(d => setRecicladores(d.recicladores || [])),
            api.get('/bodegas').then(d => { setBodegas(d.bodegas || []); if (d.bodegas[0]) setForm(f => ({ ...f, bodega_id: d.bodegas[0].id })); })
        ]);
        cargar();
    }, []);

    const cargar = () => api.get('/empaques').then(d => setEmpaques(d.empaques || [])).catch(() => {});

    const guardar = async () => {
        const cantidad = parseInt(form.cantidad) || 0;
        if (!cantidad) return setMsg('Cantidad requerida');
        if (!form.reciclador_id && !form.conductor) return setMsg('Selecciona reciclador o ingresa conductor');
        setLoading(true);
        try {
            const tipo_actor = form.reciclador_id ? 'reciclador' : 'conductor';
            const body = {
                tipo_actor,
                reciclador_id: form.reciclador_id || null,
                conductor: form.conductor || null,
                bodega_id: form.bodega_id,
                fecha: form.fecha,
                observaciones: form.observaciones,
                cantidad_entregada: form.tipo === 'entrega' ? cantidad : 0,
                cantidad_devuelta:  form.tipo === 'devolucion' ? cantidad : 0,
            };
            await api.post('/empaques', body);
            setForm({ reciclador_id: '', conductor: '', tipo: 'entrega', cantidad: '', bodega_id: bodegas[0]?.id || '', fecha: hoy(), observaciones: '' });
            setShowForm(false); setMsg(''); cargar();
        } catch (err) { setMsg(err.message); }
        finally { setLoading(false); }
    };

    const tipoEntrega = { bg: '#d1fae5', color: '#059669' };
    const tipoDevol  = { bg: '#fee2e2', color: '#dc2626' };

    const empFiltrados = filtro
        ? empaques.filter(e => e.reciclador?.nombre?.toLowerCase().includes(filtro.toLowerCase()) || e.conductor?.toLowerCase().includes(filtro.toLowerCase()))
        : empaques;

    // Resumen por actor
    const resumen = empaques.reduce((acc, e) => {
        const key = e.reciclador_id || `c_${e.conductor}`;
        const nombre = e.reciclador?.nombre || e.conductor || '—';
        if (!acc[key]) acc[key] = { nombre, entregado: 0, devuelto: 0 };
        acc[key].entregado += Number(e.cantidad_entregada) || 0;
        acc[key].devuelto  += Number(e.cantidad_devuelta)  || 0;
        return acc;
    }, {});

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700 }}>📦 Empaques</h1>
                    <p style={{ color: '#666', fontSize: 13 }}>Control de empaques entregados y devueltos</p>
                </div>
                <button onClick={() => setShowForm(!showForm)} style={{ padding: '9px 18px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>+ Registrar</button>
            </div>

            {showForm && (
                <div style={{ background: '#fff', borderRadius: 10, padding: 20, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Nuevo movimiento de empaque</h3>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                        {[['entrega','📤 Entrega'], ['devolucion','📥 Devolución']].map(([v, l]) => (
                            <button key={v} onClick={() => setForm({ ...form, tipo: v })}
                                style={{ flex: 1, padding: '9px', background: form.tipo === v ? (v === 'entrega' ? '#d1fae5' : '#fee2e2') : '#f5f5f5', color: form.tipo === v ? (v === 'entrega' ? '#059669' : '#dc2626') : '#888', border: `2px solid ${form.tipo === v ? (v === 'entrega' ? '#059669' : '#dc2626') : '#ddd'}`, borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                        <label>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Reciclador</div>
                            <select value={form.reciclador_id} onChange={e => setForm({ ...form, reciclador_id: e.target.value, conductor: '' })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                <option value="">-- Ninguno --</option>
                                {recicladores.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                            </select>
                        </label>
                        <label>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>O conductor externo</div>
                            <input value={form.conductor} onChange={e => setForm({ ...form, conductor: e.target.value, reciclador_id: '' })} placeholder="Nombre conductor" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                        </label>
                        <label>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Cantidad*</div>
                            <input type="number" value={form.cantidad} onChange={e => setForm({ ...form, cantidad: e.target.value })} min="1" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                        </label>
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
                        <label>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Observaciones</div>
                            <input value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                        </label>
                    </div>

                    {msg && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{msg}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={guardar} disabled={loading} style={{ padding: '9px 20px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>{loading ? 'Guardando...' : 'Registrar'}</button>
                        <button onClick={() => setShowForm(false)} style={{ padding: '9px 16px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 13 }}>Cancelar</button>
                    </div>
                </div>
            )}

            {/* Saldo por persona */}
            {Object.values(resumen).length > 0 && (
                <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: '#555', marginBottom: 10 }}>Saldo por persona</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
                        {Object.values(resumen).map(r => {
                            const saldo = r.entregado - r.devuelto;
                            return (
                                <div key={r.nombre} style={{ background: '#fff', borderRadius: 8, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{r.nombre}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                        <span style={{ color: '#059669' }}>Entregados: {r.entregado}</span>
                                        <span style={{ color: '#dc2626' }}>Devueltos: {r.devuelto}</span>
                                    </div>
                                    <div style={{ marginTop: 6, fontWeight: 700, color: saldo > 0 ? '#d97706' : '#059669', fontSize: 14 }}>
                                        Saldo: {saldo} empaques
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Historial */}
            <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
                    <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar por reciclador o conductor..." style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr style={{ background: '#f0faf0' }}>
                        {['Fecha','Persona','Entregados','Devueltos','Saldo','Bodega'].map(h => (
                            <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>{h}</th>
                        ))}
                    </tr></thead>
                    <tbody>
                        {empFiltrados.map(e => (
                            <tr key={e.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                <td style={{ padding: '8px 12px', color: '#888' }}>{e.fecha}</td>
                                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{e.reciclador?.nombre || e.conductor || '—'}</td>
                                <td style={{ padding: '8px 12px' }}>
                                    {e.cantidad_entregada > 0 && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: tipoEntrega.bg, color: tipoEntrega.color }}>📤 {e.cantidad_entregada}</span>}
                                </td>
                                <td style={{ padding: '8px 12px' }}>
                                    {e.cantidad_devuelta > 0 && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: tipoDevol.bg, color: tipoDevol.color }}>📥 {e.cantidad_devuelta}</span>}
                                </td>
                                <td style={{ padding: '8px 12px', fontWeight: 700, color: e.saldo > 0 ? '#d97706' : '#059669' }}>{e.saldo}</td>
                                <td style={{ padding: '8px 12px', color: '#888', fontSize: 12 }}>{e.bodega?.nombre}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {empFiltrados.length === 0 && <p style={{ color: '#999', textAlign: 'center', padding: 20, fontSize: 13 }}>Sin registros</p>}
            </div>
        </div>
    );
}
