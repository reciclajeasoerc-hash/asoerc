import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../App';

export default function Configuracion() {
    const { user } = useAuth();

    const [empresa, setEmpresa] = useState({ nombre: '', logo_url: null });
    const [perfil, setPerfil]   = useState({ nombre: '', email: '', password: '', confirmar: '' });
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);

    const [guardandoEmpresa, setGuardandoEmpresa] = useState(false);
    const [guardandoPerfil,  setGuardandoPerfil]  = useState(false);
    const [msgEmpresa, setMsgEmpresa] = useState(null);
    const [msgPerfil,  setMsgPerfil]  = useState(null);

    const [telegramChats, setTelegramChats] = useState([]);
    const [tgForm, setTgForm] = useState({ chat_id: '', nombre: '', rol: 'operador' });
    const [msgTg, setMsgTg] = useState(null);

    const [limpiando, setLimpiando]   = useState(false);
    const [msgLimpiar, setMsgLimpiar] = useState(null);

    const fileRef = useRef();

    useEffect(() => {
        fetch('/api/configuracion').then(r => r.json()).then(d => {
            if (d.ok) setEmpresa({ nombre: d.nombre, logo_url: d.logo_url });
        }).catch(() => {});
        setEmpresa(e => ({ ...e }));
        if (user) setPerfil(p => ({ ...p, nombre: user.nombre || '', email: user.email || '' }));
        api.get('/telegram/chats').then(d => setTelegramChats(d.chats || [])).catch(() => {});
    }, [user]);

    function onLogoChange(e) {
        const f = e.target.files[0];
        if (!f) return;
        setLogoFile(f);
        setLogoPreview(URL.createObjectURL(f));
    }

    async function guardarEmpresa(e) {
        e.preventDefault();
        setGuardandoEmpresa(true); setMsgEmpresa(null);
        try {
            const fd = new FormData();
            fd.append('nombre', empresa.nombre);
            if (logoFile) fd.append('logo', logoFile);
            const d = await api.uploadPut('/configuracion', fd);
            setEmpresa({ nombre: d.nombre, logo_url: d.logo_url });
            setLogoFile(null); setLogoPreview(null);
            setMsgEmpresa({ ok: true, texto: 'Configuración guardada' });
        } catch (err) {
            setMsgEmpresa({ ok: false, texto: err.message });
        } finally { setGuardandoEmpresa(false); }
    }

    async function guardarPerfil(e) {
        e.preventDefault();
        if (perfil.password && perfil.password !== perfil.confirmar)
            return setMsgPerfil({ ok: false, texto: 'Las contraseñas no coinciden' });
        setGuardandoPerfil(true); setMsgPerfil(null);
        try {
            const body = { nombre: perfil.nombre, email: perfil.email };
            if (perfil.password) body.password = perfil.password;
            await api.put('/usuarios/perfil', body);
            setPerfil(p => ({ ...p, password: '', confirmar: '' }));
            setMsgPerfil({ ok: true, texto: 'Perfil actualizado. Vuelva a iniciar sesión si cambió el correo.' });
        } catch (err) {
            setMsgPerfil({ ok: false, texto: err.message });
        } finally { setGuardandoPerfil(false); }
    }

    const ROL_OPCIONES = [
        { val: 'superadmin', label: '🔑 Super Admin — acceso total' },
        { val: 'admin',      label: '🏢 Admin — acceso total' },
        { val: 'vendedor',   label: '📤 Vendedor — ventas, clientes, caja (consulta)' },
        { val: 'cajero',     label: '💰 Cajero — solo consultas de caja y resúmenes' },
        { val: 'operador',   label: '♻️ Operador — compras, recicladores, préstamos' },
    ];
    const ROL_BADGE = { superadmin:'#f59e0b', admin:'#3b82f6', vendedor:'#8b5cf6', cajero:'#10b981', operador:'#6b7280' };

    async function agregarChat(e) {
        e.preventDefault();
        if (!tgForm.chat_id.trim()) return;
        setMsgTg(null);
        try {
            const d = await api.post('/telegram/chats', tgForm);
            setTelegramChats(d.chats);
            setTgForm({ chat_id: '', nombre: '', rol: 'operador' });
            setMsgTg({ ok: true, texto: 'Chat agregado' });
        } catch (err) { setMsgTg({ ok: false, texto: err.message }); }
    }

    async function eliminarChat(chat_id) {
        const d = await api.delete(`/telegram/chats/${chat_id}`);
        setTelegramChats(d.chats);
    }

    async function limpiarDatosPrueba() {
        if (!window.confirm('⚠️ Esto BORRARÁ todas las ventas, compras, cajas, movimientos, remisiones y préstamos de TODAS las bodegas.\n\nSe mantienen clientes, recicladores, materiales y empleados.\n\n¿Continuar?')) return;
        const texto = window.prompt('Esta acción es IRREVERSIBLE. Escribe BORRAR para confirmar:');
        if (texto !== 'BORRAR') { setMsgLimpiar({ ok: false, texto: 'Cancelado. Debes escribir BORRAR exactamente.' }); return; }
        setLimpiando(true); setMsgLimpiar(null);
        try {
            const d = await api.post('/setup/limpiar-operaciones', {});
            setMsgLimpiar({ ok: true, texto: d.msg || 'Datos de prueba eliminados.' });
        } catch (err) {
            setMsgLimpiar({ ok: false, texto: err.message });
        } finally { setLimpiando(false); }
    }

    const logoActual = logoPreview || empresa.logo_url;

    return (
        <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>⚙️ Configuración</h2>

            {/* ── Empresa ── */}
            <div style={s.card}>
                <h3 style={s.cardTitle}>🏢 Datos de la empresa</h3>
                <form onSubmit={guardarEmpresa}>
                    {/* Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                        <div onClick={() => fileRef.current.click()} style={{
                            width: 80, height: 80, borderRadius: 12, border: '2px dashed #d1d5db',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', overflow: 'hidden', background: '#f9fafb', flexShrink: 0
                        }}>
                            {logoActual
                                ? <img src={logoActual} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                : <span style={{ fontSize: 32 }}>♻️</span>
                            }
                        </div>
                        <div>
                            <button type="button" onClick={() => fileRef.current.click()}
                                style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                                Subir logo
                            </button>
                            <p style={{ color: '#888', fontSize: 12, marginTop: 6 }}>PNG, JPG. Recomendado: cuadrado</p>
                            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onLogoChange} />
                        </div>
                    </div>

                    <label style={s.label}>
                        Nombre de la empresa
                        <input type="text" value={empresa.nombre}
                            onChange={e => setEmpresa(v => ({ ...v, nombre: e.target.value }))}
                            style={s.input} required />
                    </label>

                    {msgEmpresa && <div style={msgEmpresa.ok ? s.ok : s.err}>{msgEmpresa.texto}</div>}
                    <button type="submit" disabled={guardandoEmpresa} style={s.btn}>
                        {guardandoEmpresa ? 'Guardando...' : 'Guardar empresa'}
                    </button>
                </form>
            </div>

            {/* ── Telegram ── */}
            <div style={s.card}>
                <h3 style={s.cardTitle}>🤖 Bot Telegram — chats autorizados</h3>
                <p style={{ fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 1.6 }}>
                    Solo los chats de esta lista pueden usar el bot. Si la lista está vacía, cualquiera con el enlace puede usarlo.<br />
                    Para saber tu chat ID, abre el bot en Telegram y envía <strong>/start</strong>.
                </p>

                {telegramChats.length > 0 && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
                        <thead>
                            <tr style={{ background: '#f0faf0' }}>
                                <th style={{ padding: '8px 10px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>Nombre</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>Chat ID</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left', color: '#1a5c2a', fontWeight: 600 }}>Rol</th>
                                <th style={{ width: 40 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {telegramChats.map(c => (
                                <tr key={c.chat_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{c.nombre}</td>
                                    <td style={{ padding: '8px 10px', color: '#666', fontFamily: 'monospace' }}>{c.chat_id}</td>
                                    <td style={{ padding: '8px 10px' }}>
                                        <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, color: '#fff', background: ROL_BADGE[c.rol] || '#6b7280' }}>
                                            {ROL_OPCIONES.find(r => r.val === c.rol)?.label.split(' — ')[0] || c.rol || 'operador'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '8px 10px' }}>
                                        <button onClick={() => eliminarChat(c.chat_id)}
                                            style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16 }}>✕</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {telegramChats.length === 0 && (
                    <p style={{ fontSize: 13, color: '#aaa', marginBottom: 12 }}>Sin chats autorizados — bot abierto a cualquiera.</p>
                )}

                <form onSubmit={agregarChat} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <label style={{ ...s.label, flex: '1 1 130px', margin: 0 }}>
                        <span style={{ fontSize: 11, color: '#666' }}>Nombre</span>
                        <input value={tgForm.nombre} onChange={e => setTgForm(f => ({ ...f, nombre: e.target.value }))}
                            placeholder="Ej: César" style={{ ...s.input, marginTop: 4 }} />
                    </label>
                    <label style={{ ...s.label, flex: '1 1 140px', margin: 0 }}>
                        <span style={{ fontSize: 11, color: '#666' }}>Chat ID *</span>
                        <input value={tgForm.chat_id} onChange={e => setTgForm(f => ({ ...f, chat_id: e.target.value }))}
                            placeholder="Ej: 123456789" required style={{ ...s.input, marginTop: 4 }} />
                    </label>
                    <label style={{ ...s.label, flex: '1 1 170px', margin: 0 }}>
                        <span style={{ fontSize: 11, color: '#666' }}>Rol</span>
                        <select value={tgForm.rol} onChange={e => setTgForm(f => ({ ...f, rol: e.target.value }))}
                            style={{ ...s.input, marginTop: 4 }}>
                            {ROL_OPCIONES.filter(r => r.val !== 'superadmin').map(r => (
                                <option key={r.val} value={r.val}>{r.label}</option>
                            ))}
                        </select>
                    </label>
                    <button type="submit" style={{ ...s.btn, marginTop: 0, whiteSpace: 'nowrap' }}>+ Agregar</button>
                </form>
                {msgTg && <div style={{ ...( msgTg.ok ? s.ok : s.err), marginTop: 10 }}>{msgTg.texto}</div>}
            </div>

            {/* ── Perfil ── */}
            <div style={s.card}>
                <h3 style={s.cardTitle}>👤 Mi perfil</h3>
                <form onSubmit={guardarPerfil}>
                    <label style={s.label}>
                        Nombre
                        <input type="text" value={perfil.nombre}
                            onChange={e => setPerfil(p => ({ ...p, nombre: e.target.value }))}
                            style={s.input} />
                    </label>
                    <label style={s.label}>
                        Correo electrónico
                        <input type="email" value={perfil.email}
                            onChange={e => setPerfil(p => ({ ...p, email: e.target.value }))}
                            style={s.input} required />
                    </label>
                    <label style={s.label}>
                        Nueva contraseña <span style={{ color: '#aaa', fontWeight: 400 }}>(dejar vacío para no cambiar)</span>
                        <input type="password" value={perfil.password}
                            onChange={e => setPerfil(p => ({ ...p, password: e.target.value }))}
                            placeholder="Mínimo 6 caracteres"
                            style={s.input} />
                    </label>
                    {perfil.password && (
                        <label style={s.label}>
                            Confirmar contraseña
                            <input type="password" value={perfil.confirmar}
                                onChange={e => setPerfil(p => ({ ...p, confirmar: e.target.value }))}
                                style={s.input} />
                        </label>
                    )}

                    {msgPerfil && <div style={msgPerfil.ok ? s.ok : s.err}>{msgPerfil.texto}</div>}
                    <button type="submit" disabled={guardandoPerfil} style={s.btn}>
                        {guardandoPerfil ? 'Guardando...' : 'Guardar perfil'}
                    </button>
                </form>
            </div>

            {/* ── Zona de peligro (solo superadmin) ── */}
            {user?.rol === 'superadmin' && (
                <div style={{ ...s.card, border: '1px solid #fca5a5' }}>
                    <h3 style={{ ...s.cardTitle, color: '#dc2626' }}>🧹 Limpiar datos de prueba</h3>
                    <p style={{ fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 1.6 }}>
                        Borra <strong>todas las ventas, compras, cajas, movimientos, remisiones y préstamos</strong> de todas las bodegas, para dejar el sistema limpio antes de operar en real.
                        <strong> No</strong> borra clientes, recicladores, materiales ni empleados. Esta acción es <strong>irreversible</strong>.
                    </p>
                    {msgLimpiar && <div style={msgLimpiar.ok ? s.ok : s.err}>{msgLimpiar.texto}</div>}
                    <button type="button" onClick={limpiarDatosPrueba} disabled={limpiando} style={{ ...s.btn, background: '#dc2626' }}>
                        {limpiando ? 'Limpiando...' : '🧹 Limpiar datos de prueba'}
                    </button>
                </div>
            )}
        </div>
    );
}

const s = {
    card:      { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,.08)' },
    cardTitle: { fontSize: 15, fontWeight: 700, marginBottom: 20, color: '#111' },
    label:     { display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 14 },
    input:     { display: 'block', width: '100%', marginTop: 5, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' },
    btn:       { marginTop: 4, padding: '11px 24px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
    ok:        { background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '10px 12px', color: '#166534', fontSize: 13, marginBottom: 12 },
    err:       { background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 12px', color: '#dc2626', fontSize: 13, marginBottom: 12 },
};
