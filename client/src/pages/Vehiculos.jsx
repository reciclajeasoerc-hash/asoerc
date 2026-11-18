import React, { useState, useEffect } from 'react';
import { api } from '../api';
import CajaOrigen from '../components/CajaOrigen';
import PickerBuscable from '../components/PickerBuscable';
import Icono from '../components/Icono';
import {
    EncabezadoPagina, Boton, Tarjeta, Kpi, RejillaKpi, Chip, ContenedorTabla,
    estiloTabla, estiloTh, estiloTd, estiloTdNum, estiloInput, Campo, Modal,
    Vacio, Aviso
} from '../components/ui';

// Fecha de Colombia (con toISOString, después de las 7 pm ya daba "mañana" y la plata caía en la caja del día siguiente)
const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const primerDiaMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; };
const fmt = n => Number(n || 0).toLocaleString('es-CO');

const TIPO_LABELS = { camion: 'Camión', furgon: 'Furgón', moto: 'Moto', otro: 'Otro' };
const GASTO_LABELS = { gasolina: 'Gasolina', viatico: 'Viático', mantenimiento: 'Mantenimiento', otro: 'Otro' };
const GASTO_TONOS = { gasolina: 'ambar', viatico: 'azul', mantenimiento: 'rojo', otro: 'gris' };

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
        <Modal titulo={vehiculo ? 'Editar vehículo' : 'Nuevo vehículo'} onCerrar={onClose}
            pie={<>
                <Boton variante="secundario" onClick={onClose}>Cancelar</Boton>
                <Boton onClick={guardar} disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Boton>
            </>}>
                <div className="rejilla-form">
                    {[['placa','Placa*'],['descripcion','Descripción / Modelo'],['conductor','Conductor habitual']].map(([k,l]) => (
                        <Campo key={k} etiqueta={l}>
                            <input value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })}
                                style={estiloInput} />
                        </Campo>
                    ))}
                    <Campo etiqueta="Tipo">
                        <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                            style={estiloInput}>
                            {Object.entries(TIPO_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </Campo>
                </div>
                {msg && <Aviso tipo="error" style={{ marginTop: 12 }}>{msg}</Aviso>}
        </Modal>
    );
}

function ModalGasto({ vehiculo, onClose, onSaved }) {
    const [form, setForm] = useState({ fecha: hoy(), tipo: 'gasolina', monto: '', descripcion: '', km_actual: '', sale_de_caja: true, bodega_id: '' });
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
        <Modal titulo="Registrar gasto" onCerrar={onClose}
            pie={<>
                <Boton variante="secundario" onClick={onClose}>Cancelar</Boton>
                <Boton onClick={guardar} disabled={loading}>{loading ? 'Guardando...' : 'Registrar gasto'}</Boton>
            </>}>
                <div style={{ color: 'var(--texto-2)', marginBottom: 16 }}>
                    <strong>{vehiculo.placa}</strong>{vehiculo.descripcion && ` — ${vehiculo.descripcion}`}
                </div>
                <div className="rejilla-form">
                    <Campo etiqueta="Tipo de gasto">
                        <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                            style={estiloInput}>
                            {Object.entries(GASTO_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </Campo>
                    <Campo etiqueta="Fecha">
                        <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}
                            style={estiloInput} />
                    </Campo>
                    <Campo etiqueta="Monto ($)*">
                        <input type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })}
                            style={estiloInput} />
                    </Campo>
                    <Campo etiqueta="Descripción">
                        <input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                            style={estiloInput} />
                    </Campo>
                    <Campo etiqueta="Km actuales (opcional)">
                        <input type="number" value={form.km_actual} onChange={e => setForm({ ...form, km_actual: e.target.value })}
                            style={estiloInput} />
                    </Campo>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.sale_de_caja} onChange={e => setForm({ ...form, sale_de_caja: e.target.checked })} style={{ width: 18, height: 18 }} />
                        ¿Se pagó con plata de la caja?
                    </label>
                    {form.sale_de_caja
                        ? <CajaOrigen value={form.bodega_id} onChange={v => setForm(f => ({ ...f, bodega_id: v }))} />
                        : <div style={{ fontSize: 13, color: 'var(--texto-2)' }}>No se descuenta de la caja (pagado por transferencia u otro medio).</div>}
                </div>
                {msg && <Aviso tipo="error" style={{ marginTop: 12 }}>{msg}</Aviso>}
        </Modal>
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
        <div className="pagina">
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

            <EncabezadoPagina titulo="Vehículos" sub="Camiones, gastos de gasolina y viáticos" icono="vehiculos" acciones={<Boton icono="agregar" onClick={() => setModalVehiculo('nuevo')}>Nuevo vehículo</Boton>} />

            {/* Tarjetas de vehículos */}
            <div className="rejilla-tarjetas" style={{ marginBottom: 16 }}>
                {vehiculos.map(v => (
                    <div key={v.id} onClick={() => setSeleccionado(seleccionado?.id === v.id ? null : v)}
                        className="tarjeta"
                        style={{ background: seleccionado?.id === v.id ? 'var(--verde-suave)' : '#fff', borderColor: seleccionado?.id === v.id ? 'var(--verde)' : 'var(--borde)', cursor: 'pointer', padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--noche)', color: 'var(--verde-vivo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Icono nombre="vehiculos" tam={21} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div className="cifra" style={{ fontSize: 19 }}>{v.placa}</div>
                                    <Chip tono="gris" style={{ marginTop: 4 }}>{TIPO_LABELS[v.tipo] || v.tipo}</Chip>
                                </div>
                            </div>
                            {seleccionado?.id === v.id && <Chip tono="verde">Seleccionado</Chip>}
                        </div>
                        {v.descripcion && <div style={{ fontSize: 13, color: 'var(--texto-2)', marginTop: 12 }}>{v.descripcion}</div>}
                        {v.conductor && <div style={{ fontSize: 13, color: 'var(--texto-3)', marginTop: 4 }}>Conductor: {v.conductor}</div>}
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, marginTop: 14 }}>
                            <Boton variante="noche" icono="caja" onClick={e => { e.stopPropagation(); setModalGasto(v); }}>Registrar gasto</Boton>
                            <Boton variante="secundario" onClick={e => { e.stopPropagation(); setModalVehiculo(v); }}>Editar</Boton>
                        </div>
                    </div>
                ))}
                {vehiculos.length === 0 && (
                    <Tarjeta style={{ gridColumn: '1/-1' }}>
                        <Vacio icono="vehiculos" texto="No hay vehículos registrados" />
                    </Tarjeta>
                )}
            </div>

            {/* Filtros de gastos */}
            <Tarjeta titulo="Consultar gastos" icono="calendario" style={{ marginBottom: 16 }}>
                <div className="rejilla-form">
                    <Campo etiqueta="Desde">
                        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={estiloInput} />
                    </Campo>
                    <Campo etiqueta="Hasta">
                        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={estiloInput} />
                    </Campo>
                {!seleccionado && (
                    <Campo etiqueta="Vehículo">
                        <PickerBuscable
                            items={vehiculos}
                            value={filtroVehiculo}
                            onChange={setFiltroVehiculo}
                            getLabel={v => v.placa}
                            placeholder="Buscar placa..."
                            fontSize={13}
                        />
                    </Campo>
                )}
                    {seleccionado && (
                        <Campo etiqueta="Vehículo seleccionado">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 42 }}>
                                <Chip tono="verde">{seleccionado.placa}</Chip>
                                <Boton tam="sm" variante="fantasma" onClick={() => setSeleccionado(null)}>Quitar filtro</Boton>
                            </div>
                        </Campo>
                    )}
                </div>
            </Tarjeta>

            {/* Resumen de gastos */}
            {gastos.length > 0 && (
                <RejillaKpi>
                    <Kpi titulo="Total gastos" valor={`$${fmt(totalGastos)}`} icono="caja" tono="verde" />
                    {Object.entries(gastosPorTipo).map(([tipo, monto]) => (
                        <Kpi key={tipo} titulo={GASTO_LABELS[tipo] || tipo} valor={`$${fmt(monto)}`} icono="caja" tono={GASTO_TONOS[tipo] || 'gris'} />
                    ))}
                </RejillaKpi>
            )}

            {/* Tabla de gastos */}
            <Tarjeta titulo={`Gastos registrados (${gastos.length})`} icono="caja" sinPadding>
                {gastos.length === 0 ? (
                    <Vacio icono="caja" texto="No hay gastos en este período" />
                ) : (
                    <>
                    <div className="solo-pc">
                    <ContenedorTabla><table style={estiloTabla}>
                        <thead>
                            <tr>
                                {['Fecha','Vehículo','Tipo','Monto','Descripción','Km',''].map(h => (
                                    <th key={h} style={h === 'Monto' ? { ...estiloTh, textAlign: 'right' } : estiloTh}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {gastos.map(g => (
                                <tr key={g.id}>
                                    <td style={{ ...estiloTd, color: 'var(--texto-2)' }}>{g.fecha}</td>
                                    <td style={{ ...estiloTd, fontWeight: 700 }}>{g.vehiculo?.placa || '—'}</td>
                                    <td style={estiloTd}>
                                        <Chip tono={GASTO_TONOS[g.tipo] || 'gris'}>{GASTO_LABELS[g.tipo] || g.tipo}</Chip>
                                    </td>
                                    <td style={{ ...estiloTdNum, fontWeight: 700, color: 'var(--verde-osc)' }}>${fmt(g.monto)}</td>
                                    <td style={{ ...estiloTd, color: 'var(--texto-2)' }}>{g.descripcion || '—'}</td>
                                    <td style={{ ...estiloTd, color: 'var(--texto-3)' }}>{g.km_actual ? `${g.km_actual.toLocaleString()} km` : '—'}</td>
                                    <td style={estiloTd}>
                                        <Boton tam="sm" variante="peligro" onClick={() => eliminarGasto(g.vehiculo_id, g.id)}>Eliminar</Boton>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table></ContenedorTabla>
                    </div>
                    <div className="solo-movil">
                        {gastos.map(g => (
                            <div key={g.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--borde)' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                                    <div>
                                        <div style={{ fontWeight: 700 }}>{g.vehiculo?.placa || '—'}</div>
                                        <div style={{ color: 'var(--texto-3)', fontSize: 13, marginTop: 2 }}>{g.fecha}</div>
                                    </div>
                                    <div className="cifra" style={{ color: 'var(--verde-osc)', fontSize: 18 }}>${fmt(g.monto)}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
                                    <div style={{ minWidth: 0 }}>
                                        <Chip tono={GASTO_TONOS[g.tipo] || 'gris'}>{GASTO_LABELS[g.tipo] || g.tipo}</Chip>
                                        {g.descripcion && <div style={{ color: 'var(--texto-2)', fontSize: 13, marginTop: 7 }}>{g.descripcion}</div>}
                                        {g.km_actual && <div style={{ color: 'var(--texto-3)', fontSize: 13, marginTop: 3 }}>{g.km_actual.toLocaleString()} km</div>}
                                    </div>
                                    <Boton tam="sm" variante="peligro" onClick={() => eliminarGasto(g.vehiculo_id, g.id)}>Eliminar</Boton>
                                </div>
                            </div>
                        ))}
                    </div>
                    </>
                )}
            </Tarjeta>
        </div>
    );
}
