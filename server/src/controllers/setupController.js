const bcrypt   = require('bcryptjs');
const { Usuario, Bodega } = require('../models');

exports.estado = async (req, res) => {
    try {
        const total = await Usuario.count();
        res.json({ ok: true, configurado: total > 0 });
    } catch (err) {
        res.status(500).json({ ok: false, msg: err.message });
    }
};

exports.configurar = async (req, res) => {
    try {
        const total = await Usuario.count();
        if (total > 0) return res.status(400).json({ ok: false, msg: 'El sistema ya está configurado.' });

        const { nombre_empresa, email, password, nombre_admin } = req.body;
        if (!email || !password || !nombre_empresa)
            return res.status(400).json({ ok: false, msg: 'Nombre de empresa, email y contraseña son requeridos.' });
        if (password.length < 6)
            return res.status(400).json({ ok: false, msg: 'La contraseña debe tener al menos 6 caracteres.' });

        // Crear o actualizar bodega principal con el nombre de la empresa
        let bodega = await Bodega.findOne({ where: { nombre: 'Bodega Principal' } });
        if (bodega) await bodega.update({ nombre: nombre_empresa });
        else bodega = await Bodega.create({ nombre: nombre_empresa, direccion: '' });

        const hash = await bcrypt.hash(password, 10);
        const admin = await Usuario.create({
            nombre:    nombre_admin || 'Administrador',
            email:     email.toLowerCase().trim(),
            password:  hash,
            rol:       'superadmin',
            bodega_id: bodega.id
        });

        res.json({ ok: true, msg: 'Sistema configurado correctamente. Ya puede iniciar sesión.' });
    } catch (err) {
        res.status(500).json({ ok: false, msg: err.message });
    }
};
