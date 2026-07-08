import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import { exportarCertificadoDisposicionFinal } from '../utils/exportar';
import PickerBuscable from '../components/PickerBuscable';

const hoy = () => new Date().toISOString().slice(0, 10);
const primerDiaMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; };
const BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

// ── Modal detalle remisión (fotos) ────────────────────────────────────────
function ModalDetalle({ remision, onClose }) {
    if (!remision) return null;
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 540, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
                {remision.foto_url ? (
                    <div style={{ position: 'relative' }}>
                        <img src={`${BASE}${remision.foto_url}`} alt="remision" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: '14px 14px 0 0' }} />
                        <a href={`${BASE}${remision.foto_url}`} target="_blank" rel="noreferrer"
                            style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,.6)', color: '#fff', padding: '5px 12px', borderRadius: 20, fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>
                            🔍 Ampliar
                        </a>
                    </div>
                ) : (
                    <div style={{ height: 120, background: '#f0faf0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, borderRadius: '14px 14px 0 0' }}>🚛</div>
                )}
                <div style={{ padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <div style={{ fontSize: 11, color: '#1a5c2a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Remisión #{remision.id}</div>
                                {remision.tipo && (
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: remision.tipo === 'venta' ? '#d1fae5' : '#dbeafe', color: remision.tipo === 'venta' ? '#065f46' : '#1e40af' }}>
                                        {remision.tipo === 'venta' ? '📤 Venta' : '📥 Compra'}
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{remision.conductor}</div>
                        </div>
                        <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', borderRadius: 20, width: 32, height: 32, cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>✕</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        {[
                            ['📅 Fecha', remision.fecha],
                            ['🕐 Hora llegada', remision.hora_llegada || '—'],
                            ['🕐 Hora salida', remision.hora_salida || '—'],
                            ['🚛 Vehículo / Placa', remision.vehiculo || '—'],
                            ['🏪 Bodega', remision.bodega?.nombre || '—'],
                            ['⚖️ Total kilos', remision.total_kilos ? `${Number(remision.total_kilos).toFixed(2)} kg` : '—'],
                            ['👤 Cliente', remision.cliente?.nombre || '—'],
                            ['📍 Sede', remision.sede?.nombre || '—'],
                        ].map(([label, value]) => (
                            <div key={label} style={{ background: '#f8f8f8', borderRadius: 8, padding: '10px 14px' }}>
                                <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{label}</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#222' }}>{value}</div>
                            </div>
                        ))}
                    </div>
                    {remision.items?.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a5c2a', marginBottom: 8 }}>📦 Materiales</div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead><tr style={{ background: '#f0faf0' }}>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>Material</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'right', color: '#1a5c2a', fontWeight: 600 }}>Kilos</th>
                                </tr></thead>
                                <tbody>
                                    {remision.items.map((item, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                            <td style={{ padding: '7px 12px' }}>{item.material?.nombre || '—'}</td>
                                            <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 600 }}>{Number(item.kilos).toFixed(2)} kg</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {remision.observaciones && (
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px' }}>
                            <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700, marginBottom: 4 }}>📝 Observaciones</div>
                            <div style={{ fontSize: 13, color: '#555' }}>{remision.observaciones}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
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
            <div style={{ background: '#fff', borderRadius: 10, padding: 20, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#1a5c2a' }}>📄 Generar Certificado de Disposición Final</h3>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Cliente*</div>
                        <PickerBuscable
                            items={clientes}
                            value={cliente_id}
                            onChange={setClienteId}
                            placeholder="Buscar cliente..."
                            fontSize={13}
                        />
                    </div>
                    <label>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Período desde</div>
                        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                    </label>
                    <label>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Hasta</div>
                        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                    </label>
                    <label>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Fecha del certificado</div>
                        <input type="date" value={fechaCert} onChange={e => setFechaCert(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                    </label>
                    <button onClick={generar} disabled={loading} style={{ padding: '9px 20px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        {loading ? 'Cargando...' : '🔍 Consultar datos'}
                    </button>
                </div>
                {msg && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{msg}</div>}
            </div>

            {/* Preview del certificado */}
            {certificado && (
                <div style={{ background: '#fff', borderRadius: 10, padding: 28, boxShadow: '0 2px 8px rgba(0,0,0,.08)', maxWidth: 720 }}>
                    {/* Mini vista previa */}
                    <div style={{ textAlign: 'center', marginBottom: 20, borderBottom: '2px solid #1a5c2a', paddingBottom: 16 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#1a5c2a' }}>ASOCIACIÓN ECO RECICLAJE CAPITAL ERC (ASOERC)</div>
                        <div style={{ fontSize: 12, color: '#666' }}>NIT. 901.299.762-6</div>
                        <div style={{ fontWeight: 700, fontSize: 14, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Certificado de Disposición Final</div>
                    </div>

                    <div style={{ fontSize: 13, color: '#333', marginBottom: 16 }}>
                        <strong>{certificado.cliente?.nombre}</strong>{certificado.cliente?.nit ? ` (NIT: ${certificado.cliente.nit})` : ''} · Período: <strong>{desde}</strong> al <strong>{hasta}</strong>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 16, border: '1px solid #ddd' }}>
                        <thead><tr style={{ background: '#f0faf0' }}>
                            {['Material','Industria Final','Kilos'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#1a5c2a', fontWeight: 700, border: '1px solid #ddd' }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                            {(certificado.detalle || []).map(d => (
                                <tr key={d.material} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '7px 12px', border: '1px solid #eee' }}>{d.material}</td>
                                    <td style={{ padding: '7px 12px', color: '#666', border: '1px solid #eee' }}>${fmt(d.precio_promedio)}/kg</td>
                                    <td style={{ padding: '7px 12px', fontWeight: 700, border: '1px solid #eee' }}>{Number(d.kilos).toFixed(1)} kg</td>
                                </tr>
                            ))}
                            <tr style={{ background: '#f0faf0', fontWeight: 700 }}>
                                <td colSpan={2} style={{ padding: '9px 12px', border: '1px solid #ddd' }}>TOTAL</td>
                                <td style={{ padding: '9px 12px', color: '#1a5c2a', border: '1px solid #ddd' }}>{Number(certificado.total || 0).toFixed(1)} kg</td>
                            </tr>
                        </tbody>
                    </table>

                    <button onClick={descargarPDF} style={{ width: '100%', padding: '12px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                        📄 Descargar Certificado Oficial PDF
                    </button>
                    <p style={{ fontSize: 11, color: '#999', textAlign: 'center', marginTop: 8 }}>Genera el documento oficial firmado por Fredi Hernandez Jaime</p>
                </div>
            )}

            {!certificado && !loading && (
                <div style={{ background: '#fff', borderRadius: 10, padding: 40, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                    <div style={{ fontSize: 40 }}>📄</div>
                    <p style={{ color: '#999', marginTop: 12, fontSize: 13 }}>Selecciona un cliente y período para generar el certificado oficial</p>
                </div>
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

    const Btn = ({ active, onClick, children }) => (
        <button onClick={onClick} style={{ padding: '8px 18px', background: active ? '#1a5c2a' : '#f5f5f5', color: active ? '#fff' : '#555', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {children}
        </button>
    );

    return (
        <div style={{ padding: 24 }}>
            <ModalDetalle remision={selected} onClose={() => setSelected(null)} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700 }}>🚛 Remisiones</h1>
                    <p style={{ color: '#666', fontSize: 13 }}>Fotos de Telegram y certificados generados</p>
                </div>
                {tab === 'fotos' && (
                    <button onClick={() => setShowForm(!showForm)} style={{ padding: '9px 18px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        + Nueva Remisión
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <Btn active={tab === 'fotos'} onClick={() => setTab('fotos')}>📷 Fotos (Telegram)</Btn>
                <Btn active={tab === 'certificados'} onClick={() => setTab('certificados')}>📄 Certificados</Btn>
            </div>

            {/* ── Tab Fotos ─────────────────────────────────────────────── */}
            {tab === 'fotos' && (
                <>
                    {showForm && (
                        <div style={{ background: '#fff', borderRadius: 10, padding: 20, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Nueva Remisión</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                                {[['conductor','Conductor*'],['vehiculo','Placa / Vehículo']].map(([k,l]) => (
                                    <label key={k}>
                                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>{l}</div>
                                        <input value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                                    </label>
                                ))}
                                <label>
                                    <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Bodega</div>
                                    <select value={form.bodega_id} onChange={e => setForm({ ...form, bodega_id: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                                        {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                                    </select>
                                </label>
                                <label>
                                    <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Fecha</div>
                                    <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                                </label>
                                <label style={{ gridColumn: 'span 2' }}>
                                    <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Observaciones</div>
                                    <input value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                                </label>
                            </div>
                            <label style={{ display: 'block', marginBottom: 14 }}>
                                <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>Foto de remisión</div>
                                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                    <label style={{ cursor: 'pointer', padding: '8px 16px', background: '#f0faf0', border: '2px dashed #1a5c2a', borderRadius: 8, fontSize: 13, color: '#1a5c2a', fontWeight: 600 }}>
                                        📷 Seleccionar foto
                                        <input type="file" accept="image/*" onChange={handleFoto} style={{ display: 'none' }} />
                                    </label>
                                    {preview && <img src={preview} alt="preview" style={{ height: 80, borderRadius: 6, border: '1px solid #ddd' }} />}
                                </div>
                            </label>
                            {msg && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{msg}</div>}
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={guardar} disabled={loading} style={{ padding: '9px 20px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                    {loading ? 'Guardando...' : 'Guardar'}
                                </button>
                                <button onClick={() => { setShowForm(false); setFoto(null); setPreview(null); }} style={{ padding: '9px 16px', background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 13 }}>Cancelar</button>
                            </div>
                        </div>
                    )}

                    {/* Buscador */}
                    <div style={{ position: 'relative', marginBottom: 16, maxWidth: 360 }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#888', pointerEvents: 'none' }}>🔍</span>
                        <input
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            placeholder="Buscar por N° orden, conductor, remisión..."
                            style={{ width: '100%', padding: '9px 12px 9px 38px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                        />
                        {busqueda && (
                            <button onClick={() => setBusqueda('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#999' }}>✕</button>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
                        {remisiones.filter(r => {
                            if (!busqueda) return true;
                            const q = busqueda.toLowerCase();
                            return String(r.numero || r.id).includes(q)
                                || (r.numero_orden || '').toLowerCase().includes(q)
                                || (r.conductor || '').toLowerCase().includes(q)
                                || (r.vehiculo || '').toLowerCase().includes(q);
                        }).map(r => (
                            <div key={r.id} onClick={() => setSelected(r)}
                                style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.08)', cursor: 'pointer', transition: 'transform .15s, box-shadow .15s', borderTop: r.tipo === 'venta' ? '3px solid #1a5c2a' : r.tipo === 'compra' ? '3px solid #2563eb' : '3px solid #ddd' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,.13)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.08)'; }}>
                                {r.foto_url
                                    ? <img src={`${BASE}${r.foto_url}`} alt="remision" style={{ width: '100%', height: 160, objectFit: 'cover' }} />
                                    : <div style={{ width: '100%', height: 100, background: r.tipo === 'venta' ? '#f0faf0' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
                                        {r.tipo === 'venta' ? '📤' : r.tipo === 'compra' ? '📥' : '🚛'}
                                      </div>
                                }
                                <div style={{ padding: 14 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                        <div style={{ fontWeight: 700, fontSize: 15 }}>{r.conductor}</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                                            <div style={{ fontSize: 11, color: '#1a5c2a', fontWeight: 600, background: '#f0faf0', padding: '2px 8px', borderRadius: 10 }}>#{r.numero || r.id}</div>
                                            {r.numero_orden && <div style={{ fontSize: 10, color: '#2563eb', fontWeight: 700, background: '#eff6ff', padding: '2px 7px', borderRadius: 10 }}>Orden #{r.numero_orden}</div>}
                                        </div>
                                    </div>
                                    {r.tipo && (
                                        <div style={{ marginBottom: 6 }}>
                                            <span style={{
                                                fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10,
                                                background: r.tipo === 'venta' ? '#d1fae5' : '#dbeafe',
                                                color: r.tipo === 'venta' ? '#065f46' : '#1e40af'
                                            }}>
                                                {r.tipo === 'venta' ? '📤 Venta' : '📥 Compra'}
                                            </span>
                                            {r.tipo === 'venta' && r.venta && <span style={{ fontSize: 11, color: '#666', marginLeft: 6 }}>Venta #{r.venta.id}</span>}
                                            {r.tipo === 'compra' && r.compra && <span style={{ fontSize: 11, color: '#666', marginLeft: 6 }}>{r.compra.reciclador?.nombre}</span>}
                                        </div>
                                    )}
                                    {r.vehiculo && <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>🚛 {r.vehiculo}</div>}
                                    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{r.fecha} · {r.bodega?.nombre}</div>
                                    {r.total_kilos > 0 && <div style={{ fontSize: 12, color: '#1a5c2a', marginTop: 3, fontWeight: 600 }}>⚖️ {Number(r.total_kilos).toFixed(2)} kg</div>}
                                    {r.observaciones && <div style={{ fontSize: 11, color: '#888', marginTop: 6, borderTop: '1px solid #f0f0f0', paddingTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.observaciones}</div>}
                                    <div style={{ marginTop: 10, fontSize: 12, color: '#1a5c2a', fontWeight: 600 }}>Ver detalles →</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {busqueda && remisiones.filter(r => {
                        const q = busqueda.toLowerCase();
                        return String(r.numero || r.id).includes(q) || (r.numero_orden || '').toLowerCase().includes(q) || (r.conductor || '').toLowerCase().includes(q) || (r.vehiculo || '').toLowerCase().includes(q);
                    }).length === 0 && (
                        <div style={{ background: '#fff', borderRadius: 10, padding: 30, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                            <div style={{ fontSize: 32 }}>🔍</div>
                            <p style={{ color: '#999', marginTop: 8, fontSize: 13 }}>Sin resultados para "<strong>{busqueda}</strong>"</p>
                        </div>
                    )}

                    {remisiones.length === 0 && !busqueda && (
                        <div style={{ background: '#fff', borderRadius: 10, padding: 40, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                            <div style={{ fontSize: 40 }}>🚛</div>
                            <p style={{ color: '#999', marginTop: 12, fontSize: 13 }}>No hay remisiones registradas. Las fotos enviadas por Telegram aparecen aquí automáticamente.</p>
                        </div>
                    )}
                </>
            )}

            {/* ── Tab Certificados ──────────────────────────────────────── */}
            {tab === 'certificados' && <TabCertificados />}
        </div>
    );
}
