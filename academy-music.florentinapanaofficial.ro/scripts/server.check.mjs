import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));

test('built standalone server serves JSON APIs, SSR pages and private security headers', { timeout: 60000 }, async (t) => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const makeToken = (sid) => 'header.' + Buffer.from(JSON.stringify({ sub: userId, session_id: sid, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url') + '.signature';
    const validToken = makeToken(sessionId);
    const rpcCalls = [];
    const signups = [];
    const upstream = createServer(async (req, res) => {
        let text = '';
        for await (const chunk of req) text += chunk;
        const input = text ? JSON.parse(text) : {};
        res.setHeader('Content-Type', 'application/json');
        if (req.url.startsWith('/auth/v1/user')) return res.end(JSON.stringify({ id: userId, aud: 'authenticated', email: 'parent@example.test' }));
        if (req.url.startsWith('/auth/v1/signup')) {
            signups.push(input);
            return res.end(JSON.stringify({ id: userId, email: 'parent@example.test' }));
        }
        if (req.url.startsWith('/auth/v1/token')) {
            if (input.password !== 'correct-password') { res.statusCode = 400; return res.end(JSON.stringify({ code: 'invalid_credentials', msg: 'Invalid login credentials' })); }
            return res.end(JSON.stringify({ access_token: validToken, refresh_token: 'test-refresh-token', token_type: 'bearer', expires_in: 3600, user: { id: userId } }));
        }
        if (req.url === '/rest/v1/rpc/academy_check_session') {
            rpcCalls.push(input);
            return res.end(JSON.stringify(input.p_session_id.startsWith('bbbb') ? 'locked' : input.p_session_id.startsWith('cccc') ? 'replaced' : 'ok'));
        }
        if (req.url === '/rest/v1/rpc/academy_end_session') return res.end('null');
        res.statusCode = 500; res.end(JSON.stringify({ error: 'Unexpected upstream route' }));
    });
    upstream.listen(0, '127.0.0.1');
    await once(upstream, 'listening');
    t.after(() => new Promise((resolve, reject) => upstream.close((error) => error ? reject(error) : resolve())));
    const server = spawn(process.execPath, ['./dist/server/entry.mjs'], {
        cwd,
        env: { ...process.env, HOST: '127.0.0.1', PORT: '0', ASTRO_NODE_LOGGING: 'enabled', JITSI_DOMAIN: 'meet.academy.test', NODE_ENV: 'production', VITE_SUPABASE_URL: `http://127.0.0.1:${upstream.address().port}`, VITE_SUPABASE_ANON_KEY: 'test-anon-key', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', ACADEMY_TRUSTED_IP_HEADER: 'x-forwarded-for', ACADEMY_TRUSTED_PROXY_HOPS: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    server.stdout.on('data', (data) => { output += data; });
    server.stderr.on('data', (data) => { output += data; });
    t.after(async () => {
        if (server.exitCode === null && server.signalCode === null) {
            const exited = once(server, 'exit');
            server.kill();
            await exited;
        }
    });
    const base = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Standalone server did not become ready: ${output}`)), 20000);
        const onExit = (code) => {
            clearTimeout(timer);
            reject(new Error(`Standalone server exited with ${code}: ${output}`));
        };
        server.once('exit', onExit);
        server.once('error', (error) => { clearTimeout(timer); reject(error); });
        server.stdout.on('data', () => {
            const address = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
            if (address) {
                clearTimeout(timer);
                server.off('exit', onExit);
                resolve(address);
            }
        });
    });
    const request = (path, options = {}) => fetch(new URL(path, base), { signal: AbortSignal.timeout(10000), ...options, headers: { 'x-forwarded-for': '198.51.100.10', ...options.headers } });
    const authorized = (path, options = {}) => request(path, { ...options, headers: { Authorization: `Bearer ${validToken}`, ...options.headers } });
    const jsonError = async (path, options, status, message) => {
        const response = await request(path, options);
        assert.equal(response.status, status);
        assert.match(response.headers.get('content-type'), /application\/json/);
        assert.match(response.headers.get('cache-control'), /no-store/);
        assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
        assert.equal((await response.json()).error, message);
    };

    await t.test('GET upload is JSON 405, not the SPA fallback', async () => {
        await jsonError('/api/upload-homework/', { headers: { Authorization: `Bearer ${validToken}` } }, 405, 'Metodă neacceptată.');
    });
    await t.test('POST upload requires authentication before any external write', async () => {
        await jsonError('/api/upload-homework/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, 401, 'Sesiune invalidă. Autentifică-te din nou.');
    });
    await t.test('cross-origin POST is denied', async () => {
        await jsonError('/api/upload-homework/', { method: 'POST', headers: { Origin: 'https://untrusted.example', Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' }, body: '{}' }, 403, 'Origine nepermisă.');
    });
    await t.test('unknown API paths stay JSON 404 for GET and POST', async () => {
        for (const method of ['GET', 'POST']) {
            await jsonError('/api/not-an-endpoint/', { method, headers: { Authorization: `Bearer ${validToken}` } }, 404, 'Endpoint inexistent.');
        }
    });
    await t.test('public landing renders without authentication and exposes only public calls to action', async () => {
        const count = rpcCalls.length;
        const response = await request('/');
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'private, no-store');
        const html = await response.text();
        assert.equal(rpcCalls.length, count, 'anonymous homepage must not query Supabase');
        assert.doesNotMatch(html, /id="root"/);
        assert.match(html, /Suport educațional pentru performanță/);
        assert.match(html, /href="\/login\/"/);
        assert.match(html, /Începe Pregătirea Muzicală/);
        assert.match(html, /https:\/\/florentinapanaofficial.ro\//);
        assert.match(html, /E-Learning by Claudiu Pană/);
        assert.match(html, /href="https:\/\/revista.florentinapanaofficial.ro\/" target="_blank" rel="noopener noreferrer"/);
        assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
        const title = html.match(/<title>(.*?)<\/title>/)?.[1];
        const description = html.match(/name="description" content="([^"]*)"/)?.[1];
        assert.ok(title.length >= 50 && title.length <= 58, title);
        assert.ok(description.length >= 130 && description.length <= 150, description);
        const csp = response.headers.get('content-security-policy');
        for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
            if (script[1]) assert.ok(csp.includes("'sha256-" + createHash('sha256').update(script[1]).digest('base64') + "'"));
        }
    });
    await t.test('authenticated homepage redirects to private dashboard, anonymous dashboard redirects to login', async () => {
        for (const headers of [{ Authorization: 'Bearer ' + validToken }, { Cookie: 'academy-access=' + validToken }]) {
            const response = await request('/', { redirect: 'manual', headers });
            assert.equal(response.status, 303);
            assert.equal(response.headers.get('location'), '/dashboard/');
            assert.equal(response.headers.get('cache-control'), 'private, no-store');
        }
        const response = await request('/dashboard/', { redirect: 'manual' });
        assert.equal(response.status, 303);
        assert.equal(response.headers.get('location'), '/login/?reason=unauthorized');
    });
    await t.test('legacy orga redirects permanently to instrument and disciplines remain private', async () => {
        const legacy = await authorized('/orga/', { redirect: 'manual' });
        assert.equal(legacy.status, 301);
        assert.equal(legacy.headers.get('location'), '/instrument/');
        for (const path of ['/canto/', '/instrument/', '/instrument/claviatura/']) {
            const response = await request(path, { redirect: 'manual' });
            assert.equal(response.status, 303);
            assert.equal(response.headers.get('location'), '/login/?reason=unauthorized');
        }
    });
    await t.test('dashboard and direct React routes render with security headers', async () => {
        for (const path of ['/dashboard/', '/login/', '/register/', '/instrument/', '/instrument/claviatura/', '/canto/', '/admin/canto/', '/cursuri-online/', '/cursuri-online/test-group/']) {
            const response = await authorized(path);
            assert.equal(response.status, 200, path);
            assert.match(response.headers.get('content-type'), /text\/html/);
            const html = await response.text();
            assert.match(html, /id="root"/);
            assert.match(html, /name="robots" content="noindex, nofollow"/);
            assert.equal(response.headers.get('x-frame-options'), 'DENY');
            assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
            assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
            assert.match(response.headers.get('cache-control'), /no-cache|private, no-store/);
            assert.match(response.headers.get('permissions-policy'), /camera=\(self "https:\/\/meet\.academy\.test"\)/);
            const csp = response.headers.get('content-security-policy');
            assert.match(csp, /frame-ancestors 'none'/);
            assert.ok(!csp.includes('unsafe-eval'));
            assert.match(csp, /https:\/\/meet\.academy\.test/);
            for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
                if (script[1]) assert.ok(csp.includes(`'sha256-${createHash('sha256').update(script[1]).digest('base64')}'`));
            }
            const title = html.match(/<title>(.*?)<\/title>/)?.[1];
            const description = html.match(/name="description" content="([^"]*)"/)?.[1];
            assert.ok(title && title.length >= 50 && title.length <= 58, `title: ${title}`);
            assert.ok(description && description.length >= 130 && description.length <= 150, `description: ${description}`);
            for (const image of html.matchAll(/<img\b[^>]*>/gi)) assert.match(image[0], /\balt=/);
        }
    });
    await t.test('SSR studio and magazine render, with inline scripts allowed by CSP', async () => {
        for (const path of ['/studio/', '/revista/', '/revista/notele-muzicale/']) {
            const response = await authorized(path);
            assert.equal(response.status, 200, path);
            const html = await response.text();
            assert.match(html, /<h1[\s>]/);
            const title = html.match(/<title>(.*?)<\/title>/)?.[1];
            const description = html.match(/name="description" content="([^"]*)"/)?.[1];
            assert.ok(title && title.length >= 50 && title.length <= 58, `title: ${title}`);
            assert.ok(description && description.length >= 130 && description.length <= 150, `description: ${description}`);
            for (const image of html.matchAll(/<img\b[^>]*>/gi)) assert.match(image[0], /\balt=/);
            const csp = response.headers.get('content-security-policy');
            assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
            for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
                if (script[1]) assert.ok(csp.includes(`'sha256-${createHash('sha256').update(script[1]).digest('base64')}'`));
            }
        }
    });
    await t.test('missing magazine entries and files do not receive the SPA shell', async () => {
        for (const path of ['/revista/missing-course/', '/missing-file.js', '/studio/missing/']) {
            const response = await authorized(path);
            assert.equal(response.status, 404, path);
            assert.doesNotMatch(await response.text(), /id="root"/);
        }
    });
    await t.test('unauthenticated private pages redirect; revoked sessions carry exact reasons', async () => {
        const anonymous = await request('/canto/', { redirect: 'manual' });
        assert.equal(anonymous.status, 303);
        assert.equal(anonymous.headers.get('location'), '/login/?reason=unauthorized');
        for (const [prefix, reason] of [['bbbbbbbb','locked'],['cccccccc','replaced']]) {
            const response = await request('/canto/', { redirect: 'manual', headers: { Authorization: 'Bearer ' + makeToken(prefix + '-aaaa-4aaa-8aaa-aaaaaaaaaaaa') } });
            assert.equal(response.status, reason === 'locked' ? 403 : 401);
            assert.equal((await response.json()).code, reason);
        }
    });
    await t.test('login registers once, refresh only validates and the cookie is HttpOnly', async () => {
        const response = await request('/api/auth/login/', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ identity: 'test.student', password: 'correct-password' }) });
        assert.equal(response.status, 200, await response.clone().text());
        assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
        assert.match(response.headers.get('set-cookie'), /SameSite=Lax/i);
        assert.equal((await response.json()).session.access_token, validToken);
        assert.equal(rpcCalls.at(-1).p_register, true);
        assert.equal(rpcCalls.at(-1).p_ip, '198.51.100.10');
        const refresh = await authorized('/api/auth/session/', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: '{}' });
        assert.equal(refresh.status, 200);
        assert.equal(rpcCalls.at(-1).p_register, false);
        const page = await request('/canto/', { headers: { Cookie: 'academy-access=' + validToken } });
        assert.equal(page.status, 200);
        assert.equal(page.headers.get('cache-control'), 'private, no-store');
    });
    await t.test('trusted HTTPS proxy preserves origin and sets a Secure cookie', async () => {
        const response = await request('/api/auth/login/', { method: 'POST', headers: {
            Host: 'academy-music.florentinapanaofficial.ro',
            'x-forwarded-proto': 'https', 'x-forwarded-host': 'academy-music.florentinapanaofficial.ro', 'x-forwarded-port': '443',
            Origin: 'https://academy-music.florentinapanaofficial.ro', 'Content-Type': 'application/json',
        }, body: JSON.stringify({ identity: 'test.student', password: 'correct-password' }) });
        assert.equal(response.status, 200, await response.clone().text());
        assert.match(response.headers.get('set-cookie'), /; Secure/i);
    });
    await t.test('server checks parental consent before signUp, records only validated metadata, and rejects CSRF', async () => {
        const body = { fullName: 'Test elev', email: 'parent@example.test', password: 'correct-password' };
        const submit = (input, origin = base) => request('/api/auth/register/', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
        const missing = await submit(body);
        assert.equal(missing.status, 400, await missing.clone().text());
        assert.equal((await submit({ ...body, parentalConsent: 'true' })).status, 400);
        assert.equal(signups.length, 0);
        assert.equal((await submit({ ...body, parentalConsent: true }, 'https://evil.test')).status, 403);
        assert.equal(signups.length, 0);
        assert.equal((await submit({ ...body, parentalConsent: true })).status, 200);
        assert.equal(signups[0].data.parental_consent, true);
        assert.equal(signups[0].data.consent_version, '2026-10-20');
    });
    await t.test('trailing slash redirect and static assets remain available', async () => {
        const redirect = await authorized('/studio', { redirect: 'manual' });
        assert.equal(redirect.status, 301);
        assert.equal(new URL(redirect.headers.get('location'), base).pathname, '/studio/');
        const homepage = await request('/');
        const html = await homepage.text();
        const assetPath = html.match(/src="([^" ]*\/_astro\/[^" ]+\.js)"/)?.[1];
        assert.ok(assetPath, 'compiled homepage script');
        const asset = await request(assetPath);
        assert.equal(asset.status, 200);
        assert.match(asset.headers.get('content-type'), /javascript/);
        assert.match(asset.headers.get('cache-control'), /immutable/);
    });
});
