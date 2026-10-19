const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer '))
        return res.status(401).json({ ok: false, msg: 'Token requerido' });

    const token = authHeader.split(' ')[1];
    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        const msg = err.name === 'TokenExpiredError'
            ? 'Sesión expirada, inicia sesión nuevamente'
            : 'Token inválido';
        return res.status(401).json({ ok: false, msg });
    }

    // El token dice QUIÉN es; el rol, la bodega y si sigue activo se leen de la BD ahora.
    // Antes salían del token: un cambio de rol o de bodega (o desactivar la cuenta) no surtía
    // efecto hasta que el token vencía (12 h), así que la persona seguía con el permiso viejo.
    usuarioActual(payload.id).then(u => {
        if (!u || !u.activo) return res.status(401).json({ ok: false, msg: 'Sesión expirada, inicia sesión nuevamente' });
        req.user = { ...payload, rol: u.rol, bodega_id: u.bodega_id, nombre: u.nombre };
        next();
    }).catch(() => res.status(500).json({ ok: false, msg: 'Error verificando la sesión' }));
};

// Caché corta (10 s): la app hace muchas peticiones seguidas y no hace falta ir a la BD en cada una.
const cache = new Map();
async function usuarioActual(id) {
    const c = cache.get(id);
    if (c && c.hasta > Date.now()) return c.u;
    const { Usuario } = require('../models');
    const u = await Usuario.findByPk(id, { attributes: ['id', 'rol', 'bodega_id', 'activo', 'nombre'], raw: true });
    cache.set(id, { u, hasta: Date.now() + 10000 });
    return u;
}
// Para que un cambio hecho en Usuarios aplique al instante, sin esperar los 10 s.
module.exports.olvidarUsuario = id => cache.delete(Number(id));
