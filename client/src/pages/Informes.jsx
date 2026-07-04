import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { exportarInformeComprasExcel, exportarInformeComprasPDF, exportarCertificadoDisposicionFinal } from '../utils/exportar';
import PickerBuscable from '../components/PickerBuscable';

const fmt = n => Number(n || 0).toLocaleString('es-CO');
const hoy = () => new Date().toISOString().slice(0, 10);
const primerDiaMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; };

export default function Informes() {
    const [tab, setTab] = useState('compras');
    const [clientes, setClientes] = useState([]);
    const [bodegas, setBodegas] = useState([]);
    const [desde, setDesde] = useState(primerDiaMes());
    const [hasta, setHasta] = useState(hoy());
    const [bodega_id, setBodegaId] = useState('');
    const [cliente_id, setClienteId] = useState('');
    const [compras, setCompras] = useState(null);
    const [certificado, setCertificado] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get('/clientes').then(d => setClientes(d.clientes || [])).catch(() => {});
        api.get('/bodegas').then(d => setBodegas(d.bodegas || [])).catch(() => {});
    }, []);

    const cargarCompras = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ desde, hasta });
            if (bodega_id) params.append('bodega_id', bodega_id);
            const d = await api.get(`/informes/compras-periodo?${params}`);
            setCompras(d);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const cargarCertificado = async () => {
        if (!cliente_id) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({ desde, hasta, cliente_id });
            const d = await api.get(`/informes/certificado-cliente?${params}`);
            setCertificado(d);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const Btn = ({ active, onClick, children }) => (
        <button onClick={onClick} style={{ padding: '8px 18px', background: active ? '#1a5c2a' : '#f5f5f5', color: active ? '#fff' : '#555', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{children}</button>
    );

    return (
        <div style={{ padding: 24 }}>
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700 }}>📊 Informes</h1>
                <p style={{ color: '#666', fontSize: 13 }}>Reportes de compras, ventas y certificados</p>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <Btn active={tab === 'compras'} onClick={() => setTab('compras')}>📦 Compras por período</Btn>
                <Btn active={tab === 'certificado'} onClick={() => setTab('certificado')}>📜 Certificado cliente</Btn>
            </div>

            {/* Filtros */}
            <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <label>
                    <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Desde</div>
                    <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                </label>
                <label>
                    <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Hasta</div>
                    <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }} />
                </label>
                {tab === 'compras' && (
                    <label>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Bodega</div>
                        <select value={bodega_id} onChange={e => setBodegaId(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                            <option value="">Todas</option>
                            {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                        </select>
                    </label>
                )}
                {tab === 'certificado' && (
                    <label>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Cliente*</div>
                        <PickerBuscable
                            items={clientes}
                            value={cliente_id}
                            onChange={setClienteId}
                            placeholder="Buscar cliente..."
                            fontSize={13}
                        />
                    </label>
                )}
                <button onClick={tab === 'compras' ? cargarCompras : cargarCertificado} disabled={loading} style={{ padding: '9px 20px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                    {loading ? 'Cargando...' : '🔍 Generar'}
                </button>
            </div>

            {/* Informe de compras */}
            {tab === 'compras' && compras && (
                <div>
                    {/* Botones exportar */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        <button onClick={() => exportarInformeComprasExcel({ ...compras, desde, hasta })}
                            style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            📊 Descargar Excel
                        </button>
                        <button onClick={() => exportarInformeComprasPDF({ ...compras, desde, hasta })}
                            style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            📄 Descargar PDF
                        </button>
                    </div>

                    {/* Totales */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                        {[
                            ['Total compras', `$${fmt(compras.resumen?.total_pagado)}`, '#1a5c2a'],
                            ['# Compras', compras.resumen?.total_compras, '#2563eb'],
                            ['Kg comprados', `${fmt(compras.resumen?.total_kilos)} kg`, '#d97706'],
                            ['Recicladores', compras.resumen?.total_recicladores, '#7c3aed'],
                        ].map(([t, v, c]) => (
                            <div key={t} style={{ background: '#fff', borderRadius: 8, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
                                <div style={{ fontSize: 12, color: '#666' }}>{t}</div>
                                <div style={{ fontSize: 22, fontWeight: 700, color: c, marginTop: 4 }}>{v}</div>
                            </div>
                        ))}
                    </div>

                    {/* Por material */}
                    {compras.por_material?.length > 0 && (
                        <div style={{ background: '#fff', borderRadius: 10, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'hidden' }}>
                            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', fontWeight: 600, fontSize: 14 }}>Por material</div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead><tr style={{ background: '#f0faf0' }}>
                                    {['Material','Kg comprados','Total pagado','Precio promedio/kg'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>{h}</th>)}
                                </tr></thead>
                                <tbody>
                                    {compras.por_material.map(m => (
                                        <tr key={m.material} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                            <td style={{ padding: '9px 14px', fontWeight: 600 }}>{m.material}</td>
                                            <td style={{ padding: '9px 14px' }}>{fmt(m.total_kilos)} kg</td>
                                            <td style={{ padding: '9px 14px', fontWeight: 700, color: '#1a5c2a' }}>${fmt(m.total_pagado)}</td>
                                            <td style={{ padding: '9px 14px', color: '#666' }}>${fmt(m.precio_promedio)}/kg</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Por reciclador */}
                    {compras.por_reciclador?.length > 0 && (
                        <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'hidden' }}>
                            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', fontWeight: 600, fontSize: 14 }}>Por reciclador</div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead><tr style={{ background: '#f0faf0' }}>
                                    {['Reciclador','Compras','Kg','Total pagado'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>{h}</th>)}
                                </tr></thead>
                                <tbody>
                                    {compras.por_reciclador.map(r => (
                                        <tr key={r.reciclador} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                            <td style={{ padding: '9px 14px', fontWeight: 600 }}>{r.reciclador}</td>
                                            <td style={{ padding: '9px 14px' }}>{r.total_compras}</td>
                                            <td style={{ padding: '9px 14px' }}>{fmt(r.total_kilos)} kg</td>
                                            <td style={{ padding: '9px 14px', fontWeight: 700, color: '#1a5c2a' }}>${fmt(r.total_pagado)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Certificado cliente */}
            {tab === 'certificado' && certificado && (
                <div style={{ background: '#fff', borderRadius: 10, padding: 32, boxShadow: '0 2px 8px rgba(0,0,0,.08)', maxWidth: 700 }}>
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <img src="/logo.png" alt="ASOERC" style={{ width: 90, marginBottom: 8 }} />
                        <div style={{ fontWeight: 800, fontSize: 20, color: '#1a5c2a' }}>ASOERC ESP</div>
                        <div style={{ fontSize: 13, color: '#666' }}>NIT: 901.299.762-6</div>
                        <div style={{ fontWeight: 700, fontSize: 16, marginTop: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Certificado de Compra de Material Reciclable</div>
                    </div>

                    <div style={{ fontSize: 14, lineHeight: 1.8, color: '#333', marginBottom: 20 }}>
                        <p>Certificamos que la empresa <strong>{certificado.cliente?.nombre}</strong>
                        {certificado.cliente?.nit ? ` (NIT: ${certificado.cliente.nit})` : ''} realizó entrega de material reciclable a ASOERC ESP durante el período comprendido entre el <strong>{desde}</strong> y el <strong>{hasta}</strong>, con los siguientes detalles:</p>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
                        <thead><tr style={{ background: '#f0faf0' }}>
                            {['Material','Cantidad (kg)','Valor unitario','Total'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                            {(certificado.detalle || []).map(d => (
                                <tr key={d.material} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '9px 14px', fontWeight: 600 }}>{d.material}</td>
                                    <td style={{ padding: '9px 14px' }}>{fmt(d.kilos)} kg</td>
                                    <td style={{ padding: '9px 14px', color: '#666' }}>${fmt(d.precio_promedio)}/kg</td>
                                    <td style={{ padding: '9px 14px', fontWeight: 700 }}>${fmt(d.total)}</td>
                                </tr>
                            ))}
                            <tr style={{ background: '#f0faf0', fontWeight: 700 }}>
                                <td style={{ padding: '10px 14px' }} colSpan={2}>TOTAL</td>
                                <td style={{ padding: '10px 14px' }}></td>
                                <td style={{ padding: '10px 14px', color: '#1a5c2a', fontSize: 15 }}>${fmt(certificado.total)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style={{ fontSize: 12, color: '#888', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: 16 }}>
                        Este certificado fue generado el {hoy()} y tiene validez como soporte de gestión ambiental.
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
                        <button onClick={() => exportarCertificadoDisposicionFinal({ cliente: certificado.cliente, detalle: certificado.detalle, desde, fechaCertificado: new Date().toISOString().slice(0,10) })}
                            style={{ padding: '9px 24px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            📄 Descargar Certificado Oficial PDF
                        </button>
                        <button onClick={() => window.print()} style={{ padding: '9px 20px', background: '#f5f5f5', color: '#333', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🖨️ Imprimir</button>
                    </div>
                </div>
            )}

            {/* Estados vacíos */}
            {tab === 'compras' && !compras && !loading && (
                <div style={{ background: '#fff', borderRadius: 10, padding: 40, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                    <div style={{ fontSize: 40 }}>📊</div>
                    <p style={{ color: '#999', marginTop: 12, fontSize: 13 }}>Selecciona un período y haz clic en Generar</p>
                </div>
            )}
            {tab === 'certificado' && !certificado && !loading && (
                <div style={{ background: '#fff', borderRadius: 10, padding: 40, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                    <div style={{ fontSize: 40 }}>📜</div>
                    <p style={{ color: '#999', marginTop: 12, fontSize: 13 }}>Selecciona un cliente y período para generar el certificado</p>
                </div>
            )}
        </div>
    );
}
