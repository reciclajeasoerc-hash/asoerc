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

    const fileRef = useRef();

    useEffect(() => {
        fetch('/api/configuracion').then(r => r.json()).then(d => {
            if (d.ok) setEmpresa({ nombre: d.nombre, logo_url: d.logo_url });
        }).catch(() => {});
        setEmpresa(e => ({ ...e }));
        if (user) setPerfil(p => ({ ...p, nombre: user.nombre || '', email: user.email || '' }));
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
