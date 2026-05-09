const sequelize = require('../config/db');
const { DataTypes } = require('sequelize');

// ── Modelos ──────────────────────────────────────────────────────────────────

const Usuario = sequelize.define('Usuario', {
    nombre:   { type: DataTypes.STRING, allowNull: false },
    email:    { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    rol:      { type: DataTypes.STRING, defaultValue: 'operador' },
    bodega_id:{ type: DataTypes.INTEGER, allowNull: true },
    activo:   { type: DataTypes.BOOLEAN, defaultValue: true }
});

const Bodega = sequelize.define('Bodega', {
    nombre:    { type: DataTypes.STRING, allowNull: false },
    direccion: { type: DataTypes.STRING },
    telefono:  { type: DataTypes.STRING },
    activa:    { type: DataTypes.BOOLEAN, defaultValue: true }
});

const Material = sequelize.define('Material', {
    codigo:        { type: DataTypes.STRING, allowNull: false, unique: true },
    nombre:        { type: DataTypes.STRING, allowNull: false },
    precio_compra: { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 },
    unidad:        { type: DataTypes.STRING, defaultValue: 'kg' },
    categoria:     { type: DataTypes.STRING, defaultValue: 'Otros' },
    activo:        { type: DataTypes.BOOLEAN, defaultValue: true }
});

const Reciclador = sequelize.define('Reciclador', {
    nombre:    { type: DataTypes.STRING, allowNull: false },
    cedula:    { type: DataTypes.STRING, unique: true },
    telefono:  { type: DataTypes.STRING },
    whatsapp:  { type: DataTypes.STRING },
    bodega_id: { type: DataTypes.INTEGER },
    activo:    { type: DataTypes.BOOLEAN, defaultValue: true },
    saldo_prestamo: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 }
});

const Compra = sequelize.define('Compra', {
    numero:       { type: DataTypes.INTEGER },
    reciclador_id:{ type: DataTypes.INTEGER, allowNull: false },
    bodega_id:    { type: DataTypes.INTEGER, allowNull: false },
    fecha:        { type: DataTypes.DATEONLY, allowNull: false },
    total:        { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
    descuento_prestamo: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
    neto:         { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
    estado:       { type: DataTypes.ENUM('borrador','finalizada'), defaultValue: 'borrador' },
    whatsapp_enviado: { type: DataTypes.BOOLEAN, defaultValue: false },
    observaciones:{ type: DataTypes.TEXT }
});

const CompraItem = sequelize.define('CompraItem', {
    compra_id:   { type: DataTypes.INTEGER, allowNull: false },
    material_id: { type: DataTypes.INTEGER, allowNull: false },
    kilos:       { type: DataTypes.DECIMAL(10,3), allowNull: false },
    precio_unitario: { type: DataTypes.DECIMAL(10,2), allowNull: false },
    total:       { type: DataTypes.DECIMAL(12,2), allowNull: false }
});

const Cliente = sequelize.define('Cliente', {
    nombre:   { type: DataTypes.STRING, allowNull: false },
    nit:      { type: DataTypes.STRING },
    telefono: { type: DataTypes.STRING },
    email:    { type: DataTypes.STRING },
    contacto: { type: DataTypes.STRING },
    tipo_precio: { type: DataTypes.ENUM('fijo','semanal'), defaultValue: 'fijo' },
    activo:   { type: DataTypes.BOOLEAN, defaultValue: true }
});

const ClienteSede = sequelize.define('ClienteSede', {
    cliente_id: { type: DataTypes.INTEGER, allowNull: false },
    nombre:     { type: DataTypes.STRING, allowNull: false },
    direccion:  { type: DataTypes.STRING },
    activa:     { type: DataTypes.BOOLEAN, defaultValue: true }
});

const MaterialPrecioCliente = sequelize.define('MaterialPrecioCliente', {
    cliente_id:  { type: DataTypes.INTEGER, allowNull: false },
    material_id: { type: DataTypes.INTEGER, allowNull: false },
    precio:      { type: DataTypes.DECIMAL(10,2), allowNull: false }
});

const Venta = sequelize.define('Venta', {
    numero:     { type: DataTypes.INTEGER },
    cliente_id: { type: DataTypes.INTEGER, allowNull: false },
    sede_id:    { type: DataTypes.INTEGER },
    bodega_id:  { type: DataTypes.INTEGER, allowNull: false },
    fecha:      { type: DataTypes.DATEONLY, allowNull: false },
    total:      { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
    estado:     { type: DataTypes.ENUM('orden','facturada','pagada'), defaultValue: 'orden' },
    tipo_pago:  { type: DataTypes.ENUM('efectivo','transferencia','pendiente'), defaultValue: 'pendiente' },
    observaciones: { type: DataTypes.TEXT }
});

const VentaItem = sequelize.define('VentaItem', {
    venta_id:    { type: DataTypes.INTEGER, allowNull: false },
    material_id: { type: DataTypes.INTEGER, allowNull: false },
    kilos:       { type: DataTypes.DECIMAL(10,3), allowNull: false },
    precio_unitario: { type: DataTypes.DECIMAL(10,2), allowNull: false },
    total:       { type: DataTypes.DECIMAL(12,2), allowNull: false }
});

const Empleado = sequelize.define('Empleado', {
    nombre:    { type: DataTypes.STRING, allowNull: false },
    cedula:    { type: DataTypes.STRING, unique: true },
    telefono:  { type: DataTypes.STRING },
    bodega_id: { type: DataTypes.INTEGER },
    cargo:     { type: DataTypes.STRING },
    salario:   { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
    activo:    { type: DataTypes.BOOLEAN, defaultValue: true }
});

const PrestamoEmpleado = sequelize.define('PrestamoEmpleado', {
    empleado_id: { type: DataTypes.INTEGER, allowNull: false },
    monto:       { type: DataTypes.DECIMAL(12,2), allowNull: false },
    fecha:       { type: DataTypes.DATEONLY, allowNull: false },
    descripcion: { type: DataTypes.STRING },
    quincena:    { type: DataTypes.STRING },
    descontado:  { type: DataTypes.BOOLEAN, defaultValue: false }
});

const DiasNoLaborados = sequelize.define('DiasNoLaborados', {
    empleado_id: { type: DataTypes.INTEGER, allowNull: false },
    fecha_inicio:{ type: DataTypes.DATEONLY, allowNull: false },
    fecha_fin:   { type: DataTypes.DATEONLY, allowNull: false },
    dias:        { type: DataTypes.DECIMAL(4,1), allowNull: false },
    motivo:      { type: DataTypes.STRING },
    quincena:    { type: DataTypes.STRING },
    descontado:  { type: DataTypes.BOOLEAN, defaultValue: false }
});

const PrestamoReciclador = sequelize.define('PrestamoReciclador', {
    reciclador_id: { type: DataTypes.INTEGER, allowNull: false },
    monto:         { type: DataTypes.DECIMAL(12,2), allowNull: false },
    fecha:         { type: DataTypes.DATEONLY, allowNull: false },
    descripcion:   { type: DataTypes.STRING },
    compra_id:     { type: DataTypes.INTEGER },
    pagado:        { type: DataTypes.BOOLEAN, defaultValue: false }
});

const Caja = sequelize.define('Caja', {
    bodega_id:    { type: DataTypes.INTEGER, allowNull: false },
    fecha:        { type: DataTypes.DATEONLY, allowNull: false },
    saldo_inicial:{ type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
    total_ingresos:{ type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
    total_egresos: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
    saldo_final:  { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
    estado:       { type: DataTypes.ENUM('abierta','cerrada'), defaultValue: 'abierta' },
    observaciones:{ type: DataTypes.TEXT }
});

const MovimientoCaja = sequelize.define('MovimientoCaja', {
    caja_id:   { type: DataTypes.INTEGER, allowNull: false },
    tipo:      { type: DataTypes.ENUM('ingreso','egreso'), allowNull: false },
    concepto:  { type: DataTypes.STRING, allowNull: false },
    monto:     { type: DataTypes.DECIMAL(12,2), allowNull: false },
    referencia:{ type: DataTypes.STRING },
    hora:      { type: DataTypes.TIME }
});

const Remision = sequelize.define('Remision', {
    numero:       { type: DataTypes.INTEGER },
    numero_orden: { type: DataTypes.STRING },
    tipo:         { type: DataTypes.ENUM('compra','venta'), allowNull: true },
    conductor:    { type: DataTypes.STRING, allowNull: false },
    cliente_id: { type: DataTypes.INTEGER },
    sede_id:    { type: DataTypes.INTEGER },
    bodega_id:  { type: DataTypes.INTEGER, allowNull: false },
    venta_id:   { type: DataTypes.INTEGER },
    compra_id:  { type: DataTypes.INTEGER },
    fecha:      { type: DataTypes.DATEONLY, allowNull: false },
    hora_llegada: { type: DataTypes.TIME },
    hora_salida:  { type: DataTypes.TIME },
    vehiculo:   { type: DataTypes.STRING },
    foto_url:   { type: DataTypes.STRING },
    total_kilos:{ type: DataTypes.DECIMAL(10,3), defaultValue: 0 },
    observaciones: { type: DataTypes.TEXT }
});

const RemisionItem = sequelize.define('RemisionItem', {
    remision_id: { type: DataTypes.INTEGER, allowNull: false },
    material_id: { type: DataTypes.INTEGER, allowNull: false },
    kilos:       { type: DataTypes.DECIMAL(10,3), allowNull: false }
});

const Empaque = sequelize.define('Empaque', {
    tipo_actor:    { type: DataTypes.ENUM('reciclador','conductor'), allowNull: false },
    reciclador_id: { type: DataTypes.INTEGER },
    conductor:     { type: DataTypes.STRING },
    bodega_id:     { type: DataTypes.INTEGER, allowNull: false },
    fecha:         { type: DataTypes.DATEONLY, allowNull: false },
    cantidad_entregada: { type: DataTypes.INTEGER, defaultValue: 0 },
    cantidad_devuelta:  { type: DataTypes.INTEGER, defaultValue: 0 },
    saldo:         { type: DataTypes.INTEGER, defaultValue: 0 },
    observaciones: { type: DataTypes.STRING }
});

const Vehiculo = sequelize.define('Vehiculo', {
    placa:       { type: DataTypes.STRING, allowNull: false, unique: true },
    descripcion: { type: DataTypes.STRING },
    conductor:   { type: DataTypes.STRING },
    tipo:        { type: DataTypes.ENUM('camion','furgon','moto','otro'), defaultValue: 'camion' },
    activo:      { type: DataTypes.BOOLEAN, defaultValue: true }
});

const GastoVehiculo = sequelize.define('GastoVehiculo', {
    vehiculo_id: { type: DataTypes.INTEGER, allowNull: false },
    bodega_id:   { type: DataTypes.INTEGER },
    fecha:       { type: DataTypes.DATEONLY, allowNull: false },
    tipo:        { type: DataTypes.ENUM('gasolina','viatico','mantenimiento','otro'), allowNull: false },
    monto:       { type: DataTypes.DECIMAL(12,2), allowNull: false },
    descripcion: { type: DataTypes.STRING },
    km_actual:   { type: DataTypes.INTEGER }
});

const Certificado = sequelize.define('Certificado', {
    cliente_id:   { type: DataTypes.INTEGER, allowNull: false },
    mes:          { type: DataTypes.INTEGER, allowNull: false },
    anio:         { type: DataTypes.INTEGER, allowNull: false },
    total_kilos:  { type: DataTypes.DECIMAL(12,3), defaultValue: 0 },
    total_valor:  { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
    archivo_url:  { type: DataTypes.STRING },
    generado_at:  { type: DataTypes.DATE }
});

// ── Hooks: numero = id ───────────────────────────────────────────────────────
Compra.addHook('afterCreate',  async (r) => { await r.update({ numero: r.id }); });
Venta.addHook('afterCreate',   async (r) => { await r.update({ numero: r.id }); });
Remision.addHook('afterCreate',async (r) => { await r.update({ numero: r.id }); });

// ── Asociaciones ─────────────────────────────────────────────────────────────

Compra.hasMany(CompraItem,    { foreignKey: 'compra_id', as: 'items' });
CompraItem.belongsTo(Compra,  { foreignKey: 'compra_id' });
CompraItem.belongsTo(Material,{ foreignKey: 'material_id', as: 'material' });
Compra.belongsTo(Reciclador,  { foreignKey: 'reciclador_id', as: 'reciclador' });
Compra.belongsTo(Bodega,      { foreignKey: 'bodega_id', as: 'bodega' });

Venta.hasMany(VentaItem,      { foreignKey: 'venta_id', as: 'items' });
VentaItem.belongsTo(Venta,    { foreignKey: 'venta_id' });
VentaItem.belongsTo(Material, { foreignKey: 'material_id', as: 'material' });
Venta.belongsTo(Cliente,      { foreignKey: 'cliente_id', as: 'cliente' });
Venta.belongsTo(ClienteSede,  { foreignKey: 'sede_id', as: 'sede' });
Venta.belongsTo(Bodega,       { foreignKey: 'bodega_id', as: 'bodega' });

ClienteSede.belongsTo(Cliente,{ foreignKey: 'cliente_id', as: 'cliente' });
Cliente.hasMany(ClienteSede,  { foreignKey: 'cliente_id', as: 'sedes' });
Cliente.hasMany(MaterialPrecioCliente, { foreignKey: 'cliente_id', as: 'precios' });
MaterialPrecioCliente.belongsTo(Material, { foreignKey: 'material_id', as: 'material' });

Usuario.belongsTo(Bodega,     { foreignKey: 'bodega_id', as: 'bodega' });
Reciclador.belongsTo(Bodega,  { foreignKey: 'bodega_id', as: 'bodega' });
Empleado.belongsTo(Bodega,    { foreignKey: 'bodega_id', as: 'bodega' });
PrestamoEmpleado.belongsTo(Empleado, { foreignKey: 'empleado_id', as: 'empleado' });
DiasNoLaborados.belongsTo(Empleado,  { foreignKey: 'empleado_id', as: 'empleado' });
PrestamoReciclador.belongsTo(Reciclador, { foreignKey: 'reciclador_id', as: 'reciclador' });

Caja.hasMany(MovimientoCaja,  { foreignKey: 'caja_id', as: 'movimientos' });
MovimientoCaja.belongsTo(Caja,{ foreignKey: 'caja_id' });
Caja.belongsTo(Bodega,        { foreignKey: 'bodega_id', as: 'bodega' });

Remision.hasMany(RemisionItem,    { foreignKey: 'remision_id', as: 'items' });
RemisionItem.belongsTo(Remision,  { foreignKey: 'remision_id' });
RemisionItem.belongsTo(Material,  { foreignKey: 'material_id', as: 'material' });
Remision.belongsTo(Cliente,       { foreignKey: 'cliente_id', as: 'cliente' });
Remision.belongsTo(ClienteSede,   { foreignKey: 'sede_id', as: 'sede' });
Remision.belongsTo(Bodega,        { foreignKey: 'bodega_id', as: 'bodega' });
Remision.belongsTo(Venta,         { foreignKey: 'venta_id',  as: 'venta' });
Remision.belongsTo(Compra,        { foreignKey: 'compra_id', as: 'compra' });

Empaque.belongsTo(Reciclador, { foreignKey: 'reciclador_id', as: 'reciclador' });
Empaque.belongsTo(Bodega,     { foreignKey: 'bodega_id', as: 'bodega' });
Certificado.belongsTo(Cliente,{ foreignKey: 'cliente_id', as: 'cliente' });

Vehiculo.hasMany(GastoVehiculo, { foreignKey: 'vehiculo_id', as: 'gastos' });
GastoVehiculo.belongsTo(Vehiculo, { foreignKey: 'vehiculo_id', as: 'vehiculo' });
GastoVehiculo.belongsTo(Bodega,   { foreignKey: 'bodega_id', as: 'bodega' });

module.exports = {
    sequelize, Usuario, Bodega, Material, Reciclador,
    Compra, CompraItem, Cliente, ClienteSede, MaterialPrecioCliente,
    Venta, VentaItem, Empleado, PrestamoEmpleado, DiasNoLaborados,
    PrestamoReciclador, Caja, MovimientoCaja,
    Remision, RemisionItem, Empaque, Certificado,
    Vehiculo, GastoVehiculo
};
