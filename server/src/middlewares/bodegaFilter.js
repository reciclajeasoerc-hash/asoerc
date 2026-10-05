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

// ── Operaciones amarradas a la bodega del usuario ──────────────────────────────
// Solo el superadmin opera en cualquier bodega. Los demás roles registran compras,
// ventas, caja y remisiones ÚNICAMENTE en la bodega que tienen asignada.
const esSuper = req => req.user?.rol === 'superadmin';
const sinBodega = res => res.status(403).json({ ok: false, msg: 'Tu usuario no tiene bodega asignada. Pide al superadministrador que te asigne una.' });

// Un usuario que no es superadmin y no tiene bodega no puede operar: sin bodega,
// bodegaFilter no tiene qué forzar y quedaría eligiendo la que quiera.
module.exports.requiereBodega = (req, res, next) => {
    if (esSuper(req) || req.user?.bodega_id) return next();
    return sinBodega(res);
};

// Para rutas /:id — el registro tiene que ser de la bodega del usuario.
// (Sin esto, con el número de una compra/venta/caja de la otra bodega se podía modificar.)
module.exports.mismaBodega = (Modelo) => async (req, res, next) => {
    if (esSuper(req)) return next();
    if (!req.user?.bodega_id) return sinBodega(res);
    try {
        const reg = await Modelo.findByPk(req.params.id, { attributes: ['id', 'bodega_id'] });
        if (!reg) return next(); // el controlador responde 404
        if (String(reg.bodega_id) !== String(req.user.bodega_id))
            return res.status(403).json({ ok: false, msg: 'Ese registro es de otra bodega' });
        next();
    } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
};

// multer llena req.body DESPUÉS de bodegaFilter, así que en los formularios con foto
// hay que volver a forzar la bodega cuando ya está leído el cuerpo.
module.exports.forzarBodegaBody = (req, res, next) => {
    if (!esSuper(req) && req.user?.bodega_id && req.body && typeof req.body === 'object')
        req.body.bodega_id = req.user.bodega_id;
    next();
};

// Middleware para proteger rutas por rol
module.exports.soloRoles = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user?.rol))
        return res.status(403).json({ ok: false, msg: 'Acceso denegado para tu rol' });
    next();
};
