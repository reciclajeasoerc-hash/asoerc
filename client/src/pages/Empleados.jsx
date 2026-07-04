import React, { useState, useEffect } from 'react';
import { api } from '../api';

const fmt = n => Number(n || 0).toLocaleString('es-CO');
const hoy = () => new Date().toISOString().slice(0, 10);

export default function Empleados() {
    const [empleados, setEmpleados] = useState([]);
    const [busquedaEmp, setBusquedaEmp] = useState('');
    const [bodegas, setBodegas] = useState([]);
    const [selected, setSelected] = useState(null);
    const [tab, setTab] = useState('prestamos');
    const [prestamos, setPrestamos] = useState([]);
    const [dias, setDias] = useState([]);
    const [showEmp, setShowEmp] = useState(false);
    const [editando, setEditando] = useState(null);
    const [showP, setShowP] = useState(false);
    const [showD, setShowD] = useState(false);
    const [form, setForm] = useState({ nombre: '', cedula: '', telefono: '', bodega_id: '', cargo: '', salario: '', tipo_salario: 'dia' });
    const [nForm, setNForm] = useState({ desde: '', hasta: hoy(), dias_periodo: '15', tipo: 'dia' });
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
        setNForm(f => ({ ...f, tipo: e.tipo_salario || 'dia' }));
        const [p, d] = await Promise.all([
            api.get(`/empleados/${e.id}/prestamos`).catch(() => ({ prestamos: [] })),
            api.get(`/empleados/${e.id}/dias-no-laborados`).catch(() => ({ dias: [] }))
        ]);
        setPrestamos(p.prestamos || []);
        setDias(d.dias || []);
    };

    // ── Cálculo de liquidación de nómina (en el rango elegido) ────────────────
    const salarioBase   = parseFloat(selected?.salario || 0);
    const diasPeriodo   = parseFloat(nForm.dias_periodo || 0);
    const valorDia      = nForm.tipo === 'dia' ? salarioBase : (diasPeriodo ? salarioBase / diasPeriodo : 0);
    const diasNoLab     = dias
        .filter(d => (!nForm.desde || d.fecha_inicio >= nForm.desde) && (!nForm.hasta || d.fecha_inicio <= nForm.hasta))
        .reduce((s, d) => s + parseFloat(d.dias || 0), 0);
    const diasPagados   = Math.max(0, diasPeriodo - diasNoLab);
    const sueldoBruto   = nForm.tipo === 'dia' ? diasPagados * valorDia : Math.max(0, salarioBase - diasNoLab * valorDia);
    const saldoDe = p => parseFloat(p.monto || 0) - parseFloat(p.abonado || 0);
    const prestamosPend = prestamos.filter(p => !p.descontado);
    const totalPrestamos = prestamosPend.reduce((s, p) => s + saldoDe(p), 0);
    const netoPagar     = sueldoBruto - totalPrestamos;

    const registrarNomina = async () => {
        if (!selected) return;
        if (!window.confirm(`¿Registrar el pago de nómina de ${selected.nombre}?\nNeto a pagar: $${fmt(netoPagar)}\nSe marcarán ${prestamosPend.length} préstamo(s) como descontados.`)) return;
        try {
            for (const p of prestamosPend) {
                await api.put(`/empleados/${selected.id}/prestamos/${p.id}`, { descontado: true });
            }
            await seleccionar(selected);
            setMsg('');
            alert(`Nómina registrada. Neto pagado: $${fmt(netoPagar)}`);
        } catch (err) { setMsg(err.message); }
    };

    const nuevoEmpleado = () => {
        setEditando(null);
        setForm({ nombre: '', cedula: '', telefono: '', bodega_id: '', cargo: '', salario: '', tipo_salario: 'dia' });
        setMsg('');
        setShowEmp(s => !s);
    };

    const editarEmpleado = (e) => {
        setEditando(e.id);
        setForm({ nombre: e.nombre || '', cedula: e.cedula || '', telefono: e.telefono || '', bodega_id: e.bodega_id || '', cargo: e.cargo || '', salario: e.salario || '', tipo_salario: e.tipo_salario || 'dia' });
        setMsg('');
        setShowEmp(true);
    };

    const guardarEmpleado = async () => {
        if (!form.nombre) return setMsg('Nombre requerido');
        try {
            if (editando) await api.put(`/empleados/${editando}`, form);
            else await api.post('/empleados', form);
            setShowEmp(false); setEditando(null); setMsg('');
            setForm({ nombre: '', cedula: '', telefono: '', bodega_id: '', cargo: '', salario: '', tipo_salario: 'dia' });
            const actualizados = await api.get('/empleados').then(d => d.empleados).catch(() => empleados);
            setEmpleados(actualizados);
            if (selected && editando === selected.id) {
                const nuevo = actualizados.find(x => x.id === selected.id);
                if (nuevo) { setSelected(nuevo); setNForm(f => ({ ...f, tipo: nuevo.tipo_salario || 'dia' })); }
            }
        }
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

    const togglePrestamo = async (p) => {
        try {
            await api.put(`/empleados/${selected.id}/prestamos/${p.id}`, { descontado: !p.descontado });
            seleccionar(selected);
        } catch (err) { setMsg(err.message); }
    };

    const abonarPrestamoEmp = async (p) => {
        const restante = parseFloat(p.monto || 0) - parseFloat(p.abonado || 0);
        const entrada = window.prompt(`Abono al préstamo\nSaldo pendiente: $${fmt(restante)}\n\n¿Cuánto abona?`, '');
        if (entrada === null) return;
        const monto = parseFloat(String(entrada).replace(/[^\d.]/g, ''));
        if (!monto || monto <= 0) return setMsg('Monto de abono inválido');
        try {
            await api.post(`/empleados/${selected.id}/prestamos/${p.id}/abono`, { monto });
            seleccionar(selected);
        } catch (err) { setMsg(err.message); }
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
                <button onClick={nuevoEmpleado} style={{ padding: '9px 18px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>+ Nuevo</button>
            </div>

            {showEmp && (
                <div style={{ background: '#fff', borderRadius: 10, padding: 20, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{editando ? '✏️ Editar empleado' : '👷 Nuevo empleado'}</h3>
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
                        <label>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Tipo de salario</div>
                            <select value={form.tipo_salario} onChange={e => setForm({ ...form, tipo_salario: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                <option value="dia">Por día (jornal)</option>
                                <option value="completo">Sueldo completo del periodo</option>
                            </select>
                        </label>
                    </div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
                        💡 En <strong>Salario</strong> escribe el valor de <strong>un día</strong> si elegiste "Por día", o el <strong>total del periodo</strong> (ej: la quincena) si elegiste "Sueldo completo".
                    </div>
                    {msg && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{msg}</div>}
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                        <button onClick={guardarEmpleado} style={{ padding: '8px 20px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13 }}>{editando ? 'Actualizar' : 'Guardar'}</button>
                        <button onClick={() => { setShowEmp(false); setEditando(null); }} style={{ padding: '8px 16px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 13 }}>Cancelar</button>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 20 }}>
                <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', opacity: .6, fontSize: 13, pointerEvents: 'none' }}>🔍</span>
                        <input value={busquedaEmp} onChange={e => setBusquedaEmp(e.target.value)} placeholder="Buscar empleado por nombre o cargo..."
                            style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead><tr style={{ background: '#f0faf0' }}>
                            {['Nombre','Cargo','Bodega',''].map(h => <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                            {empleados.filter(e => !busquedaEmp.trim() || `${e.nombre || ''} ${e.cargo || ''} ${e.cedula || ''}`.toLowerCase().includes(busquedaEmp.trim().toLowerCase())).map(e => (
                                <tr key={e.id} onClick={() => seleccionar(e)} style={{ borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: selected?.id === e.id ? '#f0faf0' : 'transparent' }}>
                                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{e.nombre}</td>
                                    <td style={{ padding: '10px 12px', color: '#666' }}>{e.cargo}</td>
                                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#888' }}>{e.bodega?.nombre}</td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button onClick={ev => { ev.stopPropagation(); seleccionar(e); }} style={{ padding: '4px 10px', background: '#e0f2e9', color: '#1a5c2a', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Ver</button>
                                            <button onClick={ev => { ev.stopPropagation(); editarEmpleado(e); }} style={{ padding: '4px 10px', background: '#fef3c7', color: '#d97706', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Editar</button>
                                        </div>
                                    </td>
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
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                            <Btn active={tab === 'prestamos'} onClick={() => setTab('prestamos')}>💰 Préstamos</Btn>
                            <Btn active={tab === 'dias'} onClick={() => setTab('dias')}>📅 Días no laborados</Btn>
                            <Btn active={tab === 'nomina'} onClick={() => setTab('nomina')}>💵 Nómina</Btn>
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
                                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                                        <div>
                                            <div><span style={{ fontWeight: 600 }}>${fmt(p.monto)}</span> <span style={{ color: '#888', fontSize: 12 }}>{p.descripcion}</span></div>
                                            {parseFloat(p.abonado || 0) > 0 && (
                                                <div style={{ fontSize: 11, marginTop: 2 }}>
                                                    <span style={{ color: '#059669' }}>Abonado ${fmt(p.abonado)}</span>
                                                    {!p.descontado && <span style={{ color: '#dc2626', fontWeight: 700 }}> · Saldo ${fmt(saldoDe(p))}</span>}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                            <span style={{ color: '#888', fontSize: 12 }}>{p.quincena}</span>
                                            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: p.descontado ? '#d1fae5' : '#fee2e2', color: p.descontado ? '#059669' : '#dc2626' }}>{p.descontado ? 'Descontado' : 'Pendiente'}</span>
                                            {!p.descontado && (
                                                <button onClick={() => abonarPrestamoEmp(p)} title="Registrar un abono (pago parcial)"
                                                    style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb' }}>💵 Abonar</button>
                                            )}
                                            <button onClick={() => togglePrestamo(p)} title={p.descontado ? 'Marcar como pendiente' : 'Marcar como pagado / descontado'}
                                                style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: p.descontado ? '1px solid #e5e7eb' : 'none', background: p.descontado ? '#f3f4f6' : '#1a5c2a', color: p.descontado ? '#6b7280' : '#fff' }}>
                                                {p.descontado ? '↩' : '✅ Pagar'}
                                            </button>
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

                        {tab === 'nomina' && (
                            <>
                                <div style={{ background: '#f0faf0', border: '1px solid #cfe8d4', borderRadius: 8, padding: 12, marginBottom: 14 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                                        <label>
                                            <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>Desde</div>
                                            <input type="date" value={nForm.desde} onChange={e => setNForm({ ...nForm, desde: e.target.value })} style={{ width: '100%', padding: '7px', borderRadius: 6, border: '1px solid #cfe8d4', fontSize: 13, boxSizing: 'border-box' }} />
                                        </label>
                                        <label>
                                            <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>Hasta</div>
                                            <input type="date" value={nForm.hasta} onChange={e => setNForm({ ...nForm, hasta: e.target.value })} style={{ width: '100%', padding: '7px', borderRadius: 6, border: '1px solid #cfe8d4', fontSize: 13, boxSizing: 'border-box' }} />
                                        </label>
                                        <label>
                                            <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>Días del periodo</div>
                                            <input type="number" step="0.5" min="0" value={nForm.dias_periodo} onChange={e => setNForm({ ...nForm, dias_periodo: e.target.value })} style={{ width: '100%', padding: '7px', borderRadius: 6, border: '1px solid #cfe8d4', fontSize: 13, boxSizing: 'border-box' }} />
                                        </label>
                                        <label>
                                            <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>Cómo se paga</div>
                                            <select value={nForm.tipo} onChange={e => setNForm({ ...nForm, tipo: e.target.value })} style={{ width: '100%', padding: '7px', borderRadius: 6, border: '1px solid #cfe8d4', fontSize: 13, boxSizing: 'border-box' }}>
                                                <option value="dia">Por día (jornal)</option>
                                                <option value="completo">Sueldo completo</option>
                                            </select>
                                        </label>
                                    </div>
                                    <div style={{ fontSize: 11, color: '#888' }}>
                                        Salario registrado: <strong>${fmt(salarioBase)}</strong> {nForm.tipo === 'dia' ? 'por día' : 'por periodo'} · Valor día: <strong>${fmt(Math.round(valorDia))}</strong>
                                    </div>
                                </div>

                                {[
                                    ['Días del periodo', diasPeriodo, '#374151'],
                                    ['Días no laborados', `− ${diasNoLab}`, '#dc2626'],
                                    ['Días pagados', diasPagados, '#059669'],
                                    ['Sueldo bruto', `$${fmt(Math.round(sueldoBruto))}`, '#111'],
                                    [`Préstamos pendientes (${prestamosPend.length})`, `− $${fmt(Math.round(totalPrestamos))}`, '#dc2626'],
                                ].map(([l, v, c]) => (
                                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                                        <span style={{ color: '#555' }}>{l}</span>
                                        <span style={{ fontWeight: 600, color: c }}>{v}</span>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, background: '#1a5c2a', borderRadius: 8, padding: '12px 16px' }}>
                                    <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>NETO A PAGAR</span>
                                    <span style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>${fmt(Math.round(netoPagar))}</span>
                                </div>
                                <button onClick={registrarNomina} disabled={!salarioBase}
                                    style={{ width: '100%', marginTop: 12, padding: '11px', background: salarioBase ? '#d97706' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: salarioBase ? 'pointer' : 'default' }}>
                                    💵 Registrar pago y descontar préstamos
                                </button>
                                {!salarioBase && <div style={{ fontSize: 12, color: '#d97706', marginTop: 8, textAlign: 'center' }}>⚠️ Este empleado no tiene salario registrado. Edítalo con el botón + Nuevo o desde su ficha.</div>}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
