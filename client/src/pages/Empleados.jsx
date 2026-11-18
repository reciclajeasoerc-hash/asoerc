import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import CajaOrigen from '../components/CajaOrigen';
import {
    EncabezadoPagina, Boton, Pestanas, Tarjeta, Kpi, RejillaKpi, Chip,
    ContenedorTabla, estiloTabla, estiloTh, estiloTd, estiloTdNum, estiloInput,
    Campo, Buscador, Modal, Vacio, Aviso
} from '../components/ui';

const fmt = n => Number(n || 0).toLocaleString('es-CO');
// Fecha de Colombia (con toISOString, después de las 7 pm ya daba "mañana" y la plata caía en la caja del día siguiente)
const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

// Lista cada fecha (día por día) entre inicio y fin, inclusive. Parseo manual para evitar
// que la zona horaria corra el día.
const fechasEntre = (ini, fin) => {
    if (!ini) return [];
    const [ay, am, ad] = ini.split('-').map(Number);
    const [by, bm, bd] = (fin || ini).split('-').map(Number);
    const cur = new Date(ay, am - 1, ad);
    const end = new Date(by, bm - 1, bd);
    const out = [];
    let g = 0;
    while (cur <= end && g < 366) { out.push(new Date(cur)); cur.setDate(cur.getDate() + 1); g++; }
    return out;
};
const etiquetaDia = d => d.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' });

export default function Empleados() {
    const { user } = useAuth();
    const esSuper = user?.rol === 'superadmin';
    const [empleados, setEmpleados] = useState([]);
    const [busquedaEmp, setBusquedaEmp] = useState('');
    const [bodegas, setBodegas] = useState([]);
    const [selected, setSelected] = useState(null);
    const [tab, setTab] = useState('prestamos');
    // Celular: la ficha queda debajo de la lista; al elegir a alguien se baja hasta ella.
    useEffect(() => {
        if (selected && window.innerWidth < 900) document.getElementById('detalle-empleado')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [selected?.id]);
    const [prestamos, setPrestamos] = useState([]);
    const [dias, setDias] = useState([]);
    const [showEmp, setShowEmp] = useState(false);
    const [editando, setEditando] = useState(null);
    const [showP, setShowP] = useState(false);
    const [showD, setShowD] = useState(false);
    const [form, setForm] = useState({ nombre: '', cedula: '', telefono: '', bodega_id: '', cargo: '', salario: '', tipo_salario: 'mensual' });
    const [nForm, setNForm] = useState({ desde: '', hasta: hoy(), dias_periodo: '15', tipo: 'mensual' });
    const [pForm, setPForm] = useState({ monto: '', descripcion: '', quincena: '', fecha: hoy(), bodega_id: '' });
    const [dForm, setDForm] = useState({ fecha_inicio: hoy(), fecha_fin: hoy(), dias: '', motivo: '', quincena: '' });
    const [msg, setMsg] = useState('');

    useEffect(() => {
        api.get('/bodegas').then(d => setBodegas(d.bodegas));
        cargar();
    }, []);

    const cargar = () => api.get('/empleados').then(d => setEmpleados(d.empleados)).catch(() => {});

    const seleccionar = async (e) => {
        setSelected(e);
        setNForm(f => ({ ...f, tipo: e.tipo_salario === 'dia' ? 'dia' : 'mensual' }));
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
    // Valor de un día según el modo:
    //  'mensual'  → el salario es del MES; el día vale salario / (días del periodo × 2)  [el mes ≈ 2 quincenas]
    //  'completo' → el salario es el fijo del PERIODO (la quincena); el día vale salario / díasPeriodo
    //  'dia'      → el salario YA es el valor de un día
    const valorDia =
        nForm.tipo === 'dia'     ? salarioBase :
        nForm.tipo === 'mensual' ? (diasPeriodo ? salarioBase / (diasPeriodo * 2) : 0) :
                                   (diasPeriodo ? salarioBase / diasPeriodo : 0);
    // Solo cuentan los días NO archivados (descontado=false) dentro del rango; los archivados
    // quedan en el historial pero ya no descuentan de la nómina.
    const diasNoLab     = dias
        .filter(d => !d.descontado && (!nForm.desde || d.fecha_inicio >= nForm.desde) && (!nForm.hasta || d.fecha_inicio <= nForm.hasta))
        .reduce((s, d) => s + parseFloat(d.dias || 0), 0);
    const diasPagados   = Math.max(0, diasPeriodo - diasNoLab);
    // 'completo' = monto fijo del periodo menos las faltas; 'mensual' y 'dia' = días pagados × valor día
    const sueldoBruto   = nForm.tipo === 'completo'
        ? Math.max(0, salarioBase - diasNoLab * valorDia)
        : Math.max(0, diasPagados * valorDia);
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
            alert(`Pago registrado ✅\nNeto pagado: $${fmt(netoPagar)}\nTodos los préstamos quedaron saldados (en $0).`);
        } catch (err) { setMsg(err.message); }
    };

    // Pago PARCIAL: descuenta solo una parte de los préstamos (abono); el resto queda como saldo.
    const registrarNominaParcial = async () => {
        if (!selected) return;
        const sugerido = Math.max(0, Math.min(Math.round(sueldoBruto), Math.round(totalPrestamos)));
        const entrada = window.prompt(
            `Pago de ${selected.nombre}\nSueldo de la quincena: $${fmt(Math.round(sueldoBruto))}\nPréstamos pendientes: $${fmt(Math.round(totalPrestamos))}\n\n¿Cuánto descontar de préstamos en ESTE pago?\n(el resto le queda como saldo pendiente)`,
            String(sugerido)
        );
        if (entrada === null) return;
        const monto = parseFloat(String(entrada).replace(/[^\d.]/g, ''));
        if (isNaN(monto) || monto < 0) return setMsg('Monto inválido');
        try {
            if (monto > 0) await api.post(`/empleados/${selected.id}/prestamos/abonar-masivo`, { monto });
            await seleccionar(selected);
            setMsg('');
            const netoParcial = sueldoBruto - monto;
            alert(`Pago registrado ✅\nSe descontó $${fmt(monto)} de préstamos.\nNeto pagado: $${fmt(Math.round(netoParcial))}\nEl resto de los préstamos queda como saldo pendiente.`);
        } catch (err) { setMsg(err.message); }
    };

    const nuevoEmpleado = () => {
        setEditando(null);
        setForm({ nombre: '', cedula: '', telefono: '', bodega_id: '', cargo: '', salario: '', tipo_salario: 'mensual' });
        setMsg('');
        setShowEmp(s => !s);
    };

    const editarEmpleado = (e) => {
        setEditando(e.id);
        setForm({ nombre: e.nombre || '', cedula: e.cedula || '', telefono: e.telefono || '', bodega_id: e.bodega_id || '', cargo: e.cargo || '', salario: e.salario || '', tipo_salario: e.tipo_salario === 'dia' ? 'dia' : 'mensual' });
        setMsg('');
        setShowEmp(true);
    };

    const eliminarEmpleado = async (e) => {
        if (!window.confirm(`¿Eliminar al empleado "${e.nombre}"?\n\nSe quita de la lista. Su historial (préstamos, nómina, días) se conserva por seguridad.`)) return;
        try {
            await api.delete(`/empleados/${e.id}`);
            if (selected?.id === e.id) setSelected(null);
            const actualizados = await api.get('/empleados').then(d => d.empleados).catch(() => empleados.filter(x => x.id !== e.id));
            setEmpleados(actualizados);
        } catch (err) { setMsg(err.message); }
    };

    const guardarEmpleado = async () => {
        if (!form.nombre) return setMsg('Nombre requerido');
        try {
            if (editando) await api.put(`/empleados/${editando}`, form);
            else await api.post('/empleados', form);
            setShowEmp(false); setEditando(null); setMsg('');
            setForm({ nombre: '', cedula: '', telefono: '', bodega_id: '', cargo: '', salario: '', tipo_salario: 'mensual' });
            const actualizados = await api.get('/empleados').then(d => d.empleados).catch(() => empleados);
            setEmpleados(actualizados);
            if (selected && editando === selected.id) {
                const nuevo = actualizados.find(x => x.id === selected.id);
                if (nuevo) { setSelected(nuevo); setNForm(f => ({ ...f, tipo: nuevo.tipo_salario === 'dia' ? 'dia' : 'mensual' })); }
            }
        }
        catch (err) { setMsg(err.message); }
    };

    const guardarPrestamo = async () => {
        if (!selected || !pForm.monto) return;
        try {
            await api.post(`/empleados/${selected.id}/prestamos`, { ...pForm, fecha: hoy() });
            setPForm(f => ({ monto: '', descripcion: '', quincena: '', fecha: hoy(), bodega_id: f.bodega_id }));
            setShowP(false); seleccionar(selected);
        }
        catch (err) { setMsg(err.message); alert(err.message); }
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

    // Reiniciar (solo superadmin): poner préstamos en cero / borrar días no laborados.
    const reiniciarPrestamosEmp = async () => {
        if (!selected) return;
        if (!window.confirm(`¿Poner en CERO todos los préstamos de ${selected.nombre}?\n\nSe marcarán todos como pagados y su saldo queda en $0.`)) return;
        try {
            const d = await api.post(`/empleados/${selected.id}/prestamos/reiniciar`, {});
            await seleccionar(selected);
            alert(`Listo ✅\nSe saldaron ${d.cantidad} préstamo(s) por $${fmt(d.total_saldado)}.\nSaldo actual: $0.`);
        } catch (err) { setMsg(err.message); }
    };
    const reiniciarDiasEmp = async () => {
        if (!selected) return;
        if (!window.confirm(`¿Archivar los días no laborados pendientes de ${selected.nombre}?\n\nQuedan en el HISTORIAL (no se borran) y dejan de contar para la nómina. Sirve para empezar la quincena limpia.`)) return;
        try {
            const d = await api.delete(`/empleados/${selected.id}/dias-no-laborados`);
            await seleccionar(selected);
            alert(`Listo ✅\nSe archivaron ${d.cantidad} registro(s).\nSiguen en el historial pero ya no descuentan de la nómina.`);
        } catch (err) { setMsg(err.message); }
    };

    return (
        <div className="pagina">
            <EncabezadoPagina titulo="Empleados" sub="Préstamos y días no laborados" icono="empleados" acciones={<Boton icono="agregar" onClick={nuevoEmpleado}>Nuevo</Boton>} />

            {showEmp && (
                <Modal titulo={editando ? 'Editar empleado' : 'Nuevo empleado'} onCerrar={() => { setShowEmp(false); setEditando(null); }}
                    pie={<>
                        <Boton variante="secundario" onClick={() => { setShowEmp(false); setEditando(null); }}>Cancelar</Boton>
                        <Boton onClick={guardarEmpleado}>{editando ? 'Actualizar' : 'Guardar'}</Boton>
                    </>}>
                    <div className="rejilla-form">
                        {[['nombre','Nombre*'],['cedula','Cédula'],['telefono','Teléfono'],['cargo','Cargo'],['salario','Salario']].map(([k,l]) => (
                            <Campo key={k} etiqueta={l}>
                                <input value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
                                    style={estiloInput} />
                            </Campo>
                        ))}
                        <Campo etiqueta="Bodega">
                            <select value={form.bodega_id} onChange={e => setForm({ ...form, bodega_id: e.target.value })}
                                style={estiloInput}>
                                <option value="">--</option>
                                {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                            </select>
                        </Campo>
                        <Campo etiqueta="Cómo se le paga">
                            <select value={form.tipo_salario} onChange={e => setForm({ ...form, tipo_salario: e.target.value })}
                                style={estiloInput}>
                                <option value="mensual">Sueldo mensual (se paga por quincena)</option>
                                <option value="completo">Sueldo fijo por quincena</option>
                                <option value="dia">Por día trabajado (jornal)</option>
                            </select>
                        </Campo>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--texto-2)', marginTop: 12, lineHeight: 1.45 }}>
                        En <strong>Salario</strong>: si elegiste <strong>"Sueldo mensual"</strong> escribe el sueldo del MES (ej: 2.000.000) — el sistema paga la mitad cada quincena. Si es <strong>"por quincena"</strong>, escribe lo de UNA quincena. Si es <strong>"por día"</strong>, el valor de un día.
                    </div>
                    {msg && <Aviso tipo="error">{msg}</Aviso>}
                </Modal>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: selected ? 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))' : '1fr', gap: 14 }}>
                <Tarjeta sinPadding>
                    <div style={{ padding: 14, borderBottom: '1.5px solid var(--borde)' }}>
                        <Buscador value={busquedaEmp} onChange={setBusquedaEmp} placeholder="Buscar empleado por nombre o cargo..." />
                    </div>
                    {/* Celular: una tarjeta por empleado */}
                    <div className="solo-movil">
                        {empleados.filter(e => !busquedaEmp.trim() || `${e.nombre || ''} ${e.cargo || ''} ${e.cedula || ''}`.toLowerCase().includes(busquedaEmp.trim().toLowerCase())).map(e => (
                            <div key={e.id} style={{ padding: '12px 14px', borderBottom: '1px solid #eef1f4', background: selected?.id === e.id ? 'var(--verde-suave)' : 'transparent' }}>
                                <div onClick={() => seleccionar(e)} style={{ cursor: 'pointer', marginBottom: 10 }}>
                                    <div style={{ fontWeight: 700, fontSize: 15, textTransform: 'capitalize' }}>{e.nombre}</div>
                                    <div style={{ fontSize: 12.5, color: 'var(--texto-3)', marginTop: 2 }}>{[e.cargo, e.bodega?.nombre].filter(Boolean).join(' · ')}</div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                                    <Boton tam="sm" variante="noche" onClick={() => seleccionar(e)}>Ver</Boton>
                                    <Boton tam="sm" variante="secundario" onClick={() => editarEmpleado(e)}>Editar</Boton>
                                    <Boton tam="sm" variante="peligro" onClick={() => eliminarEmpleado(e)}>Eliminar</Boton>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="solo-pc"><ContenedorTabla><table style={estiloTabla}>
                        <thead><tr>
                            {['Nombre','Cargo','Bodega',''].map(h => <th key={h} style={estiloTh}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                            {empleados.filter(e => !busquedaEmp.trim() || `${e.nombre || ''} ${e.cargo || ''} ${e.cedula || ''}`.toLowerCase().includes(busquedaEmp.trim().toLowerCase())).map(e => (
                                <tr key={e.id} onClick={() => seleccionar(e)} style={{ cursor: 'pointer', background: selected?.id === e.id ? 'var(--verde-suave)' : 'transparent' }}>
                                    <td style={{ ...estiloTd, fontWeight: 700 }}>{e.nombre}</td>
                                    <td style={{ ...estiloTd, color: 'var(--texto-2)' }}>{e.cargo}</td>
                                    <td style={{ ...estiloTd, color: 'var(--texto-2)' }}>{e.bodega?.nombre}</td>
                                    <td style={estiloTd}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <Boton tam="sm" variante="secundario" onClick={ev => { ev.stopPropagation(); seleccionar(e); }}>Ver</Boton>
                                            <Boton tam="sm" variante="fantasma" onClick={ev => { ev.stopPropagation(); editarEmpleado(e); }}>Editar</Boton>
                                            <Boton tam="sm" variante="peligro" onClick={ev => { ev.stopPropagation(); eliminarEmpleado(e); }}>Eliminar</Boton>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table></ContenedorTabla></div>
                    {empleados.filter(e => !busquedaEmp.trim() || `${e.nombre || ''} ${e.cargo || ''} ${e.cedula || ''}`.toLowerCase().includes(busquedaEmp.trim().toLowerCase())).length === 0 && <Vacio icono="empleados" texto="Sin empleados para mostrar" />}
                </Tarjeta>

                {selected && (
                    <Tarjeta style={{ scrollMarginTop: 12 }}><span id="detalle-empleado" />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ minWidth: 0 }}>
                                <h2 className="tit-seccion">{selected.nombre}</h2>
                                <div style={{ fontSize: 13, color: 'var(--texto-2)', marginTop: 4 }}>{selected.cargo} · {selected.bodega?.nombre}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                <Boton tam="sm" variante="secundario" onClick={() => editarEmpleado(selected)}>Editar</Boton>
                                <Boton tam="sm" variante="peligro" onClick={() => eliminarEmpleado(selected)}>Eliminar</Boton>
                                <Boton tam="sm" variante="fantasma" onClick={() => setSelected(null)} aria-label="Cerrar ficha">Cerrar</Boton>
                            </div>
                        </div>
                        <Pestanas activa={tab} onChange={setTab} items={[
                            { id: 'prestamos', label: 'Préstamos', icono: 'prestamos' },
                            { id: 'dias', label: 'Días no laborados', icono: 'calendario' },
                            { id: 'nomina', label: 'Nómina', icono: 'caja' },
                        ]} />

                        {tab === 'prestamos' && (
                            <>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                                    <Boton tam="sm" variante="secundario" onClick={() => setShowP(!showP)}>Nuevo préstamo</Boton>
                                    {esSuper && <Boton tam="sm" variante="peligro" onClick={reiniciarPrestamosEmp} title="Marcar todos los préstamos como pagados (saldo en cero)">Poner en cero</Boton>}
                                </div>
                                {showP && (
                                    <Modal titulo="Registrar préstamo" onCerrar={() => setShowP(false)}
                                        pie={<>
                                            <Boton variante="secundario" onClick={() => setShowP(false)}>Cancelar</Boton>
                                            <Boton onClick={guardarPrestamo}>Registrar</Boton>
                                        </>}>
                                        <div className="rejilla-form">
                                            <Campo etiqueta="Monto">
                                                <input type="number" value={pForm.monto} onChange={e => setPForm({ ...pForm, monto: e.target.value })} style={estiloInput} />
                                            </Campo>
                                            <Campo etiqueta="Quincena">
                                                <input placeholder="Ej: 2026-05-1" value={pForm.quincena} onChange={e => setPForm({ ...pForm, quincena: e.target.value })} style={estiloInput} />
                                            </Campo>
                                        </div>
                                        <Campo etiqueta="Descripción" style={{ marginTop: 12 }}>
                                            <input value={pForm.descripcion} onChange={e => setPForm({ ...pForm, descripcion: e.target.value })} style={estiloInput} />
                                        </Campo>
                                        <div style={{ marginTop: 12 }}><CajaOrigen value={pForm.bodega_id} onChange={v => setPForm(f => ({ ...f, bodega_id: v }))} /></div>
                                    </Modal>
                                )}
                                {prestamos.map(p => (
                                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--borde)', fontSize: 13 }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div><span className="cifra" style={{ fontSize: 16 }}>${fmt(p.monto)}</span> <span style={{ color: 'var(--texto-2)' }}>{p.descripcion}</span></div>
                                            <div style={{ color: 'var(--texto-3)', fontSize: 12, marginTop: 3 }}>{p.fecha ? p.fecha.split('-').reverse().join('/') : '—'}{p.createdAt ? ' · ' + new Date(p.createdAt).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                                            {parseFloat(p.abonado || 0) > 0 && (
                                                <div style={{ fontSize: 12, marginTop: 3 }}>
                                                    <span style={{ color: 'var(--verde-osc)' }}>Abonado ${fmt(p.abonado)}</span>
                                                    {!p.descontado && <span style={{ color: 'var(--rojo)', fontWeight: 700 }}> · Saldo ${fmt(saldoDe(p))}</span>}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                            {p.quincena && <Chip tono="gris">{p.quincena}</Chip>}
                                            <Chip tono={p.descontado ? 'verde' : 'rojo'}>{p.descontado ? 'Descontado' : 'Pendiente'}</Chip>
                                            {!p.descontado && (
                                                <Boton tam="sm" variante="secundario" onClick={() => abonarPrestamoEmp(p)} title="Registrar un abono (pago parcial)">Abonar</Boton>
                                            )}
                                            <Boton tam="sm" variante={p.descontado ? 'secundario' : 'primario'} onClick={() => togglePrestamo(p)} title={p.descontado ? 'Marcar como pendiente' : 'Marcar como pagado / descontado'}>{p.descontado ? 'Reabrir' : 'Pagar'}</Boton>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}

                        {tab === 'dias' && (
                            <>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                                    <Boton tam="sm" variante="secundario" onClick={() => setShowD(!showD)}>Registrar días no laborados</Boton>
                                    {esSuper && <Boton tam="sm" variante="secundario" onClick={reiniciarDiasEmp} title="Archivar los días no laborados pendientes (quedan en el historial, dejan de contar para la nómina)">Archivar / reiniciar</Boton>}
                                </div>
                                {showD && (
                                    <Modal titulo="Registrar días no laborados" onCerrar={() => setShowD(false)}
                                        pie={<>
                                            <Boton variante="secundario" onClick={() => setShowD(false)}>Cancelar</Boton>
                                            <Boton onClick={guardarDias}>Registrar</Boton>
                                        </>}>
                                        <div className="rejilla-form">
                                            <Campo etiqueta="Desde">
                                                <input type="date" value={dForm.fecha_inicio} onChange={e => setDForm({ ...dForm, fecha_inicio: e.target.value })} style={estiloInput} />
                                            </Campo>
                                            <Campo etiqueta="Hasta">
                                                <input type="date" value={dForm.fecha_fin} onChange={e => setDForm({ ...dForm, fecha_fin: e.target.value })} style={estiloInput} />
                                            </Campo>
                                            <Campo etiqueta="Cantidad de días">
                                                <input type="number" value={dForm.dias} onChange={e => setDForm({ ...dForm, dias: e.target.value })} step="0.5" style={estiloInput} />
                                            </Campo>
                                        </div>
                                        <div className="rejilla-form" style={{ marginTop: 12 }}>
                                            <Campo etiqueta="Motivo">
                                                <input value={dForm.motivo} onChange={e => setDForm({ ...dForm, motivo: e.target.value })} style={estiloInput} />
                                            </Campo>
                                            <Campo etiqueta="Quincena">
                                                <input value={dForm.quincena} onChange={e => setDForm({ ...dForm, quincena: e.target.value })} style={estiloInput} />
                                            </Campo>
                                        </div>
                                    </Modal>
                                )}
                                <div className="tit-seccion" style={{ fontSize: 15, margin: '4px 0 6px' }}>Historial de días no laborados</div>
                                {dias.length === 0 && <Vacio icono="calendario" texto="Sin registros todavía." />}
                                {dias.map(d => (
                                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--borde)', fontSize: 13, opacity: d.descontado ? .6 : 1 }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div><span style={{ fontWeight: 700 }}>{d.dias} días</span> <span style={{ color: 'var(--texto-2)' }}>{d.motivo}</span></div>
                                            <div style={{ color: 'var(--texto-3)', fontSize: 12, marginTop: 3 }}>{d.fecha_inicio} → {d.fecha_fin}</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                                {fechasEntre(d.fecha_inicio, d.fecha_fin).map((f, i) => (
                                                    <Chip key={i} tono="gris" style={{ textTransform: 'capitalize' }}>{etiquetaDia(f)}</Chip>
                                                ))}
                                            </div>
                                        </div>
                                        <Chip tono={d.descontado ? 'gris' : 'azul'}>{d.descontado ? 'Archivado' : 'Cuenta'}</Chip>
                                    </div>
                                ))}
                            </>
                        )}

                        {tab === 'nomina' && (
                            <>
                                <div style={{ background: '#f8fafc', border: '1.5px solid var(--borde)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }}>
                                        <label>
                                            <div className="etiqueta" style={{ fontSize: 12, color: 'var(--texto-2)', marginBottom: 5 }}>Desde</div>
                                            <input type="date" value={nForm.desde} onChange={e => setNForm({ ...nForm, desde: e.target.value })} style={estiloInput} />
                                        </label>
                                        <label>
                                            <div className="etiqueta" style={{ fontSize: 12, color: 'var(--texto-2)', marginBottom: 5 }}>Hasta</div>
                                            <input type="date" value={nForm.hasta} onChange={e => setNForm({ ...nForm, hasta: e.target.value })} style={estiloInput} />
                                        </label>
                                        <label>
                                            <div className="etiqueta" style={{ fontSize: 12, color: 'var(--texto-2)', marginBottom: 5 }}>Días del periodo</div>
                                            <input type="number" step="0.5" min="0" value={nForm.dias_periodo} onChange={e => setNForm({ ...nForm, dias_periodo: e.target.value })} style={estiloInput} />
                                        </label>
                                        <label>
                                            <div className="etiqueta" style={{ fontSize: 12, color: 'var(--texto-2)', marginBottom: 5 }}>Cómo se paga</div>
                                            <select value={nForm.tipo} onChange={e => setNForm({ ...nForm, tipo: e.target.value })} style={estiloInput}>
                                                <option value="mensual">Sueldo mensual (se paga por quincena)</option>
                                                <option value="completo">Sueldo fijo por quincena</option>
                                                <option value="dia">Por día trabajado (jornal)</option>
                                            </select>
                                        </label>
                                    </div>
                                    <div style={{ fontSize: 12.5, color: 'var(--texto-2)', lineHeight: 1.5 }}>
                                        {nForm.tipo === 'dia'
                                            ? <>Valor de un día: <strong>${fmt(salarioBase)}</strong> · Paga = días trabajados × ese valor.</>
                                            : nForm.tipo === 'mensual'
                                            ? <>Sueldo del mes: <strong>${fmt(salarioBase)}</strong> · Por quincena paga <strong>${fmt(Math.round(diasPeriodo * valorDia))}</strong> · cada día que falta descuenta <strong>${fmt(Math.round(valorDia))}</strong>.</>
                                            : <>Sueldo de la quincena: <strong>${fmt(salarioBase)}</strong> · Cada día que falta descuenta <strong>${fmt(Math.round(valorDia))}</strong> (÷ {diasPeriodo} días).</>}
                                    </div>
                                </div>

                                {[
                                    ['Días del periodo', diasPeriodo, 'var(--texto)'],
                                    ['Días no laborados', `− ${diasNoLab}`, 'var(--rojo)'],
                                    ['Días pagados', diasPagados, 'var(--verde-osc)'],
                                    ['Sueldo bruto', `$${fmt(Math.round(sueldoBruto))}`, 'var(--texto)'],
                                    [`Préstamos pendientes (${prestamosPend.length})`, `− $${fmt(Math.round(totalPrestamos))}`, 'var(--rojo)'],
                                ].map(([l, v, c]) => (
                                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: '1px solid #eef1f4', fontSize: 14 }}>
                                        <span style={{ color: 'var(--texto-2)' }}>{l}</span>
                                        <span className="cifra" style={{ fontSize: 16, color: c }}>{v}</span>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 12, background: 'var(--noche)', borderRadius: 10, padding: '13px 16px', borderLeft: '5px solid var(--verde)' }}>
                                    <span className="etiqueta" style={{ color: 'var(--verde-vivo)', fontSize: 14 }}>Neto a pagar</span>
                                    <span className="cifra" style={{ color: '#fff', fontSize: 26 }}>${fmt(Math.round(netoPagar))}</span>
                                </div>
                                <button onClick={registrarNomina} disabled={!salarioBase}
                                    style={{ width: '100%', marginTop: 12, minHeight: 48, padding: '10px', background: salarioBase ? 'var(--verde)' : 'var(--borde-fuerte)', color: '#fff', border: salarioBase ? '2px solid var(--verde-osc)' : '2px solid transparent', borderRadius: 10, fontFamily: 'var(--fuente-tit)', fontSize: 16.5, fontWeight: 800, letterSpacing: .4, cursor: salarioBase ? 'pointer' : 'default' }}>
                                    Pagar y saldar todo (préstamos en cero)
                                </button>
                                <button onClick={registrarNominaParcial} disabled={!salarioBase}
                                    style={{ width: '100%', marginTop: 8, minHeight: 48, padding: '10px', background: salarioBase ? 'var(--ambar-suave)' : '#f1f5f9', color: salarioBase ? '#5c4100' : 'var(--texto-3)', border: salarioBase ? '2px solid var(--ambar)' : '2px solid var(--borde)', borderRadius: 10, fontFamily: 'var(--fuente-tit)', fontSize: 16.5, fontWeight: 800, letterSpacing: .4, cursor: salarioBase ? 'pointer' : 'default' }}>
                                    Pagar con abono parcial (queda saldo)
                                </button>
                                {!salarioBase && <div style={{ fontSize: 12.5, color: '#7a5600', background: 'var(--ambar-suave)', borderRadius: 8, padding: '8px 10px', marginTop: 8, textAlign: 'center' }}>⚠️ Este empleado no tiene salario registrado. Edítalo con el botón + Nuevo o desde su ficha.</div>}
                            </>
                        )}
                    </Tarjeta>
                )}
            </div>
        </div>
    );
}
