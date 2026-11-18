import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { exportarInformeComprasExcel, exportarInformeComprasPDF, exportarCertificadoDisposicionFinal } from '../utils/exportar';
import PickerBuscable from '../components/PickerBuscable';
import { EncabezadoPagina, Pestanas, Tarjeta, Kpi, RejillaKpi, Boton, Campo, ContenedorTabla, estiloTabla, estiloTh, estiloTd, estiloTdNum, estiloInput, Vacio } from '../components/ui';

const fmt = n => Number(n || 0).toLocaleString('es-CO');
const hoy = () => new Date().toISOString().slice(0, 10);
const primerDiaMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; };

const PESTANAS = [
    { id: 'compras', label: 'Compras por período', icono: 'compras' },
    { id: 'certificado', label: 'Certificado cliente', icono: 'clientes' },
];

// Tabla simple con encabezado; cols = [{ t: 'Título', num: bool }]
function TablaInforme({ cols, children, alto }) {
    return (
        <ContenedorTabla style={alto ? { maxHeight: alto, overflowY: 'auto' } : undefined}>
            <table style={estiloTabla}>
                <thead><tr>{cols.map(c => <th key={c.t} style={{ ...estiloTh, textAlign: c.num ? 'right' : 'left' }}>{c.t}</th>)}</tr></thead>
                <tbody>{children}</tbody>
            </table>
        </ContenedorTabla>
    );
}

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

    return (
        <div className="pagina">
            <EncabezadoPagina titulo="Informes" sub="Reportes de compras y certificados" icono="informes" />
            <Pestanas items={PESTANAS} activa={tab} onChange={setTab} />

            {/* Filtros */}
            <Tarjeta style={{ marginBottom: 14 }}>
                <div className="rejilla-form" style={{ alignItems: 'end' }}>
                    <Campo etiqueta="Desde">
                        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={estiloInput} />
                    </Campo>
                    <Campo etiqueta="Hasta">
                        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={estiloInput} />
                    </Campo>
                    {tab === 'compras' && (
                        <Campo etiqueta="Bodega">
                            <select value={bodega_id} onChange={e => setBodegaId(e.target.value)} style={estiloInput}>
                                <option value="">Todas</option>
                                {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                            </select>
                        </Campo>
                    )}
                    {tab === 'certificado' && (
                        <div>
                            <div className="etiqueta" style={{ color: 'var(--texto-2)', marginBottom: 5, fontSize: 12 }}>Cliente*</div>
                            <PickerBuscable items={clientes} value={cliente_id} onChange={setClienteId} placeholder="Buscar cliente..." fontSize={14} />
                        </div>
                    )}
                    <Boton onClick={tab === 'compras' ? cargarCompras : cargarCertificado} disabled={loading} ancho>
                        {loading ? 'Cargando...' : 'Generar'}
                    </Boton>
                </div>
            </Tarjeta>

            {/* Informe de compras */}
            {tab === 'compras' && compras && (
                <div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                        <Boton variante="secundario" icono="informes" onClick={() => exportarInformeComprasExcel({ ...compras, desde, hasta })}>Descargar Excel</Boton>
                        <Boton variante="secundario" icono="remisiones" onClick={() => exportarInformeComprasPDF({ ...compras, desde, hasta })}>Descargar PDF</Boton>
                    </div>

                    <RejillaKpi>
                        <Kpi titulo="Total compras" tono="marco" icono="compras" valor={`$${fmt(compras.resumen?.total_pagado)}`} />
                        <Kpi titulo="# Compras" icono="remisiones" valor={compras.resumen?.total_compras} />
                        <Kpi titulo="Kg comprados" tono="verde" icono="kilos" valor={`${fmt(compras.resumen?.total_kilos)} kg`} />
                        <Kpi titulo="Recicladores" tono="noche" icono="recicladores" valor={compras.resumen?.total_recicladores} />
                    </RejillaKpi>

                    <div className="rejilla-2-1" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', marginBottom: 14 }}>
                        {compras.por_material?.length > 0 && (
                            <Tarjeta titulo="Por material" sinPadding>
                                <TablaInforme cols={[{ t: 'Material' }, { t: 'Kg', num: true }, { t: 'Total pagado', num: true }, { t: 'Promedio/kg', num: true }]}>
                                    {compras.por_material.map(m => (
                                        <tr key={m.material}>
                                            <td style={{ ...estiloTd, fontWeight: 700 }}>{m.material}</td>
                                            <td style={estiloTdNum}>{fmt(m.total_kilos)} kg</td>
                                            <td style={{ ...estiloTdNum, fontWeight: 700 }}>${fmt(m.total_pagado)}</td>
                                            <td style={{ ...estiloTdNum, color: 'var(--texto-2)' }}>${fmt(m.precio_promedio)}</td>
                                        </tr>
                                    ))}
                                </TablaInforme>
                            </Tarjeta>
                        )}
                        {compras.por_reciclador?.length > 0 && (
                            <Tarjeta titulo="Por reciclador" sinPadding>
                                <TablaInforme cols={[{ t: 'Reciclador' }, { t: 'Compras', num: true }, { t: 'Kg', num: true }, { t: 'Total pagado', num: true }]}>
                                    {compras.por_reciclador.map(r => (
                                        <tr key={r.reciclador}>
                                            <td style={{ ...estiloTd, fontWeight: 700 }}>{r.reciclador}</td>
                                            <td style={estiloTdNum}>{r.total_compras}</td>
                                            <td style={estiloTdNum}>{fmt(r.total_kilos)} kg</td>
                                            <td style={{ ...estiloTdNum, fontWeight: 700 }}>${fmt(r.total_pagado)}</td>
                                        </tr>
                                    ))}
                                </TablaInforme>
                            </Tarjeta>
                        )}
                    </div>

                    {compras.compras?.length > 0 && (
                        <Tarjeta titulo={`Todas las compras del período (${compras.compras.length})`} sinPadding>
                            <TablaInforme alto={460} cols={[{ t: 'Fecha' }, { t: 'Hora' }, { t: '#' }, { t: 'Reciclador' }, { t: 'Bodega' }, { t: 'Kg', num: true }, { t: 'Total', num: true }]}>
                                {compras.compras.map(c => (
                                    <tr key={c.id}>
                                        <td style={{ ...estiloTd, whiteSpace: 'nowrap' }}>{c.fecha}</td>
                                        <td style={{ ...estiloTd, color: 'var(--texto-3)' }}>{c.hora}</td>
                                        <td style={estiloTd}>{c.numero_diario || '—'}</td>
                                        <td style={{ ...estiloTd, fontWeight: 700 }}>{c.reciclador}</td>
                                        <td style={{ ...estiloTd, color: 'var(--texto-2)' }}>{c.bodega}</td>
                                        <td style={estiloTdNum}>{fmt(c.kilos)} kg</td>
                                        <td style={{ ...estiloTdNum, fontWeight: 700 }}>${fmt(c.total)}</td>
                                    </tr>
                                ))}
                            </TablaInforme>
                        </Tarjeta>
                    )}
                </div>
            )}

            {/* Certificado cliente (documento: se imprime) */}
            {tab === 'certificado' && certificado && (
                <div className="tarjeta" style={{ padding: 'clamp(18px, 4vw, 32px)', maxWidth: 760 }}>
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <img src="/logo.png" alt="ASOERC" style={{ width: 90, marginBottom: 8 }} />
                        <div style={{ fontFamily: 'var(--fuente-tit)', fontWeight: 800, fontSize: 22, color: 'var(--verde-osc)' }}>ASOERC ESP</div>
                        <div style={{ fontSize: 13, color: 'var(--texto-2)' }}>NIT: 901.299.762-6</div>
                        <div className="tit-seccion" style={{ justifyContent: 'center', marginTop: 16, fontSize: 17 }}>Certificado de Compra de Material Reciclable</div>
                    </div>

                    <div style={{ fontSize: 14.5, lineHeight: 1.8, color: 'var(--texto)', marginBottom: 20 }}>
                        <p>Certificamos que la empresa <strong>{certificado.cliente?.nombre}</strong>
                        {certificado.cliente?.nit ? ` (NIT: ${certificado.cliente.nit})` : ''} realizó entrega de material reciclable a ASOERC ESP durante el período comprendido entre el <strong>{desde}</strong> y el <strong>{hasta}</strong>, con los siguientes detalles:</p>
                    </div>

                    <div style={{ border: '1.5px solid var(--borde)', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
                        <TablaInforme cols={[{ t: 'Material' }, { t: 'Cantidad (kg)', num: true }, { t: 'Valor unitario', num: true }, { t: 'Total', num: true }]}>
                            {(certificado.detalle || []).map(d => (
                                <tr key={d.material}>
                                    <td style={{ ...estiloTd, fontWeight: 700 }}>{d.material}</td>
                                    <td style={estiloTdNum}>{fmt(d.kilos)} kg</td>
                                    <td style={{ ...estiloTdNum, color: 'var(--texto-2)' }}>${fmt(d.precio_promedio)}/kg</td>
                                    <td style={{ ...estiloTdNum, fontWeight: 700 }}>${fmt(d.total)}</td>
                                </tr>
                            ))}
                            <tr style={{ background: 'var(--verde-suave)' }}>
                                <td style={{ ...estiloTd, fontWeight: 800 }} colSpan={3}>TOTAL</td>
                                <td style={{ ...estiloTdNum, fontWeight: 800, color: 'var(--verde-osc)', fontSize: 15.5 }}>${fmt(certificado.total)}</td>
                            </tr>
                        </TablaInforme>
                    </div>

                    <div style={{ fontSize: 12.5, color: 'var(--texto-3)', textAlign: 'center', borderTop: '1px solid var(--borde)', paddingTop: 16 }}>
                        Este certificado fue generado el {hoy()} y tiene validez como soporte de gestión ambiental.
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
                        <Boton icono="remisiones" onClick={() => exportarCertificadoDisposicionFinal({ cliente: certificado.cliente, detalle: certificado.detalle, desde, fechaCertificado: new Date().toISOString().slice(0,10) })}>
                            Descargar certificado oficial PDF
                        </Boton>
                        <Boton variante="secundario" onClick={() => window.print()}>Imprimir</Boton>
                    </div>
                </div>
            )}

            {/* Estados vacíos */}
            {tab === 'compras' && !compras && !loading && (
                <Tarjeta><Vacio icono="informes" texto="Selecciona un período y toca Generar" /></Tarjeta>
            )}
            {tab === 'certificado' && !certificado && !loading && (
                <Tarjeta><Vacio icono="clientes" texto="Selecciona un cliente y un período para generar el certificado" /></Tarjeta>
            )}
        </div>
    );
}
