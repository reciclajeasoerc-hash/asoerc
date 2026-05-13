import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { api } from '../api';

export default function Login() {
    const { login } = useAuth();
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState({ nombre: 'ASOERC', logo_url: null });

    useEffect(() => {
        fetch('/api/configuracion').then(r => r.json()).then(d => {
            if (d.ok) setConfig({ nombre: d.nombre, logo_url: d.logo_url });
        }).catch(() => {});
    }, []);

    const submit = async (e) => {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            const data = await api.post('/auth/login', form);
            login(data.user, data.token);
        } catch (err) {
            setError(err.message);
        } finally { setLoading(false); }
    };

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a5c2a 0%, #2d7a3f 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 40, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    {config.logo_url
                        ? <img src={config.logo_url} alt="Logo" style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: 8 }} />
                        : <div style={{ fontSize: 48 }}>♻️</div>
                    }
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a5c2a', marginTop: 8 }}>{config.nombre}</h1>
                    <p style={{ color: '#666', fontSize: 13 }}>Sistema de Gestión de Reciclaje</p>
                </div>
                <form onSubmit={submit}>
                    <label style={{ display: 'block', marginBottom: 16 }}>
                        <span style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>Correo electrónico</span>
                        <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                            style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
                    </label>
                    <label style={{ display: 'block', marginBottom: 24 }}>
                        <span style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>Contraseña</span>
                        <input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                            style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
                    </label>
                    {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 12px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{error}</div>}
                    <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                        {loading ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </form>
            </div>
        </div>
    );
}
