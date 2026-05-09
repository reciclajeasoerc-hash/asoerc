import React, { useState, useEffect } from 'react';

export default function InstalarApp() {
    const [prompt, setPrompt] = useState(null);
    const [instalado, setInstalado] = useState(false);
    const [esIOS, setEsIOS] = useState(false);
    const [mostrarIOS, setMostrarIOS] = useState(false);

    useEffect(() => {
        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone;
        setEsIOS(ios);

        const handler = e => { e.preventDefault(); setPrompt(e); };
        window.addEventListener('beforeinstallprompt', handler);
        window.addEventListener('appinstalled', () => { setInstalado(true); setPrompt(null); });
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    if (instalado) return null;

    if (esIOS) return (
        <>
            <button
                onClick={() => setMostrarIOS(v => !v)}
                style={{ background: '#2d7a3f', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                📲 Instalar
            </button>
            {mostrarIOS && (
                <div style={{ position: 'fixed', bottom: 20, left: 16, right: 16, background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 8px 32px rgba(0,0,0,.25)', zIndex: 9999, border: '2px solid #1a5c2a' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: '#1a5c2a' }}>📲 Instalar ASOERC en iPhone/iPad</div>
                    <div style={{ fontSize: 13, color: '#444', lineHeight: 1.6 }}>
                        1. Toca el botón <strong>Compartir</strong> (□↑) en Safari<br />
                        2. Baja y toca <strong>"Agregar a pantalla de inicio"</strong><br />
                        3. Toca <strong>Agregar</strong>
                    </div>
                    <button onClick={() => setMostrarIOS(false)} style={{ marginTop: 14, width: '100%', padding: '10px', background: '#1a5c2a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                        Entendido
                    </button>
                </div>
            )}
        </>
    );

    if (!prompt) return null;

    return (
        <button
            onClick={async () => {
                prompt.prompt();
                const { outcome } = await prompt.userChoice;
                if (outcome === 'accepted') setInstalado(true);
                setPrompt(null);
            }}
            style={{ background: '#2d7a3f', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
            📲 Instalar App
        </button>
    );
}
