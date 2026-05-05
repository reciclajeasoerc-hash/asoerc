import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
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

export const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

function App() {
    const [user, setUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
    });

    const login  = (u, token) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(u)); setUser(u); };
    const logout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); };

    return (
        <AuthCtx.Provider value={{ user, login, logout }}>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
                    <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
                        <Route index element={<Dashboard />} />
                        <Route path="compras"     element={<Compras />} />
                        <Route path="ventas"      element={<Ventas />} />
                        <Route path="recicladores" element={<Recicladores />} />
                        <Route path="empleados"   element={<Empleados />} />
                        <Route path="caja"        element={<Caja />} />
                        <Route path="remisiones"  element={<Remisiones />} />
                        <Route path="empaques"    element={<Empaques />} />
                        <Route path="materiales"  element={<Materiales />} />
                        <Route path="informes"    element={<Informes />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthCtx.Provider>
    );
}

export default App;
