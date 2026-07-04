import React, { useState, useEffect } from 'react';
import { api } from '../api';

const hoy = () => new Date().toISOString().slice(0, 10);
const fmt = n => Number(n || 0).toLocaleString('es-CO');

function ModalNuevoPrestamo({ onClose, onSaved }) {
    const [tipo, setTipo] = useState('reciclador');
    const [personas, setPersonas] = useState([]);
    const [form, setForm] = useState({ persona_id: '', monto: '', fecha: hoy(), descripcion: '', quincena: '' });
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        const endpoint = tipo === 'reciclador' ? '/recicladores' : '/empleados';
        api.get(endpoint).then(d => setPersonas(d.recicladores || d.empleados || [])).catch(() => {});
        setForm(f => ({ ...f, persona_id: '' }));
    }, [tipo]);

    const guardar = async () => {
        if (!form.persona_id || !form.monto) return setMsg('Persona y monto son requeridos');
        setLoading(true);
        try {
            const endpoint = tipo === 'reciclador'
                ? `/recicladores/${form.persona_id}/prestamos`
                : `/empleados/${form.persona_id}/prestamos`;
            await api.post(endpoint, { monto: form.monto, fecha: form.fecha, descripcion: form.descripcion, quincena: form.quincena });
            onSaved();
        } catch (err) { setMsg(err.message); }
        finally { setLoading(false); }
    };

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>+ Nuevo Préstamo</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                    <label>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Tipo</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {[['reciclador','♻️ Reciclador'],['empleado','👷 Empleado']].map(([k,l]) => (
                                <button key={k} onClick={() => setTipo(k)}
                                    style={{ flex: 1, padding: '8px', background: tipo === k ? '#1a5c2a' : '#f5f5f5', color: tipo === k ? '#fff' : '#555', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                    {l}
                                </button>
                            ))}
                        </div>
                    </label>
                    <label>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>{tipo === 'reciclador' ? 'Reciclador' : 'Empleado'}*</div>
                        <select value={form.persona_id} onChange={e => setForm({ ...form, persona_id: e.target.value })}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                            <option value="">-- Selecciona --</option>
                            {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                    </label>
                    <label>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Monto ($)*</div>
                        <input type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                    </label>
                    <label>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Fecha</div>
                        <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                    </label>
                    <label>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Descripción / Motivo</div>
                        <input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                    </label>
                    {tipo === 'empleado' && (
                        <label>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Quincena (ej: 2026-05-15)</div>
                            <input value={form.quincena} onChange={e => setForm({ ...form, quincena: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                        </label>
                    )}
                </div>
                {msg && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{msg}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <button onClick={guardar} disabled={loading}
                        style={{ flex: 1, padding: '9px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        {loading ? 'Guardando...' : 'Registrar préstamo'}
                    </button>
                    <button onClick={onClose} style={{ padding: '9px 16px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                </div>
            </div>
        </div>
    );
}

export default function Prestamos() {
    const [tab, setTab] = useState('pendientes');
    const [recicladores, setRecicladores] = useState([]);
    const [empleados, setEmpleados] = useState([]);
    const [prestamosRec, setPrestamosRec] = useState([]);
    const [prestamosEmp, setPrestamosEmp] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [filtroTipo, setFiltroTipo] = useState('todos');

    const cargar = async () => {
        try {
            const [recs, emps] = await Promise.all([
                api.get('/recicladores'),
                api.get('/empleados')
            ]);
            const todosRec = recs.recicladores || [];
            const todosEmp = emps.empleados || [];
            setRecicladores(todosRec);
            setEmpleados(todosEmp);

            // Cargar préstamos de cada reciclador
            const promesasRec = todosRec.map(r =>
                api.get(`/recicladores/${r.id}/prestamos`)
                    .then(d => (d.prestamos || []).map(p => ({ ...p, tipo: 'reciclador', persona: r.nombre })))
                    .catch(() => [])
            );
            const promesasEmp = todosEmp.map(e =>
                api.get(`/empleados/${e.id}/prestamos`)
                    .then(d => (d.prestamos || []).map(p => ({ ...p, tipo: 'empleado', persona: e.nombre })))
                    .catch(() => [])
            );
            const [resRec, resEmp] = await Promise.all([
                Promise.all(promesasRec),
                Promise.all(promesasEmp)
            ]);
            setPrestamosRec(resRec.flat());
            setPrestamosEmp(resEmp.flat());
        } catch (err) { console.error(err); }
    };

    useEffect(() => { cargar(); }, []);

    const marcarPagado = async (p, pagado) => {
        try {
            if (p.tipo === 'reciclador')
                await api.put(`/recicladores/${p.reciclador_id}/prestamos/${p.id}`, { pagado });
            else
                await api.put(`/empleados/${p.empleado_id}/prestamos/${p.id}`, { descontado: pagado });
            cargar();
        } catch (err) { alert(err.message); }
    };

    const saldoDe = p => parseFloat(p.monto || 0) - parseFloat(p.abonado || 0);

    const abonar = async (p) => {
        const restante = saldoDe(p);
        const entrada = window.prompt(`Abono al préstamo de ${p.persona}\nSaldo pendiente: $${fmt(restante)}\n\n¿Cuánto abona? (déjalo igual al saldo para dejarlo pagado)`, '');
        if (entrada === null) return;
        const monto = parseFloat(String(entrada).replace(/[^\d.]/g, ''));
        if (!monto || monto <= 0) return alert('Monto inválido');
        try {
            const base = p.tipo === 'reciclador' ? `/recicladores/${p.reciclador_id}` : `/empleados/${p.empleado_id}`;
            await api.post(`${base}/prestamos/${p.id}/abono`, { monto });
            cargar();
        } catch (err) { alert(err.message); }
    };

    const todos = [...prestamosRec, ...prestamosEmp];
    const pendientes = todos.filter(p => !p.pagado && !p.descontado);
    const pagados    = todos.filter(p => p.pagado || p.descontado);

    const lista = tab === 'pendientes' ? pendientes : pagados;
    const filtrados = filtroTipo === 'todos' ? lista : lista.filter(p => p.tipo === filtroTipo);

    // Totales por SALDO pendiente (monto − abonado)
    const totalPendRec = prestamosRec.filter(p => !p.pagado && !p.descontado).reduce((s, p) => s + saldoDe(p), 0);
    const totalPendEmp = prestamosEmp.filter(p => !p.pagado && !p.descontado).reduce((s, p) => s + saldoDe(p), 0);

    const Btn = ({ active, onClick, children }) => (
        <button onClick={onClick} style={{ padding: '7px 16px', background: active ? '#1a5c2a' : '#f5f5f5', color: active ? '#fff' : '#555', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {children}
        </button>
    );

    return (
        <div style={{ padding: 24 }}>
            {showModal && <ModalNuevoPrestamo onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); cargar(); }} />}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700 }}>💳 Préstamos</h1>
                    <p style={{ color: '#666', fontSize: 13 }}>Recicladores y empleados con saldo pendiente</p>
                </div>
                <button onClick={() => setShowModal(true)} style={{ padding: '9px 18px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    + Nuevo préstamo
                </button>
            </div>

            {/* Resumen */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 24 }}>
                {[
                    ['💳 Total pendiente', `$${fmt(totalPendRec + totalPendEmp)}`, '#dc2626', '#fef2f2'],
                    ['♻️ Recicladores', `$${fmt(totalPendRec)}`, '#1a5c2a', '#f0faf0'],
                    ['👷 Empleados', `$${fmt(totalPendEmp)}`, '#2563eb', '#eff6ff'],
                    ['📋 Total préstamos', pendientes.length, '#7c3aed', '#f5f3ff'],
                ].map(([t, v, c, bg]) => (
                    <div key={t} style={{ background: bg, borderRadius: 10, padding: 16, borderLeft: `4px solid ${c}` }}>
                        <div style={{ fontSize: 12, color: '#666' }}>{t}</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: c, marginTop: 4 }}>{v}</div>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <Btn active={tab === 'pendientes'} onClick={() => setTab('pendientes')}>⏳ Pendientes ({pendientes.length})</Btn>
                <Btn active={tab === 'pagados'} onClick={() => setTab('pagados')}>✅ Pagados ({pagados.length})</Btn>
                <div style={{ marginLeft: 16, display: 'flex', gap: 6 }}>
                    {[['todos','Todos'],['reciclador','♻️ Recicladores'],['empleado','👷 Empleados']].map(([k,l]) => (
                        <button key={k} onClick={() => setFiltroTipo(k)}
                            style={{ padding: '7px 14px', background: filtroTipo === k ? '#374151' : '#f0f0f0', color: filtroTipo === k ? '#fff' : '#555', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                            {l}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tabla */}
            <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'hidden' }}>
                {filtrados.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>💳</div>
                        No hay préstamos {tab === 'pendientes' ? 'pendientes' : 'pagados'}
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#f0faf0' }}>
                                {['Persona','Tipo','Monto','Fecha','Descripción','Estado','Acción'].map(h => (
                                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtrados.map((p, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{p.persona}</td>
                                    <td style={{ padding: '10px 14px' }}>
                                        <span style={{ background: p.tipo === 'reciclador' ? '#f0faf0' : '#eff6ff', color: p.tipo === 'reciclador' ? '#1a5c2a' : '#2563eb', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                                            {p.tipo === 'reciclador' ? '♻️ Reciclador' : '👷 Empleado'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                        <div style={{ fontWeight: 700, color: '#111' }}>${fmt(p.monto)}</div>
                                        {parseFloat(p.abonado || 0) > 0 && (
                                            <div style={{ fontSize: 11, marginTop: 2 }}>
                                                <span style={{ color: '#059669' }}>Abonado ${fmt(p.abonado)}</span>
                                                {!(p.pagado || p.descontado) && <span style={{ color: '#dc2626', fontWeight: 700 }}> · Saldo ${fmt(saldoDe(p))}</span>}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: '10px 14px', color: '#666' }}>{p.fecha}</td>
                                    <td style={{ padding: '10px 14px', color: '#666' }}>{p.descripcion || '—'}</td>
                                    <td style={{ padding: '10px 14px' }}>
                                        {(p.pagado || p.descontado)
                                            ? <span style={{ background: '#d1fae5', color: '#059669', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>✅ Pagado</span>
                                            : <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>⏳ Pendiente</span>
                                        }
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                        {(p.pagado || p.descontado)
                                            ? <button onClick={() => marcarPagado(p, false)} style={{ padding: '4px 10px', background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>↩ Marcar pendiente</button>
                                            : <div style={{ display: 'flex', gap: 6 }}>
                                                <button onClick={() => abonar(p)} style={{ padding: '4px 10px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>💵 Abonar</button>
                                                <button onClick={() => marcarPagado(p, true)} style={{ padding: '4px 10px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✅ Pagado</button>
                                              </div>
                                        }
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
