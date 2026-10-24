import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL } from '../pages/api/upload-homework.js';

test('homework route returns JSON method/auth failures instead of throwing on locals', async () => {
    const context = (method, headers = {}) => ({ request: new Request('https://academy.test/api/upload-homework/', { method, headers }), locals: { workerEnv: {} } });
    const method = await ALL(context('GET'));
    assert.equal(method.status, 405);
    assert.match(method.headers.get('content-type'), /application\/json/);
    assert.match((await method.json()).error, /Metodă/);
    const unauthorized = await ALL(context('POST'));
    assert.equal(unauthorized.status, 401);
    assert.match((await unauthorized.json()).error, /Autentifică/);
    const crossOrigin = await ALL(context('POST', { Origin: 'https://other.test' }));
    assert.equal(crossOrigin.status, 403);
});

test('homework route passes Cloudflare worker configuration to the upload handler', async (t) => {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async (request) => {
        calls++;
        assert.match(String(request instanceof Request ? request.url : request), /^https:\/\/configured\.supabase\.co\/auth\/v1\/user/);
        return new Response(JSON.stringify({ message: 'Invalid JWT', code: 'bad_jwt' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    });
    const response = await ALL({
        request: new Request('https://academy.test/api/upload-homework/', { method: 'POST', headers: { Authorization: 'Bearer route-test-token' } }),
        locals: { workerEnv: {
            VITE_SUPABASE_URL: 'https://configured.supabase.co', VITE_SUPABASE_ANON_KEY: 'test-anon-key',
            GOOGLE_DRIVE_FOLDER_ID: 'test-folder', GOOGLE_CREDENTIALS: '{}',
        } },
    });
    assert.equal(response.status, 401);
    assert.equal(calls, 1);
    assert.match((await response.json()).error, /Sesiunea a expirat/);
});
