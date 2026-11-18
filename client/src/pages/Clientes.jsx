import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { EncabezadoPagina, Boton, Pestanas, Tarjeta, Chip, ContenedorTabla, estiloTabla, estiloTh, estiloTd, estiloTdNum, estiloInput, Campo, Buscador, Aviso, Vacio } from '../components/ui';

const fmt = n => Number(n || 0).toLocaleString('es-CO');

export default function Clientes() {
    const [clientes, setClientes] = useState([]);
    const [materiales, setMateriales] = useState([]);
    const [selected, setSelected] = useState(null);
    const [sedes, setSedes] = useState([]);
    const [precios, setPrecios] = useState([]);
    const [tabDetalle, setTabDetalle] = useState('sedes');
    const [showForm, setShowForm] = useState(false);
    const [showSedeForm, setShowSedeForm] = useState(false);
    const [form, setForm] = useState({ nombre: '', nit: '', telefono: '', email: '', contacto: '', tipo_precio: 'fijo' });
    const [sedeForm, setSedeForm] = useState({ nombre: '', direccion: '' });
    const [precioForm, setPrecioForm] = useState({ material_id: '', precio: '' });
    const [buscar, setBuscar] = useState('');
    const [msg, setMsg] = useState('');

    useEffect(() => {
        api.get('/materiales').then(d => setMateriales(d.materiales || []));
        cargar();
    }, []);

    const cargar = () => api.get('/clientes').then(d => setClientes(d.clientes || [])).catch(() => {});

    const seleccionar = async (c) => {
        setSelected(c);
        setTabDetalle('sedes');
        setSedes(c.sedes || []);
        const p = await api.get(`/clientes/${c.id}/precios`).catch(() => ({ precios: [] }));
        setPrecios(p.precios || []);
    };

    const guardar = async () => {
        if (!form.nombre.trim()) { setMsg('El nombre es requerido'); return; }
        try {
            await api.post('/clientes', form);
            setForm({ nombre: '', nit: '', telefono: '', email: '', contacto: '', tipo_precio: 'fijo' });
            setShowForm(false); setMsg(''); cargar();
        } catch (err) { setMsg(err.message); }
    };

    const guardarSede = async () => {
        if (!sedeForm.nombre.trim()) return;
        try {
            const d = await api.post(`/clientes/${selected.id}/sedes`, sedeForm);
            setSedes(prev => [...prev, d.sede]);
            setSedeForm({ nombre: '', direccion: '' });
            setShowSedeForm(false);
        } catch (err) { setMsg(err.message); }
    };

    const guardarPrecio = async () => {
        if (!precioForm.material_id || precioForm.precio === '') return;
        try {
            const d = await api.post(`/clientes/${selected.id}/precios`, precioForm);
            setPrecios(d.precios);
            setPrecioForm({ material_id: '', precio: '' });
        } catch (err) { setMsg(err.message); }
    };

    const eliminarPrecio = async (material_id) => {
        await api.delete(`/clientes/${selected.id}/precios/${material_id}`);
        setPrecios(prev => prev.filter(p => p.material_id !== material_id));
    };

    const clientesFiltrados = clientes.filter(c =>
        !buscar || c.nombre.toLowerCase().includes(buscar.toLowerCase()) ||
        (c.nit || '').includes(buscar) || (c.telefono || '').includes(buscar)
    );

    return (
        <div className="pagina">
            <EncabezadoPagina titulo="Clientes" sub="Gestión de clientes, sedes y precios especiales" icono="clientes"
                acciones={<Boton icono="agregar" onClick={() => setShowForm(!showForm)}>Nuevo cliente</Boton>} />

            {showForm && (
                <Tarjeta titulo="Nuevo cliente" icono="clientes" style={{ marginBottom: 16 }}>
                    <div className="rejilla-form">
                        {[['nombre','Nombre*'],['nit','NIT'],['telefono','Teléfono'],['email','Email'],['contacto','Contacto']].map(([k,l]) => (
                            <Campo key={k} etiqueta={l}>
                                <input value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
                                    style={estiloInput} />
                            </Campo>
                        ))}
                        <Campo etiqueta="Tipo precio">
                            <select value={form.tipo_precio} onChange={e => setForm({ ...form, tipo_precio: e.target.value })}
                                style={estiloInput}>
                                <option value="fijo">Fijo</option>
                                <option value="semanal">Semanal</option>
                            </select>
                        </Campo>
                    </div>
                    {msg && <Aviso tipo="error" style={{ marginTop: 12 }}>{msg}</Aviso>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                        <Boton onClick={guardar}>Guardar</Boton>
                        <Boton variante="secundario" onClick={() => { setShowForm(false); setMsg(''); }}>Cancelar</Boton>
                    </div>
                </Tarjeta>
            )}

            {/* Buscador */}
            <Buscador placeholder="Buscar por nombre, NIT o teléfono..." value={buscar} onChange={setBuscar} style={{ maxWidth: 420, marginBottom: 12 }} />

            <div style={{ display: 'grid', gridTemplateColumns: selected ? 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))' : 'minmax(0, 1fr)', gap: 16 }}>
                {/* Lista de clientes */}
                <Tarjeta titulo="Clientes" sub={`${clientesFiltrados.length} registrados`} sinPadding>
                    {/* Celular: una tarjeta por cliente */}
                    <div className="solo-movil">
                        {clientesFiltrados.map(c => (
                            <div key={c.id} onClick={() => seleccionar(c)}
                                style={{ padding: '12px 14px', borderTop: '1px solid #eef1f4', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: selected?.id === c.id ? 'var(--verde-suave)' : 'transparent' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 15 }}>{c.nombre}</div>
                                    <div style={{ fontSize: 12.5, color: 'var(--texto-3)', marginTop: 2 }}>
                                        {[c.nit && `NIT ${c.nit}`, c.telefono, `${(c.sedes || []).length} sede${(c.sedes || []).length !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
                                    </div>
                                </div>
                                <span style={{ color: 'var(--texto-3)', fontSize: 20 }}>›</span>
                            </div>
                        ))}
                    </div>
                    <div className="solo-pc"><ContenedorTabla>
                    <table style={estiloTabla}>
                        <thead>
                            <tr>
                                {['Nombre','NIT','Teléfono','Sedes',''].map(h => (
                                    <th key={h} style={estiloTh}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {clientesFiltrados.map(c => (
                                <tr key={c.id} onClick={() => seleccionar(c)}
                                    style={{ cursor: 'pointer', background: selected?.id === c.id ? 'var(--verde-suave)' : 'transparent' }}>
                                    <td style={{ ...estiloTd, fontWeight: 700 }}>{c.nombre}</td>
                                    <td style={estiloTd}>{c.nit || '—'}</td>
                                    <td style={estiloTd}>{c.telefono || '—'}</td>
                                    <td style={estiloTd}>
                                        {(c.sedes || []).length} sede{(c.sedes || []).length !== 1 ? 's' : ''}
                                    </td>
                                    <td style={estiloTd}>
                                        <Boton tam="sm" variante="secundario" onClick={e => { e.stopPropagation(); seleccionar(c); }}>Ver</Boton>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table></ContenedorTabla></div>
                    {clientesFiltrados.length === 0 && (
                        <Vacio icono="clientes" texto={buscar ? 'Sin resultados' : 'No hay clientes registrados'} />
                    )}
                </Tarjeta>

                {/* Panel de detalle */}
                {selected && (
                    <Tarjeta>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                            <div>
                                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{selected.nombre}</h3>
                                <div style={{ fontSize: 13, color: 'var(--texto-2)' }}>
                                    {selected.nit && <span>NIT: {selected.nit} · </span>}
                                    {selected.telefono && <span>📞 {selected.telefono}</span>}
                                </div>
                                {selected.email && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{selected.email}</div>}
                            </div>
                            <Boton tam="sm" variante="secundario" icono="cerrar" onClick={() => setSelected(null)}>Cerrar</Boton>
                        </div>

                        {/* Tabs */}
                        <Pestanas items={[{ id: 'sedes', label: 'Sedes', icono: 'bodegas' }, { id: 'precios', label: 'Precios especiales', icono: 'ventas' }]} activa={tabDetalle} onChange={setTabDetalle} />

                        {/* Tab: Sedes */}
                        {tabDetalle === 'sedes' && (
                            <>
                                <Boton tam="sm" variante="secundario" icono="agregar" onClick={() => setShowSedeForm(!showSedeForm)} style={{ marginBottom: 12 }}>Nueva sede</Boton>
                                {showSedeForm && (
                                    <div style={{ background: 'var(--verde-suave)', border: '1px solid var(--verde-borde)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                                        <div className="rejilla-form" style={{ marginBottom: 8 }}>
                                            <input placeholder="Nombre sede*" value={sedeForm.nombre} onChange={e => setSedeForm({ ...sedeForm, nombre: e.target.value })}
                                                style={estiloInput} />
                                            <input placeholder="Dirección" value={sedeForm.direccion} onChange={e => setSedeForm({ ...sedeForm, direccion: e.target.value })}
                                                style={estiloInput} />
                                        </div>
                                        <Boton tam="sm" onClick={guardarSede}>Agregar sede</Boton>
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
                                <div style={{ background: 'var(--verde-suave)', border: '1px solid var(--verde-borde)', borderRadius: 8, padding: 12, marginBottom: 14 }}>
                                    <div style={{ fontSize: 12, color: '#555', marginBottom: 8, fontWeight: 600 }}>Asignar precio especial de venta</div>
                                    <div className="rejilla-form">
                                        <select value={precioForm.material_id} onChange={e => setPrecioForm({ ...precioForm, material_id: e.target.value })}
                                            style={estiloInput}>
                                            <option value="">-- Material --</option>
                                            {materiales.filter(m => m.activo !== false).map(m => (
                                                <option key={m.id} value={m.id}>{m.nombre}</option>
                                            ))}
                                        </select>
                                        <input type="number" placeholder="$/kg" value={precioForm.precio}
                                            onChange={e => setPrecioForm({ ...precioForm, precio: e.target.value })}
                                            style={estiloInput} />
                                        <Boton tam="sm" onClick={guardarPrecio}>Guardar</Boton>
                                    </div>
                                </div>
                                {precios.length === 0 ? (
                                    <p style={{ color: '#999', fontSize: 13 }}>Sin precios especiales. Se usa el precio general de cada material.</p>
                                ) : (
                                    <ContenedorTabla><table style={estiloTabla}>
                                        <thead>
                                            <tr>
                                                <th style={estiloTh}>Material</th>
                                                <th style={{ ...estiloTh, textAlign: 'right' }}>Precio especial</th>
                                                <th style={{ ...estiloTh, textAlign: 'right' }}>Precio general</th>
                                                <th style={{ width: 40 }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {precios.map(p => (
                                                <tr key={p.id}>
                                                    <td style={{ ...estiloTd, fontWeight: 600 }}>{p.material?.nombre}</td>
                                                    <td style={{ ...estiloTdNum, color: 'var(--verde-osc)', fontWeight: 700 }}>${fmt(p.precio)}/kg</td>
                                                    <td style={estiloTdNum}>${fmt(p.material?.precio_compra)}/kg</td>
                                                    <td style={estiloTd}>
                                                        <Boton tam="sm" variante="peligro" icono="cerrar" onClick={() => eliminarPrecio(p.material_id)} aria-label="Eliminar" />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table></ContenedorTabla>
                                )}
                            </>
                        )}
                    </Tarjeta>
                )}
            </div>
        </div>
    );
}
