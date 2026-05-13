const BASE = '/api';

function headers() {
    const token = localStorage.getItem('token');
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function req(method, url, body) {
    const opts = { method, headers: headers() };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${BASE}${url}`, opts);
    const data = await r.json();
    if (!r.ok) throw new Error(data.msg || 'Error en la petición');
    return data;
}

export const api = {
    get:    (url)       => req('GET', url),
    post:   (url, body) => req('POST', url, body),
    put:    (url, body) => req('PUT', url, body),
    delete: (url)       => req('DELETE', url),

    upload: async (url, formData) => {
        const token = localStorage.getItem('token');
        const r = await fetch(`${BASE}${url}`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.msg || 'Error');
        return data;
    },

    uploadPut: async (url, formData) => {
        const token = localStorage.getItem('token');
        const r = await fetch(`${BASE}${url}`, {
            method: 'PUT',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.msg || 'Error');
        return data;
    }
};
