const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { Usuario } = require('../models');

const intentosFallidos = new Map();
const MAX_INTENTOS = 5, BLOQUEO_MS = 15 * 60 * 1000;

function estasBloqueado(email) {
    const info = intentosFallidos.get(email);
    if (!info?.lockUntil) return false;
    if (Date.now() < info.lockUntil) return true;
    intentosFallidos.delete(email); return false;
}
function registrarFallo(email) {
    const info = intentosFallidos.get(email) || { count: 0, lockUntil: null };
    info.count += 1;
    if (info.count >= MAX_INTENTOS) { info.lockUntil = Date.now() + BLOQUEO_MS; info.count = 0; }
    intentosFallidos.set(email, info);
}
function minutosRestantes(email) {
    const info = intentosFallidos.get(email);
    return info?.lockUntil ? Math.ceil((info.lockUntil - Date.now()) / 60000) : 0;
}

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ ok: false, msg: 'Email y contraseña requeridos' });
        const emailLimpio = String(email).toLowerCase().trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio))
            return res.status(400).json({ ok: false, msg: 'Email inválido' });
        if (estasBloqueado(emailLimpio)) {
            const mins = minutosRestantes(emailLimpio);
            return res.status(429).json({ ok: false, msg: `Cuenta bloqueada. Espera ${mins} minuto${mins !== 1 ? 's' : ''}.` });
        }
        const user = await Usuario.findOne({ where: { email: emailLimpio, activo: true } });
        if (!user) { registrarFallo(emailLimpio); return res.status(401).json({ ok: false, msg: 'Credenciales incorrectas' }); }
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) { registrarFallo(emailLimpio); return res.status(401).json({ ok: false, msg: 'Credenciales incorrectas' }); }
        intentosFallidos.delete(emailLimpio);
        const token = jwt.sign(
            { id: user.id, nombre: user.nombre, rol: user.rol, bodega_id: user.bodega_id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
        );
        res.json({ ok: true, token, user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, bodega_id: user.bodega_id } });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ ok: false, msg: 'Error interno del servidor' });
    }
};
