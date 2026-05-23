const { Configuracion, Bodega, Usuario } = require('../models');
const bcrypt = require('bcryptjs');

async function obtener(req, res) {
    try {
        const configs = await Configuracion.findAll();
        const map = {};
        configs.forEach(c => { map[c.clave] = c.valor; });

        // Fallback al nombre de Bodega si aún no está en Configuracion
        let nombre = map['empresa_nombre'];
        if (!nombre) {
            const bodega = await Bodega.findOne({ order: [['id', 'ASC']] });
            nombre = bodega?.nombre || 'ASOERC';
        }

        res.json({
            ok: true,
            nombre,
            logo_url: map['empresa_logo'] ? `/uploads/${map['empresa_logo']}` : null
        });
    } catch (e) {
        res.json({ ok: true, nombre: 'ASOERC', logo_url: null });
    }
}

async function actualizar(req, res) {
    try {
        if (req.body.nombre) {
            await Configuracion.upsert({ clave: 'empresa_nombre', valor: req.body.nombre });
            // Sincronizar también en Bodega Principal para consistencia
            const bodega = await Bodega.findOne({ order: [['id', 'ASC']] });
            if (bodega) await bodega.update({ nombre: req.body.nombre });
        }
        if (req.file) {
            await Configuracion.upsert({ clave: 'empresa_logo', valor: req.file.filename });
        }
        if (req.body.limpiar_logo === 'true') {
            await Configuracion.destroy({ where: { clave: 'empresa_logo' } });
        }

        const configs = await Configuracion.findAll();
        const map = {};
        configs.forEach(c => { map[c.clave] = c.valor; });

        res.json({
            ok: true,
            nombre: map['empresa_nombre'] || 'ASOERC',
            logo_url: map['empresa_logo'] ? `/uploads/${map['empresa_logo']}` : null
        });
    } catch (e) {
        res.status(500).json({ ok: false, msg: e.message });
    }
}

async function actualizarPerfil(req, res) {
    try {
        const usuario = await Usuario.findByPk(req.user.id);
        if (!usuario) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });
        const updates = {};
        if (req.body.nombre) updates.nombre = req.body.nombre;
        if (req.body.email)  updates.email  = req.body.email;
        if (req.body.password) {
            if (req.body.password.length < 6) return res.status(400).json({ ok: false, msg: 'Mínimo 6 caracteres' });
            updates.password = await bcrypt.hash(req.body.password, 10);
        }
        await usuario.update(updates);
        const u = usuario.toJSON();
        delete u.password;
        res.json({ ok: true, usuario: u });
    } catch (e) {
        res.status(500).json({ ok: false, msg: e.message });
    }
}

async function listarTelegramChats(req, res) {
    try {
        const conf = await Configuracion.findOne({ where: { clave: 'telegram_chats' } });
        const chats = conf ? JSON.parse(conf.valor || '[]') : [];
        res.json({ ok: true, chats });
    } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
}

async function agregarTelegramChat(req, res) {
    try {
        const { chat_id, nombre, rol } = req.body;
        if (!chat_id) return res.status(400).json({ ok: false, msg: 'chat_id requerido' });
        const conf = await Configuracion.findOne({ where: { clave: 'telegram_chats' } });
        const chats = conf ? JSON.parse(conf.valor || '[]') : [];
        const existe = chats.find(c => String(c.chat_id) === String(chat_id));
        if (existe) {
            existe.nombre = nombre || existe.nombre;
            existe.rol = rol || existe.rol || 'operador';
        } else {
            chats.push({ chat_id: String(chat_id), nombre: nombre || `Chat ${chat_id}`, rol: rol || 'operador' });
        }
        await Configuracion.upsert({ clave: 'telegram_chats', valor: JSON.stringify(chats) });
        res.json({ ok: true, chats });
    } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
}

async function eliminarTelegramChat(req, res) {
    try {
        const conf = await Configuracion.findOne({ where: { clave: 'telegram_chats' } });
        if (!conf) return res.json({ ok: true, chats: [] });
        const chats = JSON.parse(conf.valor || '[]').filter(c => String(c.chat_id) !== String(req.params.chat_id));
        await conf.update({ valor: JSON.stringify(chats) });
        res.json({ ok: true, chats });
    } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
}

module.exports = { obtener, actualizar, actualizarPerfil, listarTelegramChats, agregarTelegramChat, eliminarTelegramChat };
