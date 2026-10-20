import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const userId = '11111111-1111-4111-8111-111111111111';
const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const accessToken = 'header.' + Buffer.from(JSON.stringify({ sub: userId, session_id: sessionId, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url') + '.signature';
const profile = { id: userId, full_name: 'Elev Test', role: 'student', is_active: true, disciplines: ['canto', 'orga'] };
const upstream = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.url.startsWith('/auth/v1/user')) return response.end(JSON.stringify({ id: userId }));
    if (request.url === '/rest/v1/rpc/academy_check_session') return response.end('"ok"');
    response.statusCode = 500; response.end('{"error":"Unexpected test request"}');
});
upstream.listen(0, '127.0.0.1');
await once(upstream, 'listening');
const cwd = fileURLToPath(new URL('../', import.meta.url));
const server = spawn(process.execPath, ['dist/server/entry.mjs'], {
    cwd, env: { ...process.env, HOST: '127.0.0.1', PORT: '0', ASTRO_NODE_LOGGING: 'enabled', NODE_ENV: 'production',
        VITE_SUPABASE_URL: `http://127.0.0.1:${upstream.address().port}`, VITE_SUPABASE_ANON_KEY: 'test-anon', SUPABASE_SERVICE_ROLE_KEY: 'test-service',
        ACADEMY_TRUSTED_IP_HEADER: 'x-forwarded-for', ACADEMY_TRUSTED_PROXY_HOPS: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', chunk => { output += chunk; });
server.stderr.on('data', chunk => { output += chunk; });
let browser;
try {
    const base = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Server not ready: ${output}`)), 15000);
        server.once('error', error => { clearTimeout(timer); reject(error); });
        server.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}; ${output}`)); });
        server.stdout.on('data', () => {
            const address = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
            if (address) { clearTimeout(timer); resolve(address); }
        });
    });
    browser = await chromium.launch({ headless: true });
    async function open(viewport, path = '/dashboard/', role = 'student') {
        const context = await browser.newContext({ viewport, extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.1' } });
        await context.addCookies([{ name: 'academy-access', value: accessToken, url: base, httpOnly: true, sameSite: 'Lax' }]);
        await context.addInitScript(({ accessToken, userId }) => {
            localStorage.setItem('academy-music-auth', JSON.stringify({ access_token: accessToken, refresh_token: 'test-refresh', expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, token_type: 'bearer', user: { id: userId, aud: 'authenticated' } }));
        }, { accessToken, userId });
        const page = await context.newPage();
        const errors = [];
        const chunks = [];
        const tables = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => {
            if (request.url().includes('/_astro/') && request.url().endsWith('.js')) chunks.push(new URL(request.url()).pathname);
            if (request.url().includes('/rest/v1/')) tables.push(new URL(request.url()).pathname);
        });
        await page.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: userId }) });
            if (!url.pathname.startsWith('/rest/v1/')) return route.continue();
            const body = url.pathname === '/rest/v1/profiles' ? { ...profile, role }
                : url.pathname === '/rest/v1/rpc/start_activity_session' ? sessionId : [];
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body), headers: { 'Content-Range': '0-0/0' } });
        });
        await page.goto(base + path);
        return { context, page, errors, chunks, tables };
    }

    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
        const { context, page, errors, chunks, tables } = await open(viewport);
        await expect(page.getByRole('heading', { name: 'Ce vrei să studiezi astăzi?' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Deschide Canto', exact: true })).toHaveAttribute('href', '/canto/');
        await expect(page.getByRole('link', { name: 'Deschide Instrument-Orgă', exact: true })).toHaveAttribute('href', '/instrument/');
        assert.equal(chunks.some(path => /\/(Canto|Discipline|VirtualPiano)[.-]/.test(path)), false, chunks.join('\n'));
        assert.equal(tables.some(path => /pieces|submissions|quiz_results/.test(path)), false, 'selection must not fetch discipline content or old stats');
        const summaries = page.locator('summary');
        await summaries.first().focus();
        await page.keyboard.press('Enter');
        await expect(page.getByText(/Lecții, negative și materiale pentru studiul vocal/)).toBeVisible();
        await expect(page).toHaveURL(`${base}/dashboard/`);
        await summaries.nth(1).click();
        await expect(page.getByText('Exerciții, partituri și claviatură virtuală pentru studiul instrumentului.')).toBeVisible();
        const sidebar = page.getByRole('complementary', { name: 'Meniu lateral' });
        if (viewport.width >= 1024) {
            await expect(sidebar).toBeVisible();
            const style = await sidebar.evaluate(element => ({ position: getComputedStyle(element).position, height: element.clientHeight }));
            assert.equal(style.position, 'sticky');
            assert.equal(style.height, viewport.height);
            await page.locator('main').evaluate(element => { const filler = document.createElement('div'); filler.style.height = '2000px'; filler.dataset.testFiller = ''; element.append(filler); });
            await page.evaluate(() => window.scrollTo(0, 900));
            await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
            assert.ok(Math.abs((await sidebar.boundingBox()).y) <= 1, 'sidebar stays pinned while content scrolls');
            await expect(sidebar.getByRole('link', { name: /REVISTA/ })).toBeInViewport();
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.locator('[data-test-filler]').evaluate(element => element.remove());
        } else {
            await page.getByRole('button', { name: 'Meniu', exact: true }).click();
            await expect(page.getByRole('navigation', { name: 'Navigare mobilă' })).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(page.getByRole('navigation', { name: 'Navigare mobilă' })).toBeHidden();
            await page.getByRole('button', { name: 'Meniu', exact: true }).click();
        }
        const nav = page.getByRole('navigation', { name: viewport.width >= 1024 ? 'Navigare principală' : 'Navigare mobilă', exact: true });
        await expect(nav.getByRole('link', { name: /REVISTA/ })).toHaveAttribute('href', 'https://revista.florentinapanaofficial.ro/');
        await expect(nav.getByRole('link', { name: /REVISTA/ })).toHaveAttribute('target', '_blank');
        await expect(nav.getByRole('link', { name: /REVISTA/ })).toHaveAttribute('rel', 'noopener noreferrer');
        await expect(nav.getByRole('link', { name: 'Claviatură virtuală' })).toHaveCount(0);
        if (viewport.width < 1024) await page.getByRole('button', { name: 'Meniu', exact: true }).click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if (process.env.ACADEMY_SCREENSHOT_DIR) {
            await mkdir(process.env.ACADEMY_SCREENSHOT_DIR, { recursive: true });
            await page.screenshot({ path: `${process.env.ACADEMY_SCREENSHOT_DIR}\\academy-dashboard-${viewport.width}.png`, fullPage: true });
        }
        await page.getByRole('link', { name: 'Deschide Canto', exact: true }).click();
        await expect(page.getByRole('region', { name: 'Biblioteca Canto' })).toBeVisible();
        assert.ok(chunks.some(path => /\/Canto[.-]/.test(path)), chunks.join('\n'));
        assert.equal(chunks.some(path => /\/(Discipline|VirtualPiano)[.-]/.test(path)), false);
        if (viewport.width < 1024) await page.getByRole('button', { name: 'Meniu', exact: true }).click();
        await expect(nav.getByRole('link', { name: 'Biblioteca Canto' })).toBeVisible();
        await expect(nav.getByRole('link', { name: 'Claviatură virtuală' })).toHaveCount(0);
        await nav.getByRole('link', { name: 'Alege disciplina' }).click();
        await expect(page.getByRole('heading', { name: 'Ce vrei să studiezi astăzi?' })).toBeVisible();
        await page.getByRole('link', { name: 'Deschide Instrument-Orgă' }).click();
        await expect(page.getByRole('heading', { name: 'Instrument-Orgă', exact: true })).toBeVisible();
        if (viewport.width < 1024) await page.getByRole('button', { name: 'Meniu', exact: true }).click();
        await expect(nav.getByRole('link', { name: 'Biblioteca Canto' })).toHaveCount(0);
        await nav.getByRole('link', { name: 'Claviatură virtuală' }).click();
        await expect(page.getByRole('region', { name: /pian|claviatur/i })).toBeVisible();
        assert.ok(chunks.some(path => /\/VirtualPiano[.-]/.test(path)));
        assert.deepEqual(errors, []);
        await context.close();
        console.log(`Navigation ${viewport.width}px PASS: two cards, accessible Info, contextual menus, REVISTA, scroll and discipline switching.`);
    }
    const isolated = await open({ width: 1440, height: 900 }, '/instrument/');
    await expect(isolated.page.getByRole('heading', { name: 'Instrument-Orgă', exact: true })).toBeVisible();
    assert.equal(isolated.chunks.some(path => /\/(Canto|CantoAudio|VirtualPiano)[.-]/.test(path)), false, isolated.chunks.join('\n'));
    await isolated.context.close();
    const teacher = await open({ width: 1440, height: 900 }, '/dashboard/', 'teacher');
    await expect(teacher.page.getByRole('link', { name: 'Panou profesor' })).toBeVisible();
    await expect(teacher.page.getByRole('switch', { name: 'Comută modul profesor' })).toBeVisible();
    await teacher.page.setViewportSize({ width: 1440, height: 240 });
    const shortSidebar = teacher.page.getByRole('complementary', { name: 'Meniu lateral' });
    assert.equal(await shortSidebar.evaluate(element => getComputedStyle(element).overflowY), 'auto');
    await teacher.page.getByRole('switch', { name: 'Comută modul profesor' }).scrollIntoViewIfNeeded();
    await expect(teacher.page.getByRole('switch', { name: 'Comută modul profesor' })).toBeInViewport();
    assert.ok(await shortSidebar.evaluate(element => element.scrollTop > 0));
    assert.ok(Math.abs((await shortSidebar.boundingBox()).y) <= 1);
    await teacher.context.close();
    console.log('Split loading PASS: direct Instrument does not load Canto-specific modules or piano; teacher navigation preserved.');
} finally {
    if (browser) await browser.close();
    if (server.exitCode === null && server.signalCode === null) { const exited = once(server, 'exit'); server.kill(); await exited; }
    await new Promise((resolve, reject) => upstream.close(error => error ? reject(error) : resolve()));
}
