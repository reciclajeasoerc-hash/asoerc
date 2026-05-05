async function enviarCompra(compra) {
    const token  = process.env.WHATSAPP_TOKEN;
    const phoneId= process.env.WHATSAPP_PHONE_ID;
    if (!token || !phoneId) return false;

    const telefono = compra.reciclador?.whatsapp || compra.reciclador?.telefono;
    if (!telefono) return false;

    // Formatear número colombiano
    let numero = telefono.replace(/\D/g, '');
    if (numero.startsWith('0')) numero = numero.slice(1);
    if (!numero.startsWith('57')) numero = `57${numero}`;

    const fecha = new Date(compra.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const lineas = compra.items?.map(i =>
        `  • ${i.material?.nombre || 'Material'}: ${parseFloat(i.kilos).toFixed(2)} kg × $${parseFloat(i.precio_unitario).toLocaleString('es-CO')} = $${parseFloat(i.total).toLocaleString('es-CO')}`
    ).join('\n') || '';

    const descuento = parseFloat(compra.descuento_prestamo) > 0
        ? `\n💳 Descuento préstamo: -$${parseFloat(compra.descuento_prestamo).toLocaleString('es-CO')}` : '';

    const texto = `♻️ *ASOERC - Compra #${compra.numero}*
📅 Fecha: ${fecha}
👤 ${compra.reciclador?.nombre}
🏪 ${compra.bodega?.nombre || ''}

*Detalle:*
${lineas}

💰 Total bruto: $${parseFloat(compra.total).toLocaleString('es-CO')}${descuento}
✅ *Neto a pagar: $${parseFloat(compra.neto).toLocaleString('es-CO')}*

Gracias por su trabajo 🌿`;

    try {
        const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ messaging_product: 'whatsapp', to: numero, type: 'text', text: { body: texto } })
        });
        const data = await r.json();
        if (data.error) { console.error('WA enviarCompra error:', data.error.message); return false; }
        console.log(`📱 WhatsApp enviado a ${numero}`);
        return true;
    } catch (err) {
        console.error('WA error:', err.message);
        return false;
    }
}

async function enviarMensaje(telefono, texto) {
    const token  = process.env.WHATSAPP_TOKEN;
    const phoneId= process.env.WHATSAPP_PHONE_ID;
    if (!token || !phoneId) return false;
    let numero = telefono.replace(/\D/g, '');
    if (numero.startsWith('0')) numero = numero.slice(1);
    if (!numero.startsWith('57')) numero = `57${numero}`;
    try {
        const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ messaging_product: 'whatsapp', to: numero, type: 'text', text: { body: texto } })
        });
        const data = await r.json();
        return !data.error;
    } catch { return false; }
}

module.exports = { enviarCompra, enviarMensaje };
