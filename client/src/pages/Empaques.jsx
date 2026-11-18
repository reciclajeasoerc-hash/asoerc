import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import PickerBuscable from '../components/PickerBuscable';
import { EncabezadoPagina, Boton, Tarjeta, Campo, estiloInput, Buscador, ContenedorTabla, estiloTabla, estiloTh, estiloTd, estiloTdNum, Chip, Aviso, Vacio } from '../components/ui';

const hoy = () => new Date().toISOString().slice(0, 10);

export default function Empaques() {
    const { user } = useAuth();
    const [empaques, setEmpaques] = useState([]);
    const [recicladores, setRecicladores] = useState([]);
    const [bodegas, setBodegas] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        reciclador_id: '', conductor: '', tipo: 'entrega',
        cantidad: '', bodega_id: '', fecha: hoy(), observaciones: ''
    });
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [filtro, setFiltro] = useState('');

    // Bodega por defecto = la del usuario (evita que caiga en otra bodega por elegir "la primera")
    const bodegaPorDefecto = (lista) => user?.bodega_id || lista?.[0]?.id || '';

    useEffect(() => {
        Promise.all([
            api.get('/recicladores').then(d => setRecicladores(d.recicladores || [])),
            api.get('/bodegas').then(d => { setBodegas(d.bodegas || []); setForm(f => ({ ...f, bodega_id: bodegaPorDefecto(d.bodegas) })); })
        ]);
        cargar();
    }, []);

    const cargar = () => api.get('/empaques').then(d => setEmpaques(d.empaques || [])).catch(() => {});

    const guardar = async () => {
        const cantidad = parseInt(form.cantidad) || 0;
        if (!cantidad) return setMsg('Cantidad requerida');
        if (!form.reciclador_id && !form.conductor) return setMsg('Selecciona reciclador o ingresa conductor');
        setLoading(true);
        try {
            const tipo_actor = form.reciclador_id ? 'reciclador' : 'conductor';
            const body = {
                tipo_actor,
                reciclador_id: form.reciclador_id || null,
                conductor: form.conductor || null,
                bodega_id: form.bodega_id,
                fecha: form.fecha,
                observaciones: form.observaciones,
                cantidad_entregada: form.tipo === 'entrega' ? cantidad : 0,
                cantidad_devuelta:  form.tipo === 'devolucion' ? cantidad : 0,
            };
            await api.post('/empaques', body);
            setForm({ reciclador_id: '', conductor: '', tipo: 'entrega', cantidad: '', bodega_id: bodegaPorDefecto(bodegas), fecha: hoy(), observaciones: '' });
            setShowForm(false); setMsg(''); cargar();
        } catch (err) { setMsg(err.message); }
        finally { setLoading(false); }
    };

    const empFiltrados = filtro
        ? empaques.filter(e => e.reciclador?.nombre?.toLowerCase().includes(filtro.toLowerCase()) || e.conductor?.toLowerCase().includes(filtro.toLowerCase()))
        : empaques;

    // Resumen por actor
    const resumen = empaques.reduce((acc, e) => {
        const key = e.reciclador_id || `c_${e.conductor}`;
        const nombre = e.reciclador?.nombre || e.conductor || '—';
        if (!acc[key]) acc[key] = { nombre, entregado: 0, devuelto: 0 };
        acc[key].entregado += Number(e.cantidad_entregada) || 0;
        acc[key].devuelto  += Number(e.cantidad_devuelta)  || 0;
        return acc;
    }, {});

    return (
        <div className="pagina">
            <EncabezadoPagina titulo="Empaques" sub="Control de empaques entregados y devueltos" icono="empaques"
                acciones={<Boton icono="agregar" onClick={() => setShowForm(!showForm)}>Registrar</Boton>} />

            {showForm && (
                <Tarjeta titulo="Nuevo movimiento de empaque" icono="empaques" style={{ marginBottom: 20 }}>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                        {[['entrega', 'Entrega'], ['devolucion', 'Devolución']].map(([v, l]) => (
                            <Boton key={v} onClick={() => setForm({ ...form, tipo: v })}
                                variante={form.tipo === v ? (v === 'entrega' ? 'primario' : 'peligro') : 'secundario'}
                                style={{ flex: '1 1 160px' }}>{l}</Boton>
                        ))}
                    </div>

                    <div className="rejilla-form" style={{ marginBottom: 14 }}>
                        <Campo etiqueta="Reciclador">
                            <PickerBuscable
                                items={recicladores}
                                value={form.reciclador_id}
                                onChange={id => setForm({ ...form, reciclador_id: id, conductor: '' })}
                                placeholder="Buscar reciclador..."
                                fontSize={13}
                            />
                        </Campo>
                        <Campo etiqueta="O conductor externo">
                            <input value={form.conductor} onChange={e => setForm({ ...form, conductor: e.target.value, reciclador_id: '' })} placeholder="Nombre conductor" style={estiloInput} />
                        </Campo>
                        <Campo etiqueta="Cantidad *">
                            <input type="number" value={form.cantidad} onChange={e => setForm({ ...form, cantidad: e.target.value })} min="1" style={estiloInput} />
                        </Campo>
                        <Campo etiqueta="Bodega">
                            <select value={form.bodega_id} onChange={e => setForm({ ...form, bodega_id: e.target.value })} style={estiloInput}>
                                {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                            </select>
                        </Campo>
                        <Campo etiqueta="Fecha">
                            <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={estiloInput} />
                        </Campo>
                        <Campo etiqueta="Observaciones">
                            <input value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} style={estiloInput} />
                        </Campo>
                    </div>

                    {msg && <Aviso tipo="error" style={{ marginBottom: 8 }}>{msg}</Aviso>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Boton onClick={guardar} disabled={loading}>{loading ? 'Guardando...' : 'Registrar'}</Boton>
                        <Boton variante="secundario" onClick={() => setShowForm(false)}>Cancelar</Boton>
                    </div>
                </Tarjeta>
            )}

            {/* Saldo por persona */}
            {Object.values(resumen).length > 0 && (
                <Tarjeta titulo="Saldo por persona" icono="empaques" style={{ marginBottom: 20 }}>
                    <div className="rejilla-tarjetas">
                        {Object.values(resumen).map(r => {
                            const saldo = r.entregado - r.devuelto;
                            return (
                                <div key={r.nombre} className="tarjeta" style={{ padding: 14, boxShadow: 'none' }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, overflowWrap: 'anywhere' }}>{r.nombre}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                                        <span style={{ color: 'var(--verde-osc)' }}>Entregados: {r.entregado}</span>
                                        <span style={{ color: 'var(--rojo)' }}>Devueltos: {r.devuelto}</span>
                                    </div>
                                    <div className="cifra" style={{ marginTop: 10, color: saldo > 0 ? 'var(--ambar)' : 'var(--verde-osc)', fontSize: 16 }}>
                                        Saldo: {saldo} empaques
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Tarjeta>
            )}

            {/* Historial */}
            <Tarjeta titulo="Historial de movimientos" icono="materiales" sinPadding>
                <div style={{ padding: '12px 16px', borderBottom: '1.5px solid var(--borde)' }}>
                    <Buscador value={filtro} onChange={setFiltro} placeholder="Buscar por reciclador o conductor..." style={{ maxWidth: 520 }} />
                </div>
                {empFiltrados.length === 0 && <Vacio icono="empaques" texto="Sin registros" />}

                {empFiltrados.length > 0 && (
                    <div className="solo-pc">
                        <ContenedorTabla>
                            <table style={estiloTabla}>
                                <thead>
                                    <tr>
                                        {['Fecha', 'Persona', 'Entregados', 'Devueltos', 'Saldo', 'Bodega'].map(h => (
                                            <th key={h} style={h === 'Saldo' ? { ...estiloTh, textAlign: 'right' } : estiloTh}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {empFiltrados.map(e => (
                                        <tr key={e.id}>
                                            <td style={{ ...estiloTd, color: 'var(--texto-2)' }}>{e.fecha}</td>
                                            <td style={{ ...estiloTd, fontWeight: 700 }}>{e.reciclador?.nombre || e.conductor || '—'}</td>
                                            <td style={estiloTd}>{e.cantidad_entregada > 0 && <Chip tono="verde">Entrega: {e.cantidad_entregada}</Chip>}</td>
                                            <td style={estiloTd}>{e.cantidad_devuelta > 0 && <Chip tono="rojo">Devolución: {e.cantidad_devuelta}</Chip>}</td>
                                            <td className="cifra" style={{ ...estiloTdNum, color: e.saldo > 0 ? 'var(--ambar)' : 'var(--verde-osc)' }}>{e.saldo}</td>
                                            <td style={{ ...estiloTd, color: 'var(--texto-2)' }}>{e.bodega?.nombre}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </ContenedorTabla>
                    </div>
                )}

                <div className="solo-movil">
                    {empFiltrados.map(e => (
                        <div key={e.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--borde)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, overflowWrap: 'anywhere' }}>{e.reciclador?.nombre || e.conductor || '—'}</div>
                                    <div style={{ fontSize: 13, color: 'var(--texto-2)', marginTop: 2 }}>{e.fecha}</div>
                                </div>
                                <div className="cifra" style={{ color: e.saldo > 0 ? 'var(--ambar)' : 'var(--verde-osc)', fontSize: 16, flexShrink: 0 }}>{e.saldo}</div>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                                {e.cantidad_entregada > 0 && <Chip tono="verde">Entrega: {e.cantidad_entregada}</Chip>}
                                {e.cantidad_devuelta > 0 && <Chip tono="rojo">Devolución: {e.cantidad_devuelta}</Chip>}
                                {e.bodega?.nombre && <Chip tono="gris">{e.bodega?.nombre}</Chip>}
                            </div>
                        </div>
                    ))}
                </div>
            </Tarjeta>
        </div>
    );
}
