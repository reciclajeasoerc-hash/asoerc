import React, { useState, useEffect } from 'react';
import { api } from '../api';

const fmt = n => Number(n || 0).toLocaleString('es-CO');
const hoy = () => new Date().toISOString().slice(0, 10);

export default function Ventas() {
    const [ventas, setVentas] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [materiales, setMateriales] = useState([]);
    const [bodegas, setBodegas] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ cliente_id: '', sede_id: '', bodega_id: '', fecha: hoy(), tipo_pago: 'pendiente', observaciones: '' });
    const [items, setItems] = useState([]);
    const [itemForm, setItemForm] = useState({ material_id: '', kilos: '', precio_unitario: '' });
    const [sedes, setSedes] = useState([]);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        Promise.all([
            api.get('/clientes').then(d => setClientes(d.clientes)),
            api.get('/materiales').then(d => setMateriales(d.materiales)),
            api.get('/bodegas').then(d => { setBodegas(d.bodegas); if (d.bodegas[0]) setForm(f => ({ ...f, bodega_id: d.bodegas[0].id })); })
        ]).catch(() => {});
        cargar();
    }, []);

    const cargar = () => api.get('/ventas').then(d => setVentas(d.items || [])).catch(() => {});

    const clienteChange = (id) => {
        const c = clientes.find(c => c.id === parseInt(id));
        setForm(f => ({ ...f, cliente_id: id, sede_id: '' }));
        setSedes(c?.sedes || []);
    };

    const agregarItem = () => {
        if (!itemForm.material_id || !itemForm.kilos) return;
        const mat = materiales.find(m => m.id === parseInt(itemForm.material_id));
        const cliente = clientes.find(c => c.id === parseInt(form.cliente_id));
        const precioEsp = cliente?.precios?.find(p => p.material_id === parseInt(itemForm.material_id));
        const precio = itemForm.precio_unitario || (precioEsp ? precioEsp.precio : mat?.precio_compra) || 0;
        setItems([...items, { material_id: itemForm.material_id, material_nombre: mat?.nombre, kilos: parseFloat(itemForm.kilos), precio_unitario: parseFloat(precio), total: parseFloat(itemForm.kilos) * parseFloat(precio) }]);
        setItemForm({ material_id: '', kilos: '', precio_unitario: '' });
    };

    const guardar = async () => {
        if (!form.cliente_id || !form.bodega_id || !items.length) return setMsg('Completa cliente, bodega y al menos un material');
        try {
            await api.post('/ventas', { ...form, items });
            setForm({ cliente_id: '', sede_id: '', bodega_id: bodegas[0]?.id || '', fecha: hoy(), tipo_pago: 'pendiente', observaciones: '' });
            setItems([]); setShowForm(false); setMsg(''); cargar();
        } catch (err) { setMsg(err.message); }
    };

    const cambiarEstado = async (id, estado, tipo_pago) => {
        await api.put(`/ventas/${id}/estado`, { estado, tipo_pago });
        cargar();
    };

    const estadoColor = { orden: ['#fef3c7','#d97706'], facturada: ['#eff6ff','#2563eb'], pagada: ['#d1fae5','#059669'] };

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700 }}>📤 Ventas de Material</h1>
                    <p style={{ color: '#666', fontSize: 13 }}>Órdenes de compra y despacho a clientes</p>
                </div>
                <button onClick={() => setShowForm(!showForm)} style={{ padding: '9px 18px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>+ Nueva Orden</button>
            </div>

            {showForm && (
                <div style={{ background: '#fff', borderRadius: 10, padding: 20, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Nueva Orden de Compra</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                        <label>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Cliente*</div>
                            <select value={form.cliente_id} onChange={e => clienteChange(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                <option value="">-- Selecciona --</option>
                                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </label>
                        <label>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Sede</div>
                            <select value={form.sede_id} onChange={e => setForm({ ...form, sede_id: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                <option value="">-- Sin sede --</option>
                                {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                            </select>
                        </label>
                        <label>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Bodega*</div>
                            <select value={form.bodega_id} onChange={e => setForm({ ...form, bodega_id: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                            </select>
                        </label>
                        <label>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Fecha</div>
                            <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                        </label>
                        <label>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Pago</div>
                            <select value={form.tipo_pago} onChange={e => setForm({ ...form, tipo_pago: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                <option value="pendiente">Pendiente</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="transferencia">Transferencia</option>
                            </select>
                        </label>
                    </div>

                    <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                            <select value={itemForm.material_id} onChange={e => setItemForm({ ...itemForm, material_id: e.target.value })} style={{ flex: 2, padding: '7px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                <option value="">-- Material --</option>
                                {materiales.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                            </select>
                            <input type="number" placeholder="Kg" value={itemForm.kilos} onChange={e => setItemForm({ ...itemForm, kilos: e.target.value })} style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                            <input type="number" placeholder="Precio/kg" value={itemForm.precio_unitario} onChange={e => setItemForm({ ...itemForm, precio_unitario: e.target.value })} style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                            <button onClick={agregarItem} style={{ padding: '7px 14px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14 }}>+</button>
                        </div>
                        {items.map((item, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: 13 }}>
                                <span>{item.material_nombre} — {item.kilos} kg × ${fmt(item.precio_unitario)}</span>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <span style={{ fontWeight: 600 }}>${fmt(item.total)}</span>
                                    <button onClick={() => setItems(items.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>✕</button>
                                </div>
                            </div>
                        ))}
                        {items.length > 0 && <div style={{ textAlign: 'right', fontWeight: 700, marginTop: 8, color: '#1a5c2a' }}>Total: ${fmt(items.reduce((s, i) => s + i.total, 0))}</div>}
                    </div>

                    {msg && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{msg}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={guardar} style={{ padding: '9px 20px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>Crear Orden</button>
                        <button onClick={() => { setShowForm(false); setItems([]); }} style={{ padding: '9px 16px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 13 }}>Cancelar</button>
                    </div>
                </div>
            )}

            <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr style={{ background: '#f0faf0' }}>
                        {['#','Cliente','Fecha','Total','Pago','Estado','Acciones'].map(h => <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                        {ventas.map(v => {
                            const [bg, clr] = estadoColor[v.estado] || ['#f5f5f5','#666'];
                            return (
                                <tr key={v.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                    <td style={{ padding: '10px 12px' }}>{v.numero}</td>
                                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{v.cliente?.nombre}</td>
                                    <td style={{ padding: '10px 12px', color: '#666' }}>{v.fecha}</td>
                                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1a5c2a' }}>${fmt(v.total)}</td>
                                    <td style={{ padding: '10px 12px', color: '#666' }}>{v.tipo_pago}</td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: bg, color: clr }}>{v.estado}</span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            {v.estado === 'orden' && <button onClick={() => cambiarEstado(v.id, 'facturada')} style={{ padding: '3px 8px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 4, fontSize: 11 }}>Facturar</button>}
                                            {v.estado === 'facturada' && <button onClick={() => cambiarEstado(v.id, 'pagada', 'efectivo')} style={{ padding: '3px 8px', background: '#d1fae5', color: '#059669', border: 'none', borderRadius: 4, fontSize: 11 }}>Marcar pagada</button>}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {ventas.length === 0 && <p style={{ color: '#999', textAlign: 'center', padding: 20, fontSize: 13 }}>No hay ventas registradas</p>}
            </div>
        </div>
    );
}
