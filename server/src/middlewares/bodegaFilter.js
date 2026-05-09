// Inyecta bodega_id automáticamente en query y body según el rol del usuario.
// superadmin puede ver todo o filtrar por bodega_id pasado en query.
// Todos los demás roles solo ven su propia bodega.
module.exports = (req, res, next) => {
    const rol = req.user?.rol;
    if (rol === 'superadmin') {
        // superadmin: respeta el bodega_id que venga en query, o ve todo
        req.bodegaId = req.query.bodega_id ? parseInt(req.query.bodega_id) : null;
    } else {
        // Todos los demás: solo su bodega
        req.bodegaId = req.user?.bodega_id || null;
        if (req.bodegaId) {
            req.query.bodega_id = req.bodegaId;
            if (req.body && typeof req.body === 'object') {
                req.body.bodega_id = req.bodegaId;
            }
        }
    }
    next();
};

// Middleware para proteger rutas por rol
module.exports.soloRoles = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user?.rol))
        return res.status(403).json({ ok: false, msg: 'Acceso denegado para tu rol' });
    next();
};
