const router = require('express').Router();
const auth   = require('../middlewares/auth');
const multer = require('multer');
const path   = require('path');
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
    filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const authCtrl       = require('../controllers/authController');
const comprasCtrl    = require('../controllers/comprasController');
const materialesCtrl = require('../controllers/materialesController');
const recicladoresCtrl = require('../controllers/recicladoresController');
const ventasCtrl     = require('../controllers/ventasController');
const empleadosCtrl  = require('../controllers/empleadosController');
const cajaCtrl       = require('../controllers/cajaController');
const remisionesCtrl = require('../controllers/remisionesController');
const empaquesCtrl   = require('../controllers/empaquesController');
const informesCtrl   = require('../controllers/informesController');
const { Bodega, Material, Reciclador } = require('../models');

// Auth
router.post('/auth/login', authCtrl.login);

router.use(auth);

// Bodegas
router.get('/bodegas', async (req, res) => {
    const bodegas = await Bodega.findAll({ where: { activa: true } });
    res.json({ ok: true, bodegas });
});
router.post('/bodegas', async (req, res) => {
    const b = await Bodega.create(req.body);
    res.json({ ok: true, bodega: b });
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
router.get('/clientes',         ventasCtrl.listarClientes);
router.post('/clientes',        ventasCtrl.crearCliente);
router.put('/clientes/:id',     ventasCtrl.actualizarCliente);
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

// Informes
router.get('/informes/dashboard',          informesCtrl.dashboard);
router.get('/informes/compras-periodo',    informesCtrl.comprasPorPeriodo);
router.get('/informes/certificado-cliente',informesCtrl.certificadoCliente);

module.exports = router;
