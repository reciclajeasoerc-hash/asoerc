import React, { useState, useEffect } from 'react';
import { api } from '../api';

const fmt = n => Number(n || 0).toLocaleString('es-CO');
const hoy = () => new Date().toISOString().slice(0, 10);

export default function Compras() {
    const [compras, setCompras] = useState([]);
    const [materiales, setMateriales] = useState([]);
    const [recicladores, setRecicladores] = useState([]);
    const [bodegas, setBodegas] = useState([]);
    const [resumen, setResumen] = useState(null);
    const [compraActiva, setCompraActiva] = useState(null);
    const [filtros, setFiltros] = useState({ fecha: hoy(), bodega_id: '' });
    const [form, setForm] = useState({ reciclador_id: '', bodega_id: '', fecha: hoy() });
    const [itemForm, setItemForm] = useState({ material_id: '', kilos: '' });
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        Promise.all([
            api.get('/materiales').then(d => setMateriales(d.materiales)),
            api.get('/recicladores').then(d => setRecicladores(d.recicladores)),
            api.get('/bodegas').then(d => { setBodegas(d.bodegas); if (d.bodegas[0]) setForm(f => ({ ...f, bodega_id: d.bodegas[0].id })); })
        ]).catch(() => {});
        cargar();
    }, []);

    const cargar = async () => {
        const q = new URLSearchParams(filtros).toString();
        const [c, r] = await Promise.all([
            api.get(`/compras?${q}`).catch(() => ({ items: [] })),
            api.get(`/compras/resumen-dia?${q}`).catch(() => null)
        ]);
        setCompras(c.items || []);
        setResumen(r);
    };

    useEffect(() => { cargar(); }, [filtros]);

    const crearCompra = async () => {
        if (!form.reciclador_id || !form.bodega_id) return setMsg('Selecciona reciclador y bodega');
        setLoading(true);
        try {
            const d = await api.post('/compras', form);
            setCompraActiva(d.compra);
            setMsg('');
            cargar();
        } catch (err) { setMsg(err.message); }
        finally { setLoading(false); }
    };

    const agregarItem = async () => {
        if (!itemForm.material_id || !itemForm.kilos) return setMsg('Completa material y kilos');
        setLoading(true);
        try {
            const d = await api.post(`/compras/${compraActiva.id}/items`, itemForm);
            setCompraActiva(d.compra);
            setItemForm({ material_id: '', kilos: '' });
            setMsg('');
        } catch (err) { setMsg(err.message); }
        finally { setLoading(false); }
    };

    const quitarItem = async (item_id) => {
        const d = await api.delete(`/compras/${compraActiva.id}/items/${item_id}`);
        setCompraActiva(d.compra);
    };

    const finalizar = async () => {
        if (!window.confirm('¿Finalizar y enviar WhatsApp al reciclador?')) return;
        setLoading(true);
        try {
            const d = await api.post(`/compras/${compraActiva.id}/finalizar`, {});
            setCompraActiva(null);
            setMsg('✅ Compra finalizada' + (d.compra?.whatsapp_enviado ? ' y WhatsApp enviado' : ''));
            cargar();
        } catch (err) { setMsg(err.message); }
        finally { setLoading(false); }
    };

    const cancelar = async () => {
        if (!window.confirm('¿Cancelar esta compra?')) return;
        await api.delete(`/compras/${compraActiva.id}`);
        setCompraActiva(null);
        cargar();
    };

    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>⚖️ Compras de Material</h1>
            <p style={{ color: '#666', fontSize: 13, marginBottom: 20 }}>Registro de material comprado a recicladores</p>

            {/* Resumen del día */}
            {resumen && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                    {[
                        ['Compras hoy', resumen.totalCompras, ''],
                        ['Kg ingresados', Number(resumen.totalKilos).toFixed(1) + ' kg', ''],
                        ['Total bruto', `$${fmt(resumen.totalPesos)}`, ''],
                        ['Neto pagado', `$${fmt(resumen.totalNeto)}`, ''],
                    ].map(([t, v]) => (
                        <div key={t} style={{ background: '#fff', borderRadius: 8, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,.08)', borderLeft: '4px solid #1a5c2a' }}>
                            <div style={{ fontSize: 12, color: '#666' }}>{t}</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#1a5c2a' }}>{v}</div>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: compraActiva ? '1fr 1fr' : '1fr', gap: 20 }}>
                {/* Panel izquierdo: nueva compra o lista */}
                <div>
                    {!compraActiva ? (
                        <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)', marginBottom: 20 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Nueva Compra</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                                <select value={form.reciclador_id} onChange={e => setForm({ ...form, reciclador_id: e.target.value })}
                                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                    <option value="">-- Reciclador --</option>
                                    {recicladores.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                                </select>
                                <select value={form.bodega_id} onChange={e => setForm({ ...form, bodega_id: e.target.value })}
                                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                    <option value="">-- Bodega --</option>
                                    {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                                </select>
                            </div>
                            <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}
                                style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, marginBottom: 10, width: '100%' }} />
                            {msg && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{msg}</div>}
                            <button onClick={crearCompra} disabled={loading}
                                style={{ width: '100%', padding: '10px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600 }}>
                                {loading ? 'Abriendo...' : 'Abrir Cuenta'}
                            </button>
                        </div>
                    ) : (
                        <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                <div>
                                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1a5c2a' }}>{compraActiva.reciclador?.nombre}</h3>
                                    <div style={{ fontSize: 12, color: '#666' }}>{compraActiva.bodega?.nombre}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={cancelar} style={{ padding: '6px 12px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, fontSize: 12 }}>Cancelar</button>
                                    <button onClick={finalizar} style={{ padding: '6px 12px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>✅ Finalizar</button>
                                </div>
                            </div>

                            {/* Agregar item */}
                            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                                <select value={itemForm.material_id} onChange={e => setItemForm({ ...itemForm, material_id: e.target.value })}
                                    style={{ flex: 2, padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                    <option value="">-- Material --</option>
                                    {materiales.map(m => <option key={m.id} value={m.id}>{m.nombre} (${fmt(m.precio_compra)}/kg)</option>)}
                                </select>
                                <input type="number" placeholder="Kg" value={itemForm.kilos} onChange={e => setItemForm({ ...itemForm, kilos: e.target.value })} min="0" step="0.001"
                                    style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                                <button onClick={agregarItem} style={{ padding: '8px 14px', background: '#2d7a3f', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13 }}>+</button>
                            </div>

                            {/* Items */}
                            {compraActiva.items?.map(item => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 14 }}>
                                    <div>
                                        <span style={{ fontWeight: 600 }}>{item.material?.nombre}</span>
                                        <span style={{ color: '#666', marginLeft: 8 }}>{parseFloat(item.kilos).toFixed(2)} kg</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span style={{ fontWeight: 600, color: '#1a5c2a' }}>${fmt(item.total)}</span>
                                        <button onClick={() => quitarItem(item.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 16, cursor: 'pointer' }}>✕</button>
                                    </div>
                                </div>
                            ))}

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, padding: '12px 0', borderTop: '2px solid #e5e7eb', fontWeight: 700, fontSize: 16 }}>
                                <span>Total</span>
                                <span style={{ color: '#1a5c2a' }}>${fmt(compraActiva.total)}</span>
                            </div>
                        </div>
                    )}

                    {/* Filtros y lista */}
                    <div style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                            <input type="date" value={filtros.fecha} onChange={e => setFiltros({ ...filtros, fecha: e.target.value })}
                                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                            <select value={filtros.bodega_id} onChange={e => setFiltros({ ...filtros, bodega_id: e.target.value })}
                                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                <option value="">Todas las bodegas</option>
                                {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                            </select>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: '#f0faf0' }}>
                                    {['#','Reciclador','Total','Neto','Estado','WA'].map(h => (
                                        <th key={h} style={{ padding: '8px', textAlign: 'left', fontWeight: 600, color: '#1a5c2a', borderBottom: '2px solid #e5e7eb' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {compras.map(c => (
                                    <tr key={c.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                        <td style={{ padding: '8px' }}>{c.numero}</td>
                                        <td style={{ padding: '8px', fontWeight: 600 }}>{c.reciclador?.nombre}</td>
                                        <td style={{ padding: '8px' }}>${fmt(c.total)}</td>
                                        <td style={{ padding: '8px', color: '#1a5c2a', fontWeight: 600 }}>${fmt(c.neto)}</td>
                                        <td style={{ padding: '8px' }}>
                                            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: c.estado === 'finalizada' ? '#d1fae5' : '#fef3c7', color: c.estado === 'finalizada' ? '#059669' : '#d97706' }}>
                                                {c.estado}
                                            </span>
                                        </td>
                                        <td style={{ padding: '8px' }}>{c.whatsapp_enviado ? '✅' : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {compras.length === 0 && <p style={{ color: '#999', textAlign: 'center', padding: 20, fontSize: 13 }}>No hay compras para este filtro</p>}
                    </div>
                </div>

                {/* Panel derecho: resumen por material */}
                {resumen && compraActiva === null && (
                    <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)', height: 'fit-content' }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#1a5c2a' }}>Resumen por material — hoy</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: '#f0faf0' }}>
                                    <th style={{ padding: '6px 8px', textAlign: 'left', color: '#1a5c2a' }}>Material</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'right', color: '#1a5c2a' }}>Kg</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'right', color: '#1a5c2a' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(resumen.porMaterial || {}).map(([nombre, v]) => (
                                    <tr key={nombre} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                        <td style={{ padding: '6px 8px' }}>{nombre}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{Number(v.kilos).toFixed(2)}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>${fmt(v.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
