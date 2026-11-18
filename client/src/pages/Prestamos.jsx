import React, { useState, useEffect } from 'react';
import { api } from '../api';
import PickerBuscable from '../components/PickerBuscable';
import CajaOrigen from '../components/CajaOrigen';
import {
    EncabezadoPagina, Boton, Pestanas, Tarjeta, Kpi, RejillaKpi, Chip, ContenedorTabla,
    estiloTabla, estiloTh, estiloTd, estiloTdNum, estiloInput, Campo, Modal,
    Vacio, Aviso
} from '../components/ui';

// Fecha de Colombia (con toISOString, después de las 7 pm ya daba "mañana" y la plata caía en la caja del día siguiente)
const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const fmt = n => Number(n || 0).toLocaleString('es-CO');

function ModalNuevoPrestamo({ onClose, onSaved }) {
    const [tipo, setTipo] = useState('reciclador');
    const [personas, setPersonas] = useState([]);
    const [form, setForm] = useState({ persona_id: '', monto: '', fecha: hoy(), descripcion: '', quincena: '', bodega_id: '' });
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
            await api.post(endpoint, { monto: form.monto, fecha: form.fecha, descripcion: form.descripcion, quincena: form.quincena, bodega_id: form.bodega_id });
            onSaved();
        } catch (err) { setMsg(err.message); }
        finally { setLoading(false); }
    };

    return (
        <Modal titulo="Nuevo préstamo" onCerrar={onClose}
            pie={<><Boton variante="secundario" onClick={onClose}>Cancelar</Boton><Boton onClick={guardar} disabled={loading}>{loading ? 'Guardando...' : 'Registrar préstamo'}</Boton></>}>
                <div className="rejilla-form">
                    <Campo etiqueta="Tipo">
                        <div style={{ display: 'flex', gap: 8 }}>
                            {[['reciclador','Reciclador'],['empleado','Empleado']].map(([k,l]) => (
                                <Boton key={k} variante={tipo === k ? 'primario' : 'secundario'} ancho onClick={() => setTipo(k)}>
                                    {l}
                                </Boton>
                            ))}
                        </div>
                    </Campo>
                    <Campo etiqueta={`${tipo === 'reciclador' ? 'Reciclador' : 'Empleado'} *`}>
                        <PickerBuscable
                            items={personas}
                            value={form.persona_id}
                            onChange={id => setForm({ ...form, persona_id: id })}
                            placeholder={`Buscar ${tipo === 'reciclador' ? 'reciclador' : 'empleado'}...`}
                            fontSize={13}
                        />
                    </Campo>
                    <Campo etiqueta="Monto ($) *">
                        <input type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })}
                            style={estiloInput} />
                    </Campo>
                    <Campo etiqueta="Fecha">
                        <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}
                            style={estiloInput} />
                    </Campo>
                    <Campo etiqueta="Descripción / Motivo">
                        <input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                            style={estiloInput} />
                    </Campo>
                    <CajaOrigen value={form.bodega_id} onChange={v => setForm(f => ({ ...f, bodega_id: v }))} />
                    {tipo === 'empleado' && (
                        <Campo etiqueta="Quincena (ej: 2026-05-15)">
                            <input value={form.quincena} onChange={e => setForm({ ...form, quincena: e.target.value })}
                                style={estiloInput} />
                        </Campo>
                    )}
                </div>
                {msg && <Aviso tipo="error" style={{ marginTop: 8 }}>{msg}</Aviso>}
        </Modal>
    );
}

export default function Prestamos() {
    const [tab, setTab] = useState('pendientes');
    const [prestamosRec, setPrestamosRec] = useState([]);
    const [prestamosEmp, setPrestamosEmp] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [filtroTipo, setFiltroTipo] = useState('todos');

    // Una sola petición trae TODOS los préstamos (antes era una por persona → saturaba)
    const cargar = async () => {
        try {
            const d = await api.get('/prestamos');
            setPrestamosRec(d.recicladores || []);
            setPrestamosEmp(d.empleados || []);
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

    return (
        <div className="pagina">
            {showModal && <ModalNuevoPrestamo onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); cargar(); }} />}

            <EncabezadoPagina titulo="Préstamos" sub="Recicladores y empleados con saldo pendiente" icono="prestamos" acciones={<Boton icono="agregar" onClick={() => setShowModal(true)}>Nuevo préstamo</Boton>} />

            <RejillaKpi>
                <Kpi titulo="Total pendiente" valor={`$${fmt(totalPendRec + totalPendEmp)}`} tono="rojo" />
                <Kpi titulo="Recicladores" valor={`$${fmt(totalPendRec)}`} tono="verde" />
                <Kpi titulo="Empleados" valor={`$${fmt(totalPendEmp)}`} tono="marco" />
                <Kpi titulo="Total préstamos" valor={pendientes.length} tono="claro" />
            </RejillaKpi>

            {/* Filtros */}
            <Pestanas
                items={[
                    { id: 'pendientes', label: `Pendientes (${pendientes.length})`, icono: 'prestamos' },
                    { id: 'pagados', label: `Pagados (${pagados.length})`, icono: 'prestamos' },
                ]}
                activa={tab}
                onChange={setTab}
            />

            <Tarjeta style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="etiqueta" style={{ color: 'var(--texto-2)' }}>Mostrar</span>
                    {[['todos','Todos'],['reciclador','Recicladores'],['empleado','Empleados']].map(([k,l]) => (
                        <Boton key={k} tam="sm" variante={filtroTipo === k ? 'noche' : 'secundario'} onClick={() => setFiltroTipo(k)}>
                            {l}
                        </Boton>
                    ))}
                </div>
            </Tarjeta>

            {/* Tabla */}
            <Tarjeta sinPadding>
                {filtrados.length === 0 ? (
                    <Vacio icono="prestamos" texto={`No hay préstamos ${tab === 'pendientes' ? 'pendientes' : 'pagados'}`} />
                ) : (
                    <>
                    <div className="solo-pc">
                    <ContenedorTabla><table style={estiloTabla}>
                        <thead>
                            <tr>
                                {['Persona','Tipo','Monto','Fecha','Descripción','Estado','Acción'].map(h => (
                                    <th key={h} style={h === 'Monto' ? { ...estiloTh, textAlign: 'right' } : estiloTh}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtrados.map((p, i) => (
                                <tr key={i}>
                                    <td style={{ ...estiloTd, fontWeight: 700 }}>{p.persona}</td>
                                    <td style={estiloTd}>
                                        <Chip tono={p.tipo === 'reciclador' ? 'verde' : 'azul'}>
                                            {p.tipo === 'reciclador' ? 'Reciclador' : 'Empleado'}
                                        </Chip>
                                    </td>
                                    <td style={estiloTdNum}>
                                        <div className="cifra">${fmt(p.monto)}</div>
                                        {parseFloat(p.abonado || 0) > 0 && (
                                            <div style={{ fontSize: 11, marginTop: 2 }}>
                                                <span style={{ color: 'var(--verde-osc)' }}>Abonado ${fmt(p.abonado)}</span>
                                                {!(p.pagado || p.descontado) && <span style={{ color: 'var(--rojo)', fontWeight: 700 }}> · Saldo ${fmt(saldoDe(p))}</span>}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ ...estiloTd, color: 'var(--texto-2)', whiteSpace: 'nowrap' }}>{p.fecha ? p.fecha.split('-').reverse().join('/') : '—'}{p.createdAt ? <span style={{ color: 'var(--texto-3)' }}><br />{new Date(p.createdAt).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' })}</span> : ''}</td>
                                    <td style={{ ...estiloTd, color: 'var(--texto-2)' }}>{p.descripcion || '—'}</td>
                                    <td style={estiloTd}>
                                        {(p.pagado || p.descontado)
                                            ? <Chip tono="verde">Pagado</Chip>
                                            : <Chip tono="ambar">Pendiente</Chip>
                                        }
                                    </td>
                                    <td style={estiloTd}>
                                        {(p.pagado || p.descontado)
                                            ? <Boton tam="sm" variante="secundario" onClick={() => marcarPagado(p, false)}>Marcar pendiente</Boton>
                                            : <div style={{ display: 'flex', gap: 6 }}>
                                                <Boton tam="sm" variante="secundario" onClick={() => abonar(p)}>Abonar</Boton>
                                                <Boton tam="sm" onClick={() => marcarPagado(p, true)}>Pagado</Boton>
                                              </div>
                                        }
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table></ContenedorTabla>
                    </div>
                    <div className="solo-movil">
                        {filtrados.map((p, i) => (
                            <div key={i} style={{ padding: '14px', borderBottom: '1px solid var(--borde)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 15 }}>{p.persona}</div>
                                        <div style={{ color: 'var(--texto-2)', fontSize: 13, marginTop: 3 }}>{p.fecha ? p.fecha.split('-').reverse().join('/') : '—'}</div>
                                    </div>
                                    <div className="cifra" style={{ fontSize: 18, whiteSpace: 'nowrap' }}>${fmt(p.monto)}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                                    <Chip tono={p.tipo === 'reciclador' ? 'verde' : 'azul'}>{p.tipo === 'reciclador' ? 'Reciclador' : 'Empleado'}</Chip>
                                    <Chip tono={p.pagado || p.descontado ? 'verde' : 'ambar'}>{p.pagado || p.descontado ? 'Pagado' : 'Pendiente'}</Chip>
                                </div>
                                {p.descripcion && <div style={{ color: 'var(--texto-2)', fontSize: 13, marginTop: 9, overflowWrap: 'anywhere' }}>{p.descripcion}</div>}
                                {parseFloat(p.abonado || 0) > 0 && <div style={{ color: 'var(--verde-osc)', fontSize: 13, marginTop: 8 }}>Abonado ${fmt(p.abonado)}{!(p.pagado || p.descontado) && ` · Saldo $${fmt(saldoDe(p))}`}</div>}
                                <div style={{ display: 'grid', gridTemplateColumns: p.pagado || p.descontado ? '1fr' : '1fr 1fr', gap: 8, marginTop: 12 }}>
                                    {(p.pagado || p.descontado)
                                        ? <Boton variante="secundario" onClick={() => marcarPagado(p, false)}>Marcar pendiente</Boton>
                                        : <><Boton variante="secundario" onClick={() => abonar(p)}>Abonar</Boton><Boton onClick={() => marcarPagado(p, true)}>Pagado</Boton></>
                                    }
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
