import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { EncabezadoPagina, Tarjeta, Boton, Campo, Buscador, Aviso, Chip, ContenedorTabla, estiloTabla, estiloTh, estiloTd, estiloTdNum, estiloInput } from '../components/ui';

const fmt = n => Number(n || 0).toLocaleString('es-CO');

const CATEGORIAS = ['Metales', 'Electrónicos', 'Plásticos', 'Papel y Cartón', 'Vidrio', 'Madera', 'Otros'];
const VACIO = { codigo: '', nombre: '', precio_compra: '', unidad: 'kg', categoria: 'Otros', orden: '' };

export default function Materiales() {
    const [materiales, setMateriales] = useState([]);
    const [form, setForm] = useState(VACIO);
    const [editando, setEditando] = useState(null);
    const [busqueda, setBusqueda] = useState('');
    const [msg, setMsg] = useState('');

    useEffect(() => { cargar(); }, []);
    const cargar = () => api.get('/materiales').then(d => setMateriales(d.materiales)).catch(() => {});

    const guardar = async () => {
        if (!form.codigo || !form.nombre) return setMsg('Código y nombre requeridos');
        try {
            if (editando) {
                await api.put(`/materiales/${editando}`, form);
                setEditando(null);
            } else {
                await api.post('/materiales', form);
            }
            setForm(VACIO);
            setMsg(''); cargar();
        } catch (err) { setMsg(err.message); }
    };

    const editar = (m) => {
        setEditando(m.id);
        setForm({ codigo: m.codigo, nombre: m.nombre, precio_compra: m.precio_compra, unidad: m.unidad, categoria: m.categoria || 'Otros', orden: m.orden ?? '' });
    };

    const eliminar = async (id) => {
        if (!window.confirm('¿Desactivar este material?')) return;
        await api.delete(`/materiales/${id}`);
        cargar();
    };

    const lista = busqueda.trim() ? materiales.filter(m => `${m.nombre || ''} ${m.codigo || ''}`.toLowerCase().includes(busqueda.trim().toLowerCase())) : materiales;

    return (
        <div className="pagina">
            <EncabezadoPagina titulo="Materiales" sub="Precios de compra por material (precios fijos)" icono="materiales" />

            <div className="rejilla-form-lista">
                <Tarjeta titulo={editando ? 'Editar material' : 'Nuevo material'} icono={editando ? 'editar' : 'agregar'}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[['codigo', 'Código*'], ['nombre', 'Nombre*']].map(([k, l]) => (
                            <Campo key={k} etiqueta={l}>
                                <input value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} style={estiloInput} />
                            </Campo>
                        ))}
                        <Campo etiqueta="Precio compra ($/kg)">
                            <input type="number" value={form.precio_compra} onChange={e => setForm({ ...form, precio_compra: e.target.value })} min="0" style={estiloInput} />
                        </Campo>
                        <Campo etiqueta="Familia">
                            <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} style={estiloInput}>
                                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </Campo>
                        <Campo etiqueta="Orden dentro de la familia" ayuda="Menor número = aparece primero. Déjalo vacío para el final.">
                            <input type="number" value={form.orden} onChange={e => setForm({ ...form, orden: e.target.value })} min="0" placeholder="ej: 1, 2, 3…" style={estiloInput} />
                        </Campo>
                        {msg && <Aviso tipo="error">{msg}</Aviso>}
                        <div style={{ display: 'flex', gap: 8 }}>
                            <Boton onClick={guardar} style={{ flex: 1 }}>{editando ? 'Actualizar' : 'Guardar'}</Boton>
                            {editando && <Boton variante="secundario" onClick={() => { setEditando(null); setForm(VACIO); }}>Cancelar</Boton>}
                        </div>
                    </div>
                </Tarjeta>

                <Tarjeta titulo="Materiales" sub={`${materiales.length} activos`} sinPadding style={{ minWidth: 0 }}>
                    <div style={{ padding: '0 14px 12px', borderBottom: '1.5px solid var(--borde)' }}>
                        <Buscador value={busqueda} onChange={setBusqueda} placeholder="Buscar material por nombre o código..." />
                    </div>

                    {/* Computador: tabla agrupada por familia */}
                    <div className="solo-pc">
                        <ContenedorTabla>
                            <table style={estiloTabla}>
                                <thead>
                                    <tr>
                                        {['Familia', '#', 'Código', 'Nombre', 'Precio compra', ''].map(h => (
                                            <th key={h} style={{ ...estiloTh, textAlign: h === 'Precio compra' ? 'right' : 'left' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {lista.map((m, i, arr) => {
                                        const nuevaFamilia = i === 0 || arr[i - 1].categoria !== m.categoria;
                                        return (
                                            <tr key={m.id} style={{ borderTop: nuevaFamilia && i > 0 ? '2px solid var(--borde-fuerte)' : undefined }}>
                                                <td style={estiloTd}>{nuevaFamilia ? <Chip tono="noche">{m.categoria || '—'}</Chip> : ''}</td>
                                                <td style={{ ...estiloTd, color: 'var(--texto-3)' }}>{m.orden === 999 ? '—' : m.orden}</td>
                                                <td style={{ ...estiloTd, color: 'var(--texto-2)' }}>{m.codigo}</td>
                                                <td style={{ ...estiloTd, fontWeight: 700 }}>{m.nombre}</td>
                                                <td style={{ ...estiloTdNum, fontWeight: 700 }}>${fmt(m.precio_compra)}</td>
                                                <td style={{ ...estiloTd, textAlign: 'right' }}>
                                                    <div style={{ display: 'inline-flex', gap: 6 }}>
                                                        <Boton tam="sm" variante="secundario" onClick={() => editar(m)}>Editar</Boton>
                                                        <Boton tam="sm" variante="peligro" onClick={() => eliminar(m.id)}>Quitar</Boton>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </ContenedorTabla>
                    </div>

                    {/* Celular: lista por familia */}
                    <div className="solo-movil">
                        {lista.map((m, i, arr) => {
                            const nuevaFamilia = i === 0 || arr[i - 1].categoria !== m.categoria;
                            return (
                                <React.Fragment key={m.id}>
                                    {nuevaFamilia && <div className="etiqueta" style={{ padding: '10px 14px 6px', background: '#f6f8fa', color: 'var(--texto-2)', borderTop: '1px solid var(--borde)' }}>{m.categoria || '—'}</div>}
                                    <div style={{ padding: '11px 14px', borderTop: '1px solid #eef1f4', display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: 15 }}>{m.nombre}</div>
                                            <div style={{ fontSize: 12.5, color: 'var(--texto-3)' }}>Código {m.codigo}{m.orden !== 999 && m.orden != null ? ` · orden ${m.orden}` : ''}</div>
                                        </div>
                                        <div className="cifra" style={{ fontSize: 16, flexShrink: 0 }}>${fmt(m.precio_compra)}</div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 14px 11px' }}>
                                        <Boton variante="secundario" tam="sm" onClick={() => { editar(m); window.scrollTo({ top: 0, behavior: 'smooth' }); document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' }); }}>Editar</Boton>
                                        <Boton variante="peligro" tam="sm" onClick={() => eliminar(m.id)}>Quitar</Boton>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </Tarjeta>
            </div>
        </div>
    );
}
