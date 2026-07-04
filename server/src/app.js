require('dotenv').config();

process.on('uncaughtException',  err  => console.error('CRASH uncaughtException:',  err.stack || err.message));
process.on('unhandledRejection', (r)  => console.error('CRASH unhandledRejection:', r?.stack || r));

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt    = require('bcryptjs');
const path      = require('path');
const fs        = require('fs');
const sequelize = require('./config/db');
const { Op } = require('sequelize');
const { Usuario, Bodega, Material, Cliente, ClienteSede, MaterialPrecioCliente, Configuracion } = require('./models');
const { startBot } = require('./services/telegramBot');
const { iniciarVerificacion, verificarLicencia, estadoEndpoint } = require('./middlewares/licencia');

const app    = express();
const isProd = process.env.NODE_ENV === 'production';

// ── Seguridad ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

const allowedOrigins = isProd
    ? [process.env.ALLOWED_ORIGIN || 'https://asoerc-production.up.railway.app']
    : null; // en desarrollo permitimos cualquier localhost

app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (!isProd) return cb(null, true); // desarrollo: permitir todo
        if (allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error('CORS: origen no permitido'));
    },
    credentials: true
}));

app.use(express.json({ limit: '10mb' })); // 10mb para fotos
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false, message: { ok: false, msg: 'Demasiadas peticiones' } }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false, message: { ok: false, msg: 'Demasiados intentos de login' } }));

// Crear carpeta uploads si no existe (Railway tiene filesystem efímero)
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Servir el frontend compilado (PWA) — siempre que exista el build
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
    app.get('/sw.js', (req, res) => {
        res.setHeader('Service-Worker-Allowed', '/');
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.join(clientDist, 'sw.js'));
    });
    app.use(express.static(clientDist));
}

app.get('/api/health',          (_, res) => res.json({ ok: true, sistema: 'ASOERC' }));
app.get('/api/licencia/estado', estadoEndpoint);
app.use('/api', verificarLicencia);
app.use('/api', require('./routes/index'));

// SPA fallback — todas las rutas que no sean /api devuelven index.html
if (fs.existsSync(clientDist)) {
    app.get('*', (req, res) => {
        res.sendFile(path.join(clientDist, 'index.html'));
    });
}

app.use((err, req, res, next) => {
    if (err.message?.includes('CORS')) return res.status(403).json({ ok: false, msg: 'Origen no permitido' });
    console.error('Error:', err.message);
    res.status(500).json({ ok: false, msg: isProd ? 'Error interno' : err.message });
});

async function seed() {
    // Bodegas iniciales (primero para tener IDs disponibles)
    const count = await Bodega.count();
    if (count === 0) {
        await Bodega.create({ nombre: 'Bodega Principal', direccion: 'Bogotá' });
        await Bodega.create({ nombre: 'El Diamante', direccion: 'Bogotá' });
        console.log('✅ Bodegas iniciales creadas');
    }

    // Admin / Superadmin
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
        const principal = await Bodega.findOne({ where: { nombre: { [Op.like]: '%Principal%' } } });
        const existe = await Usuario.findOne({ where: { email: process.env.ADMIN_EMAIL } });
        if (!existe) {
            const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
            await Usuario.create({ nombre: 'Administrador', email: process.env.ADMIN_EMAIL, password: hash, rol: 'superadmin', bodega_id: principal?.id });
            console.log(`✅ Superadmin creado: ${process.env.ADMIN_EMAIL}`);
        } else if (existe.rol !== 'superadmin') {
            await existe.update({ rol: 'superadmin', bodega_id: principal?.id || existe.bodega_id });
            console.log(`✅ Usuario actualizado a superadmin`);
        }
    }
    // Materiales con categorías
    const matCount = await Material.count();
    if (matCount === 0) {
        const materiales = [
            // ── Metales ──────────────────────────────────────────────────────
            { codigo: '102CH', nombre: 'Chatarra',         precio_compra: 600,   categoria: 'Metales' },
            { codigo: '102B',  nombre: 'Bronce',           precio_compra: 15000, categoria: 'Metales' },
            { codigo: '102C',  nombre: 'Cobre Rojo',       precio_compra: 35000, categoria: 'Metales' },
            { codigo: '103CA', nombre: 'Cobre Amarillo',   precio_compra: 20000, categoria: 'Metales' },
            { codigo: '106',   nombre: 'Cable',            precio_compra: 3000,  categoria: 'Metales' },
            { codigo: '101',   nombre: 'Aluminio Lata',    precio_compra: 5500,  categoria: 'Metales' },
            { codigo: '102AC', nombre: 'Acero',            precio_compra: 800,   categoria: 'Metales' },
            { codigo: '1',     nombre: 'Plomo',            precio_compra: 3000,  categoria: 'Metales' },
            { codigo: '199RC', nombre: 'Radiador Cobre',   precio_compra: 15000, categoria: 'Metales' },
            { codigo: '199RM', nombre: 'Radiador Mixto',   precio_compra: 13000, categoria: 'Metales' },
            { codigo: '777',   nombre: 'Lámina',           precio_compra: 2500,  categoria: 'Metales' },
            { codigo: '103P',  nombre: 'Perfil',           precio_compra: 6000,  categoria: 'Metales' },
            { codigo: '199PL', nombre: 'Plancha',          precio_compra: 2200,  categoria: 'Metales' },
            { codigo: '101D',  nombre: 'Desarme',          precio_compra: 900,   categoria: 'Metales' },
            { codigo: '102PA', nombre: 'Patio',            precio_compra: 1200,  categoria: 'Metales' },
            { codigo: '36C',   nombre: 'Colado',           precio_compra: 1000,  categoria: 'Metales' },
            // ── Electrónicos ─────────────────────────────────────────────────
            { codigo: '101CE', nombre: 'Celular',          precio_compra: 10000, categoria: 'Electrónicos' },
            { codigo: '102B22',nombre: 'Batería 22',       precio_compra: 30000, categoria: 'Electrónicos' },
            { codigo: '102B24',nombre: 'Batería 24',       precio_compra: 35000, categoria: 'Electrónicos' },
            { codigo: '3B27',  nombre: 'Batería 27',       precio_compra: 40000, categoria: 'Electrónicos' },
            { codigo: '102BM', nombre: 'Batería Maletín',  precio_compra: 15000, categoria: 'Electrónicos' },
            { codigo: '399PA', nombre: 'Pantalla',         precio_compra: 2000,  categoria: 'Electrónicos' },
            { codigo: '107',   nombre: 'Plaqueta',         precio_compra: 3000,  categoria: 'Electrónicos' },
            { codigo: '302CD', nombre: 'Pasta de CD',      precio_compra: 300,   categoria: 'Electrónicos' },
            { codigo: '102RG', nombre: 'Radiografía',      precio_compra: 1000,  categoria: 'Electrónicos' },
            { codigo: '499PE', nombre: 'Peter',            precio_compra: 2000,  categoria: 'Electrónicos' },
            { codigo: '111CO', nombre: 'Cores',            precio_compra: 300,   categoria: 'Electrónicos' },
            // ── Plásticos ────────────────────────────────────────────────────
            { codigo: '307',   nombre: 'PET Cristal',      precio_compra: 1500,  categoria: 'Plásticos' },
            { codigo: '399S',  nombre: 'PET Soplado',      precio_compra: 1400,  categoria: 'Plásticos' },
            { codigo: '399A',  nombre: 'PET Ámbar',        precio_compra: 200,   categoria: 'Plásticos' },
            { codigo: '399R',  nombre: 'PET Revuelto',     precio_compra: 500,   categoria: 'Plásticos' },
            { codigo: '399V',  nombre: 'PET Verde',        precio_compra: 300,   categoria: 'Plásticos' },
            { codigo: '302P',  nombre: 'Plástico Transp.', precio_compra: 1300,  categoria: 'Plásticos' },
            { codigo: '305',   nombre: 'Plástico Color',   precio_compra: 500,   categoria: 'Plásticos' },
            { codigo: '308',   nombre: 'PVC',              precio_compra: 300,   categoria: 'Plásticos' },
            { codigo: '302PP', nombre: 'Polipropileno',    precio_compra: 400,   categoria: 'Plásticos' },
            { codigo: '304',   nombre: 'Tina',             precio_compra: 1200,  categoria: 'Plásticos' },
            { codigo: '302C',  nombre: 'Caneca',           precio_compra: 1800,  categoria: 'Plásticos' },
            { codigo: '399CA', nombre: 'Canasta',          precio_compra: 3000,  categoria: 'Plásticos' },
            { codigo: '302G',  nombre: 'Galón',            precio_compra: 1100,  categoria: 'Plásticos' },
            { codigo: '302GA', nombre: 'Galón Aceite',     precio_compra: 1300,  categoria: 'Plásticos' },
            { codigo: '302GC', nombre: 'Galón Cristal',    precio_compra: 4000,  categoria: 'Plásticos' },
            { codigo: '301',   nombre: 'Pasta',            precio_compra: 500,   categoria: 'Plásticos' },
            // ── Papel y Cartón ───────────────────────────────────────────────
            { codigo: '201A',  nombre: 'Archivo',          precio_compra: 600,   categoria: 'Papel y Cartón' },
            { codigo: '201C',  nombre: 'Cartón',           precio_compra: 400,   categoria: 'Papel y Cartón' },
            { codigo: '202',   nombre: 'Plegadiza',        precio_compra: 100,   categoria: 'Papel y Cartón' },
            { codigo: '206',   nombre: 'Poliboard',        precio_compra: 150,   categoria: 'Papel y Cartón' },
            { codigo: '499T',  nombre: 'Tetrapack',        precio_compra: 100,   categoria: 'Papel y Cartón' },
            { codigo: '206E',  nombre: 'Estibas',          precio_compra: 5000,  categoria: 'Papel y Cartón' },
            // ── Vidrio ───────────────────────────────────────────────────────
            { codigo: '499V',  nombre: 'Vidrio',           precio_compra: 100,   categoria: 'Vidrio' },
            { codigo: '499VC', nombre: 'Botella Café',     precio_compra: 1500,  categoria: 'Vidrio' },
            { codigo: '303',   nombre: 'Botella Transp.',  precio_compra: 500,   categoria: 'Vidrio' },
            { codigo: '499VV', nombre: 'Botella Verde',    precio_compra: 1500,  categoria: 'Vidrio' },
            { codigo: '499VI', nombre: 'Vineras',          precio_compra: 200,   categoria: 'Vidrio' },
            { codigo: '499PF', nombre: 'Perfumeros',       precio_compra: 200,   categoria: 'Vidrio' },
            { codigo: '741',   nombre: 'Verde Limpio',     precio_compra: 300,   categoria: 'Vidrio' },
            // ── Varios ───────────────────────────────────────────────────────
            { codigo: '109',   nombre: 'Ganchos Ropa',     precio_compra: 300,   categoria: 'Varios' },
            { codigo: '105',   nombre: 'Ganchos',          precio_compra: 200,   categoria: 'Varios' },
            { codigo: '100',   nombre: 'Lonas',            precio_compra: 200,   categoria: 'Varios' },
            { codigo: '1011',  nombre: 'Gualla',           precio_compra: 5000,  categoria: 'Varios' },
            { codigo: '102AC2',nombre: 'Aceite',           precio_compra: 1000,  categoria: 'Varios' },
            { codigo: '2',     nombre: 'Parafina',         precio_compra: 1000,  categoria: 'Varios' },
            { codigo: '102T',  nombre: 'Tierra',           precio_compra: 1500,  categoria: 'Varios' },
            { codigo: '699',   nombre: 'Madera',           precio_compra: 150,   categoria: 'Varios' },
            { codigo: '36',    nombre: 'Icopor',           precio_compra: 50,    categoria: 'Varios' },
            { codigo: '111CT', nombre: 'Contaminado',      precio_compra: 0,     categoria: 'Varios' },
            { codigo: '628',   nombre: 'Retal',            precio_compra: 0,     categoria: 'Varios' },
        ];
        await Material.bulkCreate(materiales);
        console.log('✅ Materiales iniciales cargados');
    }

    // Electrónicos adicionales — se insertan si no existen (findOrCreate por código)
    const electronicos = [
        { codigo: '102TD',   nombre: 'Tarjeta Dorada',          precio_compra: 50000, categoria: 'Electrónicos' },
        { codigo: '102TVA',  nombre: 'Tarjeta Verde y Azul',    precio_compra: 15000, categoria: 'Electrónicos' },
        { codigo: '102TM',   nombre: 'Tarjeta Marrón',          precio_compra:  4000, categoria: 'Electrónicos' },
        { codigo: '102TMOD', nombre: 'Tarjeta Módem',           precio_compra: 10000, categoria: 'Electrónicos' },
        { codigo: '102DD',   nombre: 'Disco Duro Entero',       precio_compra:  7000, categoria: 'Electrónicos' },
        { codigo: '102PORT', nombre: 'Portátil',                precio_compra:  6000, categoria: 'Electrónicos' },
        { codigo: '102BPC',  nombre: 'Batería Portátil/Celular',precio_compra:  4000, categoria: 'Electrónicos' },
        { codigo: '102FCC',  nombre: 'Fuente con Cable',        precio_compra:  2000, categoria: 'Electrónicos' },
        { codigo: '102FSC',  nombre: 'Fuente sin Cable',        precio_compra:  1000, categoria: 'Electrónicos' },
        { codigo: '102CPU',  nombre: 'CPU Completa',            precio_compra: 20000, categoria: 'Electrónicos' },
        { codigo: '102TV',   nombre: 'Televisor',               precio_compra:  5000, categoria: 'Electrónicos' },
        { codigo: '102MON',  nombre: 'Monitor',                 precio_compra:  2500, categoria: 'Electrónicos' },
        { codigo: '102TF',   nombre: 'Teléfono Fijo',           precio_compra:   800, categoria: 'Electrónicos' },
        { codigo: '102PB',   nombre: 'Power Bank',              precio_compra:  1000, categoria: 'Electrónicos' },
        { codigo: '102MPLA', nombre: 'Módem Plástico',          precio_compra:  2000, categoria: 'Electrónicos' },
    ];
    for (const mat of electronicos) {
        await Material.findOrCreate({ where: { codigo: mat.codigo }, defaults: mat });
    }
    // Actualizar precio de Radiografía al valor vigente
    await Material.update({ precio_compra: 3000 }, { where: { codigo: '102RG' } });

    // Asegurar "Retal de Madera" en la familia Madera (el cliente reportó que faltaba)
    const normNombre = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const todosMat = await Material.findAll();
    const retal = todosMat.find(m => normNombre(m.nombre) === 'retal de madera');
    if (retal) {
        if (retal.categoria !== 'Madera' || retal.orden !== 2) await retal.update({ categoria: 'Madera', orden: 2 });
    } else {
        await Material.create({ codigo: '699R', nombre: 'Retal de Madera', precio_compra: 150, categoria: 'Madera', orden: 2 });
        console.log('✅ Material "Retal de Madera" creado en familia Madera');
    }

    console.log('✅ Electrónicos adicionales sincronizados');
}

async function seedEcology() {
    // Sedes y precios especiales de Ecology Victoria SAS
    const cliente = await Cliente.findOne({ where: { nombre: { [Op.like]: '%Ecology%' } } });
    if (!cliente) return;

    const SEDES = ['Atlantis plaza','Plaza central','Nuestro Bogotá','El Eden','FM chocolates','Hotel bosques','Hotel Peñalisa','Alkosto 2','Alkosto 3','Corbeta'];
    const sedesExistentes = await ClienteSede.findAll({ where: { cliente_id: cliente.id } });
    const nombresExistentes = sedesExistentes.map(s => s.nombre.toLowerCase());
    let sedesAdded = 0;
    for (const nombre of SEDES) {
        if (!nombresExistentes.includes(nombre.toLowerCase())) {
            await ClienteSede.create({ cliente_id: cliente.id, nombre });
            sedesAdded++;
        }
    }

    // Precios especiales por código de material
    const PRECIOS = [
        { codigo: '101',   precio: 4500 },
        { codigo: '201A',  precio: 500  },
        { codigo: '399CA', precio: 4000 },
        { codigo: '302C',  precio: 1500 },
        { codigo: '201C',  precio: 430  },
        { codigo: '102CH', precio: 500  },
        { codigo: '302G',  precio: 1100 },
        { codigo: '109',   precio: 200  },
        { codigo: '302CD', precio: 200  },
        { codigo: '399A',  precio: 200  },
        { codigo: '307',   precio: 1000 },
        { codigo: '399S',  precio: 1000 },
        { codigo: '305',   precio: 500  },
        { codigo: '302P',  precio: 1000 },
        { codigo: '202',   precio: 100  },
        { codigo: '206',   precio: 200  },
        { codigo: '302PP', precio: 200  },
        { codigo: '308',   precio: 300  },
        { codigo: '499T',  precio: 50   },
        { codigo: '304',   precio: 700  },
        { codigo: '499V',  precio: 100  },
    ];
    let preciosAdded = 0;
    for (const { codigo, precio } of PRECIOS) {
        const mat = await Material.findOne({ where: { codigo } });
        if (!mat) continue;
        const existe = await MaterialPrecioCliente.findOne({ where: { cliente_id: cliente.id, material_id: mat.id } });
        if (!existe) { await MaterialPrecioCliente.create({ cliente_id: cliente.id, material_id: mat.id, precio }); preciosAdded++; }
    }
    if (sedesAdded > 0 || preciosAdded > 0)
        console.log(`✅ Ecology Victoria: ${sedesAdded} sedes y ${preciosAdded} precios especiales cargados`);
}

async function seedOrdenMateriales() {
    // Reorganiza los materiales por familia y orden según las listas del cliente (imágenes).
    // Empareja por NOMBRE (no por código), así funciona aunque los códigos hayan cambiado en producción.
    // Se ejecuta una sola vez (bandera en Configuracion). Para re-aplicar, sube VERSION_ORDEN.
    const VERSION_ORDEN = '1';
    const flag = await Configuracion.findOne({ where: { clave: 'orden_materiales_version' } });
    if (flag && flag.valor === VERSION_ORDEN) return;

    const norm = s => (s || '').toString().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
        .replace(/\s*\/\s*/g, ' / ')                       // unifica barras
        .replace(/\s+/g, ' ').trim();

    // Listas deseadas por familia, en el orden exacto de las imágenes
    const FAMILIAS = {
        'Metales':        ['acero','aluminio grueso','aluminio lata','antimonio','bronce','cable','chatarra','cobre rojo','colado','guaya','patio','perfil','plomo','radiador aluminio','radiador mixto'],
        'Electrónicos':   ['bateria portatil / celular','celular','cpu completa','desarme aluminio','disco duro entero','fuente con cable','fuente sin cable','modem plastico','monitor','pantalla','portatil','power bank','radiografia','tarjeta dorada','tarjeta marron','tarjeta modem','tarjeta verde / azul','telefono fijo'],
        'Plásticos':      ['acrilico','canasta','caneca','galon','galon cristal','gancho','pasta','pasta de cd','pet ambar','pet cristal','pet revuelto','pet soplado','pet verde','plastico color','plastico transparente','polipropileno','pvc','tina'],
        'Papel y Cartón': ['archivo','caja manzana','carton','cores','periodico','propaganda','plegadiza','poliboard','tetrapack'],
        'Vidrio':         ['botella cafe','botella verde','peter','vidrio','vineras'],
        'Madera':         ['madera','retal de madera'],
        'Otros':          ['aceite','bateria 22','bateria 24','bateria 27','bateria maletin','lonas','parafina','tierra'],
    };

    // Alias: nombre como puede estar en la BD (normalizado) -> nombre en la lista
    const ALIAS = {
        'plastico transp.': 'plastico transparente',
        'plastico transp':  'plastico transparente',
        'gualla':           'guaya',
        'desarme':          'desarme aluminio',
        'ganchos':          'gancho',
        'ganchos ropa':     'gancho',
        'gancho ropa':      'gancho',
        'tarjeta verde y azul': 'tarjeta verde / azul',
        'pet vere':         'pet verde',
    };

    const deseado = {};
    for (const [categoria, lista] of Object.entries(FAMILIAS)) {
        lista.forEach((nombre, i) => { deseado[norm(nombre)] = { categoria, orden: i + 1 }; });
    }

    const materiales = await Material.findAll();
    let cambios = 0;
    for (const m of materiales) {
        let clave = norm(m.nombre);
        if (!deseado[clave] && ALIAS[clave]) clave = norm(ALIAS[clave]);
        const target = deseado[clave];
        if (target && (m.categoria !== target.categoria || m.orden !== target.orden)) {
            await m.update({ categoria: target.categoria, orden: target.orden });
            cambios++;
        }
    }

    if (flag) await flag.update({ valor: VERSION_ORDEN });
    else await Configuracion.create({ clave: 'orden_materiales_version', valor: VERSION_ORDEN });
    console.log(`✅ Orden de materiales aplicado (${cambios} materiales reorganizados)`);
}

const PORT = process.env.PORT || 3000;

async function iniciar(intentos = 5) {
    for (let i = 1; i <= intentos; i++) {
        try {
            await sequelize.authenticate();
            // Convierte la columna rol a VARCHAR si aún es ENUM (migración automática)
            await sequelize.query("ALTER TABLE Usuarios MODIFY COLUMN rol VARCHAR(255) DEFAULT 'operador'").catch(() => {});
            // Columnas nuevas en Remisiones (no afectan si ya existen)
            await sequelize.query("ALTER TABLE Remisions ADD COLUMN tipo ENUM('compra','venta') NULL").catch(() => {});
            await sequelize.query("ALTER TABLE Remisions ADD COLUMN venta_id INT NULL").catch(() => {});
            await sequelize.query("ALTER TABLE Remisions ADD COLUMN compra_id INT NULL").catch(() => {});
            await sequelize.query("ALTER TABLE Remisions ADD COLUMN numero_orden VARCHAR(50) NULL").catch(() => {});
            await sequelize.query("ALTER TABLE Bodegas ADD COLUMN logo_url VARCHAR(500) NULL").catch(() => {});
            await sequelize.query("ALTER TABLE Compras ADD COLUMN numero_diario INT DEFAULT 0").catch(() => {});
            await sequelize.query("ALTER TABLE Usuarios ADD COLUMN telegram_chat_id VARCHAR(50) NULL").catch(() => {});
            await sequelize.query("ALTER TABLE Empleados ADD COLUMN tipo_salario VARCHAR(20) DEFAULT 'dia'").catch(() => {});
            await sequelize.query("ALTER TABLE Materials ADD COLUMN orden INT DEFAULT 999").catch(() => {});
            await sequelize.query("ALTER TABLE PrestamoRecicladors ADD COLUMN abonado DECIMAL(12,2) DEFAULT 0").catch(() => {});
            await sequelize.query("ALTER TABLE PrestamoEmpleados ADD COLUMN abonado DECIMAL(12,2) DEFAULT 0").catch(() => {});
            await sequelize.sync();
            await seed();
            await seedEcology();
            await seedOrdenMateriales().catch(e => console.error('Orden materiales error:', e.message));
            app.listen(PORT, '0.0.0.0', () => console.log(`♻️  ASOERC corriendo en puerto ${PORT}`));
            try { startBot(); } catch(e) { console.error('Bot init error:', e.message); }
            iniciarVerificacion().catch(e => console.error('Licencia init error:', e.message));
            return;
        } catch (err) {
            console.error(`Intento ${i}/${intentos}: ${err.message}`);
            if (i === intentos) process.exit(1);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

iniciar();
