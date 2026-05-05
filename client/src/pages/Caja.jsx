import React, { useState, useEffect } from 'react';
import { api } from '../api';

const fmt = n => Number(n || 0).toLocaleString('es-CO');

export default function Caja() {
    const [caja, setCaja] = useState(null);
    const [bodegas, setBodegas] = useState([]);
    const [bodega_id, setBodegaId] = useState('');
    const [mForm, setMForm] = useState({ tipo: 'ingreso', concepto: '', monto: '', referencia: '' });
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => { api.get('/bodegas').then(d => { setBodegas(d.bodegas); if (d.bodegas[0]) setBodegaId(String(d.bodegas[0].id)); }); }, []);
    useEffect(() => { if (bodega_id) cargar(); }, [bodega_id]);

    const cargar = async () => {
        const d = await api.get(`/caja?bodega_id=${bodega_id}`).catch(() => null);
        if (d) setCaja(d.caja);
    };

    const agregarMovimiento = async () => {
        if (!mForm.concepto || !mForm.monto) return setMsg('Completa concepto y monto');
        setLoading(true);
        try {
            const d = await api.post(`/caja/${caja.id}/movimientos`, mForm);
            setCaja(d.caja);
            setMForm({ tipo: 'ingreso', concepto: '', monto: '', referencia: '' });
            setMsg('');
        } catch (err) { setMsg(err.message); }
        finally { setLoading(false); }
    };

    const cerrar = async () => {
        if (!window.confirm('¿Cerrar la caja del día?')) return;
        const d = await api.post(`/caja/${caja.id}/cerrar`, {});
        setCaja(d.caja);
    };

    const tipoColor = { ingreso: '#059669', egreso: '#dc2626' };

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700 }}>💰 Caja</h1>
                    <p style={{ color: '#666', fontSize: 13 }}>Control de caja menor por bodega</p>
                </div>
                <select value={bodega_id} onChange={e => setBodegaId(e.target.value)} style={{ marginLeft: 'auto', padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                    {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
            </div>

            {caja && (
                <>
                    {/* Resumen */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                        {[
                            ['Saldo inicial', `$${fmt(caja.saldo_inicial)}`, '#666'],
                            ['Ingresos', `$${fmt(caja.total_ingresos)}`, '#059669'],
                            ['Egresos', `$${fmt(caja.total_egresos)}`, '#dc2626'],
                            ['Saldo actual', `$${fmt(caja.saldo_final)}`, '#1a5c2a'],
                        ].map(([t, v, c]) => (
                            <div key={t} style={{ background: '#fff', borderRadius: 8, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
                                <div style={{ fontSize: 12, color: '#666' }}>{t}</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: c, marginTop: 4 }}>{v}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>
                        {/* Agregar movimiento */}
                        {caja.estado === 'abierta' && (
                            <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)', height: 'fit-content' }}>
                                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Nuevo movimiento</h3>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                    {['ingreso','egreso'].map(t => (
                                        <button key={t} onClick={() => setMForm({ ...mForm, tipo: t })}
                                            style={{ flex: 1, padding: '8px', background: mForm.tipo === t ? (t === 'ingreso' ? '#d1fae5' : '#fee2e2') : '#f5f5f5', color: mForm.tipo === t ? tipoColor[t] : '#888', border: `2px solid ${mForm.tipo === t ? tipoColor[t] : '#ddd'}`, borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                            {t === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}
                                        </button>
                                    ))}
                                </div>
                                {[['concepto','Concepto*'],['referencia','Referencia']].map(([k,l]) => (
                                    <label key={k} style={{ display: 'block', marginBottom: 10 }}>
                                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>{l}</div>
                                        <input value={mForm[k]} onChange={e => setMForm({ ...mForm, [k]: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                                    </label>
                                ))}
                                <label style={{ display: 'block', marginBottom: 12 }}>
                                    <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Monto*</div>
                                    <input type="number" value={mForm.monto} onChange={e => setMForm({ ...mForm, monto: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                                </label>
                                {msg && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{msg}</div>}
                                <button onClick={agregarMovimiento} disabled={loading} style={{ width: '100%', padding: '9px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>Registrar</button>
                                <button onClick={cerrar} style={{ width: '100%', marginTop: 8, padding: '9px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>Cerrar caja del día</button>
                            </div>
                        )}
                        {caja.estado === 'cerrada' && (
                            <div style={{ background: '#d1fae5', borderRadius: 10, padding: 20, height: 'fit-content', textAlign: 'center' }}>
                                <div style={{ fontSize: 32 }}>✅</div>
                                <div style={{ fontWeight: 700, color: '#059669', marginTop: 8 }}>Caja cerrada</div>
                                <div style={{ fontSize: 13, color: '#065f46', marginTop: 4 }}>Saldo final: ${fmt(caja.saldo_final)}</div>
                            </div>
                        )}

                        {/* Movimientos */}
                        <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead><tr style={{ background: '#f0faf0' }}>
                                    {['Hora','Tipo','Concepto','Referencia','Monto'].map(h => <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>{h}</th>)}
                                </tr></thead>
                                <tbody>
                                    {(caja.movimientos || []).map(m => (
                                        <tr key={m.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                            <td style={{ padding: '8px 12px', color: '#888' }}>{m.hora}</td>
                                            <td style={{ padding: '8px 12px' }}>
                                                <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: m.tipo === 'ingreso' ? '#d1fae5' : '#fee2e2', color: tipoColor[m.tipo] }}>
                                                    {m.tipo === 'ingreso' ? '↑' : '↓'} {m.tipo}
                                                </span>
                                            </td>
                                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{m.concepto}</td>
                                            <td style={{ padding: '8px 12px', color: '#888' }}>{m.referencia}</td>
                                            <td style={{ padding: '8px 12px', fontWeight: 700, color: tipoColor[m.tipo] }}>${fmt(m.monto)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {!(caja.movimientos?.length) && <p style={{ color: '#999', textAlign: 'center', padding: 20, fontSize: 13 }}>Sin movimientos registrados hoy</p>}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
