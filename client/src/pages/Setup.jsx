import React, { useState } from 'react';
import { api } from '../api';

export default function Setup({ onListo }) {
    const [paso, setPaso] = useState(1);
    const [form, setForm] = useState({ nombre_empresa: '', nombre_admin: '', email: '', password: '', confirmar: '' });
    const [error, setError]     = useState('');
    const [loading, setLoading] = useState(false);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    async function finalizar(e) {
        e.preventDefault();
        setError('');
        if (form.password !== form.confirmar) return setError('Las contraseñas no coinciden.');
        if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
        setLoading(true);
        try {
            await api.post('/setup', {
                nombre_empresa: form.nombre_empresa,
                nombre_admin:   form.nombre_admin,
                email:          form.email,
                password:       form.password
            });
            onListo();
        } catch (err) {
            setError(err.message);
        } finally { setLoading(false); }
    }

    return (
        <div style={s.page}>
            <div style={s.card}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{ fontSize: 52 }}>♻️</div>
                    <h1 style={{ color: '#1a5c2a', fontSize: 22, fontWeight: 800, margin: '8px 0 4px' }}>ASOERC</h1>
                    <p style={{ color: '#888', fontSize: 13 }}>Configuración inicial del sistema</p>
                </div>

                {/* Indicador de pasos */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 28, width: '100%' }}>
                    {[1, 2].map(n => (
                        <div key={n} style={{ flex: 1, height: 4, borderRadius: 2, background: paso >= n ? '#1a5c2a' : '#e5e7eb' }} />
                    ))}
                </div>

                {paso === 1 && (
                    <div style={{ width: '100%' }}>
                        <h2 style={s.titulo}>Datos de la empresa</h2>
                        <p style={s.subtitulo}>Esta información aparecerá en el sistema</p>

                        <label style={s.label}>
                            Nombre de la empresa *
                            <input autoFocus type="text" value={form.nombre_empresa}
                                onChange={e => set('nombre_empresa', e.target.value)}
                                placeholder="Ej: ASOERC S.A.S."
                                style={s.input} />
                        </label>

                        <button onClick={() => {
                            if (!form.nombre_empresa.trim()) return setError('Ingrese el nombre de la empresa.');
                            setError(''); setPaso(2);
                        }} style={s.btnPrimario}>
                            Continuar →
                        </button>
                        {error && <div style={s.err}>{error}</div>}
                    </div>
                )}

                {paso === 2 && (
                    <form onSubmit={finalizar} style={{ width: '100%' }}>
                        <h2 style={s.titulo}>Cuenta de administrador</h2>
                        <p style={s.subtitulo}>Con estas credenciales iniciará sesión</p>

                        <label style={s.label}>
                            Nombre del administrador
                            <input type="text" value={form.nombre_admin}
                                onChange={e => set('nombre_admin', e.target.value)}
                                placeholder="Ej: César Granados"
                                style={s.input} />
                        </label>
                        <label style={s.label}>
                            Correo electrónico *
                            <input type="email" required value={form.email}
                                onChange={e => set('email', e.target.value)}
                                placeholder="admin@empresa.com"
                                style={s.input} />
                        </label>
                        <label style={s.label}>
                            Contraseña *
                            <input type="password" required value={form.password}
                                onChange={e => set('password', e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                style={s.input} />
                        </label>
                        <label style={{ ...s.label, marginBottom: 20 }}>
                            Confirmar contraseña *
                            <input type="password" required value={form.confirmar}
                                onChange={e => set('confirmar', e.target.value)}
                                placeholder="Repita la contraseña"
                                style={s.input} />
                        </label>

                        {error && <div style={s.err}>{error}</div>}

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="button" onClick={() => { setError(''); setPaso(1); }}
                                style={s.btnSecundario}>← Atrás</button>
                            <button type="submit" disabled={loading} style={{ ...s.btnPrimario, flex: 1 }}>
                                {loading ? 'Configurando...' : '✅ Finalizar configuración'}
                            </button>
                        </div>
                    </form>
                )}

                <p style={{ color: '#bbb', fontSize: 11, marginTop: 20, textAlign: 'center' }}>
                    Solo necesita hacer esto una vez
                </p>
            </div>
        </div>
    );
}

const s = {
    page:        { minHeight: '100vh', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    card:        { background: '#fff', borderRadius: 16, padding: 40, width: '100%', maxWidth: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    titulo:      { fontSize: 17, fontWeight: 700, color: '#111', margin: '0 0 4px' },
    subtitulo:   { fontSize: 13, color: '#888', margin: '0 0 20px' },
    label:       { display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 14, width: '100%' },
    input:       { display: 'block', width: '100%', marginTop: 5, padding: '11px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' },
    btnPrimario: { width: '100%', padding: '12px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
    btnSecundario:{ padding: '12px 18px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
    err:         { background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 12px', color: '#dc2626', fontSize: 13, marginTop: 12, width: '100%' },
};
