import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';

const nav = [
    { to: '/',            icon: '📊', label: 'Dashboard' },
    { to: '/compras',     icon: '⚖️',  label: 'Compras' },
    { to: '/ventas',      icon: '📤', label: 'Ventas' },
    { to: '/recicladores',icon: '♻️',  label: 'Recicladores' },
    { to: '/empleados',   icon: '👷', label: 'Empleados' },
    { to: '/caja',        icon: '💰', label: 'Caja' },
    { to: '/remisiones',  icon: '🚛', label: 'Remisiones' },
    { to: '/empaques',    icon: '🛍️',  label: 'Empaques' },
    { to: '/materiales',  icon: '📋', label: 'Materiales' },
    { to: '/informes',    icon: '📈', label: 'Informes' },
];

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);

    const handleLogout = () => { logout(); navigate('/login'); };

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            {/* Sidebar */}
            <aside style={{ width: 220, background: '#1a5c2a', color: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <div style={{ padding: '20px 16px', borderBottom: '1px solid #2d7a3f' }}>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>♻️ ASOERC</div>
                    <div style={{ fontSize: 11, color: '#8fcca0', marginTop: 2 }}>Sistema de Gestión</div>
                </div>
                <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                    {nav.map(({ to, icon, label }) => (
                        <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                            color: isActive ? '#fff' : '#a8d5b5', textDecoration: 'none', fontSize: 14,
                            background: isActive ? '#2d7a3f' : 'transparent', borderLeft: isActive ? '3px solid #6fcf8a' : '3px solid transparent',
                            transition: 'all .15s'
                        })}>
                            <span style={{ fontSize: 18 }}>{icon}</span> {label}
                        </NavLink>
                    ))}
                </nav>
                <div style={{ padding: '12px 16px', borderTop: '1px solid #2d7a3f', fontSize: 13 }}>
                    <div style={{ color: '#8fcca0', marginBottom: 4 }}>{user?.nombre}</div>
                    <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #4a9e5c', color: '#a8d5b5', padding: '5px 12px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>
                        Cerrar sesión
                    </button>
                </div>
            </aside>
            {/* Main */}
            <main style={{ flex: 1, overflow: 'auto', position: 'relative', minHeight: 0 }}>
                <Outlet />
            </main>
        </div>
    );
}
