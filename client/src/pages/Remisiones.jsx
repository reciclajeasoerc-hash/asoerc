import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import { exportarCertificadoDisposicionFinal } from '../utils/exportar';
import PickerBuscable from '../components/PickerBuscable';
import { EncabezadoPagina, Boton, Pestanas, Tarjeta, Chip, ContenedorTabla, estiloTabla, estiloTh, estiloTd, estiloTdNum, estiloInput, Campo, Buscador, Modal, Aviso, Vacio } from '../components/ui';
import Icono from '../components/Icono';

const hoy = () => new Date().toISOString().slice(0, 10);
const primerDiaMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; };
const BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

function Btn({ active, onClick, children }) {
    return <Boton variante={active ? 'noche' : 'secundario'} onClick={onClick}>{children}</Boton>;
}

// ── Modal detalle remisión (fotos) ────────────────────────────────────────
function ModalDetalle({ remision, onClose }) {
    if (!remision) return null;
    return (
        <Modal titulo={`Remisión #${remision.id}`} onCerrar={onClose} ancho={640}>
            {remision.foto_url ? (
                <div style={{ position: 'relative', margin: '-16px -16px 16px' }}>
                    <img src={`${BASE}${remision.foto_url}`} alt="remision" style={{ width: '100%', maxHeight: 320, objectFit: 'cover' }} />
                    <a href={`${BASE}${remision.foto_url}`} target="_blank" rel="noreferrer"
                        style={{
                            position: 'absolute', bottom: 10, right: 10, background: 'var(--noche)', color: '#fff',
                            padding: '7px 12px', borderRadius: 8, fontSize: 13, textDecoration: 'none', fontWeight: 700
                        }}>
                        Ampliar
                    </a>
                </div>
            ) : (
                <div style={{ height: 120, margin: '-16px -16px 16px', background: 'var(--verde-suave)', color: 'var(--verde-osc)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icono nombre="vehiculos" tam={42} />
                </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div className="cifra" style={{ fontSize: 20 }}>{remision.conductor}</div>
                {remision.tipo && <Chip tono={remision.tipo === 'venta' ? 'verde' : 'azul'}>{remision.tipo === 'venta' ? 'Venta' : 'Compra'}</Chip>}
            </div>
            <div className="rejilla-form" style={{ marginBottom: 16 }}>
                {[
                    ['Fecha', remision.fecha],
                    ['Hora llegada', remision.hora_llegada || '—'],
                    ['Hora salida', remision.hora_salida || '—'],
                    ['Vehículo / Placa', remision.vehiculo || '—'],
                    ['Bodega', remision.bodega?.nombre || '—'],
                    ['Total kilos', remision.total_kilos ? `${Number(remision.total_kilos).toFixed(2)} kg` : '—'],
                    ['Cliente', remision.cliente?.nombre || '—'],
                    ['Sede', remision.sede?.nombre || '—'],
                ].map(([label, value]) => (
                    <div key={label} style={{ background: 'var(--fondo)', border: '1px solid var(--borde)', borderRadius: 8, padding: '10px 12px', minWidth: 0 }}>
                        <div className="etiqueta" style={{ color: 'var(--texto-3)', marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>{value}</div>
                    </div>
                ))}
            </div>
            {remision.items?.length > 0 && (
                <Tarjeta titulo="Materiales" icono="materiales" style={{ marginBottom: 16 }}>
                    <ContenedorTabla>
                        <table style={estiloTabla}>
                            <thead><tr><th style={estiloTh}>Material</th><th style={{ ...estiloTh, textAlign: 'right' }}>Kilos</th></tr></thead>
                            <tbody>{remision.items.map((item, i) => <tr key={i}><td style={estiloTd}>{item.material?.nombre || '—'}</td><td style={estiloTdNum}>{Number(item.kilos).toFixed(2)} kg</td></tr>)}</tbody>
                        </table>
                    </ContenedorTabla>
                </Tarjeta>
            )}
            {remision.observaciones && <Aviso tipo="alerta"><div className="etiqueta" style={{ marginBottom: 4 }}>Observaciones</div>{remision.observaciones}</Aviso>}
        </Modal>
    );
}

// ── Tab Certificados ──────────────────────────────────────────────────────
function TabCertificados() {
    const [clientes, setClientes] = useState([]);
    const [cliente_id, setClienteId] = useState('');
    const [desde, setDesde] = useState(primerDiaMes());
    const [hasta, setHasta] = useState(hoy());
    const [fechaCert, setFechaCert] = useState(hoy());
    const [certificado, setCertificado] = useState(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        api.get('/clientes').then(d => setClientes(d.clientes || [])).catch(() => {});
    }, []);

    const generar = async () => {
        if (!cliente_id) return setMsg('Selecciona un cliente');
        setLoading(true); setMsg('');
        try {
            const params = new URLSearchParams({ desde, hasta, cliente_id });
            const d = await api.get(`/informes/certificado-cliente?${params}`);
            setCertificado(d);
        } catch (err) { setMsg(err.message); }
        finally { setLoading(false); }
    };

    const descargarPDF = () => {
        if (!certificado) return;
        exportarCertificadoDisposicionFinal({
            cliente: certificado.cliente,
            detalle: certificado.detalle,
            desde,
            fechaCertificado: fechaCert
        });
    };

    const fmt = n => Number(n || 0).toLocaleString('es-CO');

    return (
        <div>
            {/* Formulario */}
            <Tarjeta titulo="Generar Certificado de Disposición Final" icono="remisiones" style={{ marginBottom: 14 }}>
                <div className="rejilla-form" style={{ alignItems: 'end' }}>
                    <Campo etiqueta="Cliente*">
                        <PickerBuscable
                            items={clientes}
                            value={cliente_id}
                            onChange={setClienteId}
                            placeholder="Buscar cliente..."
                            fontSize={13}
                        />
                    </Campo>
                    <Campo etiqueta="Período desde">
                        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={estiloInput} />
                    </Campo>
                    <Campo etiqueta="Hasta">
                        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={estiloInput} />
                    </Campo>
                    <Campo etiqueta="Fecha del certificado">
                        <input type="date" value={fechaCert} onChange={e => setFechaCert(e.target.value)} style={estiloInput} />
                    </Campo>
                    <Boton onClick={generar} disabled={loading} icono="informes">{loading ? 'Cargando...' : 'Consultar datos'}</Boton>
                </div>
                {msg && <Aviso tipo="error" style={{ marginTop: 12 }}>{msg}</Aviso>}
            </Tarjeta>

            {/* Preview del certificado */}
            {certificado && (
                <Tarjeta titulo="Vista previa" sub="Certificado de Disposición Final" icono="remisiones" style={{ maxWidth: 760 }}>
                    {/* Mini vista previa */}
                    <div style={{ textAlign: 'center', marginBottom: 20, borderBottom: '2px solid var(--verde-osc)', paddingBottom: 16 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--verde-osc)' }}>ASOCIACIÓN ECO RECICLAJE CAPITAL ERC (ASOERC)</div>
                        <div style={{ fontSize: 12, color: 'var(--texto-2)' }}>NIT. 901.299.762-6</div>
                        <div style={{ fontWeight: 700, fontSize: 14, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Certificado de Disposición Final</div>
                    </div>

                    <div style={{ fontSize: 13, color: 'var(--texto-2)', marginBottom: 16 }}>
                        <strong>{certificado.cliente?.nombre}</strong>{certificado.cliente?.nit ? ` (NIT: ${certificado.cliente.nit})` : ''} · Período: <strong>{desde}</strong> al <strong>{hasta}</strong>
                    </div>

                    <ContenedorTabla style={{ marginBottom: 16 }}>
                        <table style={estiloTabla}>
                        <thead><tr>{['Material','Industria Final','Kilos'].map(h => <th key={h} style={estiloTh}>{h}</th>)}</tr></thead>
                        <tbody>
                            {(certificado.detalle || []).map(d => (
                                <tr key={d.material}>
                                    <td style={estiloTd}>{d.material}</td>
                                    <td style={{ ...estiloTd, color: 'var(--texto-2)' }}>${fmt(d.precio_promedio)}/kg</td>
                                    <td style={estiloTdNum}>{Number(d.kilos).toFixed(1)} kg</td>
                                </tr>
                            ))}
                            <tr style={{ background: 'var(--verde-suave)', fontWeight: 700 }}>
                                <td colSpan={2} style={estiloTd}>TOTAL</td>
                                <td style={{ ...estiloTdNum, color: 'var(--verde-osc)' }}>{Number(certificado.total || 0).toFixed(1)} kg</td>
                            </tr>
                        </tbody>
                        </table>
                    </ContenedorTabla>

                    <Boton onClick={descargarPDF} ancho icono="remisiones">Descargar Certificado Oficial PDF</Boton>
                    <p style={{ fontSize: 12, color: 'var(--texto-3)', textAlign: 'center', marginTop: 8 }}>Genera el documento oficial firmado por Fredi Hernandez Jaime</p>
                </Tarjeta>
            )}

            {!certificado && !loading && (
                <Tarjeta><Vacio icono="remisiones" texto="Selecciona un cliente y período para generar el certificado oficial" /></Tarjeta>
            )}
        </div>
    );
}

// ── Página principal ──────────────────────────────────────────────────────
export default function Remisiones() {
    const { user } = useAuth();
    const [tab, setTab] = useState('fotos');
    const [remisiones, setRemisiones] = useState([]);
    const [bodegas, setBodegas] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ conductor: '', vehiculo: '', bodega_id: '', fecha: hoy(), observaciones: '' });
    const [foto, setFoto] = useState(null);
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState(null);
    const [selected, setSelected] = useState(null);
    const [busqueda, setBusqueda] = useState('');

    // Bodega por defecto: la del usuario logueado (los superadmin también tienen una),
    // y solo si no tiene, la primera de la lista. Evita que las remisiones caigan en
    // otra bodega por elegir "la primera" automáticamente.
    const bodegaPorDefecto = (lista) => user?.bodega_id || lista?.[0]?.id || '';

    useEffect(() => {
        api.get('/bodegas').then(d => { setBodegas(d.bodegas || []); setForm(f => ({ ...f, bodega_id: bodegaPorDefecto(d.bodegas) })); });
        cargar();
    }, []);

    const cargar = () => api.get('/remisiones').then(d => setRemisiones(d.items || [])).catch(() => {});

    const handleFoto = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setFoto(file);
        const reader = new FileReader();
        reader.onload = ev => setPreview(ev.target.result);
        reader.readAsDataURL(file);
    };

    const guardar = async () => {
        if (!form.conductor) return setMsg('Conductor es requerido');
        setLoading(true);
        try {
            const fd = new FormData();
            Object.entries(form).forEach(([k, v]) => fd.append(k, v));
            if (foto) fd.append('foto', foto);
            await api.upload('/remisiones', fd);
            setForm({ conductor: '', vehiculo: '', bodega_id: bodegaPorDefecto(bodegas), fecha: hoy(), observaciones: '' });
            setFoto(null); setPreview(null); setShowForm(false); setMsg(''); cargar();
        } catch (err) { setMsg(err.message); }
        finally { setLoading(false); }
    };

    return (
        <div className="pagina">
            <ModalDetalle remision={selected} onClose={() => setSelected(null)} />

            <EncabezadoPagina titulo="Remisiones" sub="Fotos de Telegram y certificados generados" icono="remisiones"
                acciones={tab === 'fotos' && <Boton onClick={() => setShowForm(!showForm)} icono="remisiones">Nueva Remisión</Boton>} />

            {/* Tabs */}
            <Pestanas
                items={[{ id: 'fotos', label: 'Fotos (Telegram)', icono: 'remisiones' }, { id: 'certificados', label: 'Certificados', icono: 'informes' }]}
                activa={tab}
                onChange={setTab}
            />

            {/* ── Tab Fotos ─────────────────────────────────────────────── */}
            {tab === 'fotos' && (
                <>
                    {showForm && (
                        <Tarjeta titulo="Nueva Remisión" icono="remisiones" style={{ marginBottom: 14 }}>
                            <div className="rejilla-form" style={{ marginBottom: 14 }}>
                                {[['conductor','Conductor*'],['vehiculo','Placa / Vehículo']].map(([k,l]) => (
                                    <Campo key={k} etiqueta={l}>
                                        <input value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} style={estiloInput} />
                                    </Campo>
                                ))}
                                <Campo etiqueta="Bodega"><select value={form.bodega_id} onChange={e => setForm({ ...form, bodega_id: e.target.value })} style={estiloInput}>
                                        {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                                    </select></Campo>
                                <Campo etiqueta="Fecha"><input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={estiloInput} /></Campo>
                                <Campo etiqueta="Observaciones">
                                    <input value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} style={estiloInput} />
                                </Campo>
                            </div>
                            <Campo etiqueta="Foto de remisión" style={{ marginBottom: 14 }}>
                                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                    <label
                                        style={{
                                            cursor: 'pointer', minHeight: 42, padding: '9px 14px', background: 'var(--verde-suave)',
                                            border: '1.5px dashed var(--verde)', borderRadius: 8, fontSize: 13,
                                            color: 'var(--verde-osc)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 7
                                        }}>
                                        <Icono nombre="remisiones" tam={18} /> Seleccionar foto
                                        <input type="file" accept="image/*" onChange={handleFoto} style={{ display: 'none' }} />
                                    </label>
                                    {preview && <img src={preview} alt="preview" style={{ height: 80, maxWidth: '100%', borderRadius: 8, border: '1px solid var(--borde)' }} />}
                                </div>
                            </Campo>
                            {msg && <Aviso tipo="error" style={{ marginBottom: 8 }}>{msg}</Aviso>}
                            <div style={{ display: 'flex', gap: 8 }}>
                                <Boton onClick={guardar} disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Boton>
                                <Boton variante="secundario" onClick={() => { setShowForm(false); setFoto(null); setPreview(null); }}>Cancelar</Boton>
                            </div>
                        </Tarjeta>
                    )}

                    {/* Buscador */}
                    <Buscador value={busqueda} onChange={setBusqueda} placeholder="Buscar por N° orden, conductor, remisión..." style={{ maxWidth: 420, marginBottom: 14 }} />

                    <div className="rejilla-tarjetas">
                        {remisiones.filter(r => {
                            if (!busqueda) return true;
                            const q = busqueda.toLowerCase();
                            return String(r.numero || r.id).includes(q)
                                || (r.numero_orden || '').toLowerCase().includes(q)
                                || (r.conductor || '').toLowerCase().includes(q)
                                || (r.vehiculo || '').toLowerCase().includes(q);
                        }).map(r => (
                            <Tarjeta key={r.id}
                                style={{
                                    padding: 0, overflow: 'hidden', cursor: 'pointer',
                                    borderTop: r.tipo === 'venta' ? '3px solid var(--verde)' : r.tipo === 'compra' ? '3px solid var(--azul)' : '3px solid var(--borde-fuerte)'
                                }}>
                                <div onClick={() => setSelected(r)}>
                                {r.foto_url
                                    ? <img src={`${BASE}${r.foto_url}`} alt="remision" style={{ width: '100%', height: 160, objectFit: 'cover' }} />
                                    : <div
                                        style={{
                                            width: '100%', height: 100, background: r.tipo === 'venta' ? 'var(--verde-suave)' : 'var(--azul-suave)',
                                            color: r.tipo === 'venta' ? 'var(--verde-osc)' : 'var(--azul)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                        <Icono nombre={r.tipo === 'venta' ? 'ventas' : r.tipo === 'compra' ? 'compras' : 'vehiculos'} tam={36} />
                                      </div>
                                }
                                <div style={{ padding: 14 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                        <div style={{ fontWeight: 700, fontSize: 15 }}>{r.conductor}</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                                            <Chip tono="verde">#{r.numero || r.id}</Chip>
                                            {r.numero_orden && <Chip tono="azul">Orden #{r.numero_orden}</Chip>}
                                        </div>
                                    </div>
                                    {r.tipo && (
                                        <div style={{ marginBottom: 6 }}>
                                            <Chip tono={r.tipo === 'venta' ? 'verde' : 'azul'}>{r.tipo === 'venta' ? 'Venta' : 'Compra'}</Chip>
                                            {r.tipo === 'venta' && r.venta && <span style={{ fontSize: 12, color: 'var(--texto-2)', marginLeft: 6 }}>Venta #{r.venta.id}</span>}
                                            {r.tipo === 'compra' && r.compra && <span style={{ fontSize: 12, color: 'var(--texto-2)', marginLeft: 6 }}>{r.compra.reciclador?.nombre}</span>}
                                        </div>
                                    )}
                                    {r.vehiculo && (
                                        <div style={{ fontSize: 13, color: 'var(--texto-2)', marginTop: 5, display: 'flex', gap: 6, alignItems: 'center' }}>
                                            <Icono nombre="vehiculos" tam={16} /> {r.vehiculo}
                                        </div>
                                    )}
                                    <div style={{ fontSize: 13, color: 'var(--texto-3)', marginTop: 5 }}>{r.fecha} · {r.bodega?.nombre}</div>
                                    {r.total_kilos > 0 && <div className="cifra" style={{ fontSize: 15, color: 'var(--verde-osc)', marginTop: 5 }}>{Number(r.total_kilos).toFixed(2)} kg</div>}
                                    {r.observaciones && (
                                        <div style={{
                                            fontSize: 12, color: 'var(--texto-3)', marginTop: 8, borderTop: '1px solid var(--borde)',
                                            paddingTop: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                        }}>
                                            {r.observaciones}
                                        </div>
                                    )}
                                    <div className="etiqueta" style={{ marginTop: 10, color: 'var(--verde-osc)' }}>Ver detalles</div>
                                </div>
                                </div>
                            </Tarjeta>
                        ))}
                    </div>

                    {busqueda && remisiones.filter(r => {
                        const q = busqueda.toLowerCase();
                        return String(r.numero || r.id).includes(q) || (r.numero_orden || '').toLowerCase().includes(q) || (r.conductor || '').toLowerCase().includes(q) || (r.vehiculo || '').toLowerCase().includes(q);
                    }).length === 0 && (
                        <Tarjeta><Vacio icono="remisiones" texto={`Sin resultados para "${busqueda}"`} /></Tarjeta>
                    )}

                    {remisiones.length === 0 && !busqueda && (
                        <Tarjeta><Vacio icono="remisiones" texto="No hay remisiones registradas. Las fotos enviadas por Telegram aparecen aquí automáticamente." /></Tarjeta>
                    )}
                </>
            )}

            {/* ── Tab Certificados ──────────────────────────────────────── */}
            {tab === 'certificados' && <TabCertificados />}
        </div>
    );
}
