import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Logo ASOERC ───────────────────────────────────────────────────────────
let _logoB64 = null;
async function getLogoB64() {
    if (_logoB64) return _logoB64;
    const resp = await fetch('/logo.png');
    const blob = await resp.blob();
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => { _logoB64 = reader.result; resolve(_logoB64); };
        reader.readAsDataURL(blob);
    });
}

// ─── Categorías de materiales → Industria Final ────────────────────────────
const INDUSTRIAS_FINALES = [
    { categoria: 'Papeles y Cartón',  industria: 'Empacor S.A. y papeles nacionales', keywords: ['carton','cartón','papel','archivo','plegadiza','periodico','periódico'] },
    { categoria: 'Metales',           industria: 'Diaco S.A. y Charala S.A',          keywords: ['metal','hierro','aluminio','cobre','acero','chatarra','lata'] },
    { categoria: 'Plásticos',         industria: 'Biocirculo',                          keywords: ['plastico','plástico','pet','polietileno','pvc','bolsa','garrafa'] },
    { categoria: 'Vidrio',            industria: 'Peldar S.A.',                         keywords: ['vidrio','botella'] },
    { categoria: 'Madera',            industria: 'Maderas Montoya',                     keywords: ['madera'] },
    { categoria: 'Textil',            industria: 'Gestion ambiental',                   keywords: ['textil','ropa','tela'] },
];

const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function agruparPorCategoria(detalle = []) {
    return INDUSTRIAS_FINALES.map(ind => {
        const kilos = detalle
            .filter(d => ind.keywords.some(kw => (d.material || '').toLowerCase().includes(kw)))
            .reduce((s, d) => s + (parseFloat(d.kilos) || 0), 0);
        return { ...ind, kilos: Math.round(kilos * 10) / 10 };
    });
}

// ─── Certificado de Disposición Final (documento oficial) ─────────────────
export async function exportarCertificadoDisposicionFinal({ cliente, detalle, desde, fechaCertificado }) {
    const logoB64 = await getLogoB64();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 196; // ancho útil
    const L = 14;  // margen izquierdo
    const negro = [0, 0, 0];
    const verde = [26, 92, 42];

    // ── Logo ───────────────────────────────────────────────────────────────
    doc.addImage(logoB64, 'PNG', 13, 8, 26, 26);

    // ── Encabezado derecho ─────────────────────────────────────────────────
    doc.setTextColor(...negro);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ASOCIACIÓN ECO RECICLAJE CAPITAL ERC (ASOERC)', 44, 13);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('NIT. 901.299.762-6', 44, 19);
    doc.setFontSize(7.5);
    doc.text('Registro único de prestadores de servicios públicos SSPD –  tipo prestador  Organización', 44, 24);
    doc.text('autorizada radicado id 45137 / 2022245137404625', 44, 28.5);

    // ── Línea separadora ───────────────────────────────────────────────────
    doc.setDrawColor(...negro);
    doc.setLineWidth(0.5);
    doc.line(L, 35, 210 - L, 35);

    // ── Fecha ──────────────────────────────────────────────────────────────
    const fechaObj = fechaCertificado ? new Date(fechaCertificado + 'T12:00:00') : new Date();
    const diaNum   = fechaObj.getDate();
    const mesNom   = MESES_ES[fechaObj.getMonth()];
    const anioNum  = fechaObj.getFullYear();
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Bogotá, ${String(diaNum).padStart(2,'0')} de ${mesNom} de ${anioNum}.`, L, 43);

    // ── Título ─────────────────────────────────────────────────────────────
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('CERTIFICADO DE DISPOSICIÓN FINAL', 105, 53, { align: 'center' });
    doc.setLineWidth(0.4);
    doc.line(46, 55.5, 164, 55.5);

    // ── Párrafo 1 ─────────────────────────────────────────────────────────
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const p1 = 'La Asociación Eco Reciclaje Capital ERC - ASOERC, es una organización sin ánimo de lucro, con registro en Cámara de Comercio de Bogotá del 4 de julio de 2019, bajo el número 00319729 del libro I de las Entidades sin ánimo de Lucro, en cumplimiento de lo ordenado por el Decreto 2150 de diciembre 5 de 1995, Certificado de Existencia y Representación Legal No. S0056209.';
    const l1 = doc.splitTextToSize(p1, W);
    doc.text(l1, L, 63);
    let y = 63 + l1.length * 5.2 + 3;

    // ── CERTIFICA QUE ─────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CERTIFICA QUE:', 105, y, { align: 'center' });
    y += 5;
    doc.text(cliente.nombre.toUpperCase(), 105, y, { align: 'center' });
    y += 7;

    // ── Párrafo 2 ─────────────────────────────────────────────────────────
    const periodoDate  = desde ? new Date(desde + 'T12:00:00') : fechaObj;
    const mesPeriodo   = MESES_ES[periodoDate.getMonth()];
    const anioPeriodo  = periodoDate.getFullYear();
    const cats         = agruparPorCategoria(detalle);
    const totalKilos   = cats.reduce((s, c) => s + c.kilos, 0);

    doc.setFont('helvetica', 'normal');
    const p2 = `En el mes de ${mesPeriodo} ${anioPeriodo}, recibió en las instalaciones de ASOERC la cantidad de ${totalKilos.toFixed(1)} kilos de MPR (Materiales Potencialmente Reciclables) dicho aporte de MPR es considerada una acción comprendida en el ámbito de RSE (Responsabilidad  Social Empresarial) y de Responsabilidad Ambiental Empresarial.`;
    const l2 = doc.splitTextToSize(p2, W);
    doc.text(l2, L, y);
    y += l2.length * 5.2 + 4;

    doc.text('A continuación, relacionamos los materiales recibidos:', L, y);
    y += 5;

    // ── Tabla de materiales ────────────────────────────────────────────────
    const mesTabla = mesPeriodo.toUpperCase();
    autoTable(doc, {
        startY: y,
        head: [['MES', 'MATERIAL', 'INDUSTRIA FINAL', 'CANTIDAD']],
        body: cats.map((c, i) => [
            i === 0 ? mesTabla : '',
            c.categoria,
            c.industria,
            c.kilos > 0 ? c.kilos.toFixed(1) : '0'
        ]),
        theme: 'grid',
        headStyles: { fillColor: [255,255,255], textColor: negro, fontStyle: 'bold', fontSize: 9, lineColor: negro, lineWidth: 0.3 },
        bodyStyles: { fontSize: 9, textColor: negro, lineColor: negro, lineWidth: 0.3, fillColor: [255,255,255] },
        columnStyles: {
            0: { cellWidth: 18, halign: 'center', valign: 'middle' },
            1: { cellWidth: 42 },
            2: { cellWidth: 96 },
            3: { cellWidth: 24, halign: 'center' }
        },
        margin: { left: L, right: L },
    });
    y = doc.lastAutoTable.finalY + 7;

    // ── Párrafo 3 ─────────────────────────────────────────────────────────
    const p3 = 'De acuerdo a lo anterior se buscan un sistema de ordenamiento que permita la disminución de los residuos a disponer en los rellenos sanitarios impulsando como prioridad el aprovechamiento, creando los planes de gestión integral de residuos sólidos (PGIRS) referenciado en el decreto 2981 de 2013, así como la formalización de los recicladores en el servicio público de aprovechamiento en el marco del servicio público de aseo Decreto 596 de 2016 y Resolución 276 de 2016.';
    const l3 = doc.splitTextToSize(p3, W);
    doc.text(l3, L, y);
    y += l3.length * 5.2 + 6;

    // ── Párrafo 4 ─────────────────────────────────────────────────────────
    const p4 = 'Sin otro particular, agradecemos su atención y quedamos atentos a responder sus inquietudes o comentarios por medio del correo asoerc@hotmail.com o al WhatsApp 3219544178/3144630299.';
    const l4 = doc.splitTextToSize(p4, W);
    doc.text(l4, L, y);
    y += l4.length * 5.2 + 7;

    doc.text('Cordialmente,', L, y);
    y += 22;

    // ── Firma ──────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.text('FREDI HERNANDEZ JAIME', L, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('Representante Legal', L, y);

    // ── Pie de página ──────────────────────────────────────────────────────
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('Bogotá D.C. Carrera 58b # 132ª-40 barrio ciudad jardín norte  teléfonos 3219544178 / 3144630299', 105, 287, { align: 'center' });

    const nombre = `Certificado-${(cliente.nombre || 'cliente').replace(/\s+/g,'-')}-${mesPeriodo}-${anioPeriodo}`;
    doc.save(`${nombre}.pdf`);
}

// ─── Excel genérico ────────────────────────────────────────────────────────
export function exportarExcel(hojas, nombreArchivo) {
    const wb = XLSX.utils.book_new();
    for (const { nombre, datos } of hojas) {
        const ws = XLSX.utils.json_to_sheet(datos);
        // Ancho automático
        const cols = Object.keys(datos[0] || {}).map(k => ({ wch: Math.max(k.length, 14) }));
        ws['!cols'] = cols;
        XLSX.utils.book_append_sheet(wb, ws, nombre.slice(0, 31));
    }
    XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
}

// ─── PDF genérico ──────────────────────────────────────────────────────────
export async function exportarPDF({ titulo, subtitulo, tablas, nombreArchivo }) {
    const logoB64 = await getLogoB64();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const verde = [26, 92, 42];
    const negro = [0, 0, 0];

    // Encabezado con logo
    doc.addImage(logoB64, 'PNG', 13, 6, 24, 24);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...verde);
    doc.text('ASOCIACIÓN ECO RECICLAJE CAPITAL ERC (ASOERC)', 41, 13);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('NIT. 901.299.762-6', 41, 19);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...negro);
    doc.text(titulo, 41, 26);
    doc.setDrawColor(...verde);
    doc.setLineWidth(0.5);
    doc.line(13, 34, 197, 34);

    let y = 40;
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(9);
    if (subtitulo) { doc.text(subtitulo, 14, y); y += 7; }

    for (const tabla of tablas) {
        if (tabla.titulo) {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...verde);
            doc.text(tabla.titulo, 14, y);
            y += 5;
        }
        autoTable(doc, {
            startY: y,
            head: [tabla.columnas],
            body: tabla.filas,
            theme: 'grid',
            headStyles: { fillColor: verde, textColor: 255, fontStyle: 'bold', fontSize: 9 },
            bodyStyles: { fontSize: 9, textColor: [50, 50, 50] },
            alternateRowStyles: { fillColor: [240, 250, 240] },
            margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 8;
    }

    // Pie de página
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Generado el ${new Date().toLocaleDateString('es-CO')} • Página ${i} de ${totalPages}`, 14, 290);
    }

    doc.save(`${nombreArchivo}.pdf`);
}

const fmt = n => Number(n || 0).toLocaleString('es-CO');

// ─── Informe compras por período ───────────────────────────────────────────
export function exportarInformeComprasExcel({ resumen, por_material, por_reciclador, detalle = [], desde, hasta }) {
    exportarExcel([
        {
            nombre: 'Resumen',
            datos: [{
                'Total compras ($)': resumen.total_pagado,
                '# Compras': resumen.total_compras,
                'Total kilos': resumen.total_kilos,
                'Recicladores': resumen.total_recicladores,
                'Desde': desde,
                'Hasta': hasta
            }]
        },
        {
            nombre: 'Detalle por persona',
            datos: detalle.length ? detalle.map(d => ({
                'Consecutivo día': d.numero_diario ? String(d.numero_diario).padStart(5, '0') : '—',
                'Fecha': d.fecha,
                'Hora': d.hora || '',
                'Reciclador': d.reciclador,
                'Código': d.codigo || '',
                'Material': d.material,
                'Kilos': d.kilos,
                'Precio unitario ($/kg)': d.precio_unitario,
                'Total ($)': d.total
            })) : [{ 'Sin datos': '' }]
        },
        {
            nombre: 'Por material',
            datos: por_material.map(m => ({
                'Material': m.material,
                'Kilos': m.total_kilos,
                'Total pagado ($)': m.total_pagado,
                'Precio promedio ($/kg)': m.precio_promedio
            }))
        },
        {
            nombre: 'Por reciclador',
            datos: por_reciclador.map(r => ({
                'Reciclador': r.reciclador,
                '# Compras': r.total_compras,
                'Kilos': r.total_kilos,
                'Total pagado ($)': r.total_pagado
            }))
        }
    ], `Informe-Compras-${desde}-${hasta}`);
}

export async function exportarInformeComprasPDF({ resumen, por_material, por_reciclador, desde, hasta }) {
    await exportarPDF({
        titulo: `Informe de compras · ${desde} al ${hasta}`,
        subtitulo: `Total: $${fmt(resumen.total_pagado)} | ${resumen.total_compras} compras | ${fmt(resumen.total_kilos)} kg | ${resumen.total_recicladores} recicladores`,
        tablas: [
            {
                titulo: 'Por material',
                columnas: ['Material', 'Kg comprados', 'Total pagado', 'Precio prom./kg'],
                filas: por_material.map(m => [m.material, `${fmt(m.total_kilos)} kg`, `$${fmt(m.total_pagado)}`, `$${fmt(m.precio_promedio)}`])
            },
            {
                titulo: 'Por reciclador',
                columnas: ['Reciclador', '# Compras', 'Kg', 'Total pagado'],
                filas: por_reciclador.map(r => [r.reciclador, r.total_compras, `${fmt(r.total_kilos)} kg`, `$${fmt(r.total_pagado)}`])
            }
        ],
        nombreArchivo: `Informe-Compras-${desde}-${hasta}`
    });
}

// ─── Cierre de caja ────────────────────────────────────────────────────────
export function exportarCajaExcel({ caja, movimientos, fecha }) {
    const resumenDatos = [{
        'Bodega': caja.bodega?.nombre || '',
        'Fecha': fecha,
        'Saldo inicial ($)': Number(caja.saldo_inicial),
        'Ingresos ($)': Number(caja.total_ingresos),
        'Egresos ($)': Number(caja.total_egresos),
        'Saldo final ($)': Number(caja.saldo_final),
        'Estado': caja.estado
    }];
    const movsDatos = movimientos.map(m => ({
        'Hora': m.hora,
        'Tipo': m.tipo,
        'Concepto': m.concepto,
        'Monto ($)': Number(m.monto),
        'Referencia': m.referencia || ''
    }));
    exportarExcel([
        { nombre: 'Resumen caja', datos: resumenDatos },
        { nombre: 'Movimientos', datos: movsDatos.length ? movsDatos : [{ 'Sin movimientos': '' }] }
    ], `Caja-${fecha}`);
}

export async function exportarCajaPDF({ caja, movimientos, fecha }) {
    const verde = [26, 92, 42];
    const ingresos = movimientos.filter(m => m.tipo === 'ingreso');
    const egresos  = movimientos.filter(m => m.tipo === 'egreso');

    await exportarPDF({
        titulo: `Cierre de caja · ${fecha}`,
        subtitulo: `Bodega: ${caja.bodega?.nombre || ''} | Saldo final: $${fmt(caja.saldo_final)}`,
        tablas: [
            {
                titulo: `Ingresos (${ingresos.length})`,
                columnas: ['Hora', 'Concepto', 'Monto'],
                filas: ingresos.length
                    ? ingresos.map(m => [m.hora, m.concepto, `$${fmt(m.monto)}`])
                    : [['—', 'Sin ingresos', '']]
            },
            {
                titulo: `Egresos (${egresos.length})`,
                columnas: ['Hora', 'Concepto', 'Monto'],
                filas: egresos.length
                    ? egresos.map(m => [m.hora, m.concepto, `$${fmt(m.monto)}`])
                    : [['—', 'Sin egresos', '']]
            },
            {
                titulo: 'Resumen',
                columnas: ['Concepto', 'Valor'],
                filas: [
                    ['Saldo inicial', `$${fmt(caja.saldo_inicial)}`],
                    ['Total ingresos', `$${fmt(caja.total_ingresos)}`],
                    ['Total egresos', `$${fmt(caja.total_egresos)}`],
                    ['Saldo final', `$${fmt(caja.saldo_final)}`],
                ]
            }
        ],
        nombreArchivo: `Caja-${fecha}`
    });
}
