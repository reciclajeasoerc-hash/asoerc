import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import { getBodegaFiltro } from '../bodega';

// De qué caja sale la plata de un préstamo o un gasto.
// El superadmin elige la bodega; los demás solo ven la suya (el servidor igual la fuerza).
export default function CajaOrigen({ value, onChange, texto = 'Sale de la caja de' }) {
    const { user } = useAuth();
    const esSuper = user?.rol === 'superadmin';
    const [bodegas, setBodegas] = useState([]);

    useEffect(() => {
        api.get('/bodegas').then(d => {
            const bs = d.bodegas || [];
            setBodegas(bs);
            if (esSuper && !value) {
                const inicial = getBodegaFiltro() || (bs[0] ? String(bs[0].id) : '');
                if (inicial) onChange?.(inicial);
            }
        }).catch(() => {});
    }, []);

    const nombre = id => bodegas.find(b => String(b.id) === String(id))?.nombre || '';

    if (esSuper) return (
        <label style={{ display: 'block' }}>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>💵 {texto}*</div>
            <select value={value || ''} onChange={e => onChange?.(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
                <option value="">Elige la bodega...</option>
                {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
        </label>
    );
    return (
        <div style={{ fontSize: 12, color: '#1a5c2a', fontWeight: 600, background: '#f0faf0', border: '1px solid #c8e6c9', borderRadius: 6, padding: '6px 10px' }}>
            💵 {texto} {nombre(user?.bodega_id) || 'tu bodega'}
        </div>
    );
}
