const TelegramBot = require('node-telegram-bot-api');
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');
const {
    sequelize,
    Reciclador, PrestamoReciclador,
    Material, Compra, CompraItem, Bodega,
    Cliente, Venta, VentaItem, MaterialPrecioCliente,
    Caja, MovimientoCaja, Remision,
    Empleado, PrestamoEmpleado, Configuracion, Usuario
} = require('../models');
const { Op } = require('sequelize');
const whatsappService = require('./whatsappService');
// Helpers de caja SEGUROS ante concurrencia (mismos que usa la web): evitan que dos
// registros a la vez se pisen la plata. Antes el bot hacía leer-modificar-escribir.
const { obtenerCajaDia, sumarEnCaja, recalcularCaja } = require('../utils/caja');

// ── Estado por chat ───────────────────────────────────────────────────────
const historiales     = new Map();
const fotosPendientes = new Map();
const ultimaOp        = new Map();
const MAX_HISTORIAL   = 20;

function agregarMensaje(chatId, role, content) {
    if (!historiales.has(chatId)) historiales.set(chatId, []);
    const h = historiales.get(chatId);
    h.push({ role, content: String(content) });
    if (h.length > MAX_HISTORIAL) h.splice(0, h.length - MAX_HISTORIAL);
}

// ── Sistema de prompt ─────────────────────────────────────────────────────
const SYSTEM = `Eres el asistente completo de ASOERC ESP, empresa colombiana de reciclaje.
Tienes acceso total al sistema: ventas, compras, caja, recicladores, clientes, empleados, materiales, préstamos y remisiones.

═══ REGLAS CRÍTICAS ═══
1. USA SOLO los datos que el usuario diga explícitamente. Nunca rellenes con inferencias de fotos.
2. CONFIRMACIÓN antes de registrar ventas o compras: muestra resumen y espera "sí"/"confirma"/"dale".
3. Si el usuario dice "cancela"/"borra eso"/"estaba mal" → llama cancelar_ultima_operacion.
4. tipo_pago por defecto: "efectivo". Toda venta efectivo/transferencia va a caja automáticamente.
5. Toda remisión es de COMPRA o de VENTA. Pregunta cuál antes de guardar.
6. Si un material no existe, pregunta el precio y créalo con crear_material.
7. Responde en español, mensajes cortos y claros. Montos: "566 mil"=566000, "1.2 millones"=1200000.
8. NUNCA inventes IDs; búscalos siempre con las herramientas.

Fecha: ${new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

// ── Herramientas ──────────────────────────────────────────────────────────
const TOOLS = [
    // ── Materiales ────────────────────────────────────────────────────────
    {
        type: 'function', function: {
            name: 'buscar_materiales',
            description: 'Busca materiales por nombre. Devuelve id, nombre y precio de compra.',
            parameters: { type: 'object', properties: { nombres: { type: 'array', items: { type: 'string' } } }, required: ['nombres'] }
        }
    },
    {
        type: 'function', function: {
            name: 'listar_materiales',
            description: 'Lista todos los materiales activos con sus precios de compra.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function', function: {
            name: 'crear_material',
            description: 'Crea un material nuevo si no existe. Usar cuando buscar_materiales devuelva encontrado:false.',
            parameters: {
                type: 'object',
                properties: {
                    nombre:        { type: 'string' },
                    precio_compra: { type: 'number', description: 'Precio de compra por kg en pesos' },
                    categoria:     { type: 'string' }
                },
                required: ['nombre', 'precio_compra']
            }
        }
    },
    // ── Recicladores ──────────────────────────────────────────────────────
    {
        type: 'function', function: {
            name: 'buscar_reciclador',
            description: 'Busca un reciclador por nombre.',
            parameters: { type: 'object', properties: { nombre: { type: 'string' } }, required: ['nombre'] }
        }
    },
    {
        type: 'function', function: {
            name: 'listar_recicladores',
            description: 'Lista todos los recicladores activos con su saldo de préstamo.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function', function: {
            name: 'crear_reciclador',
            description: 'Registra un nuevo reciclador.',
            parameters: {
                type: 'object',
                properties: {
                    nombre:   { type: 'string' },
                    cedula:   { type: 'string' },
                    telefono: { type: 'string' }
                },
                required: ['nombre']
            }
        }
    },
    {
        type: 'function', function: {
            name: 'ver_reciclador',
            description: 'Muestra información detallada de un reciclador: préstamos pendientes y últimas compras.',
            parameters: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] }
        }
    },
    // ── Clientes ──────────────────────────────────────────────────────────
    {
        type: 'function', function: {
            name: 'buscar_cliente',
            description: 'Busca un cliente por nombre.',
            parameters: { type: 'object', properties: { nombre: { type: 'string' } }, required: ['nombre'] }
        }
    },
    {
        type: 'function', function: {
            name: 'listar_clientes',
            description: 'Lista todos los clientes activos.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function', function: {
            name: 'crear_cliente',
            description: 'Crea un nuevo cliente.',
            parameters: { type: 'object', properties: { nombre: { type: 'string' }, nit: { type: 'string' }, telefono: { type: 'string' } }, required: ['nombre'] }
        }
    },
    {
        type: 'function', function: {
            name: 'ver_cliente',
            description: 'Muestra información de un cliente y sus últimas ventas.',
            parameters: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] }
        }
    },
    // ── Empleados ─────────────────────────────────────────────────────────
    {
        type: 'function', function: {
            name: 'listar_empleados',
            description: 'Lista todos los empleados activos.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function', function: {
            name: 'crear_empleado',
            description: 'Registra un nuevo empleado.',
            parameters: {
                type: 'object',
                properties: {
                    nombre:   { type: 'string' },
                    cedula:   { type: 'string' },
                    cargo:    { type: 'string' },
                    telefono: { type: 'string' },
                    salario:  { type: 'number' }
                },
                required: ['nombre']
            }
        }
    },
    {
        type: 'function', function: {
            name: 'ver_empleado',
            description: 'Muestra información de un empleado: préstamos pendientes.',
            parameters: { type: 'object', properties: { nombre: { type: 'string' } }, required: ['nombre'] }
        }
    },
    // ── Préstamos ─────────────────────────────────────────────────────────
    {
        type: 'function', function: {
            name: 'registrar_prestamo',
            description: 'Registra un préstamo a un reciclador o empleado.',
            parameters: {
                type: 'object',
                properties: {
                    tipo_persona: { type: 'string', enum: ['reciclador', 'empleado'] },
                    persona_id:   { type: 'integer' },
                    monto:        { type: 'number' },
                    descripcion:  { type: 'string' }
                },
                required: ['tipo_persona', 'persona_id', 'monto']
            }
        }
    },
    {
        type: 'function', function: {
            name: 'ver_prestamos_pendientes',
            description: 'Lista todos los préstamos pendientes de recicladores y empleados.',
            parameters: { type: 'object', properties: {} }
        }
    },
    // ── Operaciones ───────────────────────────────────────────────────────
    {
        type: 'function', function: {
            name: 'registrar_venta',
            description: 'Registra una venta. SOLO llamar cuando el usuario haya confirmado el resumen.',
            parameters: {
                type: 'object',
                properties: {
                    cliente_id:    { type: 'integer' },
                    items: {
                        type: 'array',
                        items: { type: 'object', properties: { material_id: { type: 'integer' }, kilos: { type: 'number' }, precio_unitario: { type: 'number' } }, required: ['material_id', 'kilos', 'precio_unitario'] }
                    },
                    total:         { type: 'number' },
                    tipo_pago:     { type: 'string', enum: ['efectivo', 'transferencia', 'pendiente'] },
                    observaciones: { type: 'string' }
                },
                required: ['cliente_id', 'items', 'total', 'tipo_pago']
            }
        }
    },
    {
        type: 'function', function: {
            name: 'registrar_compra',
            description: 'Registra una compra a reciclador. SOLO llamar cuando el usuario haya confirmado.',
            parameters: {
                type: 'object',
                properties: {
                    reciclador_id: { type: 'integer' },
                    items: {
                        type: 'array',
                        items: { type: 'object', properties: { material_id: { type: 'integer' }, kilos: { type: 'number' }, precio_unitario: { type: 'number' } }, required: ['material_id', 'kilos', 'precio_unitario'] }
                    },
                    observaciones: { type: 'string' }
                },
                required: ['reciclador_id', 'items']
            }
        }
    },
    {
        type: 'function', function: {
            name: 'cancelar_ultima_operacion',
            description: 'Cancela y borra la última venta o compra registrada. Úsalo cuando el usuario diga que algo estuvo mal.',
            parameters: { type: 'object', properties: {} }
        }
    },
    // ── Caja y resúmenes ──────────────────────────────────────────────────
    {
        type: 'function', function: {
            name: 'ver_caja',
            description: 'Consulta el saldo y estado actual de la caja del día.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function', function: {
            name: 'ver_resumen_dia',
            description: 'Resumen completo del día: ventas, compras y saldo de caja.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function', function: {
            name: 'ver_ventas_hoy',
            description: 'Lista todas las ventas del día con cliente y total.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function', function: {
            name: 'ver_compras_hoy',
            description: 'Lista todas las compras finalizadas del día.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function', function: {
            name: 'ver_historial',
            description: 'Muestra las últimas operaciones (ventas y compras) de los últimos N días.',
            parameters: {
                type: 'object',
                properties: { dias: { type: 'integer', description: 'Número de días hacia atrás (default 7)' } }
            }
        }
    },
    // ── Remisiones ────────────────────────────────────────────────────────
    {
        type: 'function', function: {
            name: 'guardar_remision',
            description: 'Guarda una remisión (foto del formulario verde). Toda remisión es de compra o venta.',
            parameters: {
                type: 'object',
                properties: {
                    tipo:         { type: 'string', enum: ['venta', 'compra'] },
                    conductor:    { type: 'string' },
                    numero_orden: { type: 'string', description: 'Número de orden del formulario físico' },
                    venta_id:     { type: 'integer' },
                    compra_id:    { type: 'integer' },
                    observaciones:{ type: 'string' }
                },
                required: ['tipo', 'conductor']
            }
        }
    }
];

// ── Implementación de herramientas ────────────────────────────────────────
const fmt = n => Number(n || 0).toLocaleString('es-CO');

// Usa el helper compartido: busca la caja del día y si no existe la crea con INSERT IGNORE
// (índice único bodega+fecha) → nunca duplica la caja aunque lleguen dos registros a la vez.
async function obtenerOCrearCaja(bodega_id, hoy) {
    return obtenerCajaDia(bodega_id, hoy);
}

async function ejecutarHerramienta(nombre, args, chatId) {
    const hoy = require("../utils/fecha").hoy();
    console.log(`🔧 [${nombre}]`, JSON.stringify(args));

    switch (nombre) {

        // ── Materiales ────────────────────────────────────────────────────
        case 'buscar_materiales': {
            const todos = await Material.findAll({ where: { activo: true } });
            const res = args.nombres.map(n => {
                const nl = n.toLowerCase();
                const m = todos.find(m => m.nombre.toLowerCase() === nl)
                    || todos.find(m => m.nombre.toLowerCase().includes(nl))
                    || todos.find(m => nl.includes(m.nombre.toLowerCase()));
                return m
                    ? { encontrado: true, id: m.id, nombre: m.nombre, precio_compra: parseFloat(m.precio_compra) }
                    : { encontrado: false, nombre_buscado: n, sugerencia: 'Usa crear_material si es nuevo, o pregunta al usuario el precio.' };
            });
            return JSON.stringify(res);
        }

        case 'listar_materiales': {
            const todos = await Material.findAll({ where: { activo: true }, order: [['categoria','ASC'],['nombre','ASC']] });
            return JSON.stringify(todos.map(m => ({ id: m.id, nombre: m.nombre, precio_compra: parseFloat(m.precio_compra), categoria: m.categoria })));
        }

        case 'crear_material': {
            const nombre = args.nombre.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            const codigo = nombre.toLowerCase().replace(/\s+/g,'-') + '-' + Date.now();
            const m = await Material.create({ nombre, codigo, precio_compra: args.precio_compra, categoria: args.categoria || 'Otros', activo: true });
            return JSON.stringify({ ok: true, id: m.id, nombre: m.nombre, precio_compra: parseFloat(m.precio_compra) });
        }

        // ── Recicladores ──────────────────────────────────────────────────
        case 'buscar_reciclador': {
            const todos = await Reciclador.findAll({ where: { activo: true } });
            const nl = args.nombre.toLowerCase();
            const r = todos.find(r => r.nombre.toLowerCase().includes(nl) || nl.includes(r.nombre.toLowerCase()));
            if (!r) return JSON.stringify({ encontrado: false, nombre_buscado: args.nombre, sugerencia: 'Usa crear_reciclador si es nuevo.' });
            return JSON.stringify({ encontrado: true, id: r.id, nombre: r.nombre, saldo_prestamo: parseFloat(r.saldo_prestamo || 0) });
        }

        case 'listar_recicladores': {
            const todos = await Reciclador.findAll({ where: { activo: true }, order: [['nombre','ASC']] });
            return JSON.stringify(todos.map(r => ({ id: r.id, nombre: r.nombre, telefono: r.telefono || '', saldo_prestamo: parseFloat(r.saldo_prestamo || 0) })));
        }

        case 'crear_reciclador': {
            const nombre = args.nombre.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            const r = await Reciclador.create({ nombre, cedula: args.cedula || null, telefono: args.telefono || null, activo: true });
            return JSON.stringify({ ok: true, id: r.id, nombre: r.nombre });
        }

        case 'ver_reciclador': {
            const r = await Reciclador.findByPk(args.id);
            if (!r) return JSON.stringify({ ok: false, error: 'Reciclador no encontrado' });
            const prestamos = await PrestamoReciclador.findAll({ where: { reciclador_id: args.id, pagado: false }, order: [['fecha','DESC']] });
            const compras   = await Compra.findAll({ where: { reciclador_id: args.id, estado: 'finalizada' }, order: [['fecha','DESC']], limit: 5 });
            return JSON.stringify({
                id: r.id, nombre: r.nombre, cedula: r.cedula, telefono: r.telefono,
                saldo_prestamo: parseFloat(r.saldo_prestamo || 0),
                prestamos_pendientes: prestamos.map(p => ({ monto: parseFloat(p.monto), fecha: p.fecha, descripcion: p.descripcion })),
                ultimas_compras: compras.map(c => ({ id: c.id, fecha: c.fecha, total: parseFloat(c.total) }))
            });
        }

        // ── Clientes ──────────────────────────────────────────────────────
        case 'buscar_cliente': {
            const todos = await Cliente.findAll({ where: { activo: true } });
            const nl = args.nombre.toLowerCase();
            const c = todos.find(c => c.nombre.toLowerCase().includes(nl) || nl.includes(c.nombre.toLowerCase()));
            if (!c) return JSON.stringify({ encontrado: false, nombre_buscado: args.nombre, sugerencia: 'Usa crear_cliente si es nuevo.' });
            return JSON.stringify({ encontrado: true, id: c.id, nombre: c.nombre, nit: c.nit || '' });
        }

        case 'listar_clientes': {
            const todos = await Cliente.findAll({ where: { activo: true }, order: [['nombre','ASC']] });
            return JSON.stringify(todos.map(c => ({ id: c.id, nombre: c.nombre, nit: c.nit || '', telefono: c.telefono || '' })));
        }

        case 'crear_cliente': {
            const nombre = args.nombre.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            const c = await Cliente.create({ nombre, nit: args.nit || null, telefono: args.telefono || null, activo: true, tipo_precio: 'fijo' });
            return JSON.stringify({ ok: true, id: c.id, nombre: c.nombre });
        }

        case 'ver_cliente': {
            const c = await Cliente.findByPk(args.id);
            if (!c) return JSON.stringify({ ok: false, error: 'Cliente no encontrado' });
            const ventas = await Venta.findAll({ where: { cliente_id: args.id }, order: [['fecha','DESC']], limit: 5 });
            return JSON.stringify({
                id: c.id, nombre: c.nombre, nit: c.nit || '', telefono: c.telefono || '',
                ultimas_ventas: ventas.map(v => ({ id: v.id, fecha: v.fecha, total: parseFloat(v.total), estado: v.estado }))
            });
        }

        // ── Empleados ─────────────────────────────────────────────────────
        case 'listar_empleados': {
            const todos = await Empleado.findAll({ where: { activo: true }, order: [['nombre','ASC']] });
            return JSON.stringify(todos.map(e => ({ id: e.id, nombre: e.nombre, cargo: e.cargo || '', telefono: e.telefono || '', salario: parseFloat(e.salario || 0) })));
        }

        case 'crear_empleado': {
            const nombre = args.nombre.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            const bodega = await Bodega.findOne({ where: { activa: true } });
            const e = await Empleado.create({
                nombre,
                cedula:   args.cedula   || null,
                cargo:    args.cargo    || null,
                telefono: args.telefono || null,
                salario:  args.salario  || 0,
                bodega_id: bodega?.id   || null,
                activo: true
            });
            return JSON.stringify({ ok: true, id: e.id, nombre: e.nombre, cargo: e.cargo });
        }

        case 'ver_empleado': {
            const todos = await Empleado.findAll({ where: { activo: true } });
            const nl = args.nombre.toLowerCase();
            const e = todos.find(e => e.nombre.toLowerCase().includes(nl));
            if (!e) return JSON.stringify({ ok: false, error: 'Empleado no encontrado' });
            const prestamos = await PrestamoEmpleado.findAll({ where: { empleado_id: e.id, descontado: false }, order: [['fecha','DESC']] });
            return JSON.stringify({
                id: e.id, nombre: e.nombre, cargo: e.cargo || '', cedula: e.cedula || '',
                salario: parseFloat(e.salario || 0),
                prestamos_pendientes: prestamos.map(p => ({ monto: parseFloat(p.monto), fecha: p.fecha, descripcion: p.descripcion })),
                total_prestamos: prestamos.reduce((s, p) => s + parseFloat(p.monto || 0), 0)
            });
        }

        // ── Préstamos ─────────────────────────────────────────────────────
        case 'registrar_prestamo': {
            const hoyDate = hoy;
            if (args.tipo_persona === 'reciclador') {
                const r = await Reciclador.findByPk(args.persona_id);
                if (!r) return JSON.stringify({ ok: false, error: 'Reciclador no encontrado' });
                await PrestamoReciclador.create({ reciclador_id: args.persona_id, monto: args.monto, fecha: hoyDate, descripcion: args.descripcion || 'Préstamo registrado por Telegram', pagado: false });
                await r.update({ saldo_prestamo: parseFloat(r.saldo_prestamo || 0) + args.monto });
                return JSON.stringify({ ok: true, mensaje: `Préstamo de $${fmt(args.monto)} registrado a ${r.nombre}` });
            } else {
                const e = await Empleado.findByPk(args.persona_id);
                if (!e) return JSON.stringify({ ok: false, error: 'Empleado no encontrado' });
                await PrestamoEmpleado.create({ empleado_id: args.persona_id, monto: args.monto, fecha: hoyDate, descripcion: args.descripcion || 'Préstamo registrado por Telegram', descontado: false });
                return JSON.stringify({ ok: true, mensaje: `Préstamo de $${fmt(args.monto)} registrado a ${e.nombre}` });
            }
        }

        case 'ver_prestamos_pendientes': {
            const [recsConPrestamos, empsConPrestamos] = await Promise.all([
                PrestamoReciclador.findAll({ where: { pagado: false }, include: [{ model: Reciclador, as: 'reciclador' }], order: [['fecha','DESC']] }),
                PrestamoEmpleado.findAll({ where: { descontado: false }, include: [{ model: Empleado, as: 'empleado' }], order: [['fecha','DESC']] })
            ]);
            const totalRec = recsConPrestamos.reduce((s, p) => s + parseFloat(p.monto || 0), 0);
            const totalEmp = empsConPrestamos.reduce((s, p) => s + parseFloat(p.monto || 0), 0);
            return JSON.stringify({
                total_pendiente: totalRec + totalEmp,
                recicladores: recsConPrestamos.map(p => ({ persona: p.reciclador?.nombre, monto: parseFloat(p.monto), fecha: p.fecha, descripcion: p.descripcion })),
                empleados: empsConPrestamos.map(p => ({ persona: p.empleado?.nombre, monto: parseFloat(p.monto), fecha: p.fecha, descripcion: p.descripcion }))
            });
        }

        // ── Ventas ────────────────────────────────────────────────────────
        case 'registrar_venta': {
            const bodega = await Bodega.findOne({ where: { activa: true } });
            if (!bodega) return JSON.stringify({ ok: false, error: 'No hay bodega activa.' });
            const esPagada = args.tipo_pago !== 'pendiente';

            const venta = await Venta.create({
                cliente_id: args.cliente_id, bodega_id: bodega.id, fecha: hoy,
                tipo_pago: args.tipo_pago, estado: esPagada ? 'pagada' : 'orden',
                total: args.total,
                observaciones: ['Registrada desde Telegram', args.observaciones].filter(Boolean).join(' | ')
            });
            for (const item of args.items) {
                await VentaItem.create({ venta_id: venta.id, material_id: item.material_id, kilos: item.kilos, precio_unitario: item.precio_unitario, total: item.kilos * item.precio_unitario });
            }

            if (esPagada) {
                const caja = await obtenerOCrearCaja(bodega.id, hoy);
                const hora = new Date().toTimeString().slice(0, 8);
                await MovimientoCaja.create({ caja_id: caja.id, tipo: 'ingreso', concepto: `Venta #${venta.id}`, monto: args.total, hora, referencia: `venta:${venta.id}` });
                await sumarEnCaja(caja.id, 'ingreso', args.total);   // suma atómica O(1), a prueba de carreras
            }

            const fotoPendiente = fotosPendientes.get(chatId);
            if (fotoPendiente) {
                await Remision.create({ tipo: 'venta', venta_id: venta.id, numero_orden: fotoPendiente.numero_orden, conductor: 'Telegram', bodega_id: bodega.id, foto_url: fotoPendiente.url, fecha: hoy, hora_llegada: new Date().toTimeString().slice(0, 5), total_kilos: args.items.reduce((s, i) => s + i.kilos, 0), observaciones: `Remisión venta #${venta.id}${fotoPendiente.numero_orden ? ` · Orden #${fotoPendiente.numero_orden}` : ''}` });
                fotosPendientes.delete(chatId);
            }

            ultimaOp.set(chatId, { tipo: 'venta', id: venta.id });
            return JSON.stringify({ ok: true, venta_id: venta.id, total: args.total, registrado_en_caja: esPagada });
        }

        // ── Compras ───────────────────────────────────────────────────────
        case 'registrar_compra': {
            const bodega = await Bodega.findOne({ where: { activa: true } });
            if (!bodega) return JSON.stringify({ ok: false, error: 'No hay bodega activa.' });

            const compra = await Compra.create({
                reciclador_id: args.reciclador_id, bodega_id: bodega.id, fecha: hoy, estado: 'borrador',
                observaciones: ['Registrada desde Telegram', args.observaciones].filter(Boolean).join(' | ')
            });
            let totalCompra = 0;
            for (const item of args.items) {
                const sub = item.kilos * item.precio_unitario;
                await CompraItem.create({ compra_id: compra.id, material_id: item.material_id, kilos: item.kilos, precio_unitario: item.precio_unitario, total: sub });
                totalCompra += sub;
            }
            // Descontar préstamos pendientes del reciclador (igual que en la web): solo el
            // saldo restante (monto − abonado), con tope en el total de la compra.
            const prestamos = await PrestamoReciclador.findAll({
                where: { reciclador_id: args.reciclador_id, pagado: false },
                order: [['fecha', 'ASC'], ['id', 'ASC']]
            });
            let descuento = 0;
            let disponible = totalCompra;
            for (const p of prestamos) {
                const restante = parseFloat(p.monto) - parseFloat(p.abonado || 0);
                if (restante <= 0) { await p.update({ pagado: true, compra_id: compra.id }); continue; }
                if (disponible <= 0) break;
                const aDescontar = Math.min(restante, disponible);
                const nuevoAbonado = parseFloat(p.abonado || 0) + aDescontar;
                const quedaPagado = nuevoAbonado >= parseFloat(p.monto) - 0.001;
                await p.update({ abonado: nuevoAbonado, pagado: quedaPagado, compra_id: compra.id });
                descuento += aDescontar;
                disponible -= aDescontar;
            }
            const netoCompra = Math.max(0, totalCompra - descuento);
            await compra.update({ total: totalCompra, neto: netoCompra, descuento_prestamo: descuento, estado: 'finalizada' });
            if (descuento > 0) await Reciclador.decrement('saldo_prestamo', { by: descuento, where: { id: args.reciclador_id } });

            const caja = await obtenerOCrearCaja(bodega.id, hoy);
            const hora = new Date().toTimeString().slice(0, 8);
            if (netoCompra > 0) {
                await MovimientoCaja.create({ caja_id: caja.id, tipo: 'egreso', concepto: `Compra #${compra.id}`, monto: netoCompra, hora, referencia: `compra:${compra.id}` });
                await sumarEnCaja(caja.id, 'egreso', netoCompra);   // resta atómica O(1), a prueba de carreras
            }

            try {
                const full = await Compra.findByPk(compra.id, { include: [{ model: CompraItem, as: 'items', include: [{ model: Material, as: 'material' }] }, { model: Reciclador, as: 'reciclador' }] });
                const enviado = await whatsappService.enviarCompra(full).catch(() => false);
                if (enviado) await compra.update({ whatsapp_enviado: true });
            } catch (e) {}

            const fotoPendiente = fotosPendientes.get(chatId);
            if (fotoPendiente) {
                await Remision.create({ tipo: 'compra', compra_id: compra.id, numero_orden: fotoPendiente.numero_orden, conductor: 'Telegram', bodega_id: bodega.id, foto_url: fotoPendiente.url, fecha: hoy, hora_llegada: hora.slice(0,5), total_kilos: args.items.reduce((s, i) => s + i.kilos, 0), observaciones: `Remisión compra #${compra.id}${fotoPendiente.numero_orden ? ` · Orden #${fotoPendiente.numero_orden}` : ''}` });
                fotosPendientes.delete(chatId);
            }

            ultimaOp.set(chatId, { tipo: 'compra', id: compra.id });
            return JSON.stringify({ ok: true, compra_id: compra.id, total: totalCompra, descuento_prestamo: descuento, neto: netoCompra, registrado_en_caja: netoCompra > 0 });
        }

        // ── Cancelar ──────────────────────────────────────────────────────
        case 'cancelar_ultima_operacion': {
            const op = ultimaOp.get(chatId);
            if (!op) return JSON.stringify({ ok: false, mensaje: 'No hay operación reciente para cancelar.' });
            const bodega = await Bodega.findOne({ where: { activa: true } });
            const caja   = bodega ? await Caja.findOne({ where: { bodega_id: bodega.id, fecha: hoy } }) : null;

            if (op.tipo === 'venta') {
                const venta = await Venta.findByPk(op.id);
                if (!venta) return JSON.stringify({ ok: false, mensaje: 'Venta no encontrada.' });
                if (caja) {
                    const mov = await MovimientoCaja.findOne({ where: { caja_id: caja.id, concepto: `Venta #${op.id}` } });
                    if (mov) { await mov.destroy(); await recalcularCaja(caja.id); }
                }
                await VentaItem.destroy({ where: { venta_id: op.id } });
                await venta.destroy();
                ultimaOp.delete(chatId);
                return JSON.stringify({ ok: true, mensaje: `✅ Venta #${op.id} cancelada y revertida de caja.` });
            }

            if (op.tipo === 'compra') {
                const compra = await Compra.findByPk(op.id);
                if (!compra) return JSON.stringify({ ok: false, mensaje: 'Compra no encontrada.' });
                if (caja) {
                    const mov = await MovimientoCaja.findOne({ where: { caja_id: caja.id, concepto: `Compra #${op.id}` } });
                    if (mov) { await mov.destroy(); await recalcularCaja(caja.id); }
                }
                // Restaurar los préstamos que esta compra descontó (revertir abonos y saldo)
                const descPrestamo = parseFloat(compra.descuento_prestamo || 0);
                if (descPrestamo > 0) {
                    let porRestaurar = descPrestamo;
                    const tocados = await PrestamoReciclador.findAll({ where: { compra_id: op.id }, order: [['fecha', 'ASC'], ['id', 'ASC']] });
                    for (const p of tocados) {
                        const yaAbonado = parseFloat(p.abonado || 0);
                        const devolver = Math.min(yaAbonado, porRestaurar);
                        await p.update({ abonado: yaAbonado - devolver, pagado: false, compra_id: null });
                        porRestaurar -= devolver;
                        if (porRestaurar <= 0.001) break;
                    }
                    await Reciclador.increment('saldo_prestamo', { by: descPrestamo, where: { id: compra.reciclador_id } });
                }
                await CompraItem.destroy({ where: { compra_id: op.id } });
                await compra.destroy();
                ultimaOp.delete(chatId);
                return JSON.stringify({ ok: true, mensaje: `✅ Compra #${op.id} cancelada y revertida de caja.` });
            }
            return JSON.stringify({ ok: false, mensaje: 'Tipo desconocido.' });
        }

        // ── Caja y resúmenes ──────────────────────────────────────────────
        case 'ver_caja': {
            const bodega = await Bodega.findOne({ where: { activa: true } });
            if (!bodega) return JSON.stringify({ ok: false, error: 'No hay bodega activa.' });
            const caja = await Caja.findOne({ where: { bodega_id: bodega.id, fecha: hoy } });
            if (!caja) return JSON.stringify({ ok: true, mensaje: 'No hay caja abierta hoy. Saldo: $0' });
            return JSON.stringify({ ok: true, fecha: hoy, estado: caja.estado, saldo_inicial: parseFloat(caja.saldo_inicial), ingresos: parseFloat(caja.total_ingresos), egresos: parseFloat(caja.total_egresos), saldo_final: parseFloat(caja.saldo_final) });
        }

        case 'ver_resumen_dia': {
            const bodega = await Bodega.findOne({ where: { activa: true } });
            const [ventas, compras, caja] = await Promise.all([
                Venta.findAll({ where: { fecha: hoy } }),
                Compra.findAll({ where: { fecha: hoy, estado: 'finalizada' } }),
                bodega ? Caja.findOne({ where: { bodega_id: bodega.id, fecha: hoy } }) : null
            ]);
            return JSON.stringify({
                fecha: hoy,
                ventas:  { cantidad: ventas.length,  total: ventas.reduce((s, v)  => s + parseFloat(v.total  || 0), 0) },
                compras: { cantidad: compras.length, total: compras.reduce((s, c) => s + parseFloat(c.total || 0), 0) },
                saldo_caja: caja ? parseFloat(caja.saldo_final) : 0
            });
        }

        case 'ver_ventas_hoy': {
            const ventas = await Venta.findAll({ where: { fecha: hoy }, include: [{ model: Cliente, as: 'cliente' }], order: [['createdAt','DESC']] });
            return JSON.stringify(ventas.map(v => ({ id: v.id, cliente: v.cliente?.nombre || 'Sin cliente', total: parseFloat(v.total), estado: v.estado, tipo_pago: v.tipo_pago })));
        }

        case 'ver_compras_hoy': {
            const compras = await Compra.findAll({ where: { fecha: hoy, estado: 'finalizada' }, include: [{ model: Reciclador, as: 'reciclador' }], order: [['createdAt','DESC']] });
            return JSON.stringify(compras.map(c => ({ id: c.id, reciclador: c.reciclador?.nombre || 'Sin nombre', total: parseFloat(c.total) })));
        }

        case 'ver_historial': {
            const dias = args.dias || 7;
            const desde = new Date(); desde.setDate(desde.getDate() - dias);
            const desdeStr = desde.toISOString().slice(0, 10);
            const [ventas, compras] = await Promise.all([
                Venta.findAll({ where: { fecha: { [Op.gte]: desdeStr } }, include: [{ model: Cliente, as: 'cliente' }], order: [['fecha','DESC']], limit: 20 }),
                Compra.findAll({ where: { fecha: { [Op.gte]: desdeStr }, estado: 'finalizada' }, include: [{ model: Reciclador, as: 'reciclador' }], order: [['fecha','DESC']], limit: 20 })
            ]);
            return JSON.stringify({
                periodo: `Últimos ${dias} días`,
                ventas:  ventas.map(v  => ({ id: v.id,  fecha: v.fecha,  tipo: 'venta',  persona: v.cliente?.nombre,  total: parseFloat(v.total) })),
                compras: compras.map(c => ({ id: c.id,  fecha: c.fecha,  tipo: 'compra', persona: c.reciclador?.nombre, total: parseFloat(c.total) }))
            });
        }

        // ── Remisiones ────────────────────────────────────────────────────
        case 'guardar_remision': {
            const fotoPendiente = fotosPendientes.get(chatId);
            if (!fotoPendiente) return JSON.stringify({ ok: false, error: 'No hay foto pendiente. Envía primero la foto.' });
            const bodega = await Bodega.findOne({ where: { activa: true } });
            const remision = await Remision.create({
                tipo: args.tipo, conductor: args.conductor, bodega_id: bodega.id,
                foto_url: fotoPendiente.url, fecha: hoy,
                hora_llegada: new Date().toTimeString().slice(0, 5),
                numero_orden: fotoPendiente.numero_orden || args.numero_orden || null,
                total_kilos: 0,
                venta_id:  args.venta_id  || null,
                compra_id: args.compra_id || null,
                observaciones: args.observaciones || `Remisión de ${args.tipo} registrada desde Telegram`
            });
            fotosPendientes.delete(chatId);
            return JSON.stringify({ ok: true, remision_id: remision.id, tipo: args.tipo, conductor: args.conductor });
        }

        default:
            return JSON.stringify({ error: `Herramienta desconocida: ${nombre}` });
    }
}

// ── Agente IA ─────────────────────────────────────────────────────────────
async function procesarConIA(chatId, mensajeUsuario, toolsActivas = TOOLS) {
    if (!process.env.OPENAI_API_KEY) return '⚠️ OpenAI no configurado. Agrega OPENAI_API_KEY al .env';

    agregarMensaje(chatId, 'user', mensajeUsuario);
    const messages = [{ role: 'system', content: SYSTEM }, ...historiales.get(chatId)];

    for (let intento = 0; intento < 10; intento++) {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'gpt-4o-mini', messages, tools: toolsActivas, tool_choice: 'auto', max_tokens: 1000 })
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error.message);

        const choice = data.choices[0];
        messages.push(choice.message);

        if (choice.finish_reason === 'stop' || !choice.message.tool_calls?.length) {
            const respuesta = choice.message.content || '✅ Listo.';
            agregarMensaje(chatId, 'assistant', respuesta);
            return respuesta;
        }

        const toolResults = await Promise.all(
            choice.message.tool_calls.map(async tc => {
                let resultado;
                try {
                    resultado = await ejecutarHerramienta(tc.function.name, JSON.parse(tc.function.arguments), chatId);
                } catch (e) {
                    console.error(`❌ [${tc.function.name}]:`, e.message);
                    resultado = JSON.stringify({ error: e.message });
                }
                console.log(`↩️  [${tc.function.name}]`, resultado.slice(0, 300));
                return { role: 'tool', tool_call_id: tc.id, content: resultado };
            })
        );
        messages.push(...toolResults);
    }

    return '⚠️ No pude completar la operación en el tiempo disponible. Intenta con menos pasos.';
}

// ── Análisis de foto ──────────────────────────────────────────────────────
async function analizarFoto(bot, fileId) {
    if (!process.env.OPENAI_API_KEY) return null;
    try {
        const fileInfo = await bot.getFile(fileId);
        const url = `https://api.telegram.org/file/bot${bot.token}/${fileInfo.file_path}`;
        const resp  = await fetch(url);
        const buffer = Buffer.from(await resp.arrayBuffer());
        const base64 = buffer.toString('base64');
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: [
                    { type: 'text', text: 'Formulario de remisión ASOERC. Extrae número de orden y materiales con kilos escritos a mano. SOLO JSON: {"numero_orden":"...","materiales":[{"nombre":"...","kilos":0}]}. Sin materiales devuelve {"numero_orden":null,"materiales":[]}' },
                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'high' } }
                ]}],
                max_tokens: 400
            })
        });
        const data    = await r.json();
        const content = data.choices?.[0]?.message?.content || '';
        const match   = content.match(/\{[\s\S]*\}/);
        return { datos: match ? JSON.parse(match[0]) : { numero_orden: null, materiales: [] }, buffer };
    } catch (e) { console.error('Foto error:', e.message); return null; }
}

// ── Transcripción audio ───────────────────────────────────────────────────
async function transcribirAudio(bot, fileId) {
    if (!process.env.OPENAI_API_KEY) return null;
    try {
        const fileInfo = await bot.getFile(fileId);
        const url  = `https://api.telegram.org/file/bot${bot.token}/${fileInfo.file_path}`;
        const resp = await fetch(url);
        const buffer = Buffer.from(await resp.arrayBuffer());
        const form = new FormData();
        form.append('file', new Blob([buffer], { type: 'audio/ogg' }), 'audio.ogg');
        form.append('model', 'whisper-1');
        form.append('language', 'es');
        const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }, body: form });
        const d = await r.json();
        return d.text?.trim() || null;
    } catch (e) { return null; }
}

// ── Guardar foto en disco ─────────────────────────────────────────────────
async function guardarFotoEnDisco(buffer, prefijo = 'foto') {
    const filename   = `${prefijo}-${Date.now()}.jpg`;
    const uploadDir  = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, filename), buffer);
    return `/uploads/${filename}`;
}

// ── Permisos por rol ──────────────────────────────────────────────────────
const TOOLS_ROL = {
    superadmin: null, // null = acceso total
    admin:      null,
    vendedor:   ['buscar_materiales','listar_materiales','buscar_cliente','listar_clientes','crear_cliente','ver_cliente',
                 'registrar_venta','cancelar_ultima_operacion','ver_caja','ver_resumen_dia','ver_ventas_hoy','ver_historial','guardar_remision'],
    cajero:     ['ver_caja','ver_resumen_dia','ver_ventas_hoy','ver_compras_hoy','ver_historial','ver_prestamos_pendientes'],
    operador:   ['buscar_materiales','listar_materiales','buscar_reciclador','listar_recicladores','crear_reciclador','ver_reciclador',
                 'registrar_compra','registrar_prestamo','cancelar_ultima_operacion','ver_resumen_dia','ver_compras_hoy','ver_historial','guardar_remision'],
};

const ROL_LABELS = {
    superadmin: '🔑 Super Admin', admin: '🏢 Admin',
    vendedor: '📤 Vendedor', cajero: '💰 Cajero', operador: '♻️ Operador'
};

// ── Autorización por chat ID ──────────────────────────────────────────────
async function obtenerChat(chatId) {
    try {
        // 1) Buscar en Usuarios (fuente principal)
        const usuario = await Usuario.findOne({ where: { telegram_chat_id: String(chatId), activo: true } });
        if (usuario) return { autorizado: true, rol: usuario.rol || 'operador', nombre: usuario.nombre };

        // 2) Fallback: lista JSON en Configuracion
        const conf = await Configuracion.findOne({ where: { clave: 'telegram_chats' } });
        if (!conf || !conf.valor) return { autorizado: true, rol: 'admin', nombre: null };
        const chats = JSON.parse(conf.valor || '[]');
        if (chats.length === 0) return { autorizado: true, rol: 'admin', nombre: null };
        const chat = chats.find(c => String(c.chat_id) === String(chatId));
        if (!chat) return { autorizado: false, rol: null, nombre: null };
        return { autorizado: true, rol: chat.rol || 'operador', nombre: chat.nombre };
    } catch { return { autorizado: true, rol: 'admin', nombre: null }; }
}

// ── Anti-reproceso persistente + cola serial por chat ─────────────────────────
// Candado en BD: si Telegram reentrega un mensaje viejo (reinicio/redeploy) NO se
// vuelve a registrar la operación. La tabla se crea al arrancar el bot.
async function yaRegistrado(chatId, messageId) {
    if (!messageId) return false;
    try {
        await sequelize.query('INSERT INTO mensajes_procesados (clave, created_at) VALUES (?, NOW())', { replacements: [`${chatId}:${messageId}`] });
        return false;
    } catch { return true; }   // choca la PK → ese mensaje ya se había procesado
}
// Cola serial POR CHAT: los mensajes de un MISMO usuario se atienden uno por uno (evita
// carreras si manda dos seguidos), pero chats distintos siguen en paralelo (no frena a todos).
const colasChat = new Map();
function encolar(chatId, fn) {
    const prev = colasChat.get(chatId) || Promise.resolve();
    const next = prev.then(fn, fn);
    colasChat.set(chatId, next);
    next.finally(() => { if (colasChat.get(chatId) === next) colasChat.delete(chatId); });
    return next;
}

// ── Bot ───────────────────────────────────────────────────────────────────
// Maneja un mensaje entrante. Recibe la instancia de bot que lo recibió, para
// soportar VARIOS bots (varios tokens) corriendo a la vez con las mismas funciones.
async function manejarMensaje(bot, msg) {
        const chatId = msg.chat.id;
        if (await yaRegistrado(chatId, msg.message_id)) return;   // ya procesado (reentrega/redeploy)
        try {
            // Verificar autorización y obtener rol
            const { autorizado, rol, nombre } = await obtenerChat(chatId);
            if (!autorizado) {
                await bot.sendMessage(chatId,
                    `⛔ *Sin acceso*\n\nTu chat ID es: \`${chatId}\`\n\nPide al administrador que te agregue en *Configuración → Bot Telegram* del sistema ASOERC.`,
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            // Filtrar herramientas permitidas según el rol
            const toolsPermitidas = TOOLS_ROL[rol];
            const toolsActivas = toolsPermitidas ? TOOLS.filter(t => toolsPermitidas.includes(t.function.name)) : TOOLS;

            let textoParaIA = '';

            // ── Foto ──────────────────────────────────────────────────────
            if (msg.photo) {
                const fileId = msg.photo[msg.photo.length - 1].file_id;
                await bot.sendMessage(chatId, '🔍 Analizando foto...');

                const resultado = await analizarFoto(bot, fileId);
                if (!resultado) { await bot.sendMessage(chatId, '❌ No pude analizar la foto.'); return; }

                const fotoUrl = await guardarFotoEnDisco(resultado.buffer, 'remision');
                const caption = (msg.caption || '').trim();
                const datos   = resultado.datos;
                fotosPendientes.set(chatId, { url: fotoUrl, numero_orden: datos?.numero_orden || null });

                if (datos?.materiales?.length) {
                    const lineas = datos.materiales.map(m => `  • ${m.nombre}: *${m.kilos} kg*`).join('\n');
                    const enc = datos.numero_orden ? `📌 Orden: *#${datos.numero_orden}*\n\n` : '';
                    await bot.sendMessage(chatId,
                        `📋 *Datos detectados (solo referencia):*\n\n${enc}${lineas}\n\n` +
                        `¿Es de *compra* 📥 (reciclador trae material) o de *venta* 📤 (cliente recibe material)?\n` +
                        `Dime los datos exactos y lo registro.`,
                        { parse_mode: 'Markdown' }
                    );
                    const resumen = datos.materiales.map(m => `${m.nombre} ${m.kilos}kg`).join(', ');
                    agregarMensaje(chatId, 'user', `[Foto recibida. Orden #${datos.numero_orden || '—'}. Referencia visual: ${resumen}. IMPORTANTE: esperar que el usuario confirme los datos exactos.]`);
                    agregarMensaje(chatId, 'assistant', `Foto analizada. Mostré datos como referencia. Esperando que el usuario indique si es compra o venta y los datos exactos.`);
                    if (caption) textoParaIA = caption; else return;
                } else {
                    await bot.sendMessage(chatId,
                        `📷 *Foto guardada.*\nNo detecté materiales claros.\n\n¿Es de *compra* o *venta*? Dime los datos.`,
                        { parse_mode: 'Markdown' }
                    );
                    agregarMensaje(chatId, 'user', `[Foto sin datos claros. ${caption ? `Usuario: "${caption}"` : 'Esperando instrucciones.'}]`);
                    agregarMensaje(chatId, 'assistant', 'Foto guardada sin datos. Esperando instrucciones.');
                    if (caption) textoParaIA = caption; else return;
                }
            }

            // ── Audio ─────────────────────────────────────────────────────
            else if (msg.voice || msg.audio) {
                const fileId = msg.voice?.file_id || msg.audio?.file_id;
                const tx = await transcribirAudio(bot, fileId);
                if (!tx) { await bot.sendMessage(chatId, '❌ No pude transcribir el audio.'); return; }
                await bot.sendMessage(chatId, `🎤 _"${tx}"_`, { parse_mode: 'Markdown' });
                textoParaIA = tx;
            }

            // ── Texto ─────────────────────────────────────────────────────
            else if (msg.text) {
                textoParaIA = msg.text;
                if (textoParaIA === '/backup' || textoParaIA === '/respaldo') {
                    if (!['superadmin', 'admin'].includes(rol)) { await bot.sendMessage(chatId, '⛔ Solo un administrador puede generar respaldos.'); return; }
                    await bot.sendMessage(chatId, '🗄️ Generando respaldo, un momento...');
                    try {
                        const { nombre, buffer, kb } = await generarBackup();
                        await bot.sendDocument(chatId, buffer, { caption: `🗄️ Respaldo manual ASOERC · ${kb} KB · guárdalo en lugar seguro` }, { filename: nombre, contentType: 'application/gzip' });
                    } catch (e) { await bot.sendMessage(chatId, '❌ Error generando respaldo: ' + e.message); }
                    return;
                }
                if (textoParaIA === '/start' || textoParaIA === '/ayuda') {
                    historiales.delete(chatId);
                    fotosPendientes.delete(chatId);
                    ultimaOp.delete(chatId);
                    const rolLabel = ROL_LABELS[rol] || rol;
                    await bot.sendMessage(chatId,
                        `♻️ *Asistente ASOERC*\n🆔 Chat ID: \`${chatId}\`  |  ${rolLabel}\n\n` +
                        `*Operaciones:*\n` +
                        `• _"Venta a Camilo: cartón 40 kg, 566 mil en efectivo"_\n` +
                        `• _"Compra a Juan: pasta 590 kg"_\n` +
                        `• _"Eso estaba mal, cancela"_ → deshace lo último\n\n` +
                        `*Consultas:*\n` +
                        `• _"¿Cuánto hay en caja?"_\n` +
                        `• _"Muéstrame los recicladores"_\n` +
                        `• _"¿Qué préstamos hay pendientes?"_\n` +
                        `• _"Ventas de los últimos 7 días"_\n\n` +
                        `*Registros:*\n` +
                        `• _"Crea el empleado Pedro García, cargo operador"_\n` +
                        `• _"Registra préstamo de 50 mil a Juan"_\n` +
                        `• _"Nuevo reciclador: María López, tel 3100000000"_\n\n` +
                        `• Envía foto de remisión → la analizo y registro\n` +
                        `• Envía audio → lo transcribo`,
                        { parse_mode: 'Markdown' }
                    );
                    return;
                }
            } else { return; }

            if (!textoParaIA.trim()) return;

            await bot.sendChatAction(chatId, 'typing');
            const respuesta = await procesarConIA(chatId, textoParaIA, toolsActivas);
            await bot.sendMessage(chatId, respuesta, { parse_mode: 'Markdown' });

        } catch (err) {
            console.error('Bot error:', err.message, err.stack);
            bot.sendMessage(chatId, `❌ Error: ${err.message}`).catch(() => {});
        }
}

// ── Respaldo (backup) diario de la base de datos ───────────────────────────
const bots = []; // instancias activas, para enviar el respaldo por Telegram

// Genera un volcado COMPLETO de la BD (todas las tablas) comprimido en .gz
async function generarBackup() {
    const dump = { _meta: { sistema: 'ASOERC', generado: new Date().toISOString() } };
    for (const [nombre, modelo] of Object.entries(sequelize.models)) {
        try { dump[nombre] = await modelo.findAll({ raw: true }); }
        catch (e) { dump[nombre] = { _error: e.message }; }
    }
    const gz = zlib.gzipSync(Buffer.from(JSON.stringify(dump), 'utf8'));
    const fecha = require("../utils/fecha").hoy();
    return { nombre: `backup-asoerc-${fecha}.json.gz`, buffer: gz, kb: Math.round(gz.length / 1024) };
}

// A qué chats de Telegram se manda el respaldo (BACKUP_CHAT_ID, o superadmins/admins vinculados)
async function chatsParaBackup() {
    if (process.env.BACKUP_CHAT_ID)
        return String(process.env.BACKUP_CHAT_ID).split(',').map(s => s.trim()).filter(Boolean);
    try {
        const admins = await Usuario.findAll({ where: { telegram_chat_id: { [Op.ne]: null }, activo: true } });
        const ids = admins.filter(u => ['superadmin', 'admin'].includes(u.rol)).map(u => u.telegram_chat_id);
        if (ids.length) return ids;
        const conf = await Configuracion.findOne({ where: { clave: 'telegram_chats' } });
        if (conf?.valor) return JSON.parse(conf.valor).map(c => String(c.chat_id));
    } catch (e) { console.error('chatsParaBackup:', e.message); }
    return [];
}

async function enviarBackupDiario() {
    if (!bots.length) return;
    try {
        const { nombre, buffer, kb } = await generarBackup();
        const chats = await chatsParaBackup();
        if (!chats.length) {
            console.warn('⚠️  Respaldo generado pero sin chat destino. Define BACKUP_CHAT_ID o vincula un superadmin en Telegram.');
            return;
        }
        const caption = `🗄️ Respaldo diario ASOERC · ${new Date().toLocaleDateString('es-CO')} · ${kb} KB\nGuárdalo. Para restaurar, envíalo a soporte (AI Company CO).`;
        for (const chatId of chats) {
            await bots[0].sendDocument(chatId, buffer, { caption }, { filename: nombre, contentType: 'application/gzip' })
                .catch(e => console.error(`Backup -> ${chatId}:`, e.message));
        }
        console.log(`✅ Respaldo diario enviado a ${chats.length} chat(s) (${kb} KB)`);
    } catch (e) { console.error('enviarBackupDiario:', e.message); }
}

// Programa el respaldo todos los días a las 01:00 hora Colombia (06:00 UTC)
function programarBackupDiario() {
    const MS_DIA = 24 * 60 * 60 * 1000;
    const msHastaProxima = () => {
        const ahora = new Date();
        const prox = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate(), 6, 0, 0));
        if (prox <= ahora) prox.setUTCDate(prox.getUTCDate() + 1);
        return prox - ahora;
    };
    setTimeout(function run() {
        enviarBackupDiario();
        setInterval(enviarBackupDiario, MS_DIA);
    }, msHastaProxima());
    console.log(`🗄️  Respaldo diario programado (próximo en ~${Math.round(msHastaProxima() / 3600000)}h)`);
}

// Inicia uno o VARIOS bots a la vez. Los tokens se leen de TELEGRAM_BOT_TOKEN
// (uno solo, o varios separados por coma) y opcionalmente TELEGRAM_BOT_TOKEN_2.
// Cada token = un bot distinto con las MISMAS funciones (útil para tener el bot
// viejo y el nuevo funcionando juntos).
// ⚠️ Regla de Telegram: un mismo token solo puede estar activo en UN lugar a la
// vez. No uses el mismo token en local y en producción al tiempo (se pelean).
function startBot() {
    const tokens = [...String(process.env.TELEGRAM_BOT_TOKEN || '').split(','), process.env.TELEGRAM_BOT_TOKEN_2 || '']
        .map(t => t.trim())
        .filter(Boolean);
    const unicos = [...new Set(tokens)];
    if (!unicos.length) { console.log('⚠️  TELEGRAM_BOT_TOKEN no configurado'); return; }

    // Tabla del candado anti-reproceso (persistente, sobrevive a redeploys) + limpieza de viejos.
    sequelize.query('CREATE TABLE IF NOT EXISTS mensajes_procesados (clave VARCHAR(80) PRIMARY KEY, created_at DATETIME)')
        .then(() => sequelize.query('DELETE FROM mensajes_procesados WHERE created_at < DATE_SUB(NOW(), INTERVAL 60 DAY)'))
        .catch(() => {});

    unicos.forEach((token, i) => {
        const bot = new TelegramBot(token, { polling: true });
        // Cada mensaje pasa por la cola serial de SU chat (evita carreras del mismo usuario).
        bot.on('message', (msg) => encolar(msg.chat.id, () => manejarMensaje(bot, msg)));
        bot.on('polling_error', err => console.error(`Telegram polling error (bot #${i + 1}):`, err.message));
        bots.push(bot);
        console.log(`🤖 Bot IA ASOERC #${i + 1} iniciado`);
    });

    programarBackupDiario(); // respaldo diario de la BD por Telegram
}

module.exports = { startBot, enviarBackupDiario };
