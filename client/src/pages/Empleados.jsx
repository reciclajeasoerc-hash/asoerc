import React, { useState, useEffect } from 'react';
import { api } from '../api';

const fmt = n => Number(n || 0).toLocaleString('es-CO');
const hoy = () => new Date().toISOString().slice(0, 10);

export default function Empleados() {
    const [empleados, setEmpleados] = useState([]);
    const [bodegas, setBodegas] = useState([]);
    const [selected, setSelected] = useState(null);
    const [tab, setTab] = useState('prestamos');
    const [prestamos, setPrestamos] = useState([]);
    const [dias, setDias] = useState([]);
    const [showEmp, setShowEmp] = useState(false);
    const [showP, setShowP] = useState(false);
    const [showD, setShowD] = useState(false);
    const [form, setForm] = useState({ nombre: '', cedula: '', telefono: '', bodega_id: '', cargo: '', salario: '' });
    const [pForm, setPForm] = useState({ monto: '', descripcion: '', quincena: '', fecha: hoy() });
    const [dForm, setDForm] = useState({ fecha_inicio: hoy(), fecha_fin: hoy(), dias: '', motivo: '', quincena: '' });
    const [msg, setMsg] = useState('');

    useEffect(() => {
        api.get('/bodegas').then(d => setBodegas(d.bodegas));
        cargar();
    }, []);

    const cargar = () => api.get('/empleados').then(d => setEmpleados(d.empleados)).catch(() => {});

    const seleccionar = async (e) => {
        setSelected(e);
        const [p, d] = await Promise.all([
            api.get(`/empleados/${e.id}/prestamos`).catch(() => ({ prestamos: [] })),
            api.get(`/empleados/${e.id}/dias-no-laborados`).catch(() => ({ dias: [] }))
        ]);
        setPrestamos(p.prestamos || []);
        setDias(d.dias || []);
    };

    const guardarEmpleado = async () => {
        if (!form.nombre) return setMsg('Nombre requerido');
        try { await api.post('/empleados', form); setShowEmp(false); setMsg(''); cargar(); }
        catch (err) { setMsg(err.message); }
    };

    const guardarPrestamo = async () => {
        if (!selected || !pForm.monto) return;
        try { await api.post(`/empleados/${selected.id}/prestamos`, pForm); setShowP(false); seleccionar(selected); }
        catch (err) { setMsg(err.message); }
    };

    const guardarDias = async () => {
        if (!selected || !dForm.dias) return;
        try { await api.post(`/empleados/${selected.id}/dias-no-laborados`, dForm); setShowD(false); seleccionar(selected); }
        catch (err) { setMsg(err.message); }
    };

    const Btn = ({ active, onClick, children }) => (
        <button onClick={onClick} style={{ padding: '6px 14px', background: active ? '#1a5c2a' : '#f5f5f5', color: active ? '#fff' : '#555', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>{children}</button>
    );

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700 }}>👷 Empleados</h1>
                    <p style={{ color: '#666', fontSize: 13 }}>Préstamos y días no laborados</p>
                </div>
                <button onClick={() => setShowEmp(!showEmp)} style={{ padding: '9px 18px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>+ Nuevo</button>
            </div>

            {showEmp && (
                <div style={{ background: '#fff', borderRadius: 10, padding: 20, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                        {[['nombre','Nombre*'],['cedula','Cédula'],['telefono','Teléfono'],['cargo','Cargo'],['salario','Salario']].map(([k,l]) => (
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
                                <option value="">--</option>
                                {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                            </select>
                        </label>
                    </div>
                    {msg && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{msg}</div>}
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                        <button onClick={guardarEmpleado} style={{ padding: '8px 20px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13 }}>Guardar</button>
                        <button onClick={() => setShowEmp(false)} style={{ padding: '8px 16px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 13 }}>Cancelar</button>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 20 }}>
                <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead><tr style={{ background: '#f0faf0' }}>
                            {['Nombre','Cargo','Bodega',''].map(h => <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                            {empleados.map(e => (
                                <tr key={e.id} onClick={() => seleccionar(e)} style={{ borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: selected?.id === e.id ? '#f0faf0' : 'transparent' }}>
                                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{e.nombre}</td>
                                    <td style={{ padding: '10px 12px', color: '#666' }}>{e.cargo}</td>
                                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#888' }}>{e.bodega?.nombre}</td>
                                    <td style={{ padding: '10px 12px' }}><button style={{ padding: '4px 10px', background: '#e0f2e9', color: '#1a5c2a', border: 'none', borderRadius: 4, fontSize: 11 }}>Ver</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {selected && (
                    <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                            <div>
                                <h3 style={{ fontWeight: 700 }}>{selected.nombre}</h3>
                                <div style={{ fontSize: 13, color: '#666' }}>{selected.cargo} • {selected.bodega?.nombre}</div>
                            </div>
                            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>✕</button>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                            <Btn active={tab === 'prestamos'} onClick={() => setTab('prestamos')}>💰 Préstamos</Btn>
                            <Btn active={tab === 'dias'} onClick={() => setTab('dias')}>📅 Días no laborados</Btn>
                        </div>

                        {tab === 'prestamos' && (
                            <>
                                <button onClick={() => setShowP(!showP)} style={{ marginBottom: 12, padding: '7px 14px', background: '#fef3c7', color: '#d97706', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>+ Préstamo</button>
                                {showP && (
                                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                                            <input type="number" placeholder="Monto" value={pForm.monto} onChange={e => setPForm({ ...pForm, monto: e.target.value })} style={{ padding: '7px', borderRadius: 6, border: '1px solid #fde68a', fontSize: 13 }} />
                                            <input placeholder="Quincena (ej: 2026-05-1)" value={pForm.quincena} onChange={e => setPForm({ ...pForm, quincena: e.target.value })} style={{ padding: '7px', borderRadius: 6, border: '1px solid #fde68a', fontSize: 13 }} />
                                        </div>
                                        <input placeholder="Descripción" value={pForm.descripcion} onChange={e => setPForm({ ...pForm, descripcion: e.target.value })} style={{ width: '100%', padding: '7px', borderRadius: 6, border: '1px solid #fde68a', fontSize: 13, marginBottom: 8 }} />
                                        <button onClick={guardarPrestamo} style={{ padding: '7px 16px', background: '#d97706', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12 }}>Registrar</button>
                                    </div>
                                )}
                                {prestamos.map(p => (
                                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                                        <div><span style={{ fontWeight: 600 }}>${fmt(p.monto)}</span> <span style={{ color: '#888', fontSize: 12 }}>{p.descripcion}</span></div>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <span style={{ color: '#888', fontSize: 12 }}>{p.quincena}</span>
                                            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: p.descontado ? '#d1fae5' : '#fee2e2', color: p.descontado ? '#059669' : '#dc2626' }}>{p.descontado ? 'Descontado' : 'Pendiente'}</span>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}

                        {tab === 'dias' && (
                            <>
                                <button onClick={() => setShowD(!showD)} style={{ marginBottom: 12, padding: '7px 14px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>+ Días no laborados</button>
                                {showD && (
                                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                                            <input type="date" value={dForm.fecha_inicio} onChange={e => setDForm({ ...dForm, fecha_inicio: e.target.value })} style={{ padding: '7px', borderRadius: 6, border: '1px solid #bfdbfe', fontSize: 13 }} />
                                            <input type="date" value={dForm.fecha_fin} onChange={e => setDForm({ ...dForm, fecha_fin: e.target.value })} style={{ padding: '7px', borderRadius: 6, border: '1px solid #bfdbfe', fontSize: 13 }} />
                                            <input type="number" placeholder="# Días" value={dForm.dias} onChange={e => setDForm({ ...dForm, dias: e.target.value })} step="0.5" style={{ padding: '7px', borderRadius: 6, border: '1px solid #bfdbfe', fontSize: 13 }} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                                            <input placeholder="Motivo" value={dForm.motivo} onChange={e => setDForm({ ...dForm, motivo: e.target.value })} style={{ padding: '7px', borderRadius: 6, border: '1px solid #bfdbfe', fontSize: 13 }} />
                                            <input placeholder="Quincena" value={dForm.quincena} onChange={e => setDForm({ ...dForm, quincena: e.target.value })} style={{ padding: '7px', borderRadius: 6, border: '1px solid #bfdbfe', fontSize: 13 }} />
                                        </div>
                                        <button onClick={guardarDias} style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12 }}>Registrar</button>
                                    </div>
                                )}
                                {dias.map(d => (
                                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                                        <div><span style={{ fontWeight: 600 }}>{d.dias} días</span> <span style={{ color: '#888', fontSize: 12 }}>{d.motivo}</span></div>
                                        <div style={{ color: '#888', fontSize: 12 }}>{d.fecha_inicio} → {d.fecha_fin}</div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
