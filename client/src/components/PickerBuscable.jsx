import React, { useState, useRef, useEffect } from 'react';

// Selector con buscador (🔍): escribes y filtra la lista. Sirve para cuando hay
// muchas personas (clientes, recicladores, etc.). Reemplaza a un <select>.
// Props:
//   items: arreglo de objetos
//   value: id seleccionado (string o number)
//   onChange: (id) => void   — recibe el id como string
//   getId:    item => id     (por defecto item.id)
//   getLabel: item => texto  (por defecto item.nombre)
//   placeholder, fontSize, disabled
export default function PickerBuscable({
    items = [], value, onChange,
    getId = it => it.id, getLabel = it => it.nombre,
    placeholder = 'Buscar...', fontSize = 14, disabled = false,
}) {
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const boxRef = useRef(null);

    const seleccionado = items.find(it => String(getId(it)) === String(value));
    const filtro = q.trim().toLowerCase();
    const lista = filtro
        ? items.filter(it => String(getLabel(it) || '').toLowerCase().includes(filtro))
        : items;

    // Cerrar al hacer clic afuera
    useEffect(() => {
        const fn = e => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', fn);
        return () => document.removeEventListener('mousedown', fn);
    }, []);

    const elegir = (it) => { onChange(String(getId(it))); setOpen(false); setQ(''); };

    const inputStyle = {
        width: '100%', minHeight: 42, padding: '9px 34px 9px 36px', borderRadius: 9,
        border: '1.5px solid var(--borde-fuerte)', fontSize, boxSizing: 'border-box',
        background: disabled ? '#f1f5f9' : '#fff', color: 'var(--texto)',
    };

    return (
        <div ref={boxRef} style={{ position: 'relative' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-3)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <input
                type="text"
                disabled={disabled}
                value={open ? q : (seleccionado ? getLabel(seleccionado) : '')}
                onChange={e => { setQ(e.target.value); if (!open) setOpen(true); }}
                onFocus={() => { setOpen(true); setQ(''); }}
                placeholder={seleccionado && !open ? '' : placeholder}
                style={inputStyle}
            />
            {(seleccionado || open) && !disabled && (
                <span onClick={e => { e.preventDefault(); onChange(''); setQ(''); setOpen(false); }}
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--texto-3)', fontSize: fontSize + 1, lineHeight: 1, padding: 6 }}>✕</span>
            )}
            {open && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: '#fff', border: '1.5px solid var(--borde-fuerte)', borderRadius: 10, marginTop: 4,
                    maxHeight: 260, overflowY: 'auto', boxShadow: 'var(--sombra-alta)',
                }}>
                    {lista.length === 0 && (
                        <div style={{ padding: '12px', color: 'var(--texto-3)', fontSize: fontSize - 1 }}>Sin resultados</div>
                    )}
                    {lista.slice(0, 60).map(it => {
                        const activo = String(getId(it)) === String(value);
                        return (
                            <div key={getId(it)}
                                role="button"
                                onClick={e => { e.preventDefault(); elegir(it); }}
                                style={{ padding: '12px 13px', cursor: 'pointer', fontSize, fontWeight: activo ? 700 : 500, background: activo ? 'var(--verde-suave)' : '#fff', color: 'var(--texto)', borderBottom: '1px solid #eef1f4', userSelect: 'none' }}>
                                {getLabel(it)}
                            </div>
                        );
                    })}
                    {lista.length > 60 && (
                        <div style={{ padding: '9px 13px', color: 'var(--texto-3)', fontSize: fontSize - 2 }}>Escribe para afinar la búsqueda…</div>
                    )}
                </div>
            )}
        </div>
    );
}
