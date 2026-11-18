import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth, puedePasar } from '../App';
import { useBodegaActiva } from '../bodega';
import Icono from '../components/Icono';
import { LineaDiaria, BarrasH, Mini, SERIES, pesos, kilos, fechaCorta } from '../components/Graficas';

const RANGOS = [7, 14, 30];
const TIPOS_GASTO = { gasolina: 'Combustible', viatico: 'Viáticos', mantenimiento: 'Mantenimiento', otro: 'Otros' };

function Variacion({ hoy, ayer }) {
    if (!ayer && !hoy) return <span style={{ color: 'var(--texto-3)' }}>Sin movimiento ayer ni hoy</span>;
    if (!ayer) return <span style={{ color: 'var(--texto-3)' }}>Ayer sin movimiento</span>;
    const pct = ((hoy - ayer) / ayer) * 100;
    const sube = pct >= 0;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontWeight: 700, color: sube ? 'var(--verde-osc)' : 'var(--rojo)' }}>
                <Icono nombre={sube ? 'subir' : 'bajar'} tam={15} grosor={2.6} />
                {Math.abs(pct).toLocaleString('es-CO', { maximumFractionDigits: 1 })}%
            </span>
            <span style={{ color: 'var(--texto-3)' }}>vs. ayer</span>
        </span>
    );
}

function Kpi({ titulo, valor, pie, icono, tono = 'claro', mini, colorMini }) {
    const tonos = {
        claro:  { fondo: 'var(--tarjeta)',     borde: 'var(--borde)',      tit: 'var(--texto-2)',    val: 'var(--texto)' },
        verde:  { fondo: 'var(--verde-suave)', borde: 'var(--verde)',      tit: 'var(--verde-osc)',  val: 'var(--verde-osc)' },
        noche:  { fondo: 'var(--noche)',       borde: 'var(--noche)',      tit: 'var(--verde-vivo)', val: '#fff' },
        marco:  { fondo: 'var(--tarjeta)',     borde: 'var(--noche)',      tit: 'var(--texto-2)',    val: 'var(--texto)' },
    }[tono];
    return (
        <div style={{ background: tonos.fondo, border: `2px solid ${tonos.borde}`, borderRadius: 'var(--radio)', padding: '14px 16px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: 'var(--sombra)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span className="etiqueta" style={{ color: tonos.tit }}>{titulo}</span>
                {icono && <Icono nombre={icono} tam={19} style={{ color: tonos.tit, opacity: .85 }} />}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
                <div className="cifra" style={{ fontSize: 'clamp(22px, 2.3vw, 30px)', color: tonos.val, lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{valor}</div>
                {mini && <div className="ocultar-movil"><Mini valores={mini} color={colorMini} ancho={84} alto={30} /></div>}
            </div>
            <div style={{ fontSize: 12.5, color: tono === 'noche' ? 'var(--noche-texto)' : 'var(--texto-2)' }}>{pie}</div>
        </div>
    );
}

function Tarjeta({ titulo, sub, accion, children, style }) {
    return (
        <section className="tarjeta" style={{ padding: '16px 18px', minWidth: 0, ...style }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
                <div style={{ minWidth: 0 }}>
                    <h2 className="tit-seccion">{titulo}</h2>
                    {sub && <div className="sub-seccion">{sub}</div>}
                </div>
                {accion}
            </div>
            {children}
        </section>
    );
}

const VerTodo = ({ to, children = 'Ver todo' }) => (
    <Link to={to} className="etiqueta" style={{ color: 'var(--verde-osc)', textDecoration: 'none', whiteSpace: 'nowrap', paddingTop: 2 }}>{children} ›</Link>
);

function Esqueleto() {
    const bloque = h => <div className="tarjeta" style={{ height: h, background: 'linear-gradient(90deg,#fff 0%,#f3f5f8 50%,#fff 100%)', backgroundSize: '200% 100%', animation: 'brillo 1.4s infinite' }} />;
    return (
        <>
            <style>{'@keyframes brillo{0%{background-position:200% 0}100%{background-position:-200% 0}}'}</style>
            <div className="rejilla-kpi" style={{ marginBottom: 14 }}>{[1, 2, 3, 4].map(i => <div key={i}>{bloque(118)}</div>)}</div>
            <div className="rejilla-2-1">{bloque(340)}{bloque(340)}</div>
        </>
    );
}

export default function Dashboard() {
    const { user } = useAuth();
    const esSuper = user?.rol === 'superadmin';
    const verCaja = puedePasar(user?.rol, 'caja');
    const filtro = useBodegaActiva(user);
    const [bodegas, setBodegas] = useState([]);
    const [bodega_id, setBodegaId] = useState(filtro);
    const [dias, setDias] = useState(14);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [verTabla, setVerTabla] = useState(false);

    useEffect(() => { if (esSuper) api.get('/bodegas').then(d => setBodegas(d.bodegas || [])).catch(() => {}); }, [esSuper]);
    useEffect(() => { setBodegaId(filtro); }, [filtro]); // el selector de la barra manda

    useEffect(() => {
        let vivo = true;
        const q = `/informes/resumen?dias=${dias}${bodega_id ? `&bodega_id=${bodega_id}` : ''}`;
        const cargar = (primera) => {
            if (primera) setLoading(true);
            api.get(q)
                .then(d => { if (vivo) { setData(d); setError(''); } })
                .catch(err => { if (vivo && primera) setError(err.message || 'Error al cargar datos'); })
                .finally(() => { if (vivo && primera) setLoading(false); });
        };
        cargar(true);
        const iv = setInterval(() => cargar(false), 30000);
        return () => { vivo = false; clearInterval(iv); };
    }, [bodega_id, dias]);

    const hoyTxt = (t => t.charAt(0).toUpperCase() + t.slice(1))(new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    const nombreBodega = esSuper ? (bodegas.find(b => String(b.id) === String(bodega_id))?.nombre || 'Todas las bodegas') : null;

    const k = data?.kpis;
    const serie = data?.serie || [];
    const ult7 = serie.slice(-7);
    const totComprasPeriodo = serie.reduce((s, d) => s + d.compras, 0);
    const totVentasPeriodo = serie.reduce((s, d) => s + d.ventas, 0);
    const saldoCajas = (data?.cajas || []).reduce((s, c) => s + c.saldo, 0);
    const mats = data?.materiales || [];
    const topMats = mats.slice(0, 7);
    const otrosKg = mats.slice(7).reduce((s, m) => s + m.kilos, 0);
    const otrosValor = mats.slice(7).reduce((s, m) => s + m.valor, 0);
    const filasMat = otrosKg > 0 ? [...topMats, { nombre: `Otros (${mats.length - 7})`, kilos: otrosKg, valor: otrosValor }] : topMats;
    const kgPeriodo = mats.reduce((s, m) => s + m.kilos, 0);

    return (
        <div className="pagina">
            <div className="encabezado-pagina">
                <div>
                    <div className="etiqueta" style={{ color: 'var(--texto-3)' }}>Resumen de operación</div>
                    <h1>Panel de inicio</h1>
                    <p>{hoyTxt}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {esSuper && (
                        <select value={bodega_id} onChange={e => setBodegaId(e.target.value)} aria-label="Bodega"
                            style={{ height: 42, padding: '0 12px', borderRadius: 9, border: '1.5px solid var(--borde-fuerte)', background: '#fff', fontFamily: 'var(--fuente-tit)', fontWeight: 700, fontSize: 15.5 }}>
                            <option value="">Todas las bodegas</option>
                            {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                        </select>
                    )}
                    <div role="group" aria-label="Periodo" style={{ display: 'flex', background: '#fff', border: '1.5px solid var(--borde-fuerte)', borderRadius: 9, padding: 3, height: 42 }}>
                        {RANGOS.map(r => (
                            <button key={r} onClick={() => setDias(r)} aria-pressed={dias === r}
                                style={{ border: 'none', borderRadius: 6, padding: '0 12px', fontFamily: 'var(--fuente-tit)', fontWeight: 700, fontSize: 15, background: dias === r ? 'var(--noche)' : 'transparent', color: dias === r ? '#fff' : 'var(--texto-2)' }}>
                                {r} días
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {error && <div style={{ background: 'var(--rojo-suave)', border: '1.5px solid var(--rojo-borde)', borderRadius: 9, padding: '12px 16px', color: 'var(--rojo)', fontSize: 14, marginBottom: 14 }}>No se pudo cargar el resumen: {error}</div>}

            {loading && !data ? <Esqueleto /> : data && (
                <>
                    {/* Indicadores de hoy */}
                    <div className="rejilla-kpi" style={{ marginBottom: 14 }}>
                        <Kpi titulo="Compras de hoy" icono="compras" tono="marco" valor={pesos(k.compras_hoy)}
                            mini={ult7.map(d => d.compras)} colorMini={SERIES[0].color}
                            pie={<><Variacion hoy={k.compras_hoy} ayer={k.compras_ayer} /> · {k.num_compras_hoy} {k.num_compras_hoy === 1 ? 'compra' : 'compras'}</>} />
                        <Kpi titulo="Ventas de hoy" icono="ventas" valor={pesos(k.ventas_hoy)}
                            mini={ult7.map(d => d.ventas)} colorMini={SERIES[1].color}
                            pie={<><Variacion hoy={k.ventas_hoy} ayer={k.ventas_ayer} /> · {k.num_ventas_hoy} {k.num_ventas_hoy === 1 ? 'venta' : 'ventas'}</>} />
                        <Kpi titulo="Kilos recibidos hoy" icono="kilos" tono="verde" valor={kilos(k.kilos_hoy)}
                            pie={<><Variacion hoy={k.kilos_hoy} ayer={k.kilos_ayer} /> · {kilos(k.kilos_venta_hoy)} despachados</>} />
                        {verCaja
                            ? <Kpi titulo="Saldo en caja" icono="caja" tono="noche" valor={pesos(saldoCajas)}
                                pie={(data.cajas || []).length > 1 ? `Suma de ${data.cajas.length} bodegas · efectivo` : 'Efectivo en la caja de hoy'} />
                            : <Kpi titulo={`Compras ${dias} días`} icono="informes" tono="noche" valor={pesos(totComprasPeriodo)} pie={`${kilos(kgPeriodo)} recibidos`} />}
                    </div>

                    {/* Gráfica principal + materiales */}
                    <div className="rejilla-2-1" style={{ marginBottom: 14 }}>
                        <Tarjeta titulo="Compras y ventas" sub={`Valor por día · últimos ${dias} días${nombreBodega ? ' · ' + nombreBodega : ''}`}
                            accion={
                                <button onClick={() => setVerTabla(v => !v)} className="etiqueta"
                                    style={{ background: 'none', border: '1.5px solid var(--borde)', borderRadius: 7, padding: '5px 10px', color: 'var(--texto-2)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                    {verTabla ? 'Ver gráfica' : 'Ver tabla'}
                                </button>
                            }>
                            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 8 }}>
                                {SERIES.map((s, i) => (
                                    <div key={s.clave} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ width: 12, height: 12, borderRadius: 3, background: s.color }} />
                                        <span style={{ fontSize: 13.5, color: 'var(--texto-2)' }}>{s.nombre}</span>
                                        <b className="cifra" style={{ fontSize: 16 }}>{pesos(i ? totVentasPeriodo : totComprasPeriodo)}</b>
                                    </div>
                                ))}
                            </div>
                            {verTabla ? (
                                <div style={{ maxHeight: 280, overflow: 'auto' }}>
                                    <table style={{ width: '100%', fontSize: 13.5 }}>
                                        <thead><tr>{['Día', 'Compras', 'Kg comprados', 'Ventas', 'Kg vendidos'].map(t => <th key={t} style={{ textAlign: t === 'Día' ? 'left' : 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--borde)', position: 'sticky', top: 0, background: '#fff' }}>{t}</th>)}</tr></thead>
                                        <tbody>{[...serie].reverse().map(d => (
                                            <tr key={d.fecha}>
                                                <td style={{ padding: '6px 8px', borderBottom: '1px solid #eef1f4' }}>{fechaCorta(d.fecha)}</td>
                                                <td style={{ padding: '6px 8px', borderBottom: '1px solid #eef1f4', textAlign: 'right' }}>{pesos(d.compras)}</td>
                                                <td style={{ padding: '6px 8px', borderBottom: '1px solid #eef1f4', textAlign: 'right' }}>{kilos(d.kilos_compra)}</td>
                                                <td style={{ padding: '6px 8px', borderBottom: '1px solid #eef1f4', textAlign: 'right' }}>{pesos(d.ventas)}</td>
                                                <td style={{ padding: '6px 8px', borderBottom: '1px solid #eef1f4', textAlign: 'right' }}>{kilos(d.kilos_venta)}</td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            ) : <LineaDiaria serie={serie} />}
                        </Tarjeta>

                        <Tarjeta titulo="Materiales recibidos" sub={`Kilos comprados · últimos ${dias} días`}
                            accion={<span className="chip" style={{ background: 'var(--verde-suave)', color: 'var(--verde-osc)' }}>{kilos(kgPeriodo)}</span>}>
                            <BarrasH filas={filasMat} valor={f => f.kilos} etiqueta={f => kilos(f.kilos)} detalle={f => pesos(f.valor)} />
                        </Tarjeta>
                    </div>

                    {/* Caja, préstamos y recicladores */}
                    <div className="rejilla-3">
                        {verCaja && (
                            <Tarjeta titulo="Caja de hoy" sub="Base + ingresos − salidas" accion={<VerTodo to="/caja">Ir a caja</VerTodo>}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {(data.cajas || []).map(c => (
                                        <div key={c.bodega_id} style={{ border: '1.5px solid var(--borde)', borderRadius: 9, padding: '11px 12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 9 }}>
                                                <b style={{ fontSize: 15 }}>{c.bodega}</b>
                                                {!c.existe ? <span className="chip" style={{ background: '#f1f5f9', color: 'var(--texto-2)' }}>Sin abrir</span>
                                                    : c.abierta ? <span className="chip" style={{ background: 'var(--verde-suave)', color: 'var(--verde-osc)' }}>● Abierta</span>
                                                    : <span className="chip" style={{ background: '#f1f5f9', color: 'var(--texto-2)' }}>Cerrada</span>}
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '8px 12px' }}>
                                                {[['Base del día', c.base, 'var(--texto)'], ['Ingresos', c.ingresos, 'var(--verde-osc)'], ['Salidas', c.egresos, 'var(--rojo)'], ['Saldo', c.saldo, c.saldo < 0 ? 'var(--rojo)' : 'var(--texto)']].map(([t, v, col]) => (
                                                    <div key={t} style={{ minWidth: 0 }}>
                                                        <div style={{ fontSize: 12, color: 'var(--texto-3)' }}>{t}</div>
                                                        <div className="cifra" style={{ fontSize: 17, color: col, whiteSpace: 'nowrap' }}>{pesos(v)}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            {c.existe && !c.base_confirmada && <div style={{ marginTop: 8, fontSize: 12, color: '#92600a', background: 'var(--ambar-suave)', borderRadius: 6, padding: '5px 8px' }}>Falta registrar la base del día</div>}
                                        </div>
                                    ))}
                                </div>
                            </Tarjeta>
                        )}

                        {data.prestamos && (
                            <Tarjeta titulo="Préstamos pendientes" sub={`${data.prestamos.personas} personas con saldo · todas las bodegas`} accion={<VerTodo to="/prestamos" />}>
                                {data.prestamos.top.length === 0
                                    ? <div style={{ color: 'var(--texto-3)', fontSize: 13.5, padding: '18px 0', textAlign: 'center' }}>No hay préstamos pendientes</div>
                                    : <div>
                                        {data.prestamos.top.map((p, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #eef1f4' }}>
                                                <div style={{ width: 34, height: 34, borderRadius: '50%', background: p.tipo === 'Empleado' ? 'var(--ambar-suave)' : 'var(--verde-suave)', color: p.tipo === 'Empleado' ? '#92600a' : 'var(--verde-osc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fuente-tit)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                                                    {p.nombre.split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase()}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
                                                    <div style={{ fontSize: 12, color: 'var(--texto-3)' }}>{p.tipo}</div>
                                                </div>
                                                <b className="cifra" style={{ fontSize: 16, color: 'var(--rojo)', whiteSpace: 'nowrap' }}>{pesos(p.saldo)}</b>
                                            </div>
                                        ))}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, background: 'var(--ambar-suave)', borderLeft: '3px solid var(--ambar)', borderRadius: 6, padding: '9px 12px' }}>
                                            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Total por cobrar</span>
                                            <b className="cifra" style={{ fontSize: 17 }}>{pesos(data.prestamos.total)}</b>
                                        </div>
                                    </div>}
                            </Tarjeta>
                        )}

                        <Tarjeta titulo="Top recicladores" sub="Kilos entregados este mes" accion={puedePasar(user?.rol, 'recicladores') ? <VerTodo to="/recicladores" /> : null}>
                            {data.top_recicladores.length === 0
                                ? <div style={{ color: 'var(--texto-3)', fontSize: 13.5, padding: '18px 0', textAlign: 'center' }}>Sin compras este mes</div>
                                : data.top_recicladores.map((r, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #eef1f4' }}>
                                        <span className="cifra" style={{ width: 24, fontSize: 15, color: i === 0 ? 'var(--verde-osc)' : 'var(--texto-3)' }}>{String(i + 1).padStart(2, '0')}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nombre}</div>
                                            <div style={{ fontSize: 12, color: 'var(--texto-3)' }}>{r.compras} compras · {pesos(r.valor)}</div>
                                        </div>
                                        <b className="cifra" style={{ fontSize: 16, whiteSpace: 'nowrap' }}>{kilos(r.kilos)}</b>
                                    </div>
                                ))}
                            {data.gastos_vehiculos.total > 0 && puedePasar(user?.rol, 'vehiculos') && (
                                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1.5px dashed var(--borde)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <span className="etiqueta" style={{ color: 'var(--texto-2)', display: 'flex', alignItems: 'center', gap: 6 }}><Icono nombre="vehiculos" tam={17} /> Gastos de vehículos del mes</span>
                                        <b className="cifra" style={{ fontSize: 16 }}>{pesos(data.gastos_vehiculos.total)}</b>
                                    </div>
                                    <div style={{ fontSize: 12.5, color: 'var(--texto-3)' }}>
                                        {data.gastos_vehiculos.por_tipo.map(g => `${TIPOS_GASTO[g.tipo] || g.tipo} ${pesos(g.total)}`).join(' · ')}
                                    </div>
                                </div>
                            )}
                        </Tarjeta>
                    </div>
                </>
            )}
        </div>
    );
}
