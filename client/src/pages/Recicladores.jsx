import React, { useState, useEffect } from 'react';
import { api } from '../api';
import CajaOrigen from '../components/CajaOrigen';
import { EncabezadoPagina, Boton, Pestanas, Tarjeta, Chip, ContenedorTabla, estiloTabla, estiloTh, estiloTd, estiloTdNum, estiloInput, Campo, Buscador, Aviso, Vacio } from '../components/ui';

// Fecha de Colombia (con toISOString, después de las 7 pm ya daba "mañana" y la plata caía en la caja del día siguiente)
const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

const fmt = n => Number(n || 0).toLocaleString('es-CO');

export default function Recicladores() {
    const [recicladores, setRecicladores] = useState([]);
    const [bodegas, setBodegas] = useState([]);
    const [materiales, setMateriales] = useState([]);
    const [filtroBodega, setFiltroBodega] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [selected, setSelected] = useState(null);
    const [prestamos, setPrestamos] = useState([]);
    const [precios, setPrecios] = useState([]);
    const [sedes, setSedes] = useState([]);
    const [tabDetalle, setTabDetalle] = useState('prestamos');
    const [showForm, setShowForm] = useState(false);
    const [showPrestamo, setShowPrestamo] = useState(false);
    const [showSedeForm, setShowSedeForm] = useState(false);
    const [form, setForm] = useState({ nombre: '', cedula: '', telefono: '', whatsapp: '', bodega_id: '' });
    const [pForm, setPForm] = useState({ monto: '', descripcion: '', fecha: hoy(), bodega_id: '' });
    const [precioForm, setPrecioForm] = useState({ material_id: '', precio: '' });
    const [sedeForm, setSedeForm] = useState({ nombre: '', direccion: '' });
    const [msg, setMsg] = useState('');

    // Celular: el detalle queda debajo de la lista; al elegir a alguien se baja hasta él.
    useEffect(() => {
        if (selected && window.innerWidth < 900) document.getElementById('detalle-reciclador')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [selected?.id]);

    useEffect(() => {
        api.get('/bodegas').then(d => setBodegas(d.bodegas));
        api.get('/materiales').then(d => setMateriales(d.materiales || []));
        cargar();
    }, []);

    const cargar = () => api.get('/recicladores').then(d => setRecicladores(d.recicladores)).catch(() => {});

    const seleccionar = async (r) => {
        setSelected(r);
        setTabDetalle('prestamos');
        const d = await api.get(`/recicladores/${r.id}/prestamos`).catch(() => ({ prestamos: [] }));
        setPrestamos(d.prestamos || []);
        const p = await api.get(`/recicladores/${r.id}/precios`).catch(() => ({ precios: [] }));
        setPrecios(p.precios || []);
        const s = await api.get(`/recicladores/${r.id}/sedes`).catch(() => ({ sedes: [] }));
        setSedes(s.sedes || []);
    };

    const guardarSede = async () => {
        if (!sedeForm.nombre.trim()) return;
        try {
            const d = await api.post(`/recicladores/${selected.id}/sedes`, sedeForm);
            setSedes(prev => [...prev, d.sede]);
            setSedeForm({ nombre: '', direccion: '' });
            setShowSedeForm(false);
        } catch (err) { setMsg(err.message); }
    };

    const guardarPrecioEspecial = async () => {
        if (!precioForm.material_id || precioForm.precio === '') return;
        try {
            const d = await api.post(`/recicladores/${selected.id}/precios`, precioForm);
            setPrecios(d.precios);
            setPrecioForm({ material_id: '', precio: '' });
        } catch (err) { setMsg(err.message); }
    };

    const eliminarPrecioEspecial = async (material_id) => {
        await api.delete(`/recicladores/${selected.id}/precios/${material_id}`);
        setPrecios(prev => prev.filter(p => p.material_id !== material_id));
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
            setPForm(f => ({ monto: '', descripcion: '', fecha: hoy(), bodega_id: f.bodega_id }));
            setShowPrestamo(false);
            seleccionar(selected); cargar();
        } catch (err) { setMsg(err.message); alert(err.message); }
    };

    return (
        <div className="pagina">
            <EncabezadoPagina titulo="Recicladores" sub="Gestión de recicladores y préstamos" icono="recicladores"
                acciones={<Boton icono="agregar" onClick={() => setShowForm(!showForm)}>Nuevo reciclador</Boton>} />

            {showForm && (
                <Tarjeta titulo="Nuevo reciclador" icono="recicladores" style={{ marginBottom: 16 }}>
                    <div className="rejilla-form">
                        {[['nombre','Nombre*'],['cedula','Cédula'],['telefono','Teléfono'],['whatsapp','WhatsApp']].map(([k,l]) => (
                            <Campo key={k} etiqueta={l}>
                                <input value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
                                    style={estiloInput} />
                            </Campo>
                        ))}
                        <Campo etiqueta="Bodega">
                            <select value={form.bodega_id} onChange={e => setForm({ ...form, bodega_id: e.target.value })}
                                style={estiloInput}>
                                <option value="">-- Selecciona --</option>
                                {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                            </select>
                        </Campo>
                    </div>
                    {msg && <Aviso tipo="error" style={{ marginTop: 10 }}>{msg}</Aviso>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                        <Boton onClick={guardar}>Guardar</Boton>
                        <Boton variante="secundario" onClick={() => setShowForm(false)}>Cancelar</Boton>
                    </div>
                </Tarjeta>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: selected ? 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))' : 'minmax(0, 1fr)', gap: 16 }}>
                <Tarjeta titulo="Recicladores" sub={`${recicladores.length} registrados`} sinPadding>
                    <div style={{ padding: '10px 14px', borderBottom: '1.5px solid var(--borde)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <Buscador value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre o cédula..." style={{ minWidth: 220 }} />
                        <select value={filtroBodega} onChange={e => setFiltroBodega(e.target.value)} aria-label="Bodega"
                            style={{ ...estiloInput, width: 'auto', minWidth: 160, flex: '1 1 160px', maxWidth: 260 }}>
                            <option value="">Todas las bodegas</option>
                            {bodegas.map(b => <option key={b.id} value={String(b.id)}>{b.nombre}</option>)}
                        </select>
                    </div>
                    {/* Celular: una tarjeta por reciclador */}
                    <div className="solo-movil">
                        {recicladores.filter(r => (!filtroBodega || String(r.bodega_id) === filtroBodega)
                            && (!busqueda.trim() || `${r.nombre || ''} ${r.cedula || ''}`.toLowerCase().includes(busqueda.trim().toLowerCase()))).map(r => (
                            <div key={r.id} onClick={() => seleccionar(r)}
                                style={{ padding: '12px 14px', borderBottom: '1px solid #eef1f4', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: selected?.id === r.id ? 'var(--verde-suave)' : 'transparent' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 15 }}>{r.nombre}</div>
                                    <div style={{ fontSize: 12.5, color: 'var(--texto-3)', marginTop: 2 }}>
                                        {[r.cedula && `C.C. ${r.cedula}`, r.telefono, r.bodega?.nombre].filter(Boolean).join(' · ')}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div className="etiqueta" style={{ fontSize: 10.5, color: 'var(--texto-3)' }}>Préstamo</div>
                                    <div className="cifra" style={{ fontSize: 16, color: parseFloat(r.saldo_prestamo) > 0 ? 'var(--rojo)' : 'var(--verde-osc)' }}>${fmt(r.saldo_prestamo)}</div>
                                </div>
                                <span style={{ color: 'var(--texto-3)', fontSize: 20 }}>›</span>
                            </div>
                        ))}
                    </div>
                    <div className="solo-pc"><ContenedorTabla><table style={estiloTabla}>
                        <thead>
                            <tr>
                                {['Nombre','Cédula','Teléfono','Préstamo','Bodega',''].map(h => (
                                    <th key={h} style={estiloTh}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {recicladores.filter(r => (!filtroBodega || String(r.bodega_id) === filtroBodega)
                                && (!busqueda.trim() || `${r.nombre || ''} ${r.cedula || ''}`.toLowerCase().includes(busqueda.trim().toLowerCase()))).map(r => (
                                <tr key={r.id} onClick={() => seleccionar(r)} style={{ borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: selected?.id === r.id ? 'var(--verde-suave)' : 'transparent' }}>
                                    <td style={{ ...estiloTd, fontWeight: 700 }}>{r.nombre}</td>
                                    <td style={estiloTd}>{r.cedula}</td>
                                    <td style={estiloTd}>{r.telefono}</td>
                                    <td className="cifra" style={{ ...estiloTdNum, color: parseFloat(r.saldo_prestamo) > 0 ? 'var(--rojo)' : 'var(--verde-osc)', fontWeight: 700 }}>
                                        ${fmt(r.saldo_prestamo)}
                                    </td>
                                    <td style={estiloTd}>{r.bodega?.nombre || '—'}</td>
                                    <td style={estiloTd}>
                                        <Boton tam="sm" variante="secundario" onClick={e => { e.stopPropagation(); seleccionar(r); }}>Ver</Boton>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table></ContenedorTabla></div>
                    {recicladores.length === 0 && <Vacio icono="recicladores" texto="No hay recicladores registrados" />}
                </Tarjeta>

                {selected && (
                    <Tarjeta style={{ scrollMarginTop: 12 }}><span id="detalle-reciclador" />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                            <div>
                                <h3 style={{ fontSize: 20, fontWeight: 800 }}>{selected.nombre}</h3>
                                <div style={{ fontSize: 13, color: 'var(--texto-2)' }}>{selected.telefono} · {selected.bodega?.nombre || 'Sin bodega'}</div>
                                <div style={{ fontSize: 13.5, color: 'var(--rojo)', fontWeight: 700, marginTop: 4 }}>Saldo préstamo: <span className="cifra" style={{ fontSize: 16 }}>${fmt(selected.saldo_prestamo)}</span></div>
                            </div>
                            <Boton tam="sm" variante="secundario" icono="cerrar" onClick={() => setSelected(null)}>Cerrar</Boton>
                        </div>

                        {/* Tabs */}
                        <Pestanas items={[{ id: 'prestamos', label: 'Préstamos', icono: 'prestamos' }, { id: 'sedes', label: 'Sedes', icono: 'bodegas' }, { id: 'precios', label: 'Precios especiales', icono: 'ventas' }]} activa={tabDetalle} onChange={setTabDetalle} />

                        {/* Tab: Préstamos */}
                        {tabDetalle === 'prestamos' && (
                            <>
                                <button onClick={() => setShowPrestamo(!showPrestamo)}
                                    style={{ padding: '6px 12px', background: '#fef3c7', color: '#d97706', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                                    + Nuevo préstamo
                                </button>
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
                                        <div style={{ marginBottom: 8 }}><CajaOrigen value={pForm.bodega_id} onChange={v => setPForm(f => ({ ...f, bodega_id: v }))} /></div>
                                        <button onClick={guardarPrestamo} style={{ padding: '7px 16px', background: '#d97706', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13 }}>Registrar préstamo</button>
                                    </div>
                                )}
                                {prestamos.length === 0 ? <p style={{ color: '#999', fontSize: 13 }}>Sin préstamos registrados</p> : (
                                    prestamos.map(p => (
                                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                                            <div>
                                                <span style={{ fontWeight: 600 }}>${fmt(p.monto)}</span>
                                                <span style={{ color: '#888', marginLeft: 8 }}>{p.descripcion}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                                <span style={{ color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>🕒 {p.fecha ? p.fecha.split('-').reverse().join('/') : '—'}{p.createdAt ? ' · ' + new Date(p.createdAt).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                                <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: p.pagado ? '#d1fae5' : '#fee2e2', color: p.pagado ? '#059669' : '#dc2626' }}>
                                                    {p.pagado ? 'Pagado' : 'Pendiente'}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </>
                        )}

                        {/* Tab: Sedes */}
                        {tabDetalle === 'sedes' && (
                            <>
                                <button onClick={() => setShowSedeForm(!showSedeForm)}
                                    style={{ padding: '6px 12px', background: '#e0f2e9', color: 'var(--verde-osc)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                                    + Nueva sede
                                </button>
                                {showSedeForm && (
                                    <div style={{ background: 'var(--verde-suave)', border: '1px solid #a7d7a7', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                                            <input placeholder="Nombre sede*" value={sedeForm.nombre} onChange={e => setSedeForm({ ...sedeForm, nombre: e.target.value })}
                                                style={{ padding: '8px', borderRadius: 6, border: '1px solid #a7d7a7', fontSize: 13 }} />
                                            <input placeholder="Dirección" value={sedeForm.direccion} onChange={e => setSedeForm({ ...sedeForm, direccion: e.target.value })}
                                                style={{ padding: '8px', borderRadius: 6, border: '1px solid #a7d7a7', fontSize: 13 }} />
                                        </div>
                                        <button onClick={guardarSede}
                                            style={{ padding: '7px 16px', background: 'var(--verde-osc)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13 }}>
                                            Agregar sede
                                        </button>
                                    </div>
                                )}
                                {sedes.length === 0 ? (
                                    <p style={{ color: '#999', fontSize: 13 }}>Sin sedes registradas</p>
                                ) : (
                                    sedes.map(s => (
                                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                                            <div>
                                                <span style={{ fontWeight: 600 }}>{s.nombre}</span>
                                                {s.direccion && <span style={{ color: '#888', marginLeft: 8 }}>{s.direccion}</span>}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </>
                        )}

                        {/* Tab: Precios especiales */}
                        {tabDetalle === 'precios' && (
                            <>
                                <div style={{ background: 'var(--verde-suave)', borderRadius: 8, padding: 12, marginBottom: 14 }}>
                                    <div style={{ fontSize: 12, color: '#555', marginBottom: 8, fontWeight: 600 }}>Asignar precio especial</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: 8, alignItems: 'center' }}>
                                        <select value={precioForm.material_id} onChange={e => setPrecioForm({ ...precioForm, material_id: e.target.value })}
                                            style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #a7d7a7', fontSize: 13 }}>
                                            <option value="">-- Material --</option>
                                            {materiales.filter(m => m.activo !== false).map(m => (
                                                <option key={m.id} value={m.id}>{m.nombre}</option>
                                            ))}
                                        </select>
                                        <input type="number" placeholder="$/kg" value={precioForm.precio}
                                            onChange={e => setPrecioForm({ ...precioForm, precio: e.target.value })}
                                            style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #a7d7a7', fontSize: 13 }} />
                                        <button onClick={guardarPrecioEspecial}
                                            style={{ padding: '7px 14px', background: 'var(--verde-osc)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                            Guardar
                                        </button>
                                    </div>
                                </div>
                                {precios.length === 0 ? (
                                    <p style={{ color: '#999', fontSize: 13 }}>Sin precios especiales. Usa el precio general de cada material.</p>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead><tr style={{ background: 'var(--verde-suave)' }}>
                                            <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--verde-osc)', fontWeight: 600 }}>Material</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--verde-osc)', fontWeight: 600 }}>Precio especial</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--verde-osc)', fontWeight: 600 }}>Precio general</th>
                                            <th style={{ width: 40 }}></th>
                                        </tr></thead>
                                        <tbody>
                                            {precios.map(p => (
                                                <tr key={p.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{p.material?.nombre}</td>
                                                    <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--verde-osc)', fontWeight: 700 }}>${fmt(p.precio)}/kg</td>
                                                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#888' }}>${fmt(p.material?.precio_compra)}/kg</td>
                                                    <td style={{ padding: '8px 10px' }}>
                                                        <button onClick={() => eliminarPrecioEspecial(p.material_id)}
                                                            style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 15 }}>✕</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </>
                        )}
                    </Tarjeta>
                )}
            </div>
        </div>
    );
}
