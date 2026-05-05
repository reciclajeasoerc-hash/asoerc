const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer '))
        return res.status(401).json({ ok: false, msg: 'Token requerido' });

    const token = authHeader.split(' ')[1];
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        const msg = err.name === 'TokenExpiredError'
            ? 'Sesión expirada, inicia sesión nuevamente'
            : 'Token inválido';
        res.status(401).json({ ok: false, msg });
    }
};
