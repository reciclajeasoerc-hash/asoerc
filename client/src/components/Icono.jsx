import React from 'react';

// Íconos de trazo (24×24) para el menú y las tarjetas. Reemplazan los emojis:
// se ven igual en todos los celulares y toman el color del texto (currentColor).
const P = {
    dashboard:     <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
    compras:       <><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.5L21 8H6.2"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/></>,
    ventas:        <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.4"/></>,
    caja:          <><path d="M4 10h16v10H4z"/><path d="M7 10V6h10v4"/><path d="M9 6V3h6v3"/><path d="M8 14h2M14 14h2M8 17h8"/></>,
    recicladores:  <><circle cx="9" cy="8" r="3.2"/><path d="M3 20c.5-3.6 2.8-5.6 6-5.6s5.5 2 6 5.6"/><circle cx="17.5" cy="9" r="2.4"/><path d="M16.5 14.6c2.6.1 4 1.9 4.5 4.9"/></>,
    clientes:      <><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></>,
    empleados:     <><circle cx="12" cy="7.5" r="3.5"/><path d="M5 21c.6-4.3 3.3-6.8 7-6.8s6.4 2.5 7 6.8"/></>,
    remisiones:    <><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h7"/></>,
    vehiculos:     <><path d="M2 6h12v10H2zM14 9h4l3 3.5V16h-7"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></>,
    prestamos:     <><path d="M6 3h9l4 4v14H6z"/><path d="M12.5 9.5c-.4-.6-1-.9-1.8-.9-1 0-1.7.6-1.7 1.4 0 1.9 3.6 1.1 3.6 3 0 .8-.8 1.5-1.9 1.5-.8 0-1.5-.4-1.9-1M10.8 7.5v1.1M10.8 15v1.1"/></>,
    empaques:      <><path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16z"/><path d="M3.5 8 12 12.5 20.5 8M12 12.5v8"/></>,
    materiales:    <><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="4" cy="18" r="1.2"/></>,
    informes:      <><path d="M3 21h18"/><path d="M6 17v-5M11 17V8M16 17v-8M21 17V5"/></>,
    usuarios:      <><circle cx="12" cy="8" r="3.5"/><path d="M5 21c.6-4 3.3-6.4 7-6.4s6.4 2.4 7 6.4"/><path d="M19 4.5l1.3 1.3 2.2-2.3"/></>,
    bodegas:       <><path d="M3 21V9l9-5 9 5v12"/><path d="M7 21v-8h10v8M7 17h10"/></>,
    configuracion: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>,
    manual:        <><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v17H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H13v17h5.5a1.5 1.5 0 0 0 1.5-1.5z"/></>,
    salir:         <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/></>,
    menu:          <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    mas:           <><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></>,
    cerrar:        <><path d="M6 6l12 12M18 6 6 18"/></>,
    agregar:       <><path d="M12 5v14M5 12h14"/></>,
    editar:        <><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></>,
    borrar:        <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></>,
    imprimir:      <><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></>,
    descargar:     <><path d="M12 4v11M7 10l5 5 5-5M4 20h16"/></>,
    buscar:        <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    subir:         <><path d="M7 14l5-5 5 5"/></>,
    bajar:         <><path d="M7 10l5 5 5-5"/></>,
    candado:       <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/></>,
    kilos:         <><path d="M6 8h12l2 12H4z"/><circle cx="12" cy="5" r="2"/></>,
    calendario:    <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
    margen:        <><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></>,
};

export default function Icono({ nombre, tam = 20, grosor = 1.9, style, ...resto }) {
    const trazo = P[nombre];
    if (!trazo) return null;
    return (
        <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...style }} {...resto}>
            {trazo}
        </svg>
    );
}
