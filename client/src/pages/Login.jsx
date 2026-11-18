import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { api } from '../api';
import { Campo, Boton, Aviso, estiloInput } from '../components/ui';

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
        <div style={{ minHeight: '100dvh', background: 'var(--noche)', backgroundImage: 'radial-gradient(circle at 15% 10%, rgba(22,163,74,.28), transparent 45%), radial-gradient(circle at 90% 95%, rgba(22,163,74,.18), transparent 40%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ width: '100%', maxWidth: 400 }}>
                <div style={{ textAlign: 'center', marginBottom: 22, color: '#fff' }}>
                    {config.logo_url
                        ? <img src={config.logo_url} alt="Logo" style={{ width: 84, height: 84, objectFit: 'contain', borderRadius: '50%', background: '#fff', border: '3px solid var(--verde)' }} />
                        : <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'var(--verde)', border: '3px solid #fff', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fuente-tit)', fontWeight: 800, fontSize: 24 }}>ASO</div>}
                    <h1 style={{ color: '#fff', fontSize: 32, fontWeight: 800, letterSpacing: .8, marginTop: 12, textTransform: 'uppercase' }}>{config.nombre}</h1>
                    <p className="etiqueta" style={{ color: 'var(--noche-tenue)', marginTop: 4 }}>Sistema de gestión de reciclaje</p>
                </div>
                <form onSubmit={submit} style={{ background: '#fff', borderRadius: 14, padding: '26px 24px', boxShadow: 'var(--sombra-alta)', borderTop: '4px solid var(--verde)' }}>
                    <h2 className="tit-seccion" style={{ marginBottom: 18 }}>Ingresar</h2>
                    <Campo etiqueta="Correo electrónico" style={{ marginBottom: 14 }}>
                        <input type="email" required autoComplete="username" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                            style={{ ...estiloInput, height: 48 }} />
                    </Campo>
                    <Campo etiqueta="Contraseña" style={{ marginBottom: 20 }}>
                        <input type="password" required autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                            style={{ ...estiloInput, height: 48 }} />
                    </Campo>
                    {error && <Aviso tipo="error" style={{ marginBottom: 16 }}>{error}</Aviso>}
                    <Boton type="submit" disabled={loading} tam="lg" ancho style={{ textTransform: 'uppercase' }}>
                        {loading ? 'Ingresando...' : 'Ingresar'}
                    </Boton>
                </form>
            </div>
        </div>
    );
}
