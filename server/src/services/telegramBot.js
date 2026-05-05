const TelegramBot = require('node-telegram-bot-api');
const { Reciclador, Material, Compra, CompraItem, Bodega } = require('../models');
const whatsappService = require('./whatsappService');

// Sesiones activas: chatId -> { compra_id, reciclador_id, bodega_id, paso }
const sesiones = new Map();

let bot;

async function transcribirAudio(fileId) {
    if (!process.env.OPENAI_API_KEY) return null;
    try {
        const fileInfo = await bot.getFile(fileId);
        const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;
        const resp = await fetch(url);
        const buffer = Buffer.from(await resp.arrayBuffer());
        const blob = new Blob([buffer], { type: 'audio/ogg' });
        const form = new FormData();
        form.append('file', blob, 'audio.ogg');
        form.append('model', 'whisper-1');
        form.append('language', 'es');
        const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
            body: form
        });
        const data = await r.json();
        return data.text?.trim() || null;
    } catch (err) {
        console.error('Transcripción error:', err.message);
        return null;
    }
}

function parsearMaterialYKilos(texto) {
    // Ej: "archivo 6 kilos", "cartón 2.5 kg", "pet cristal 10"
    const match = texto.match(/^(.+?)\s+([\d,.]+)\s*(kilo[s]?|kg)?$/i);
    if (!match) return null;
    const nombre = match[1].trim().toLowerCase();
    const kilos  = parseFloat(match[2].replace(',', '.'));
    return { nombre, kilos };
}

async function buscarMaterial(nombre) {
    const materiales = await Material.findAll({ where: { activo: true } });
    const n = nombre.toLowerCase();
    // Búsqueda exacta primero, luego parcial
    return materiales.find(m => m.nombre.toLowerCase() === n)
        || materiales.find(m => m.nombre.toLowerCase().includes(n))
        || materiales.find(m => n.includes(m.nombre.toLowerCase()));
}

async function procesarTexto(chatId, texto) {
    const sesion = sesiones.get(chatId);
    const cmd = texto.toLowerCase().trim();

    // ─── Sin sesión activa ─────────────────────────────────────────────────────
    if (!sesion) {
        if (cmd.startsWith('abrir') || cmd.startsWith('nueva compra')) {
            const nombreRecib = cmd.replace(/abrir\s*(cuenta\s*)?(para\s*)?/i, '').replace(/nueva compra para /i, '').trim();
            if (!nombreRecib) return bot.sendMessage(chatId, 'Escribe: "Abrir cuenta para [nombre del reciclador]"');

            const recicladores = await Reciclador.findAll({ where: { activo: true } });
            const r = recicladores.find(r => r.nombre.toLowerCase().includes(nombreRecib.toLowerCase()));

            if (!r) return bot.sendMessage(chatId, `❌ No encontré al reciclador "${nombreRecib}". Verifica el nombre.`);

            // Detectar bodega del usuario o usar la primera
            const bodegas = await Bodega.findAll({ where: { activa: true } });
            const bodega = bodegas[0];

            const compra = await Compra.create({
                reciclador_id: r.id, bodega_id: bodega.id,
                fecha: new Date().toISOString().slice(0, 10), estado: 'borrador'
            });

            sesiones.set(chatId, { compra_id: compra.id, reciclador: r, bodega });
            return bot.sendMessage(chatId,
                `✅ *Cuenta abierta para ${r.nombre}*\n🏪 Bodega: ${bodega.nombre}\n\nIndica el material y los kilos:\nEjemplo: "Archivo 6 kilos"\n\nDi *"finalizar"* cuando termines.`,
                { parse_mode: 'Markdown' }
            );
        }

        const materiales = await Material.findAll({ where: { activo: true } });
        const lista = materiales.map(m => `  • ${m.nombre}: $${parseFloat(m.precio_compra).toLocaleString('es-CO')}/kg`).join('\n');
        return bot.sendMessage(chatId,
            `♻️ *Bot ASOERC*\n\nComandos:\n• *Abrir cuenta para [nombre]* — iniciar compra\n• *Ver precios* — lista de materiales\n\n*Precios actuales:*\n${lista}`,
            { parse_mode: 'Markdown' }
        );
    }

    // ─── Con sesión activa ─────────────────────────────────────────────────────
    if (cmd === 'finalizar' || cmd === 'listo' || cmd === 'cerrar') {
        const compra = await Compra.findByPk(sesion.compra_id, {
            include: [
                { model: CompraItem, as: 'items', include: [{ model: Material, as: 'material' }] },
                { model: Reciclador, as: 'reciclador' },
                { model: Bodega, as: 'bodega' }
            ]
        });

        if (!compra.items?.length) {
            sesiones.delete(chatId);
            return bot.sendMessage(chatId, '⚠️ Compra cancelada (sin items).');
        }

        // Calcular total
        const total = compra.items.reduce((s, i) => s + parseFloat(i.total), 0);
        await compra.update({ total, neto: total, estado: 'finalizada' });

        // Resumen
        const lineas = compra.items.map(i =>
            `  • ${i.material.nombre}: ${parseFloat(i.kilos).toFixed(2)} kg = $${parseFloat(i.total).toLocaleString('es-CO')}`
        ).join('\n');

        await bot.sendMessage(chatId,
            `✅ *Compra finalizada*\n👤 ${sesion.reciclador.nombre}\n\n${lineas}\n\n💰 *Total: $${total.toLocaleString('es-CO')}*`,
            { parse_mode: 'Markdown' }
        );

        // Enviar WhatsApp al reciclador
        const enviado = await whatsappService.enviarCompra(compra);
        if (enviado) await compra.update({ whatsapp_enviado: true });
        if (enviado) await bot.sendMessage(chatId, '📱 Reporte enviado por WhatsApp al reciclador.');

        sesiones.delete(chatId);
        return;
    }

    if (cmd === 'cancelar') {
        const compra = await Compra.findByPk(sesion.compra_id);
        if (compra) { await CompraItem.destroy({ where: { compra_id: compra.id } }); await compra.destroy(); }
        sesiones.delete(chatId);
        return bot.sendMessage(chatId, '❌ Compra cancelada.');
    }

    if (cmd === 'ver' || cmd === 'resumen') {
        const compra = await Compra.findByPk(sesion.compra_id, {
            include: [{ model: CompraItem, as: 'items', include: [{ model: Material, as: 'material' }] }]
        });
        if (!compra.items?.length) return bot.sendMessage(chatId, 'Aún no hay materiales registrados.');
        const total = compra.items.reduce((s, i) => s + parseFloat(i.total), 0);
        const lineas = compra.items.map(i => `  • ${i.material.nombre}: ${parseFloat(i.kilos).toFixed(2)} kg = $${parseFloat(i.total).toLocaleString('es-CO')}`).join('\n');
        return bot.sendMessage(chatId, `📋 *Resumen actual:*\n${lineas}\n\n💰 Total: $${total.toLocaleString('es-CO')}`, { parse_mode: 'Markdown' });
    }

    // Intentar parsear "Material X kilos"
    const parsed = parsearMaterialYKilos(cmd);
    if (!parsed) return bot.sendMessage(chatId, `No entendí. Escribe: "Material kilos"\nEjemplo: "Archivo 6"\nO di "finalizar" para cerrar.`);

    const material = await buscarMaterial(parsed.nombre);
    if (!material) return bot.sendMessage(chatId, `❌ No encontré el material "${parsed.nombre}". Verifica el nombre.`);

    const precio_unitario = parseFloat(material.precio_compra);
    const total = parsed.kilos * precio_unitario;

    // Sumar si ya existe
    const existente = await CompraItem.findOne({ where: { compra_id: sesion.compra_id, material_id: material.id } });
    if (existente) {
        const nuevosKilos = parseFloat(existente.kilos) + parsed.kilos;
        await existente.update({ kilos: nuevosKilos, total: nuevosKilos * precio_unitario });
    } else {
        await CompraItem.create({ compra_id: sesion.compra_id, material_id: material.id, kilos: parsed.kilos, precio_unitario, total });
    }

    return bot.sendMessage(chatId,
        `✅ *${material.nombre}*: ${parsed.kilos} kg × $${precio_unitario.toLocaleString('es-CO')} = $${total.toLocaleString('es-CO')}\n\nAñade otro material o di "finalizar".`,
        { parse_mode: 'Markdown' }
    );
}

function startBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) { console.log('⚠️  TELEGRAM_BOT_TOKEN no configurado — bot desactivado'); return; }

    bot = new TelegramBot(token, { polling: true });
    console.log('🤖 Bot de Telegram ASOERC iniciado');

    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        try {
            let texto = msg.text || '';

            // Transcribir audio de voz
            if (msg.voice || msg.audio) {
                const fileId = msg.voice?.file_id || msg.audio?.file_id;
                const tx = await transcribirAudio(fileId);
                if (!tx) return bot.sendMessage(chatId, '❌ No pude transcribir el audio. Intenta de nuevo.');
                await bot.sendMessage(chatId, `🎤 Escuché: "${tx}"`);
                texto = tx;
            }

            if (!texto.trim()) return;
            await procesarTexto(chatId, texto);
        } catch (err) {
            console.error('Bot error:', err.message);
            bot.sendMessage(chatId, '❌ Ocurrió un error. Intenta de nuevo.').catch(() => {});
        }
    });

    bot.on('polling_error', (err) => console.error('Telegram polling error:', err.message));
}

module.exports = { startBot };
