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
        width: '100%', padding: '9px 30px 9px 30px', borderRadius: 8,
        border: '1px solid #ddd', fontSize, boxSizing: 'border-box',
        background: disabled ? '#f5f5f5' : '#fff', color: '#111',
    };

    return (
        <div ref={boxRef} style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: fontSize - 1, pointerEvents: 'none', opacity: .6 }}>🔍</span>
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
                <span onClick={() => { onChange(''); setQ(''); setOpen(false); }}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#999', fontSize: fontSize + 1, lineHeight: 1 }}>✕</span>
            )}
            {open && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: '#fff', border: '1px solid #ddd', borderRadius: 8, marginTop: 2,
                    maxHeight: 240, overflowY: 'auto', boxShadow: '0 6px 20px rgba(0,0,0,.12)',
                }}>
                    {lista.length === 0 && (
                        <div style={{ padding: '10px 12px', color: '#999', fontSize: fontSize - 1 }}>Sin resultados</div>
                    )}
                    {lista.slice(0, 60).map(it => {
                        const activo = String(getId(it)) === String(value);
                        return (
                            <div key={getId(it)} onClick={() => elegir(it)}
                                style={{ padding: '9px 12px', cursor: 'pointer', fontSize, background: activo ? '#f0faf0' : '#fff', color: '#222', borderBottom: '1px solid #f5f5f5' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f0faf0'}
                                onMouseLeave={e => e.currentTarget.style.background = activo ? '#f0faf0' : '#fff'}>
                                {getLabel(it)}
                            </div>
                        );
                    })}
                    {lista.length > 60 && (
                        <div style={{ padding: '8px 12px', color: '#999', fontSize: fontSize - 2 }}>Escribe para afinar la búsqueda…</div>
                    )}
                </div>
            )}
        </div>
    );
}
