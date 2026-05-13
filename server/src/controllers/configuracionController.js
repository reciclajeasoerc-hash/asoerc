const { Bodega, Usuario } = require('../models');
const bcrypt = require('bcryptjs');

async function obtener(req, res) {
    try {
        const bodega = await Bodega.findOne({ order: [['id', 'ASC']] });
        res.json({ ok: true, nombre: bodega?.nombre || 'ASOERC', logo_url: bodega?.logo_url || null });
    } catch (e) {
        res.json({ ok: true, nombre: 'ASOERC', logo_url: null });
    }
}

async function actualizar(req, res) {
    try {
        const bodega = await Bodega.findOne({ order: [['id', 'ASC']] });
        if (!bodega) return res.status(404).json({ ok: false, msg: 'No configurado' });
        const updates = {};
        if (req.body.nombre) updates.nombre = req.body.nombre;
        if (req.file) updates.logo_url = `/uploads/${req.file.filename}`;
        if (req.body.limpiar_logo === 'true') updates.logo_url = null;
        await bodega.update(updates);
        res.json({ ok: true, nombre: bodega.nombre, logo_url: bodega.logo_url });
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
        if (req.body.email) updates.email = req.body.email;
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

module.exports = { obtener, actualizar, actualizarPerfil };
