import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, puedePasar } from '../App';
import { api } from '../api';
import InstalarApp from './InstalarApp';
import Icono from './Icono';
import AvisoLicencia from '../pages/AvisoLicencia.jsx';

// grupo: separa el menú en bloques (Operación / Personas y activos / Administración)
const TODOS_NAV = [
    { to: '/',             icono: 'dashboard',     label: 'Inicio',        modulo: 'dashboard',     grupo: 'Operación' },
    { to: '/compras',      icono: 'compras',       label: 'Compras',       modulo: 'compras',       grupo: 'Operación' },
    { to: '/ventas',       icono: 'ventas',        label: 'Ventas',        modulo: 'ventas',        grupo: 'Operación' },
    { to: '/caja',         icono: 'caja',          label: 'Caja',          modulo: 'caja',          grupo: 'Operación' },
    { to: '/remisiones',   icono: 'remisiones',    label: 'Remisiones',    modulo: 'remisiones',    grupo: 'Operación' },
    { to: '/empaques',     icono: 'empaques',      label: 'Empaques',      modulo: 'empaques',      grupo: 'Operación' },
    { to: '/recicladores', icono: 'recicladores',  label: 'Recicladores',  modulo: 'recicladores',  grupo: 'Personas y activos' },
    { to: '/clientes',     icono: 'clientes',      label: 'Clientes',      modulo: 'clientes',      grupo: 'Personas y activos' },
    { to: '/empleados',    icono: 'empleados',     label: 'Empleados',     modulo: 'empleados',     grupo: 'Personas y activos' },
    { to: '/prestamos',    icono: 'prestamos',     label: 'Préstamos',     modulo: 'prestamos',     grupo: 'Personas y activos' },
    { to: '/vehiculos',    icono: 'vehiculos',     label: 'Vehículos',     modulo: 'vehiculos',     grupo: 'Personas y activos' },
    { to: '/materiales',   icono: 'materiales',    label: 'Materiales',    modulo: 'materiales',    grupo: 'Administración' },
    { to: '/informes',     icono: 'informes',      label: 'Informes',      modulo: 'informes',      grupo: 'Administración' },
    { to: '/usuarios',     icono: 'usuarios',      label: 'Usuarios',      modulo: 'usuarios',      grupo: 'Administración' },
    { to: '/bodegas',      icono: 'bodegas',       label: 'Bodegas',       modulo: 'bodegas',       grupo: 'Administración' },
    { to: '/configuracion',icono: 'configuracion', label: 'Configuración', modulo: 'configuracion', grupo: 'Administración' },
    { to: '/manual',       icono: 'manual',        label: 'Manual',        modulo: null, externo: '/manual.html', grupo: 'Administración' },
];

// Pestañas de la barra inferior en el celular, por rol (máx 4 + "Más")
const BOTTOM_TABS = {
    superadmin: ['/', '/compras', '/ventas', '/caja'],
    admin:      ['/', '/compras', '/ventas', '/caja'],
    cajero:     ['/caja', '/', '/vehiculos', '/prestamos'],
    vendedor:   ['/ventas', '/', '/remisiones'],
    operador:   ['/compras', '/', '/recicladores', '/empaques'],
};

const ROLE_LABELS = {
    superadmin: { label: 'Super Admin', fondo: 'var(--ambar)', texto: '#1f1600' },
    admin:      { label: 'Admin',       fondo: '#3b82f6', texto: '#fff' },
    cajero:     { label: 'Cajero',      fondo: '#10b981', texto: '#fff' },
    vendedor:   { label: 'Vendedor',    fondo: '#8b5cf6', texto: '#fff' },
    operador:   { label: 'Operador',    fondo: '#64748b', texto: '#fff' },
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

const iniciales = n => (n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const esActiva = (to, path) => to === '/' ? path === '/' : path.startsWith(to);

// ── Piezas compartidas ────────────────────────────────────────────────────────
function Marca({ config, subtitulo, compacta }) {
    const tam = compacta ? 36 : 46;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: compacta ? 10 : 12, minWidth: 0 }}>
            {config.logo_url
                ? <img src={config.logo_url} alt="Logo" style={{ width: tam, height: tam, objectFit: 'contain', borderRadius: '50%', background: '#fff', flexShrink: 0 }} />
                : <div style={{ width: tam, height: tam, borderRadius: '50%', background: 'var(--verde)', border: '2px solid #fff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fuente-tit)', fontWeight: 800, fontSize: compacta ? 13 : 16, flexShrink: 0 }}>ASO</div>}
            <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--fuente-tit)', fontWeight: 800, fontSize: compacta ? 19 : 23, color: '#fff', lineHeight: 1, letterSpacing: .4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {(config.nombre || 'ASOERC').toUpperCase()}
                </div>
                <div style={{ fontFamily: 'var(--fuente-tit)', fontWeight: 600, fontSize: compacta ? 11 : 12, color: 'var(--noche-tenue)', marginTop: 3, letterSpacing: .8, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {subtitulo}
                </div>
            </div>
        </div>
    );
}

function SelectorBodega({ bodegas, valor, onChange }) {
    return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--noche-2)', border: '1.5px solid var(--noche-3)', borderRadius: 10, padding: '0 12px', height: 46, cursor: 'pointer' }}>
            <Icono nombre="bodegas" tam={19} style={{ color: 'var(--verde-vivo)' }} />
            <select value={valor} onChange={e => onChange(e.target.value)} aria-label="Bodega"
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: '#fff', fontFamily: 'var(--fuente-tit)', fontWeight: 700, fontSize: 16, letterSpacing: .3, cursor: 'pointer', boxShadow: 'none', outline: 'none', padding: '10px 0' }}>
                <option value="" style={{ color: '#000' }}>Todas las bodegas</option>
                {bodegas.map(b => <option key={b.id} value={b.id} style={{ color: '#000' }}>{b.nombre}</option>)}
            </select>
        </label>
    );
}

function ItemMenu({ item, activo, alto = 46 }) {
    const base = {
        display: 'flex', alignItems: 'center', gap: 14, height: alto, padding: '0 14px', margin: '2px 0',
        borderRadius: 10, textDecoration: 'none', fontFamily: 'var(--fuente-tit)', fontSize: 18, letterSpacing: .3,
        transition: 'background-color .15s, color .15s',
    };
    const estilo = activo
        ? { ...base, background: 'var(--verde)', color: '#fff', fontWeight: 800, textTransform: 'uppercase', border: '2px solid #fff', boxShadow: '0 4px 14px rgba(22,163,74,.35)' }
        : { ...base, color: 'var(--noche-texto)', fontWeight: 600, border: '2px solid transparent' };
    const contenido = (
        <>
            <Icono nombre={item.icono} tam={21} />
            <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>
            {activo && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
        </>
    );
    if (item.externo) return <a href={item.externo} target="_blank" rel="noopener noreferrer" className="item-menu" style={estilo}>{contenido}</a>;
    return <NavLink to={item.to} end={item.to === '/'} className="item-menu" style={estilo}>{contenido}</NavLink>;
}

function MenuAgrupado({ nav, path, alto }) {
    const grupos = [];
    nav.forEach(n => {
        const g = grupos.find(x => x.nombre === n.grupo);
        if (g) g.items.push(n); else grupos.push({ nombre: n.grupo, items: [n] });
    });
    return grupos.map(g => (
        <div key={g.nombre} style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: 'var(--fuente-tit)', fontWeight: 700, fontSize: 12, color: 'var(--noche-tenue)', letterSpacing: 1.4, textTransform: 'uppercase', padding: '10px 14px 4px' }}>{g.nombre}</div>
            {g.items.map(item => <ItemMenu key={item.to} item={item} activo={!item.externo && esActiva(item.to, path)} alto={alto} />)}
        </div>
    ));
}

function PieUsuario({ user, roleInfo, onSalir }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderTop: '1px solid var(--noche-3)' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--noche-2)', border: '1.5px solid var(--noche-3)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fuente-tit)', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                {iniciales(user?.nombre)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.nombre}</div>
                <span className="chip" style={{ background: roleInfo.fondo, color: roleInfo.texto, marginTop: 3, padding: '2px 8px', fontSize: 11.5, borderRadius: 5 }}>{roleInfo.label}</span>
            </div>
            <button onClick={onSalir} title="Cerrar sesión"
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(220,38,38,.12)', border: '1.5px solid #b91c1c', color: '#fecaca', borderRadius: 9, padding: '8px 11px', fontFamily: 'var(--fuente-tit)', fontWeight: 700, fontSize: 13.5, letterSpacing: .5 }}>
                <Icono nombre="salir" tam={17} /> SALIR
            </button>
        </div>
    );
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

    const esSuper = user?.rol === 'superadmin';
    const nav = TODOS_NAV.filter(n => n.modulo === null || puedePasar(user?.rol, n.modulo));
    const handleLogout = () => { logout(); navigate('/login'); };
    const roleInfo = ROLE_LABELS[user?.rol] || { label: user?.rol, fondo: '#64748b', texto: '#fff' };
    const subtitulo = bodegaActual?.nombre || (esSuper ? 'Centro de acopio' : 'Sistema');

    const bottomTabs = (BOTTOM_TABS[user?.rol] || ['/']).map(path =>
        TODOS_NAV.find(n => n.to === path)
    ).filter(Boolean).filter(n => puedePasar(user?.rol, n.modulo));
    const extraNav = nav.filter(n => !bottomTabs.find(t => t.to === n.to));

    // ── CELULAR ────────────────────────────────────────────────────────────────
    if (isMobile) return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--fondo)' }}>
            <header style={{ background: 'var(--noche)', color: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', boxShadow: '0 2px 10px rgba(15,27,45,.3)' }}>
                <Marca config={config} subtitulo={subtitulo} compacta />
                <button onClick={() => setMenuAbierto(true)} aria-label="Abrir menú"
                    style={{ background: 'var(--noche-2)', border: '1.5px solid var(--noche-3)', color: '#fff', width: 42, height: 42, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icono nombre="menu" tam={22} />
                </button>
            </header>

            <main style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                <AvisoLicencia sistema="Sistema ASOERC" />
                <Outlet />
            </main>

            {/* Barra inferior */}
            <nav className="barra-inferior" style={{ background: '#fff', flexShrink: 0, display: 'flex', borderTop: '1.5px solid var(--borde)', boxShadow: '0 -4px 16px rgba(15,27,45,.08)' }}>
                {bottomTabs.map(({ to, icono, label }) => {
                    const activo = esActiva(to, location.pathname);
                    return (
                        <NavLink key={to} to={to} end={to === '/'}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '8px 2px 9px', minHeight: 60, textDecoration: 'none', color: activo ? 'var(--verde-osc)' : '#7b8799', position: 'relative' }}>
                            {activo && <span style={{ position: 'absolute', top: 0, left: '22%', right: '22%', height: 3, borderRadius: '0 0 3px 3px', background: 'var(--verde)' }} />}
                            <span style={{ width: 44, height: 30, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', background: activo ? 'var(--verde-suave)' : 'transparent' }}>
                                <Icono nombre={icono} tam={22} grosor={activo ? 2.2 : 1.9} />
                            </span>
                            <span style={{ fontFamily: 'var(--fuente-tit)', fontSize: 13, fontWeight: activo ? 800 : 600, letterSpacing: .3 }}>{label}</span>
                        </NavLink>
                    );
                })}
                {extraNav.length > 0 && (
                    <button onClick={() => setMenuAbierto(true)}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '8px 2px 9px', minHeight: 60, background: 'none', border: 'none', color: '#7b8799' }}>
                        <span style={{ width: 44, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icono nombre="mas" tam={22} /></span>
                        <span style={{ fontFamily: 'var(--fuente-tit)', fontSize: 13, fontWeight: 600, letterSpacing: .3 }}>Más</span>
                    </button>
                )}
            </nav>

            {/* Menú completo deslizable */}
            {menuAbierto && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex' }}>
                    <div onClick={() => setMenuAbierto(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(8,14,24,.6)' }} />
                    <div style={{ position: 'relative', zIndex: 1, width: 'min(86vw, 320px)', height: '100%', background: 'var(--noche)', color: '#fff', display: 'flex', flexDirection: 'column', boxShadow: 'var(--sombra-alta)' }}>
                        <div style={{ padding: '16px 14px 14px', borderBottom: '1px solid var(--noche-3)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <Marca config={config} subtitulo={subtitulo} compacta />
                                <button onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú"
                                    style={{ background: 'none', border: 'none', color: 'var(--noche-texto)', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Icono nombre="cerrar" tam={22} />
                                </button>
                            </div>
                            {esSuper && bodegas.length > 0 && <SelectorBodega bodegas={bodegas} valor={bodegaFiltro} onChange={setBodegaFiltro} />}
                        </div>
                        <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}>
                            <MenuAgrupado nav={nav} path={location.pathname} alto={48} />
                        </nav>
                        <div style={{ padding: '0 14px 10px' }}><InstalarApp /></div>
                        <PieUsuario user={user} roleInfo={roleInfo} onSalir={handleLogout} />
                    </div>
                </div>
            )}
        </div>
    );

    // ── ESCRITORIO ─────────────────────────────────────────────────────────────
    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <aside style={{ width: 268, background: 'var(--noche)', color: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <div style={{ padding: '18px 16px 16px', display: 'flex', flexDirection: 'column', gap: 16, borderBottom: '1px solid var(--noche-3)' }}>
                    <Marca config={config} subtitulo={subtitulo} />
                    {esSuper && bodegas.length > 0 && <SelectorBodega bodegas={bodegas} valor={bodegaFiltro} onChange={setBodegaFiltro} />}
                </div>
                <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 12px' }}>
                    <MenuAgrupado nav={nav} path={location.pathname} />
                </nav>
                <div style={{ padding: '0 16px 8px' }}><InstalarApp /></div>
                <PieUsuario user={user} roleInfo={roleInfo} onSalir={handleLogout} />
            </aside>
            <main style={{ flex: 1, overflow: 'auto', position: 'relative', minHeight: 0 }}>
                <AvisoLicencia sistema="Sistema ASOERC" />
                <Outlet />
            </main>
        </div>
    );
}
