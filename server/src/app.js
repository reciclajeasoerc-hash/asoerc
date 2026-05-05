require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt    = require('bcryptjs');
const path      = require('path');
const fs        = require('fs');
const sequelize = require('./config/db');
const { Usuario, Bodega, Material } = require('./models');
const { startBot } = require('./services/telegramBot');

const app    = express();
const isProd = process.env.NODE_ENV === 'production';

// ── Seguridad ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

const allowedOrigins = isProd
    ? [process.env.ALLOWED_ORIGIN || 'https://asoerc-production.up.railway.app']
    : ['http://localhost:5173', 'http://localhost:4173'];

app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error('CORS: origen no permitido'));
    },
    credentials: true
}));

app.use(express.json({ limit: '10mb' })); // 10mb para fotos
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false, message: { ok: false, msg: 'Demasiadas peticiones' } }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false, message: { ok: false, msg: 'Demasiados intentos de login' } }));

// Servir fotos/uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// En producción servir el frontend compilado
if (isProd) {
    const clientDist = path.join(__dirname, '../../client/dist');
    if (fs.existsSync(clientDist)) app.use(express.static(clientDist));
}

app.use('/api', require('./routes/index'));
app.get('/api/health', (_, res) => res.json({ ok: true, sistema: 'ASOERC' }));

if (isProd) {
    app.get('*', (req, res) => {
        const index = path.join(__dirname, '../../client/dist/index.html');
        if (fs.existsSync(index)) res.sendFile(index);
        else res.status(404).send('Frontend no compilado');
    });
}

app.use((err, req, res, next) => {
    if (err.message?.includes('CORS')) return res.status(403).json({ ok: false, msg: 'Origen no permitido' });
    console.error('Error:', err.message);
    res.status(500).json({ ok: false, msg: isProd ? 'Error interno' : err.message });
});

async function seed() {
    // Admin
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
        const existe = await Usuario.findOne({ where: { email: process.env.ADMIN_EMAIL } });
        if (!existe) {
            const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
            await Usuario.create({ nombre: 'Administrador', email: process.env.ADMIN_EMAIL, password: hash, rol: 'admin' });
            console.log(`✅ Admin creado: ${process.env.ADMIN_EMAIL}`);
        }
    }
    // Bodegas iniciales
    const count = await Bodega.count();
    if (count === 0) {
        await Bodega.create({ nombre: 'Bodega ASOERC El Diamante', direccion: 'Bogotá' });
        await Bodega.create({ nombre: 'Bodega ASOERC Principal', direccion: 'Bogotá' });
        console.log('✅ Bodegas iniciales creadas');
    }
    // Materiales de la factura de ejemplo
    const matCount = await Material.count();
    if (matCount === 0) {
        const materiales = [
            { codigo: '201A', nombre: 'Archivo', precio_compra: 600 },
            { codigo: '201C', nombre: 'Cartón', precio_compra: 400 },
            { codigo: '202',  nombre: 'Plegadiza', precio_compra: 100 },
            { codigo: '307',  nombre: 'PET Cristal', precio_compra: 1450 },
            { codigo: '399S', nombre: 'PET Soplado', precio_compra: 1400 },
            { codigo: '302G', nombre: 'Galón', precio_compra: 1100 },
            { codigo: '109',  nombre: 'Ganchos Ropa', precio_compra: 200 },
            { codigo: '302P', nombre: 'Plástico Transparente', precio_compra: 1300 },
            { codigo: '305',  nombre: 'Plástico Color', precio_compra: 500 },
            { codigo: '399A', nombre: 'PET Ámbar', precio_compra: 200 },
            { codigo: '304',  nombre: 'Tina', precio_compra: 1200 },
            { codigo: '206',  nombre: 'Poliboard', precio_compra: 150 },
            { codigo: '302C', nombre: 'Caneca', precio_compra: 1800 },
            { codigo: '102',  nombre: 'Chatarra', precio_compra: 650 },
            { codigo: '101',  nombre: 'Aluminio Lata', precio_compra: 5500 },
            { codigo: '499T', nombre: 'Tetrapack', precio_compra: 100 },
            { codigo: '499V', nombre: 'Vidrio', precio_compra: 100 },
            { codigo: '499VI',nombre: 'Vineras', precio_compra: 200 },
            { codigo: '36',   nombre: 'Icopor', precio_compra: 50 },
            { codigo: '102C', nombre: 'Cobre', precio_compra: 28000 },
            { codigo: '102B', nombre: 'Bronce', precio_compra: 15000 },
            { codigo: '102AC',nombre: 'Acero', precio_compra: 800 },
        ];
        await Material.bulkCreate(materiales);
        console.log('✅ Materiales iniciales cargados');
    }
}

const PORT = process.env.PORT || 3000;

async function iniciar(intentos = 5) {
    for (let i = 1; i <= intentos; i++) {
        try {
            await sequelize.authenticate();
            await sequelize.sync({ alter: true });
            await seed();
            app.listen(PORT, () => console.log(`♻️  ASOERC corriendo en puerto ${PORT}`));
            startBot();
            return;
        } catch (err) {
            console.error(`Intento ${i}/${intentos}: ${err.message}`);
            if (i === intentos) process.exit(1);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

iniciar();
