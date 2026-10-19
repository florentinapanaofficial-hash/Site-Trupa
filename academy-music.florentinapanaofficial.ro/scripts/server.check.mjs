import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));

test('built standalone server serves JSON APIs, SSR pages and private security headers', { timeout: 60000 }, async (t) => {
    const server = spawn(process.execPath, ['./dist/server/entry.mjs'], {
        cwd,
        env: { ...process.env, HOST: '127.0.0.1', PORT: '0', ASTRO_NODE_LOGGING: 'enabled', JITSI_DOMAIN: 'meet.academy.test' },
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
    const request = (path, options = {}) => fetch(new URL(path, base), { signal: AbortSignal.timeout(10000), ...options });
    const jsonError = async (path, options, status, message) => {
        const response = await request(path, options);
        assert.equal(response.status, status);
        assert.match(response.headers.get('content-type'), /application\/json/);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
        assert.deepEqual(await response.json(), { error: message });
    };

    await t.test('GET upload is JSON 405, not the SPA fallback', async () => {
        await jsonError('/api/upload-homework/', {}, 405, 'Metodă neacceptată.');
    });
    await t.test('POST upload requires authentication before any external write', async () => {
        await jsonError('/api/upload-homework/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, 401, 'Autentifică-te pentru a trimite tema.');
    });
    await t.test('cross-origin POST is denied', async () => {
        await jsonError('/api/upload-homework/', { method: 'POST', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: '{}' }, 403, 'Origine nepermisă.');
    });
    await t.test('unknown API paths stay JSON 404 for GET and POST', async () => {
        for (const method of ['GET', 'POST']) {
            await jsonError('/api/not-an-endpoint/', { method }, 404, 'Endpoint inexistent.');
        }
    });
    await t.test('homepage is ready and direct React routes render with security headers', async () => {
        for (const path of ['/', '/login/', '/canto/', '/admin/canto/', '/cursuri-online/', '/cursuri-online/test-group/']) {
            const response = await request(path);
            assert.equal(response.status, 200, path);
            assert.match(response.headers.get('content-type'), /text\/html/);
            const html = await response.text();
            assert.match(html, /id="root"/);
            assert.match(html, /name="robots" content="noindex, nofollow"/);
            assert.equal(response.headers.get('x-frame-options'), 'DENY');
            assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
            assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
            assert.equal(response.headers.get('cache-control'), 'no-cache');
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
            const response = await request(path);
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
            const response = await request(path);
            assert.equal(response.status, 404, path);
            assert.doesNotMatch(await response.text(), /id="root"/);
        }
    });
    await t.test('trailing slash redirect and static assets remain available', async () => {
        const redirect = await request('/studio', { redirect: 'manual' });
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
