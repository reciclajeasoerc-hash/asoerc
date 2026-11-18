import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Icono from '../components/Icono';
import { EncabezadoPagina, Boton, Tarjeta, Kpi, Chip, Modal, Campo, estiloInput, Aviso, Vacio } from '../components/ui';

export default function Bodegas() {
    const [bodegas, setBodegas] = useState([]);
    const [stats, setStats] = useState({});
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState({ nombre: '', direccion: '', telefono: '' });
    const [editId, setEditId] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const cargar = async () => {
        const d = await api.get('/bodegas');
        const lista = d.bodegas || [];
        setBodegas(lista);
        // Cargar stats de dashboard por bodega
        const statsMap = {};
        await Promise.all(lista.map(async b => {
            try {
                const r = await api.get(`/informes/dashboard?bodega_id=${b.id}`);
                statsMap[b.id] = r;
            } catch { statsMap[b.id] = null; }
        }));
        setStats(statsMap);
    };

    useEffect(() => { cargar(); }, []);

    const abrirNueva = () => {
        setForm({ nombre: '', direccion: '', telefono: '' });
        setEditId(null);
        setError('');
        setModal(true);
    };

    const abrirEditar = (b, e) => {
        e.stopPropagation();
        setForm({ nombre: b.nombre, direccion: b.direccion || '', telefono: b.telefono || '' });
        setEditId(b.id);
        setError('');
        setModal(true);
    };

    const guardar = async () => {
        if (!form.nombre.trim()) return setError('El nombre es requerido');
        setLoading(true);
        setError('');
        try {
            if (editId) {
                await api.put(`/bodegas/${editId}`, form);
            } else {
                await api.post('/bodegas', form);
            }
            setModal(false);
            cargar();
        } catch (e) {
            setError(e.msg || e.message || 'Error al guardar');
        } finally {
            setLoading(false);
        }
    };

    const fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

    return (
        <div className="pagina">
            <EncabezadoPagina titulo="Bodegas" sub="Administra y monitorea todas las bodegas del sistema" icono="bodegas"
                acciones={<Boton icono="agregar" onClick={abrirNueva}>Nueva bodega</Boton>} />

            <div className="rejilla-tarjetas">
                {bodegas.map(b => {
                    const s = stats[b.id];
                    return (
                        <Tarjeta
                            key={b.id}
                            onClick={() => navigate(`/bodegas/${b.id}`)}
                            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <Icono nombre="bodegas" tam={20} style={{ color: 'var(--verde)' }} />
                                        <div className="tit-seccion" style={{ fontSize: 18, textTransform: 'none', letterSpacing: 0 }}>
                                            {b.nombre}
                                        </div>
                                    </div>
                                    {b.direccion && (
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13, color: 'var(--texto-2)', marginTop: 4 }}>
                                            <Icono nombre="bodegas" tam={15} style={{ color: 'var(--texto-3)', marginTop: 1 }} />
                                            <span>{b.direccion}</span>
                                        </div>
                                    )}
                                    {b.telefono && (
                                        <div style={{ fontSize: 13, color: 'var(--texto-2)', marginTop: 4 }}>{b.telefono}</div>
                                    )}
                                </div>
                                <Boton onClick={e => abrirEditar(b, e)} variante="secundario" tam="sm" style={{ flexShrink: 0 }}>
                                    Editar
                                </Boton>
                            </div>

                            {/* Stats del día */}
                            <div style={{ background: 'var(--fondo)', border: '1.5px solid var(--borde)', borderRadius: 'var(--radio-sm)', padding: 12 }}>
                                <div className="etiqueta" style={{ color: 'var(--texto-3)', marginBottom: 10 }}>
                                    Hoy
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    <Kpi titulo="Compras" valor={s ? fmt(s.compras?.pesos) : '—'} pie={s ? `${s.compras?.cantidad || 0} transacciones` : 'Cargando...'} tono="verde" icono="compras" />
                                    <Kpi titulo="Ventas" valor={s ? fmt(s.ventas?.pesos) : '—'} pie={s ? `${s.ventas?.cantidad || 0} transacciones` : 'Cargando...'} tono="marco" icono="ventas" />
                                </div>
                            </div>

                            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                                <Chip tono={b.activa ? 'verde' : 'rojo'}>{b.activa ? 'Activa' : 'Inactiva'}</Chip>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--verde-osc)', fontWeight: 700 }}>
                                    Ver detalle
                                    <Icono nombre="subir" tam={16} style={{ transform: 'rotate(90deg)' }} />
                                </span>
                            </div>
                        </Tarjeta>
                    );
                })}
            </div>

            {bodegas.length === 0 && <Tarjeta><Vacio icono="bodegas" texto="No hay bodegas registradas" /></Tarjeta>}

            {modal && (
                <Modal
                    titulo={editId ? 'Editar bodega' : 'Nueva bodega'}
                    onCerrar={() => setModal(false)}
                    pie={
                        <>
                            <Boton variante="secundario" onClick={() => setModal(false)}>Cancelar</Boton>
                            <Boton onClick={guardar} disabled={loading}>
                                {loading ? 'Guardando...' : (editId ? 'Guardar cambios' : 'Crear bodega')}
                            </Boton>
                        </>
                    }
                >
                        <div className="rejilla-form">
                            <Campo etiqueta="Nombre">
                                <input style={estiloInput} value={form.nombre}
                                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                                    placeholder="Ej: El Diamante" />
                            </Campo>
                            <Campo etiqueta="Dirección">
                                <input style={estiloInput} value={form.direccion}
                                    onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                                    placeholder="Dirección de la bodega" />
                            </Campo>
                            <Campo etiqueta="Teléfono">
                                <input style={estiloInput} value={form.telefono}
                                    onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                                    placeholder="Teléfono de contacto" />
                            </Campo>
                        </div>

                        {error && <Aviso tipo="error" style={{ marginTop: 12 }}>{error}</Aviso>}

                </Modal>
            )}
        </div>
    );
}
