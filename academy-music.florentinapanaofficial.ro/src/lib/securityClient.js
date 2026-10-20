export async function authRequest(path, body = {}, token, method = 'POST') {
    const response = await fetch(`/api/auth/${path}/`, {
        method, credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
    });
    if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Serverul nu a returnat răspunsul API de autentificare. Contactează administratorul.');
    }
    const data = await response.json();
    if (!response.ok) {
        const error = new Error(data.error || 'Verificarea securității a eșuat.');
        error.status = response.status;
        error.code = data.code;
        throw error;
    }
    return data;
}
