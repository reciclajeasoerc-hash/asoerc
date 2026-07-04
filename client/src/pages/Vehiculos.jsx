import React, { useState, useEffect } from 'react';
import { api } from '../api';
import PickerBuscable from '../components/PickerBuscable';

const hoy = () => new Date().toISOString().slice(0, 10);
const primerDiaMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; };
const fmt = n => Number(n || 0).toLocaleString('es-CO');

const TIPO_LABELS = { camion: '🚛 Camión', furgon: '🚐 Furgón', moto: '🏍️ Moto', otro: '🚗 Otro' };
const GASTO_LABELS = { gasolina: '⛽ Gasolina', viatico: '🍽️ Viático', mantenimiento: '🔧 Mantenimiento', otro: '📋 Otro' };
const GASTO_COLORS = { gasolina: '#f59e0b', viatico: '#3b82f6', mantenimiento: '#8b5cf6', otro: '#6b7280' };

function ModalVehiculo({ vehiculo, onClose, onSaved }) {
    const [form, setForm] = useState(vehiculo || { placa: '', descripcion: '', conductor: '', tipo: 'camion' });
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');

    const guardar = async () => {
        if (!form.placa) return setMsg('La placa es requerida');
        setLoading(true);
        try {
            if (vehiculo) await api.put(`/vehiculos/${vehiculo.id}`, form);
            else await api.post('/vehiculos', form);
            onSaved();
        } catch (err) { setMsg(err.message); }
        finally { setLoading(false); }
    };

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{vehiculo ? 'Editar vehículo' : '+ Nuevo vehículo'}</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                    {[['placa','Placa*'],['descripcion','Descripción / Modelo'],['conductor','Conductor habitual']].map(([k,l]) => (
                        <label key={k}>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>{l}</div>
                            <input value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                        </label>
                    ))}
                    <label>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Tipo</div>
                        <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                            {Object.entries(TIPO_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </label>
                </div>
                {msg && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{msg}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <button onClick={guardar} disabled={loading} style={{ flex: 1, padding: '9px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        {loading ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button onClick={onClose} style={{ padding: '9px 16px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                </div>
            </div>
        </div>
    );
}

function ModalGasto({ vehiculo, onClose, onSaved }) {
    const [form, setForm] = useState({ fecha: hoy(), tipo: 'gasolina', monto: '', descripcion: '', km_actual: '' });
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');

    const guardar = async () => {
        if (!form.monto) return setMsg('El monto es requerido');
        setLoading(true);
        try {
            await api.post(`/vehiculos/${vehiculo.id}/gastos`, form);
            onSaved();
        } catch (err) { setMsg(err.message); }
        finally { setLoading(false); }
    };

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Registrar gasto</h3>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>{vehiculo.placa} — {vehiculo.descripcion || ''}</div>
                <div style={{ display: 'grid', gap: 12 }}>
                    <label>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Tipo de gasto</div>
                        <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                            {Object.entries(GASTO_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </label>
                    <label>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Fecha</div>
                        <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                    </label>
                    <label>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Monto ($)*</div>
                        <input type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                    </label>
                    <label>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Descripción</div>
                        <input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                    </label>
                    <label>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Km actuales (opcional)</div>
                        <input type="number" value={form.km_actual} onChange={e => setForm({ ...form, km_actual: e.target.value })}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                    </label>
                </div>
                {msg && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{msg}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <button onClick={guardar} disabled={loading} style={{ flex: 1, padding: '9px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        {loading ? 'Guardando...' : 'Registrar gasto'}
                    </button>
                    <button onClick={onClose} style={{ padding: '9px 16px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                </div>
            </div>
        </div>
    );
}

export default function Vehiculos() {
    const [vehiculos, setVehiculos] = useState([]);
    const [gastos, setGastos] = useState([]);
    const [seleccionado, setSeleccionado] = useState(null);
    const [modalVehiculo, setModalVehiculo] = useState(null); // null | 'nuevo' | vehiculo
    const [modalGasto, setModalGasto] = useState(null);
    const [desde, setDesde] = useState(primerDiaMes());
    const [hasta, setHasta] = useState(hoy());
    const [filtroVehiculo, setFiltroVehiculo] = useState('');

    const cargarVehiculos = () => api.get('/vehiculos').then(d => setVehiculos(d.vehiculos || [])).catch(() => {});
    const cargarGastos = () => {
        const params = new URLSearchParams({ desde, hasta });
        if (filtroVehiculo) params.append('vehiculo_id', filtroVehiculo);
        if (seleccionado) params.append('vehiculo_id', seleccionado.id);
        api.get(`/vehiculos/gastos?${params}`).then(d => setGastos(d.gastos || [])).catch(() => {});
    };

    useEffect(() => { cargarVehiculos(); }, []);
    useEffect(() => { cargarGastos(); }, [seleccionado, desde, hasta, filtroVehiculo]);

    const totalGastos = gastos.reduce((s, g) => s + parseFloat(g.monto || 0), 0);
    const gastosPorTipo = gastos.reduce((acc, g) => { acc[g.tipo] = (acc[g.tipo] || 0) + parseFloat(g.monto || 0); return acc; }, {});

    const eliminarGasto = async (vid, gid) => {
        if (!confirm('¿Eliminar este gasto?')) return;
        await api.delete(`/vehiculos/${vid}/gastos/${gid}`).catch(() => {});
        cargarGastos();
    };

    return (
        <div style={{ padding: 24 }}>
            {modalVehiculo && (
                <ModalVehiculo
                    vehiculo={modalVehiculo === 'nuevo' ? null : modalVehiculo}
                    onClose={() => setModalVehiculo(null)}
                    onSaved={() => { cargarVehiculos(); setModalVehiculo(null); }}
                />
            )}
            {modalGasto && (
                <ModalGasto
                    vehiculo={modalGasto}
                    onClose={() => setModalGasto(null)}
                    onSaved={() => { cargarGastos(); setModalGasto(null); }}
                />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700 }}>🚛 Vehículos</h1>
                    <p style={{ color: '#666', fontSize: 13 }}>Camiones, gastos de gasolina y viáticos</p>
                </div>
                <button onClick={() => setModalVehiculo('nuevo')} style={{ padding: '9px 18px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    + Nuevo vehículo
                </button>
            </div>

            {/* Tarjetas de vehículos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12, marginBottom: 24 }}>
                {vehiculos.map(v => (
                    <div key={v.id} onClick={() => setSeleccionado(seleccionado?.id === v.id ? null : v)}
                        style={{ background: seleccionado?.id === v.id ? '#f0faf0' : '#fff', borderRadius: 10, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,.08)', cursor: 'pointer', border: seleccionado?.id === v.id ? '2px solid #1a5c2a' : '2px solid transparent', transition: 'all .15s' }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>{v.tipo === 'camion' ? '🚛' : v.tipo === 'furgon' ? '🚐' : v.tipo === 'moto' ? '🏍️' : '🚗'}</div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a1a' }}>{v.placa}</div>
                        {v.descripcion && <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{v.descripcion}</div>}
                        {v.conductor && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>👤 {v.conductor}</div>}
                        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                            <button onClick={e => { e.stopPropagation(); setModalGasto(v); }}
                                style={{ flex: 1, padding: '6px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                ⛽ Gasto
                            </button>
                            <button onClick={e => { e.stopPropagation(); setModalVehiculo(v); }}
                                style={{ padding: '6px 10px', background: '#f0f0f0', border: 'none', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}>
                                ✏️
                            </button>
                        </div>
                    </div>
                ))}
                {vehiculos.length === 0 && (
                    <div style={{ gridColumn: '1/-1', background: '#fff', borderRadius: 10, padding: 40, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                        <div style={{ fontSize: 40 }}>🚛</div>
                        <p style={{ color: '#999', marginTop: 12, fontSize: 13 }}>No hay vehículos registrados</p>
                    </div>
                )}
            </div>

            {/* Filtros de gastos */}
            <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,.08)', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Desde</div>
                    <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                </div>
                <div>
                    <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Hasta</div>
                    <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                </div>
                {!seleccionado && (
                    <div>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Vehículo</div>
                        <PickerBuscable
                            items={vehiculos}
                            value={filtroVehiculo}
                            onChange={setFiltroVehiculo}
                            getLabel={v => v.placa}
                            placeholder="Buscar placa..."
                            fontSize={13}
                        />
                    </div>
                )}
                <div style={{ fontSize: 13, color: '#555', paddingBottom: 2 }}>
                    {seleccionado && <span style={{ background: '#f0faf0', color: '#1a5c2a', padding: '4px 10px', borderRadius: 20, fontWeight: 600 }}>📌 {seleccionado.placa} — <button onClick={() => setSeleccionado(null)} style={{ background: 'none', border: 'none', color: '#1a5c2a', cursor: 'pointer', fontWeight: 700 }}>✕</button></span>}
                </div>
            </div>

            {/* Resumen de gastos */}
            {gastos.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 16 }}>
                    <div style={{ background: '#fff', borderRadius: 8, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,.08)', borderLeft: '4px solid #1a5c2a' }}>
                        <div style={{ fontSize: 12, color: '#666' }}>Total gastos</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#1a5c2a' }}>${fmt(totalGastos)}</div>
                    </div>
                    {Object.entries(gastosPorTipo).map(([tipo, monto]) => (
                        <div key={tipo} style={{ background: '#fff', borderRadius: 8, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,.08)', borderLeft: `4px solid ${GASTO_COLORS[tipo] || '#6b7280'}` }}>
                            <div style={{ fontSize: 12, color: '#666' }}>{GASTO_LABELS[tipo]}</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: GASTO_COLORS[tipo] || '#6b7280' }}>${fmt(monto)}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Tabla de gastos */}
            <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', fontWeight: 600, fontSize: 14 }}>
                    Gastos registrados ({gastos.length})
                </div>
                {gastos.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: '#999', fontSize: 13 }}>No hay gastos en este período</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#f0faf0' }}>
                                {['Fecha','Vehículo','Tipo','Monto','Descripción','Km',''].map(h => (
                                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {gastos.map(g => (
                                <tr key={g.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                    <td style={{ padding: '9px 14px', color: '#666' }}>{g.fecha}</td>
                                    <td style={{ padding: '9px 14px', fontWeight: 600 }}>{g.vehiculo?.placa || '—'}</td>
                                    <td style={{ padding: '9px 14px' }}>
                                        <span style={{ background: `${GASTO_COLORS[g.tipo]}20`, color: GASTO_COLORS[g.tipo] || '#666', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
                                            {GASTO_LABELS[g.tipo] || g.tipo}
                                        </span>
                                    </td>
                                    <td style={{ padding: '9px 14px', fontWeight: 700, color: '#1a5c2a' }}>${fmt(g.monto)}</td>
                                    <td style={{ padding: '9px 14px', color: '#666' }}>{g.descripcion || '—'}</td>
                                    <td style={{ padding: '9px 14px', color: '#888' }}>{g.km_actual ? `${g.km_actual.toLocaleString()} km` : '—'}</td>
                                    <td style={{ padding: '9px 14px' }}>
                                        <button onClick={() => eliminarGasto(g.vehiculo_id, g.id)}
                                            style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>
                                            🗑️
                                        </button>
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
