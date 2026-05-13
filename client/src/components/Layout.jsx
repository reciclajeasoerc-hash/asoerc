import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, puedePasar } from '../App';
import { api } from '../api';
import InstalarApp from './InstalarApp';

const TODOS_NAV = [
    { to: '/',             icon: '📊', label: 'Dashboard',    modulo: 'dashboard'     },
    { to: '/compras',      icon: '⚖️',  label: 'Compras',      modulo: 'compras'       },
    { to: '/ventas',       icon: '📤', label: 'Ventas',       modulo: 'ventas'        },
    { to: '/caja',         icon: '💰', label: 'Caja',         modulo: 'caja'          },
    { to: '/recicladores', icon: '♻️',  label: 'Recicladores', modulo: 'recicladores'  },
    { to: '/empleados',    icon: '👷', label: 'Empleados',    modulo: 'empleados'     },
    { to: '/remisiones',   icon: '🚛', label: 'Remisiones',   modulo: 'remisiones'    },
    { to: '/vehiculos',    icon: '🚚', label: 'Vehículos',    modulo: 'vehiculos'     },
    { to: '/prestamos',    icon: '💳', label: 'Préstamos',    modulo: 'prestamos'     },
    { to: '/empaques',     icon: '🛍️',  label: 'Empaques',     modulo: 'empaques'      },
    { to: '/materiales',   icon: '📋', label: 'Materiales',   modulo: 'materiales'    },
    { to: '/informes',     icon: '📈', label: 'Informes',     modulo: 'informes'      },
    { to: '/usuarios',     icon: '👥', label: 'Usuarios',     modulo: 'usuarios'      },
    { to: '/bodegas',      icon: '🏭', label: 'Bodegas',      modulo: 'bodegas'       },
    { to: '/configuracion',icon: '⚙️',  label: 'Configuración', modulo: 'configuracion' },
    { to: '/manual',       icon: '📖', label: 'Manual',        modulo: null, externo: '/manual.html' },
];

// Tabs principales del bottom nav por rol (máx 4)
const BOTTOM_TABS = {
    superadmin: ['/', '/compras', '/ventas', '/caja'],
    admin:      ['/', '/compras', '/ventas', '/caja'],
    cajero:     ['/caja', '/', '/vehiculos', '/prestamos'],
    vendedor:   ['/ventas', '/', '/remisiones'],
    operador:   ['/compras', '/', '/recicladores', '/empaques'],
};

const ROLE_LABELS = {
    superadmin: { label: 'Super Admin', color: '#f59e0b' },
    admin:      { label: 'Admin',       color: '#3b82f6' },
    cajero:     { label: 'Cajero',      color: '#10b981' },
    vendedor:   { label: 'Vendedor',    color: '#8b5cf6' },
    operador:   { label: 'Operador',    color: '#6b7280' },
};

function useMobile() {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 900);
    useEffect(() => {
        const fn = () => setIsMobile(window.innerWidth < 900);
        window.addEventListener('resize', fn);
        return () => window.removeEventListener('resize', fn);
    }, []);
    return isMobile;
}

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const isMobile = useMobile();
    const [menuAbierto, setMenuAbierto] = useState(false);
    const [bodegas, setBodegas] = useState([]);
    const [bodegaActual, setBodegaActual] = useState(null);
    const [bodegaFiltro, setBodegaFiltro] = useState('');
    const [config, setConfig] = useState({ nombre: '', logo_url: null });

    useEffect(() => {
        fetch('/api/configuracion').then(r => r.json()).then(d => {
            if (d.ok) setConfig({ nombre: d.nombre, logo_url: d.logo_url });
        }).catch(() => {});
    }, []);

    useEffect(() => {
        api.get('/bodegas').then(d => {
            setBodegas(d.bodegas || []);
            if (user?.bodega_id) {
                const b = (d.bodegas || []).find(x => x.id === user.bodega_id);
                setBodegaActual(b);
            }
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (bodegaFiltro) localStorage.setItem('bodegaFiltro', bodegaFiltro);
        else localStorage.removeItem('bodegaFiltro');
        window.dispatchEvent(new Event('bodegaFiltroChange'));
    }, [bodegaFiltro]);

    useEffect(() => { setMenuAbierto(false); }, [location.pathname]);

    const nav = TODOS_NAV.filter(n => n.modulo === null || puedePasar(user?.rol, n.modulo));
    const handleLogout = () => { logout(); navigate('/login'); };
    const roleInfo = ROLE_LABELS[user?.rol] || { label: user?.rol, color: '#6b7280' };

    const bottomTabs = (BOTTOM_TABS[user?.rol] || ['/']).map(path =>
        TODOS_NAV.find(n => n.to === path)
    ).filter(Boolean).filter(n => puedePasar(user?.rol, n.modulo));

    const extraNav = nav.filter(n => !bottomTabs.find(t => t.to === n.to));

    // ── MÓVIL ──────────────────────────────────────────────────────────────────
    if (isMobile) return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#f0faf0' }}>

            {/* Header fijo arriba */}
            <header style={{
                background: '#1a5c2a', color: '#fff', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px',
                boxShadow: '0 2px 8px rgba(0,0,0,.25)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {config.logo_url
                        ? <img src={config.logo_url} alt="Logo" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4 }} />
                        : <span style={{ fontSize: 22 }}>♻️</span>
                    }
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1 }}>{config.nombre || 'ASOERC'}</div>
                        <div style={{ fontSize: 10, color: '#8fcca0', marginTop: 1 }}>
                            {bodegaActual?.nombre || (user?.rol === 'superadmin' ? 'Bodega Principal' : 'Sistema')}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.nombre?.split(' ')[0]}</div>
                        <span style={{ fontSize: 9, background: roleInfo.color, color: '#fff', padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>
                            {roleInfo.label}
                        </span>
                    </div>
                    <button onClick={() => setMenuAbierto(true)}
                        style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 38, height: 38, borderRadius: 10, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ☰
                    </button>
                </div>
            </header>

            {/* Contenido principal */}
            <main style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                <Outlet />
            </main>

            {/* Bottom tab bar */}
            <nav style={{
                background: '#fff', flexShrink: 0,
                display: 'flex', borderTop: '1px solid #e5e7eb',
                boxShadow: '0 -2px 12px rgba(0,0,0,.08)'
            }}>
                {bottomTabs.map(({ to, icon, label }) => {
                    const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
                    return (
                        <NavLink key={to} to={to} end={to === '/'}
                            style={{
                                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                                justifyContent: 'center', padding: '8px 4px 10px',
                                textDecoration: 'none', color: isActive ? '#1a5c2a' : '#9ca3af',
                                borderTop: isActive ? '2px solid #1a5c2a' : '2px solid transparent',
                                background: isActive ? '#f0faf0' : 'transparent',
                                transition: 'all .15s'
                            }}>
                            <span style={{ fontSize: 22 }}>{icon}</span>
                            <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 400, marginTop: 2 }}>{label}</span>
                        </NavLink>
                    );
                })}
                {/* Botón "Más" si hay secciones extra */}
                {extraNav.length > 0 && (
                    <button onClick={() => setMenuAbierto(true)}
                        style={{
                            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', padding: '8px 4px 10px', background: 'none', border: 'none',
                            color: '#9ca3af', cursor: 'pointer', borderTop: '2px solid transparent'
                        }}>
                        <span style={{ fontSize: 22 }}>⋯</span>
                        <span style={{ fontSize: 10, marginTop: 2 }}>Más</span>
                    </button>
                )}
            </nav>

            {/* Drawer lateral (menú completo) */}
            {menuAbierto && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex' }}>
                    {/* Overlay */}
                    <div onClick={() => setMenuAbierto(false)}
                        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)' }} />
                    {/* Panel */}
                    <div style={{
                        position: 'relative', zIndex: 1, width: 280, height: '100%',
                        background: '#1a5c2a', color: '#fff', display: 'flex', flexDirection: 'column',
                        overflowY: 'auto'
                    }}>
                        {/* Perfil */}
                        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid #2d7a3f' }}>
                            <div style={{ width: 48, height: 48, background: '#2d7a3f', borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 10 }}>
                                {user?.nombre?.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.nombre}</div>
                            <span style={{ fontSize: 11, background: roleInfo.color, color: '#fff', padding: '2px 10px', borderRadius: 10, fontWeight: 600 }}>
                                {roleInfo.label}
                            </span>
                            {bodegaActual && <div style={{ fontSize: 11, color: '#8fcca0', marginTop: 6 }}>📍 {bodegaActual.nombre}</div>}

                            {user?.rol === 'superadmin' && bodegas.length > 0 && (
                                <select value={bodegaFiltro} onChange={e => setBodegaFiltro(e.target.value)}
                                    style={{ marginTop: 10, width: '100%', padding: '6px 8px', borderRadius: 6, border: 'none', fontSize: 12, background: '#2d7a3f', color: '#fff' }}>
                                    <option value="">Todas las bodegas</option>
                                    {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                                </select>
                            )}
                        </div>

                        {/* Todas las secciones */}
                        <div style={{ flex: 1, padding: '8px 0' }}>
                            {nav.map(({ to, icon, label, externo }) => {
                                if (externo) return (
                                    <a key={to} href={externo} target="_blank" rel="noopener noreferrer"
                                        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', textDecoration: 'none', color: '#a8d5b5', fontSize: 15, borderLeft: '3px solid transparent' }}>
                                        <span style={{ fontSize: 20 }}>{icon}</span>
                                        <span>{label}</span>
                                    </a>
                                );
                                const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
                                return (
                                    <NavLink key={to} to={to} end={to === '/'}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 14,
                                            padding: '13px 20px', textDecoration: 'none',
                                            color: isActive ? '#fff' : '#a8d5b5', fontSize: 15,
                                            background: isActive ? '#2d7a3f' : 'transparent',
                                            borderLeft: isActive ? '3px solid #6fcf8a' : '3px solid transparent',
                                        }}>
                                        <span style={{ fontSize: 20 }}>{icon}</span>
                                        <span style={{ fontWeight: isActive ? 700 : 400 }}>{label}</span>
                                    </NavLink>
                                );
                            })}
                        </div>

                        {/* Acciones */}
                        <div style={{ padding: '16px 20px', borderTop: '1px solid #2d7a3f', display: 'flex', gap: 8 }}>
                            <InstalarApp />
                            <button onClick={handleLogout}
                                style={{ flex: 1, background: 'none', border: '1px solid #4a9e5c', color: '#a8d5b5', padding: '10px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                                Cerrar sesión
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // ── ESCRITORIO ─────────────────────────────────────────────────────────────
    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <aside style={{ width: 220, background: '#1a5c2a', color: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <div style={{ padding: '16px', borderBottom: '1px solid #2d7a3f' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 20, fontWeight: 700 }}>
                        {config.logo_url
                            ? <img src={config.logo_url} alt="Logo" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4 }} />
                            : '♻️'
                        }
                        {config.nombre || 'ASOERC'}
                    </div>
                    <div style={{ fontSize: 11, color: '#8fcca0', marginTop: 2 }}>
                        {bodegaActual?.nombre || (user?.rol === 'superadmin' ? 'Bodega Principal' : 'Sistema')}
                    </div>
                    {user?.rol === 'superadmin' && bodegas.length > 0 && (
                        <select value={bodegaFiltro} onChange={e => setBodegaFiltro(e.target.value)}
                            style={{ marginTop: 8, width: '100%', padding: '4px 6px', borderRadius: 4, border: 'none', fontSize: 12, background: '#2d7a3f', color: '#fff' }}>
                            <option value="">Todas las bodegas</option>
                            {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                        </select>
                    )}
                </div>
                <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                    {nav.map(({ to, icon, label, externo }) => externo ? (
                        <a key={to} href={externo} target="_blank" rel="noopener noreferrer" style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                            color: '#a8d5b5', textDecoration: 'none', fontSize: 14,
                            background: 'transparent', borderLeft: '3px solid transparent', transition: 'all .15s'
                        }}>
                            <span style={{ fontSize: 18 }}>{icon}</span> {label}
                        </a>
                    ) : (
                        <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                            color: isActive ? '#fff' : '#a8d5b5', textDecoration: 'none', fontSize: 14,
                            background: isActive ? '#2d7a3f' : 'transparent',
                            borderLeft: isActive ? '3px solid #6fcf8a' : '3px solid transparent',
                            transition: 'all .15s'
                        })}>
                            <span style={{ fontSize: 18 }}>{icon}</span> {label}
                        </NavLink>
                    ))}
                </nav>
                <div style={{ padding: '12px 16px', borderTop: '1px solid #2d7a3f', fontSize: 13 }}>
                    <div style={{ color: '#fff', fontWeight: 600, marginBottom: 2 }}>{user?.nombre}</div>
                    <div style={{ marginBottom: 8 }}>
                        <span style={{ background: roleInfo.color, color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                            {roleInfo.label}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <InstalarApp />
                        <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #4a9e5c', color: '#a8d5b5', padding: '5px 12px', borderRadius: 4, fontSize: 12, cursor: 'pointer', flex: 1 }}>
                            Salir
                        </button>
                    </div>
                </div>
            </aside>
            <main style={{ flex: 1, overflow: 'auto', position: 'relative', minHeight: 0 }}>
                <Outlet />
            </main>
        </div>
    );
}
