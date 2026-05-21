const bcrypt = require('bcryptjs');
const { Usuario, Bodega } = require('../models');

const ROLES_VALIDOS = ['superadmin', 'admin', 'cajero', 'vendedor', 'operador'];

exports.listar = async (req, res) => {
    try {
        const where = {};
        // superadmin ve todos; admin solo ve su bodega
        if (req.user.rol !== 'superadmin') where.bodega_id = req.user.bodega_id;
        const usuarios = await Usuario.findAll({
            where,
            attributes: { exclude: ['password'] },
            include: [{ model: Bodega, as: 'bodega', attributes: ['id', 'nombre'] }],
            order: [['nombre', 'ASC']]
        });
        res.json({ ok: true, usuarios });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.crear = async (req, res) => {
    try {
        const { nombre, email, password, rol, bodega_id, telegram_chat_id } = req.body;
        if (!nombre || !email || !password || !rol)
            return res.status(400).json({ ok: false, msg: 'Nombre, email, contraseña y rol requeridos' });
        if (!ROLES_VALIDOS.includes(rol))
            return res.status(400).json({ ok: false, msg: `Rol inválido. Válidos: ${ROLES_VALIDOS.join(', ')}` });
        // Solo superadmin puede crear superadmin o admin
        if (['superadmin', 'admin'].includes(rol) && req.user.rol !== 'superadmin')
            return res.status(403).json({ ok: false, msg: 'Sin permisos para asignar ese rol' });
        // admin solo puede crear usuarios para su propia bodega
        const bodegaAsignada = req.user.rol === 'superadmin' ? (bodega_id || null) : req.user.bodega_id;
        const existe = await Usuario.findOne({ where: { email: email.toLowerCase().trim() } });
        if (existe) return res.status(400).json({ ok: false, msg: 'El email ya está registrado' });
        const hash = await bcrypt.hash(password, 10);
        const usuario = await Usuario.create({
            nombre, email: email.toLowerCase().trim(), password: hash, rol, bodega_id: bodegaAsignada,
            telegram_chat_id: telegram_chat_id?.trim() || null
        });
        res.json({ ok: true, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, bodega_id: usuario.bodega_id } });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.actualizar = async (req, res) => {
    try {
        const usuario = await Usuario.findByPk(req.params.id);
        if (!usuario) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });
        // admin no puede editar usuarios de otras bodegas
        if (req.user.rol !== 'superadmin' && usuario.bodega_id !== req.user.bodega_id)
            return res.status(403).json({ ok: false, msg: 'Sin permisos' });
        const { nombre, rol, activo, bodega_id, password, telegram_chat_id } = req.body;
        const upd = {};
        if (nombre) upd.nombre = nombre;
        if (rol && ROLES_VALIDOS.includes(rol)) upd.rol = rol;
        if (activo !== undefined) upd.activo = activo;
        if (bodega_id !== undefined && req.user.rol === 'superadmin') upd.bodega_id = bodega_id;
        if (password) upd.password = await bcrypt.hash(password, 10);
        if (telegram_chat_id !== undefined) upd.telegram_chat_id = telegram_chat_id?.trim() || null;
        await usuario.update(upd);
        res.json({ ok: true, usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol, activo: usuario.activo } });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};

exports.eliminar = async (req, res) => {
    try {
        if (req.params.id == req.user.id) return res.status(400).json({ ok: false, msg: 'No puedes eliminarte a ti mismo' });
        const usuario = await Usuario.findByPk(req.params.id);
        if (!usuario) return res.status(404).json({ ok: false, msg: 'No encontrado' });
        if (req.user.rol !== 'superadmin' && usuario.bodega_id !== req.user.bodega_id)
            return res.status(403).json({ ok: false, msg: 'Sin permisos' });
        await usuario.update({ activo: false });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ ok: false, msg: err.message }); }
};
