import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile } from 'node:fs/promises';
import midiPackage from '@tonejs/midi';
import { chromium, expect } from '@playwright/test';
import { startWorkerPreview } from './worker-preview.mjs';

function studyPdf() {
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R >>', '<< /Length 0 >>\nstream\n\nendstream'];
    let text = '%PDF-1.4\n';
    const offsets = [0];
    for (const [i, object] of objects.entries()) { offsets.push(Buffer.byteLength(text)); text += (i + 1) + ' 0 obj\n' + object + '\nendobj\n'; }
    const xref = Buffer.byteLength(text);
    text += 'xref\n0 5\n0000000000 65535 f \n' + offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('');
    return Buffer.from(text + 'trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
}

const userId = '11111111-1111-4111-8111-111111111111';
const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const accessToken = 'header.' + Buffer.from(JSON.stringify({ sub: userId, session_id: sessionId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.signature';
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
const server = startWorkerPreview({ NODE_ENV: 'production', VITE_SUPABASE_URL: `http://127.0.0.1:${upstream.address().port}`, VITE_SUPABASE_ANON_KEY: 'test-anon', SUPABASE_SERVICE_ROLE_KEY: 'test-service' });
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
            localStorage.setItem('academy-music-auth', JSON.stringify({ access_token: accessToken, refresh_token: 'test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user: { id: userId, aud: 'authenticated' } }));
        }, { accessToken, userId });
        if (path.includes('/partituri/')) await context.addInitScript(() => {
            window.__scoreAudio = [];
            const NativeAudioContext = window.AudioContext;
            window.AudioContext = class extends NativeAudioContext {
                createOscillator() {
                    const oscillator = super.createOscillator();
                    const start = oscillator.start.bind(oscillator);
                    oscillator.start = when => { window.__scoreAudio.push({ frequency: oscillator.frequency.value, when, audioTime: this.currentTime }); return start(when); };
                    return oscillator;
                }
            };
        });
        const page = await context.newPage();
        const resources = [{ id: 'resource-id', title: 'Lecție RED', category: 'fisa-teoretica', discipline: 'comun', description: 'Explicații inițiale', external_url: 'https://example.test/lesson', file_path: 'old/resource.pdf' }];
        const rows = [{ id: path.includes('/canto') ? 'canto-piece' : 'orga-piece', discipline: path.includes('/canto') ? 'canto' : 'orga', title: path.includes('/canto') ? 'Piesă canto' : 'Piesă orgă', description: 'Descriere inițială', composer: 'Profesor', level: 'modul_1', is_published: true, positive_url: 'https://example.test/existing.mp3', negative_url: null, tags: [], versuri_text: '', grupa: 'Grupa 1' }];
        const libraryMode = path.includes('/partituri/');
        if (libraryMode) {
            rows.splice(0, rows.length, ...Array.from({ length: 14 }, (_, index) => ({ id: 'score-' + index, title: 'Studiu ' + String(index + 1).padStart(2, '0'), discipline: 'orga', composer: 'Profesor', level: index === 1 ? 'modul_4' : 'modul_1', score_path: 'scores/studiu-' + index + '.pdf', is_published: true })));
        }
        const libraryRequests = [];
        const writes = [], uploads = [], audioJobs = [], unlockRequests = [];
        let insertions = 0;
        let studentLocked = true;
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
            if (url.pathname.startsWith('/storage/v1/object/sign/') && route.request().method() === 'GET' && url.pathname.endsWith('.pdf')) return route.fulfill({ contentType: 'application/pdf', body: studyPdf() });
            if (url.pathname.startsWith('/storage/v1/object/sign/')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedURL: '/object/sign/test.' + (url.pathname.endsWith('.pdf') ? 'pdf' : 'mp3') + '?token=test' }) });
            if (url.pathname.startsWith('/storage/v1/object/')) {
                uploads.push(url.pathname);
                return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ Key: url.pathname }) });
            }
            if (url.pathname === '/api/admin/unlock-user/' && route.request().method() === 'POST') {
                unlockRequests.push(route.request().postDataJSON());
                studentLocked = false;
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'Contul elevului a fost deblocat.' }) });
            }
            if (!url.pathname.startsWith('/rest/v1/')) return route.continue();
            if (url.pathname === '/rest/v1/resources') {
                if (route.request().method() === 'PATCH') {
                    const payload = route.request().postDataJSON();
                    writes.push({ id: url.searchParams.get('id'), payload });
                    Object.assign(resources[0], payload);
                    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(resources[0]) });
                }
                return route.fulfill({ contentType: 'application/json', body: JSON.stringify(resources) });
            }
            if (url.pathname === '/rest/v1/audio_processing_queue') {
                if (route.request().method() === 'POST') {
                    const payload = route.request().postDataJSON();
                    const job = { ...payload, id: 'audio-job', status: 'pending', result_url: null, error_message: null, created_at: '2026-10-21T12:00:00.000Z' };
                    audioJobs.push(job);
                    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(job) });
                }
                return route.fulfill({ contentType: 'application/json', body: JSON.stringify(audioJobs) });
            }
            if (url.pathname === '/rest/v1/pieces') {
                if (libraryMode) {
                    libraryRequests.push(url);
                    let result = rows.filter(row => (!url.searchParams.has('id') || url.searchParams.get('id') === 'eq.' + row.id) && (!url.searchParams.has('level') || url.searchParams.get('level') === 'eq.' + row.level));
                    if (url.searchParams.has('title')) result = result.filter(row => row.title.includes(url.searchParams.get('title').slice(7, -1)));
                    const count = result.length;
                    const offset = Number(url.searchParams.get('offset') || 0);
                    const limit = Number(url.searchParams.get('limit') || count);
                    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(result.slice(offset, offset + limit)), headers: { 'Access-Control-Expose-Headers': 'Content-Range', 'Content-Range': offset + '-' + Math.max(offset, offset + Math.min(limit, count) - 1) + '/' + count } });
                }
                if (route.request().method() === 'PATCH') {
                    const payload = route.request().postDataJSON();
                    writes.push({ id: url.searchParams.get('id'), payload });
                    Object.assign(rows[0], payload);
                    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(rows[0]) });
                }
                if (route.request().method() === 'POST') insertions++;
                return route.fulfill({ contentType: 'application/json', body: JSON.stringify(rows) });
            }
            const studentList = url.pathname === '/rest/v1/profiles' && url.searchParams.get('role') === 'in.(student,elev)';
            const body = url.pathname === '/rest/v1/profiles'
                ? url.searchParams.get('select') === 'id,full_name' ? [] : studentList ? [{ ...profile, role: 'student', is_locked: studentLocked }] : { ...profile, role }
                : url.pathname === '/rest/v1/rpc/start_activity_session' ? sessionId : [];
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body), headers: { 'Content-Range': '0-0/0' } });
        });
        await page.goto(base + path);
        return { context, page, errors, chunks, tables, rows, writes, uploads, audioJobs, libraryRequests, unlockRequests, get insertions() { return insertions; } };
    }

    const unlock = await open({ width: 390, height: 844 }, '/admin/elevi/', 'teacher');
    await expect(unlock.page.getByRole('button', { name: 'Deblochează Elev', exact: true })).toBeVisible();
    await unlock.page.getByRole('button', { name: 'Deblochează Elev', exact: true }).click();
    await expect(unlock.page.getByRole('status')).toHaveText('Contul elevului a fost deblocat.');
    await expect(unlock.page.getByRole('button', { name: 'Deblochează Elev', exact: true })).toHaveCount(0);
    assert.deepEqual(unlock.unlockRequests, [{ user_id: userId }]);
    assert.deepEqual(unlock.errors, []);
    await unlock.context.close();
    console.log('Student unlock PASS: teacher-only table action posts the selected user ID, reports success, and refreshes the locked row.');

    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
        const fixture = await open(viewport, '/admin/piese/', 'teacher');
        const { page, context, errors } = fixture;
        await expect(page.getByRole('heading', { name: 'Repertoriu Orgă', exact: true })).toBeVisible();
        const karaokeButton = page.getByRole('button', { name: '🎛️ Generează Karaoke (SpectraLayers 12)', exact: true });
        await expect(karaokeButton).toBeVisible();
        await karaokeButton.click();
        const karaokeDialog = page.getByRole('dialog', { name: 'Generează Karaoke — Piesă orgă' });
        await karaokeDialog.getByRole('button', { name: '🎛️ Generează Karaoke (SpectraLayers 12)', exact: true }).click();
        await expect(karaokeDialog.getByText('în așteptare')).toBeVisible();
        assert.equal(fixture.audioJobs.length, 1);
        assert.equal(fixture.audioJobs[0].song_id, 'orga-piece');
        assert.equal(fixture.audioJobs[0].original_url, 'https://example.test/existing.mp3');
        await karaokeDialog.getByRole('button', { name: 'Închide' }).click();
        const mainToggle = page.locator('main').getByRole('switch', { name: 'Comută modul profesor' });
        await expect(mainToggle).toHaveAttribute('aria-checked', 'true');
        await page.getByRole('button', { name: 'Editează Piesă orgă', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Editează: Piesă orgă' });
        await expect(dialog.getByLabel('Titlu', { exact: true })).toHaveValue('Piesă orgă');
        await expect(dialog.getByLabel('Descriere / indicații de studiu')).toHaveValue('Descriere inițială');
        await expect(dialog.getByLabel('Disciplină', { exact: true })).toHaveValue('orga');
        await expect(dialog.getByLabel('Nivel', { exact: true })).toHaveValue('modul_1');
        assert.equal(await dialog.getByLabel('Nivel', { exact: true }).locator('option').count(), 5);
        await dialog.getByLabel('Titlu', { exact: true }).fill('Orgă actualizată');
        await dialog.getByLabel('Descriere / indicații de studiu').fill('Indicații noi');
        await dialog.getByLabel('Versuri / text sincronizat (LRC)').fill('[00:01.00]Text nou');
        await dialog.locator('div.rounded-xl').filter({ hasText: 'Negativ' }).getByRole('button', { name: 'Upload MP3' }).click();
        await dialog.getByLabel('Fișier audio Negativ').setInputFiles({ name: 'negative.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3test-audio') });
        await dialog.getByLabel('Partitură (PDF)').setInputFiles({ name: 'score.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 test') });
        await dialog.getByRole('button', { name: 'Salvează modificările', exact: true }).click();
        await expect(dialog).toBeHidden();
        await expect(page.getByRole('cell', { name: 'Orgă actualizată', exact: true })).toBeVisible();
        assert.equal(fixture.writes.length, 1);
        assert.equal(fixture.writes[0].id, 'eq.orga-piece');
        assert.equal(fixture.writes[0].payload.level, 'modul_1');
        assert.equal(fixture.writes[0].payload.description, 'Indicații noi');
        assert.match(fixture.writes[0].payload.audio_negativ_path, /^orga\//);
        assert.match(fixture.writes[0].payload.score_path, /score.pdf$/);
        assert.equal('audio_pozitiv_path' in fixture.writes[0].payload, false);
        assert.equal('created_by' in fixture.writes[0].payload, false);
        assert.equal(fixture.uploads.length, 2);
        assert.equal(fixture.insertions, 0);
        assert.equal(fixture.rows[0].id, 'orga-piece');
        assert.equal(fixture.rows[0].positive_url, 'https://example.test/existing.mp3');
        await mainToggle.click();
        await expect(page.getByRole('heading', { name: 'Instrument-Orgă', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: /Adaugă piesă|Editează|Șterge|Salvează/ })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Panou profesor' })).toHaveCount(0);
        await expect(page.locator('audio')).toHaveCount(2);
        await expect(page).toHaveURL(base + '/admin/piese/');
        const visibleSwitches = page.getByRole('switch', { name: 'Comută modul profesor' });
        for (const toggle of await visibleSwitches.all()) await expect(toggle).toHaveAttribute('aria-checked', 'false');
        await page.locator('main').getByRole('switch').click();
        await expect(page.getByRole('button', { name: 'Editează Orgă actualizată' })).toBeVisible();
        assert.equal(fixture.writes.length, 1, 'preview must not mutate DB');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.deepEqual(errors, []);
        await context.close();
        console.log('Admin ' + viewport.width + 'px PASS: karaoke job submission/status, prefilled edit, PATCH existing ID, MP3/PDF uploads, same row, shared live preview and restore.');
    }
    for (const width of [390, 1440]) {
        const fixture = await open({ width, height: 1000 }, '/canto/', 'teacher');
        const { page } = fixture;
        await page.getByRole('link', { name: 'Editează Piesă canto', exact: true }).click();
        await expect(page.getByRole('form', { name: 'Editează piesa Canto' })).toBeVisible();
        await expect(page.getByLabel('Titlul piesei')).toHaveValue('Piesă canto');
        await expect(page.getByLabel('Titlul piesei')).toBeFocused();
        await page.getByLabel('Upload MP3 Negativ', { exact: true }).setInputFiles({ name: 'negativ.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3-negative-audio') });
        await page.getByLabel('Versuri / text sincronizat (LRC)', { exact: true }).fill('[00:01.00]Versuri pentru studiu');
        await page.getByRole('button', { name: 'Salvează modificările', exact: true }).click();
        await expect(page.getByText('Piesa a fost salvată.', { exact: true })).toBeVisible();
        assert.equal(fixture.writes.length, 1);
        assert.equal(fixture.writes[0].id, 'eq.canto-piece');
        assert.equal(fixture.writes[0].payload.versuri_text, '[00:01.00]Versuri pentru studiu');
        assert.match(fixture.writes[0].payload.audio_negativ_path, /^canto\//);
        assert.equal(fixture.rows[0].positive_url, 'https://example.test/existing.mp3');
        assert.equal(fixture.insertions, 0);
        await page.locator('main').getByRole('switch').click();
        await expect(page.getByRole('link', { name: /Editează/ })).toHaveCount(0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.deepEqual(fixture.errors, []);
        await fixture.context.close();
        console.log('Canto edit entry ' + width + 'px PASS: teacher card link, prefilled/focused existing editor, negative MP3 + lyrics PATCH same ID, positive preserved, no student edit link.');
    }
    const canto = await open({ width: 1440, height: 1000 }, '/admin/canto/', 'teacher');
    await expect(canto.page.getByRole('button', { name: /Editează/ }).first()).toBeVisible();
    await canto.page.getByRole('button', { name: /Editează/ }).first().click();
    await expect(canto.page.getByLabel('Titlul piesei')).toHaveValue('Piesă canto');
    await canto.page.getByLabel('Descriere / indicații de studiu').fill('Descriere canto actualizată');
    await canto.page.getByLabel('Partitură PDF', { exact: true }).setInputFiles({ name: 'score.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 canto') });
    await canto.page.getByRole('button', { name: 'Salvează modificările', exact: true }).click();
    await expect(canto.page.getByRole('status')).toContainText('Piesa a fost salvată.');
    assert.equal(canto.writes[0].id, 'eq.canto-piece');
    assert.match(canto.writes[0].payload.score_path, /^canto\//);
    await canto.page.locator('main').getByRole('switch').click();
    await expect(canto.page.getByRole('region', { name: 'Biblioteca Canto' })).toBeVisible();
    await expect(canto.page.getByRole('button', { name: /Adaugă|Editează|Șterge|Salvează/ })).toHaveCount(0);
    await expect(canto.page.getByRole('link', { name: /Gestionează|Panou profesor/ })).toHaveCount(0);
    await canto.page.getByRole('button', { name: 'Vezi partitura', exact: true }).click();
    const score = canto.page.getByRole('dialog', { name: 'Partitura — Piesă canto' });
    await expect(score.getByText('Pagina 1 din 1', { exact: true })).toBeVisible();
    await expect(score.locator('canvas')).toBeVisible();
    await expect.poll(async () => score.locator('canvas').evaluate(canvas => canvas.width)).toBe(250);
    await canto.page.keyboard.press('Escape');
    await canto.page.getByRole('link', { name: 'Alege disciplina', exact: true }).click();
    await canto.page.getByRole('link', { name: 'Deschide Canto', exact: true }).click();
    await expect(canto.page.getByRole('switch', { name: 'Comută modul profesor' })).toHaveAttribute('aria-checked', 'false');
    await expect(canto.page.getByRole('link', { name: /Gestionează|Panou profesor/ })).toHaveCount(0);
    await expect(canto.page.getByRole('region', { name: 'Biblioteca Canto' })).toBeVisible();
    assert.deepEqual(canto.errors, []);
    await canto.context.close();
    console.log('Canto PASS: UPDATE description/PDF, student UI, rendered private PDF and SPA preview persistence.');
    const red = await open({ width: 1440, height: 900 }, '/admin/resurse/', 'teacher');
    await red.page.getByRole('button', { name: 'Editează Lecție RED' }).click();
    await expect(red.page.getByLabel('Titlu', { exact: true })).toHaveValue('Lecție RED');
    await red.page.getByLabel('Descriere', { exact: true }).fill('Explicații actualizate');
    await red.page.getByRole('button', { name: 'Salvează modificările', exact: true }).click();
    await expect(red.page.getByText('Resursa a fost actualizată.', { exact: true })).toBeVisible();
    assert.equal(red.writes[0].id, 'eq.resource-id');
    assert.equal('file_path' in red.writes[0].payload, false, 'unchanged PDF must be preserved');
    await red.page.getByRole('button', { name: 'Editează Lecție RED' }).click();
    await red.page.locator('input[type=file]').setInputFiles({ name: 'lesson.pdf', mimeType: 'application/pdf', buffer: studyPdf() });
    await red.page.getByRole('button', { name: 'Salvează modificările', exact: true }).click();
    await expect(red.page.getByText('Resursa a fost actualizată.', { exact: true })).toBeVisible();
    assert.match(red.writes[1].payload.file_path, /^red\//);
    assert.equal(red.writes[1].id, 'eq.resource-id');
    assert.deepEqual(red.errors, []);
    await red.context.close();
    console.log('RED PASS: prefilled resource UPDATE preserving unchanged PDF and uploading its replacement.');
    for (const width of [390, 1440]) {
        const f = await open({ width, height: 1000 }, '/instrument/partituri/');
        const { page } = f;
        await expect(page.getByRole('heading', { name: 'Biblioteca de partituri · Orgă' })).toBeVisible();
        await expect(page.getByRole('article')).toHaveCount(12);
        await expect(page.getByRole('button', { name: 'Nivel încă blocat' })).toBeDisabled();
        const moduleFilter = page.getByLabel('Nivel partitură');
        assert.equal(await moduleFilter.locator('option').count(), 6);
        for (let rank = 1; rank <= 5; rank++) {
            await moduleFilter.selectOption('modul_' + rank);
            await expect.poll(() => f.libraryRequests.at(-1)?.searchParams.get('level')).toBe('eq.modul_' + rank);
            await expect(page.getByRole('article')).toHaveCount(rank === 1 ? 12 : rank === 4 ? 1 : 0);
        }
        await moduleFilter.selectOption('');
        await expect(page.getByRole('article')).toHaveCount(12);
        await page.getByRole('button', { name: 'Pagina următoare', exact: true }).click();
        await expect(page.getByRole('article')).toHaveCount(2);
        assert.ok(f.libraryRequests.some(url => url.searchParams.get('offset') === '12'));
        await page.getByRole('searchbox', { name: 'Caută partitură' }).fill('Studiu 01');
        await page.getByRole('button', { name: 'Caută', exact: true }).click();
        await expect(page.getByRole('article')).toHaveCount(1);
        await page.getByRole('button', { name: 'Alege tema — Studiu 01', exact: true }).click();
        const pdf = page.getByRole('region', { name: 'Partitura de referință', exact: true });
        await expect(pdf.locator('canvas')).toBeVisible();
        await expect.poll(() => pdf.locator('canvas').evaluate(canvas => canvas.width)).toBeGreaterThan(100);
        const editor = page.getByRole('region', { name: 'Editor de partituri', exact: true });
        await expect(editor.locator('svg[role=img]')).toBeVisible();
        assert.ok((await pdf.boundingBox()).y < (await editor.boundingBox()).y, 'PDF must be above note editor');
        await editor.getByText('Doime', { exact: true }).click();
        await editor.getByRole('button', { name: 'Adaugă Do4', exact: true }).click();
        await editor.getByText('Optime', { exact: true }).click();
        await editor.getByRole('button', { name: 'Pauză', exact: true }).click();
        await editor.getByRole('radio', { name: 'Doime', exact: true }).check({ force: true });
        await editor.getByRole('button', { name: 'Adaugă Do6', exact: true }).click();
        await editor.getByRole('button', { name: 'Play Compoziție', exact: true }).click();
        await expect(editor.getByRole('button', { name: 'Oprește compoziția', exact: true })).toBeVisible();
        const downloadEvent = page.waitForEvent('download');
        await editor.getByRole('button', { name: 'Exportă MIDI', exact: true }).click();
        const midi = new midiPackage.Midi(await readFile(await (await downloadEvent).path()));
        assert.deepEqual(midi.tracks[0].notes.map(note => [note.midi, note.time, note.duration]), [[60, 0, 1], [84, 1.25, 1]]);
        await expect(editor.getByRole('button', { name: 'Play Compoziție', exact: true })).toBeVisible();
        const studio = page.getByRole('region', { name: 'Studio interactiv MIDI', exact: true });
        await expect(studio).toContainText('Studiu 01 — compoziția mea');
        await page.evaluate(() => { window.__scoreAudio = []; });
        await studio.getByRole('button', { name: 'Pornește studiul', exact: true }).click();
        const teacherKeys = studio.getByRole('group', { name: 'Claviatura profesorului', exact: true });
        await expect(teacherKeys.locator('[data-note="60"]')).toHaveAttribute('data-state', 'teacher');
        await expect.poll(() => page.evaluate(() => window.__scoreAudio.some(note => Math.abs(note.frequency - 261.6256) < 0.1))).toBe(true);
        const studentKey = studio.getByRole('group', { name: 'Claviatura elevului', exact: true }).locator('[data-note="60"]');
        await studentKey.focus();
        await page.keyboard.down('Enter');
        await expect(studentKey).toHaveAttribute('data-state', /held|correct|wrong/);
        await page.keyboard.up('Enter');
        await expect(teacherKeys.locator('[data-note="84"]')).toHaveAttribute('data-state', 'teacher', { timeout: 5000 });
        await expect.poll(async () => {
            const key = await teacherKeys.locator('[data-note="84"]').boundingBox();
            const scroller = await studio.getByLabel('Claviaturi cu derulare orizontală', { exact: true }).boundingBox();
            return key.x >= scroller.x && key.x + key.width <= scroller.x + scroller.width;
        }).toBe(true);
        await studio.getByRole('button', { name: 'Pauză studiu', exact: true }).click();
        await editor.getByRole('button', { name: 'Adaugă Sol4', exact: true }).click();
        await expect(studio).toHaveCount(0);
        await editor.getByRole('button', { name: 'Studiază pe claviatură', exact: true }).click();
        await expect(studio).toBeVisible();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.ok(f.libraryRequests.every(url => url.searchParams.get('discipline') === 'eq.orga' && url.searchParams.get('is_published') === 'eq.true'));
        await page.goto(base + '/instrument/partituri/?piece=score-1');
        await expect(page.getByText('Partitura aparține unui nivel încă blocat pentru contul tău.', { exact: true })).toBeVisible();
        await expect(page.getByRole('region', { name: 'Editor de partituri', exact: true })).toHaveCount(0);
        assert.deepEqual(f.errors, []);
        await f.context.close();
        console.log('Score library ' + width + 'px PASS: search/pagination, private PDF above editor, exact MIDI/rests, audible/visual demo, simultaneous student keyboard, revised demo and level guard.');
    }


} finally {
    if (browser) await browser.close();
    if (server.exitCode === null && server.signalCode === null) { const exited = once(server, 'exit'); server.kill(); await exited; }
    await new Promise((resolve, reject) => upstream.close(error => error ? reject(error) : resolve()));
}
