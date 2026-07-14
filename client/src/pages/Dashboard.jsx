import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import { useBodegaActiva } from '../bodega';

const fmt = n => Number(n || 0).toLocaleString('es-CO');
const fmtKg = n => Number(n || 0).toFixed(2) + ' kg';

export default function Dashboard() {
    const { user } = useAuth();
    const filtro = useBodegaActiva(user); // bodega elegida en la barra lateral ('' = todas)
    const [data, setData] = useState(null);
    const [bodegas, setBodegas] = useState([]);
    const [bodega_id, setBodegaId] = useState(filtro);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => { api.get('/bodegas').then(d => setBodegas(d.bodegas || [])).catch(() => {}); }, []);
    useEffect(() => { setBodegaId(filtro); }, [filtro]); // el selector de la barra manda

    useEffect(() => {
        setLoading(true);
        setError('');
        const q = bodega_id ? `?bodega_id=${bodega_id}` : '';
        api.get(`/informes/dashboard${q}`)
            .then(d => { setData(d); setError(''); })
            .catch(err => setError(err.message || 'Error al cargar datos'))
            .finally(() => setLoading(false));
        const iv = setInterval(() => {
            api.get(`/informes/dashboard${q}`).then(d => setData(d)).catch(() => {});
        }, 30000);
        return () => clearInterval(iv);
    }, [bodega_id]);

    const card = (icon, titulo, valor, sub, color = '#1a5c2a') => (
        <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)', borderLeft: `4px solid ${color}` }}>
            <div style={{ fontSize: 28 }}>{icon}</div>
            <div style={{ color: '#666', fontSize: 13, marginTop: 6 }}>{titulo}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 4 }}>{valor}</div>
            {sub && <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{sub}</div>}
        </div>
    );

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>Dashboard — {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
                    <p style={{ color: '#666', fontSize: 13 }}>Actividad en tiempo real</p>
                </div>
                <select value={bodega_id} onChange={e => setBodegaId(e.target.value)}
                    style={{ marginLeft: 'auto', padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                    <option value="">Todas las bodegas</option>
                    {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                </select>
            </div>

            {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>❌ {error}</div>}
            {loading ? <p style={{ color: '#666' }}>Cargando...</p> : data && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                        {card('⚖️',  'Compras hoy',    data.compras.cantidad,                 `${fmtKg(data.compras.kilos)} ingresados`, '#1a5c2a')}
                        {card('💰', 'Pagado hoy',     `$${fmt(data.compras.pesos)}`,          'A recicladores', '#2563eb')}
                        {card('📤', 'Ventas hoy',     data.ventas.cantidad,                   `${fmtKg(data.ventas.kilos)} despachados`, '#7c3aed')}
                        {card('💵', 'Ingresos ventas',`$${fmt(data.ventas.pesos)}`,            'Total ventas del día', '#059669')}
                    </div>

                    <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Bot Telegram activo</div>
                        <div style={{ fontSize: 13, color: '#666' }}>Los operadores pueden registrar compras por voz enviando mensajes al bot de Telegram configurado.</div>
                    </div>
                </>
            )}
        </div>
    );
}
