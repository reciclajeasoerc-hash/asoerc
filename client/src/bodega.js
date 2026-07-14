import { useState, useEffect } from 'react';

// Bodega seleccionada por el superadmin en la barra lateral. '' = Todas.
// Los demás roles quedan fijos a su propia bodega (el backend igual los filtra).
export function getBodegaFiltro() {
    try { return localStorage.getItem('bodegaFiltro') || ''; } catch { return ''; }
}

// Bodega que debe usarse para FILTRAR datos, según el usuario.
// superadmin → lo que eligió en la barra ('' = todas). Otros → su bodega.
export function bodegaActiva(user) {
    if (user?.rol === 'superadmin') return getBodegaFiltro();
    return user?.bodega_id ? String(user.bodega_id) : '';
}

// Hook que devuelve la bodega activa y re-renderiza cuando cambia el selector.
export function useBodegaActiva(user) {
    const [b, setB] = useState(() => bodegaActiva(user));
    useEffect(() => {
        const fn = () => setB(bodegaActiva(user));
        fn(); // por si el usuario cambió
        window.addEventListener('bodegaFiltroChange', fn);
        window.addEventListener('storage', fn);
        return () => { window.removeEventListener('bodegaFiltroChange', fn); window.removeEventListener('storage', fn); };
    }, [user?.rol, user?.bodega_id]);
    return b;
}
