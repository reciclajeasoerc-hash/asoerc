import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Setup from './pages/Setup';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Compras from './pages/Compras';
import Ventas from './pages/Ventas';
import Recicladores from './pages/Recicladores';
import Empleados from './pages/Empleados';
import Caja from './pages/Caja';
import Remisiones from './pages/Remisiones';
import Empaques from './pages/Empaques';
import Materiales from './pages/Materiales';
import Informes from './pages/Informes';
import Usuarios from './pages/Usuarios';
import Bodegas from './pages/Bodegas';
import BodegaDetalle from './pages/BodegaDetalle';
import Vehiculos from './pages/Vehiculos';
import Prestamos from './pages/Prestamos';

export const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

// Permisos por rol
// superadmin (Bodega Principal): acceso total + coordinación global
// admin (bodegas secundarias como El Diamante): solo operaciones diarias
export const PERMISOS = {
    superadmin: ['dashboard','compras','ventas','recicladores','empleados','caja','remisiones','empaques','materiales','informes','usuarios','bodegas','vehiculos','prestamos'],
    admin:      ['dashboard','compras','ventas','recicladores','empleados','caja','remisiones','empaques','vehiculos','prestamos'],
    cajero:     ['dashboard','caja','vehiculos','prestamos'],
    vendedor:   ['dashboard','ventas','remisiones'],
    operador:   ['dashboard','compras','recicladores','empaques'],
};

export function puedePasar(rol, modulo) {
    return PERMISOS[rol]?.includes(modulo) ?? false;
}

function Guard({ modulo, children }) {
    const { user } = useAuth();
    return puedePasar(user?.rol, modulo) ? children : <Navigate to="/" replace />;
}

function PantallaLicenciaVencida({ pagoUrl }) {
    return (
        <div style={{ minHeight:'100vh', background:'#0f0f0f', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            <div style={{ background:'#1a1a1a', borderRadius:16, padding:40, maxWidth:420, width:'100%', textAlign:'center', border:'1px solid #3d0000' }}>
                <div style={{ fontSize:56, marginBottom:16 }}>🔒</div>
                <h2 style={{ color:'#e74c3c', fontSize:20, marginBottom:8 }}>Licencia Vencida</h2>
                <p style={{ color:'#888', fontSize:14, lineHeight:1.6, marginBottom:24 }}>
                    El acceso al sistema ASOERC está bloqueado porque la licencia ha vencido o no está activa.
                    Renueve su suscripción para continuar usando el sistema.
                </p>
                {pagoUrl && (
                    <a href={pagoUrl} target="_blank" rel="noopener noreferrer"
                        style={{ display:'block', padding:'14px', background:'#009ee3', color:'#fff', borderRadius:10, textDecoration:'none', fontWeight:700, fontSize:15, marginBottom:12 }}>
                        💳 Renovar ahora
                    </a>
                )}
                <p style={{ color:'#444', fontSize:12 }}>¿Problemas? Contacte a AI Company CO — +57 321 267 4754</p>
            </div>
        </div>
    );
}

function App() {
    const [user, setUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
    });
    const [licencia, setLicencia]   = useState({ valida: true, pagoUrl: '', cargando: true });
    const [configurado, setConfigurado] = useState(null); // null = verificando

    useEffect(() => {
        fetch('/api/licencia/estado')
            .then(r => r.json())
            .then(d => setLicencia({ valida: d.valida !== false, pagoUrl: d.pagoUrl || '', cargando: false }))
            .catch(() => setLicencia({ valida: true, pagoUrl: '', cargando: false }));

        fetch('/api/setup/estado')
            .then(r => r.json())
            .then(d => setConfigurado(d.configurado))
            .catch(() => setConfigurado(true)); // si falla, asumir configurado
    }, []);

    const login  = (u, token) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(u)); setUser(u); };
    const logout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); };

    if (licencia.cargando || configurado === null) return (
        <div style={{ minHeight:'100vh', background:'#f0fdf4', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <p style={{ color:'#555' }}>Iniciando sistema...</p>
        </div>
    );

    if (!licencia.valida) return <PantallaLicenciaVencida pagoUrl={licencia.pagoUrl} />;

    if (!configurado) return <Setup onListo={() => setConfigurado(true)} />;

    return (
        <AuthCtx.Provider value={{ user, login, logout }}>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
                    <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
                        <Route index element={<Dashboard />} />
                        <Route path="compras"      element={<Guard modulo="compras"><Compras /></Guard>} />
                        <Route path="ventas"       element={<Guard modulo="ventas"><Ventas /></Guard>} />
                        <Route path="recicladores" element={<Guard modulo="recicladores"><Recicladores /></Guard>} />
                        <Route path="empleados"    element={<Guard modulo="empleados"><Empleados /></Guard>} />
                        <Route path="caja"         element={<Guard modulo="caja"><Caja /></Guard>} />
                        <Route path="remisiones"   element={<Guard modulo="remisiones"><Remisiones /></Guard>} />
                        <Route path="empaques"     element={<Guard modulo="empaques"><Empaques /></Guard>} />
                        <Route path="materiales"   element={<Guard modulo="materiales"><Materiales /></Guard>} />
                        <Route path="informes"     element={<Guard modulo="informes"><Informes /></Guard>} />
                        <Route path="usuarios"     element={<Guard modulo="usuarios"><Usuarios /></Guard>} />
                        <Route path="bodegas"      element={<Guard modulo="bodegas"><Bodegas /></Guard>} />
                        <Route path="bodegas/:id"  element={<Guard modulo="bodegas"><BodegaDetalle /></Guard>} />
                        <Route path="vehiculos"    element={<Guard modulo="vehiculos"><Vehiculos /></Guard>} />
                        <Route path="prestamos"    element={<Guard modulo="prestamos"><Prestamos /></Guard>} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthCtx.Provider>
    );
}

export default App;
