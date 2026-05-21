const router = require('express').Router();
const auth   = require('../middlewares/auth');
const { soloRoles } = require('../middlewares/bodegaFilter');
const bodegaFilter = require('../middlewares/bodegaFilter');
const multer = require('multer');
const path   = require('path');
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
    filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const authCtrl            = require('../controllers/authController');
const configuracionCtrl   = require('../controllers/configuracionController');
const setupCtrl      = require('../controllers/setupController');
const comprasCtrl    = require('../controllers/comprasController');
const materialesCtrl = require('../controllers/materialesController');
const recicladoresCtrl = require('../controllers/recicladoresController');
const ventasCtrl     = require('../controllers/ventasController');
const empleadosCtrl  = require('../controllers/empleadosController');
const cajaCtrl       = require('../controllers/cajaController');
const remisionesCtrl = require('../controllers/remisionesController');
const empaquesCtrl   = require('../controllers/empaquesController');
const informesCtrl   = require('../controllers/informesController');
const usuariosCtrl   = require('../controllers/usuariosController');
const vehiculosCtrl  = require('../controllers/vehiculosController');
const { Bodega, Material, Reciclador } = require('../models');

// Setup inicial (sin autenticación)
router.get('/setup/estado',  setupCtrl.estado);
router.post('/setup',        setupCtrl.configurar);
router.post('/setup/reset',  setupCtrl.reset);

// Configuración pública (logo + nombre de empresa)
router.get('/configuracion', configuracionCtrl.obtener);

// Auth
router.post('/auth/login', authCtrl.login);

router.use(auth);
router.use(bodegaFilter);

// Configuración de empresa (superadmin)
router.put('/configuracion', soloRoles('superadmin'), upload.single('logo'), configuracionCtrl.actualizar);

// Perfil del usuario autenticado
router.put('/usuarios/perfil', configuracionCtrl.actualizarPerfil);

// Bodegas
router.get('/bodegas', async (req, res) => {
    const bodegas = await Bodega.findAll({ where: { activa: true } });
    res.json({ ok: true, bodegas });
});
router.get('/bodegas/:id', async (req, res) => {
    try {
        const b = await Bodega.findByPk(req.params.id);
        if (!b) return res.status(404).json({ ok: false, msg: 'Bodega no encontrada' });
        res.json({ ok: true, bodega: b });
    } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});
router.put('/bodegas/:id', soloRoles('superadmin'), async (req, res) => {
    try {
        const b = await Bodega.findByPk(req.params.id);
        if (!b) return res.status(404).json({ ok: false, msg: 'Bodega no encontrada' });
        await b.update(req.body);
        res.json({ ok: true, bodega: b });
    } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// Materiales
router.get('/materiales',        materialesCtrl.listar);
router.post('/materiales',       materialesCtrl.crear);
router.put('/materiales/:id',    materialesCtrl.actualizar);
router.delete('/materiales/:id', materialesCtrl.eliminar);

// Recicladores
router.get('/recicladores',      recicladoresCtrl.listar);
router.post('/recicladores',     recicladoresCtrl.crear);
router.get('/recicladores/:id',  recicladoresCtrl.obtener);
router.put('/recicladores/:id',  recicladoresCtrl.actualizar);
router.delete('/recicladores/:id', recicladoresCtrl.eliminar);
router.get('/recicladores/:reciclador_id/prestamos',  recicladoresCtrl.prestamos);
router.post('/recicladores/:reciclador_id/prestamos', recicladoresCtrl.crearPrestamo);
router.get('/recicladores/:id/precios',                  recicladoresCtrl.listarPrecios);
router.post('/recicladores/:id/precios',                 recicladoresCtrl.guardarPrecio);
router.delete('/recicladores/:id/precios/:material_id',  recicladoresCtrl.eliminarPrecio);

// Compras
router.get('/compras',                          comprasCtrl.listar);
router.get('/compras/resumen-dia',              comprasCtrl.resumenDia);
router.post('/compras',                         comprasCtrl.crear);
router.get('/compras/:id',                      comprasCtrl.obtener);
router.post('/compras/:id/items',               comprasCtrl.agregarItem);
router.delete('/compras/:id/items/:item_id',    comprasCtrl.quitarItem);
router.post('/compras/:id/finalizar',           comprasCtrl.finalizar);
router.delete('/compras/:id',                   comprasCtrl.eliminar);

// Ventas y clientes
router.get('/clientes',                              ventasCtrl.listarClientes);
router.post('/clientes',                             ventasCtrl.crearCliente);
router.get('/clientes/:id',                          ventasCtrl.obtenerCliente);
router.put('/clientes/:id',                          ventasCtrl.actualizarCliente);
router.delete('/clientes/:id',                       ventasCtrl.eliminarCliente);
router.post('/clientes/:id/sedes',                   ventasCtrl.crearSede);
router.get('/clientes/:id/precios',                  ventasCtrl.listarPrecios);
router.post('/clientes/:id/precios',                 ventasCtrl.guardarPrecio);
router.delete('/clientes/:id/precios/:material_id',  ventasCtrl.eliminarPrecio);
router.get('/ventas',           ventasCtrl.listar);
router.post('/ventas',          ventasCtrl.crear);
router.get('/ventas/:id',       ventasCtrl.obtener);
router.put('/ventas/:id/estado',ventasCtrl.actualizarEstado);
router.delete('/ventas/:id',    ventasCtrl.eliminar);

// Empleados
router.get('/empleados',      empleadosCtrl.listar);
router.post('/empleados',     empleadosCtrl.crear);
router.put('/empleados/:id',  empleadosCtrl.actualizar);
router.delete('/empleados/:id', empleadosCtrl.eliminar);
router.get('/empleados/:id/prestamos',               empleadosCtrl.listarPrestamos);
router.post('/empleados/:id/prestamos',              empleadosCtrl.crearPrestamo);
router.put('/empleados/:id/prestamos/:prestamo_id',  empleadosCtrl.marcarPrestamoDescontado);
router.get('/empleados/:id/dias-no-laborados',       empleadosCtrl.listarDiasNoLaborados);
router.post('/empleados/:id/dias-no-laborados',      empleadosCtrl.crearDiasNoLaborados);

// Caja
router.get('/caja',           cajaCtrl.obtenerOAbrir);
router.get('/caja/historial', cajaCtrl.historial);
router.post('/caja/:id/movimientos', cajaCtrl.agregarMovimiento);
router.post('/caja/:id/cerrar',      cajaCtrl.cerrar);
router.post('/caja/:id/reabrir',     cajaCtrl.reabrir);

// Remisiones
router.get('/remisiones',      remisionesCtrl.listar);
router.post('/remisiones',     upload.single('foto'), remisionesCtrl.crear);
router.get('/remisiones/:id',  remisionesCtrl.obtener);
router.put('/remisiones/:id',  upload.single('foto'), remisionesCtrl.actualizar);
router.delete('/remisiones/:id', remisionesCtrl.eliminar);

// Empaques
router.get('/empaques',          empaquesCtrl.listar);
router.get('/empaques/resumen',  empaquesCtrl.resumen);
router.post('/empaques',         empaquesCtrl.registrar);
router.put('/empaques/:id',      empaquesCtrl.actualizar);

// Vehículos
router.get('/vehiculos',                    vehiculosCtrl.listar);
router.post('/vehiculos',                   vehiculosCtrl.crear);
router.get('/vehiculos/gastos',             vehiculosCtrl.listarGastos);
router.put('/vehiculos/:id',                vehiculosCtrl.actualizar);
router.delete('/vehiculos/:id',             vehiculosCtrl.eliminar);
router.post('/vehiculos/:id/gastos',        vehiculosCtrl.registrarGasto);
router.delete('/vehiculos/:id/gastos/:gasto_id', vehiculosCtrl.eliminarGasto);

// Informes
router.get('/informes/dashboard',          informesCtrl.dashboard);
router.get('/informes/compras-periodo',    informesCtrl.comprasPorPeriodo);
router.get('/informes/certificado-cliente',informesCtrl.certificadoCliente);

// Usuarios (superadmin y admin)
router.get('/usuarios',      soloRoles('superadmin','admin'), usuariosCtrl.listar);
router.post('/usuarios',     soloRoles('superadmin','admin'), usuariosCtrl.crear);
router.put('/usuarios/:id',  soloRoles('superadmin','admin'), usuariosCtrl.actualizar);
router.delete('/usuarios/:id', soloRoles('superadmin','admin'), usuariosCtrl.eliminar);

// Bodegas (solo superadmin puede crear)
router.post('/bodegas', soloRoles('superadmin'), async (req, res) => {
    const b = await Bodega.create(req.body);
    res.json({ ok: true, bodega: b });
});

module.exports = router;
