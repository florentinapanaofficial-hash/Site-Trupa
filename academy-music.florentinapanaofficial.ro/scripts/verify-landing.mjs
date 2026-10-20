import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const server = spawn(process.execPath, ['dist/server/entry.mjs'], {
    cwd, env: { ...process.env, HOST: '127.0.0.1', PORT: '0', ASTRO_NODE_LOGGING: 'enabled' },
    stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', (chunk) => { output += chunk; });
server.stderr.on('data', (chunk) => { output += chunk; });
let browser;
try {
    const base = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Server not ready: ${output}`)), 15000);
        server.once('error', (error) => { clearTimeout(timer); reject(error); });
        server.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Server exited: ${code}; ${output}`)); });
        server.stdout.on('data', () => {
            const address = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
            if (address) { clearTimeout(timer); resolve(address); }
        });
    });
    browser = await chromium.launch({ headless: true });
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const errors = [];
        let authCalls = 0;
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('request', (request) => { if (/\/api\/auth\/|supabase\.co/.test(request.url())) authCalls++; });
        await page.goto(base);
        await expect(page.getByRole('heading', { level: 1 })).toContainText('Suport educațional pentru performanță');
        await expect(page.getByRole('link', { name: /Începe Pregătirea Muzicală/ })).toHaveAttribute('href', '/login/');
        await expect(page.getByRole('link', { name: /Vizitează Site-ul/ })).toHaveAttribute('href', 'https://florentinapanaofficial.ro/');
        const magazine = page.getByRole('link', { name: /Explorează Revista/ });
        await expect(magazine).toHaveAttribute('href', 'https://revista.florentinapanaofficial.ro/');
        await expect(magazine).toHaveAttribute('target', '_blank');
        await expect(magazine).toHaveAttribute('rel', 'noopener noreferrer');
        const showcase = page.getByRole('region', { name: 'Descoperă modurile de studiu' });
        await expect(showcase.getByRole('heading', { name: 'Dă voce pasiunii tale.' })).toBeVisible();
        await showcase.getByRole('button', { name: 'Instrument-orgă', exact: true }).click();
        await expect(showcase.getByRole('heading', { name: 'Fiecare clapă, un pas înainte.' })).toBeVisible();
        await expect(showcase.getByRole('button', { name: 'Instrument-orgă', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await expect(showcase.getByRole('heading', { name: 'Dă voce pasiunii tale.' })).toBeHidden();
        await showcase.getByRole('button', { name: 'Teorie', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect(showcase.getByRole('heading', { name: 'Înțelege muzica pe care o cânți.' })).toBeVisible();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `overflow at ${viewport.width}`);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await page.locator('.music-bar').first().evaluate((element) => getComputedStyle(element).animationName), 'none');
        assert.equal(authCalls, 0, 'anonymous landing must not initialize auth');
        assert.deepEqual(errors, []);
        if (process.env.ACADEMY_SCREENSHOT_DIR) {
            await mkdir(process.env.ACADEMY_SCREENSHOT_DIR, { recursive: true });
            await page.screenshot({ path: `${process.env.ACADEMY_SCREENSHOT_DIR}\\academy-landing-${viewport.width}.png`, fullPage: true });
        }
        await page.getByRole('link', { name: /Începe Pregătirea Muzicală/ }).click();
        await expect(page).toHaveURL(`${base}/login/`);
        await expect(page.getByRole('button', { name: 'Intră în cont', exact: true })).toBeVisible();
        await context.close();
        console.log(`Landing ${viewport.width}px PASS: public rendering, slides, keyboard, CTA, magazine, reduced motion, no overflow/auth calls/runtime errors.`);
    }
    const noJS = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await noJS.newPage();
    await staticPage.goto(base);
    await expect(staticPage.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(staticPage.getByRole('link', { name: /Începe Pregătirea Muzicală/ })).toBeVisible();
    await expect(staticPage.locator('[data-slide-controls]')).toBeHidden();
    await noJS.close();
    console.log('No JavaScript PASS: hero, first presentation and links remain available.');

    for (const status of [200, 503]) {
        const context = await browser.newContext();
        const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        const accessToken = 'header.' + Buffer.from(JSON.stringify({ session_id: sessionId, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url') + '.signature';
        await context.addInitScript(({ accessToken }) => {
            localStorage.setItem('academy-music-auth', JSON.stringify({ access_token: accessToken, refresh_token: 'test-refresh', expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, token_type: 'bearer', user: { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated' } }));
        }, { accessToken });
        const page = await context.newPage();
        let checked = 0;
        await page.route('**/api/auth/session/', async (route) => {
            checked++;
            assert.equal(route.request().headers().authorization, `Bearer ${accessToken}`);
            await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 200 ? { ok: true } : { error: 'Service unavailable', code: 'security_unavailable' }) });
        });
        await page.route('**/dashboard/', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Dashboard test destination</h1>' }));
        await page.goto(base);
        if (status === 200) await expect(page).toHaveURL(`${base}/dashboard/`);
        else {
            await expect(page.getByRole('alert')).toContainText('Nu am putut verifica sesiunea salvată');
            await expect(page).toHaveURL(`${base}/`);
        }
        assert.equal(checked, 1);
        await context.close();
    }
    console.log('Persistent session PASS: dashboard only after backend validation; outages are shown explicitly.');
} finally {
    if (browser) await browser.close();
    if (server.exitCode === null && server.signalCode === null) {
        const exited = once(server, 'exit'); server.kill(); await exited;
    }
}
