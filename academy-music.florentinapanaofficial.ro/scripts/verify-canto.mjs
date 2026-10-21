import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

function wave() {
    const sampleRate = 8000, samples = sampleRate * 16;
    const buffer = Buffer.alloc(44 + samples * 2);
    buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
    buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
    return buffer;
}

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
    browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--mute-audio'] });
    async function open(viewport, path = '/dashboard/', role = 'student') {
        const context = await browser.newContext({ viewport, extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.1' } });
        await context.addCookies([{ name: 'academy-access', value: accessToken, url: base, httpOnly: true, sameSite: 'Lax' }]);
        await context.addInitScript(({ accessToken, userId }) => {
            localStorage.setItem('academy-music-auth', JSON.stringify({ access_token: accessToken, refresh_token: 'test-refresh', expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, token_type: 'bearer', user: { id: userId, aud: 'authenticated' } }));
        }, { accessToken, userId });
        await context.addInitScript(() => {
            window.__micCalls = 0; window.__streams = []; window.__contexts = []; window.__recordingConnections = [];
            const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
            navigator.mediaDevices.getUserMedia = async constraints => {
                window.__micCalls++;
                if (window.__denyMic) throw new DOMException('Denied', 'NotAllowedError');
                const stream = await capture(constraints); window.__streams.push(stream); return stream;
            };
            const NativeAudioContext = window.AudioContext;
            window.AudioContext = class extends NativeAudioContext {
                constructor(...args) { super(...args); window.__contexts.push(this); }
                trace(node, type) { const connect = node.connect.bind(node); node.connect = target => { window.__recordingConnections.push({ type, target: target.constructor.name }); return connect(target); }; return node; }
                createMediaStreamSource(stream) { return this.trace(super.createMediaStreamSource(stream), 'microphone'); }
                createMediaElementSource(element) { return this.trace(super.createMediaElementSource(element), 'backing'); }
                createDynamicsCompressor() { return this.trace(super.createDynamicsCompressor(), 'voice'); }
            };
        });
        const page = await context.newPage();
        const rows = [{ id: path.includes('/canto') ? 'canto-piece' : 'orga-piece', discipline: path.includes('/canto') ? 'canto' : 'orga', title: path.includes('/canto') ? 'Piesă canto' : 'Piesă orgă', description: 'Descriere inițială', composer: 'Profesor', level: 'incepator', is_published: true, positive_url: null, negative_url: null, tags: [], versuri_text: Array.from({ length: 15 }, (_, n) => '[00:' + String(n).padStart(2,'0') + '.00]<00:' + String(n).padStart(2,'0') + '.00>Nota ' + n + '<00:' + String(n).padStart(2,'0') + '.80>').join('\n'), audio_pozitiv_path: 'canto/positive.mp3', negative_url: 'https://media.florentinapanaofficial.ro/negative.mp3', grupa: 'Grupa 1' }];
        const writes = [], uploads = [], aiRequests = [], homeworkRequests = [], studioRequests = [];
        let releaseAi; const aiPending = new Promise(resolve => { releaseAi = resolve; });
        let aiResponse = { lrc: "[00:01.00]<00:01.00>Vers AI<00:02.00>" }, aiStatus = 200;
        let insertions = 0;
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
            if (url.pathname === '/api/upload-homework/') {
                const request = route.request();
                assert.match(request.headers()['content-type'], /multipart\/form-data; boundary=/);
                assert.ok(request.postDataBuffer().includes(Buffer.from('name="file"')));
                assert.ok(request.postDataBuffer().includes(Buffer.from('name="pieceId"')));
                const form = await new Request('http://fixture.test', { method: 'POST', headers: { 'Content-Type': request.headers()['content-type'] }, body: request.postDataBuffer() }).formData();
                const file = form.get('file');
                assert.ok(file instanceof File && file.size > 0);
                assert.match(file.type, /^audio\//);
                assert.equal(form.get('pieceId'), rows[0].id);
                homeworkRequests.push(file.size);
                return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ webViewLink: 'https://drive.google.com/file/d/test-homework/view' }) });
            }
            if (url.pathname === '/rest/v1/studio_requests' && route.request().method() === 'POST') {
                studioRequests.push(route.request().postDataJSON());
                return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
            }
            if (url.pathname === '/functions/v1/generate-lyrics') {
                aiRequests.push(route.request().postDataJSON());
                await aiPending;
                return route.fulfill({ status: aiStatus, contentType: 'application/json', body: JSON.stringify(aiResponse) });
            }
            if (url.hostname === 'media.florentinapanaofficial.ro' && url.pathname.endsWith('.mp3') || url.pathname.startsWith('/storage/v1/object/sign/') && route.request().method() === 'GET' && url.pathname.endsWith('.mp3')) {
                const bytes = wave();
                const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || '');
                const start = range ? Number(range[1]) : 0, end = range?.[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
                return route.fulfill({ status: range ? 206 : 200, contentType: 'audio/wav', headers: { 'Access-Control-Allow-Origin': '*', 'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1), ...(range ? { 'Content-Range': 'bytes ' + start + '-' + end + '/' + bytes.length } : {}) }, body: bytes.subarray(start, end + 1) });
            }
            if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: userId }) });
            if (url.pathname.startsWith('/storage/v1/object/sign/')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedURL: '/object/sign/test.' + (url.pathname.endsWith('.pdf') ? 'pdf' : 'mp3') + '?token=test' }) });
            if (url.pathname.startsWith('/storage/v1/object/')) {
                uploads.push(url.pathname);
                return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ Key: url.pathname }) });
            }
            if (!url.pathname.startsWith('/rest/v1/')) return route.continue();
            if (url.pathname === '/rest/v1/pieces') {
                if (route.request().method() === 'PATCH') {
                    const payload = route.request().postDataJSON();
                    writes.push({ id: url.searchParams.get('id'), payload });
                    Object.assign(rows[0], payload);
                    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(rows[0]) });
                }
                if (route.request().method() === 'POST') insertions++;
                return route.fulfill({ contentType: 'application/json', body: JSON.stringify(rows) });
            }
            const body = url.pathname === '/rest/v1/profiles' ? (url.searchParams.get('select') === 'id,full_name' ? [] : { ...profile, role })
                : url.pathname === '/rest/v1/rpc/start_activity_session' ? sessionId : [];
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body), headers: { 'Content-Range': '0-0/0' } });
        });
        await page.goto(base + path);
        return { context, page, errors, chunks, tables, rows, writes, uploads, aiRequests, homeworkRequests, studioRequests, completeAi() { releaseAi(); }, setAiFailure() { aiStatus = 503; aiResponse = { error: "Generarea AI nu este configurată." }; }, get insertions() { return insertions; } };
    }

    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
        const f = await open(viewport, '/canto/');
        const { page, context } = f;
        await expect(page.getByRole('region', { name: 'Biblioteca Canto' })).toBeVisible();
        await expect(page.getByRole('button', { name: /Generează Versuri/ })).toHaveCount(0);
        assert.equal(await page.evaluate(() => window.__micCalls), 0);
        await page.getByRole('button', { name: 'Redă Negativ — Piesă canto', exact: true }).click();
        await expect(page.getByLabel('Versuri karaoke', { exact: true })).toBeVisible();
        assert.equal(await page.evaluate(() => window.__micCalls), 0, 'playback must never activate the mic');
        await expect(page.getByText('Regulă de studio', { exact: true })).toHaveCount(0);
        await page.getByRole('button', { name: 'Stop karaoke', exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Închide', exact: true }).click();
        await page.getByRole('button', { name: 'REC · Înregistrează tema', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Înregistrează tema — Piesă canto' })).toBeVisible();
        assert.equal(await page.evaluate(() => window.__micCalls), 0);
        await page.getByRole('button', { name: 'REC · Pregătește tema', exact: true }).click();
        await expect(page.getByText('Regulă de studio', { exact: true })).toBeVisible();
        assert.equal(await page.evaluate(() => window.__micCalls), 0);
        assert.equal(await page.evaluate(() => window.__contexts.length), 0);
        await page.getByRole('button', { name: 'Anulează', exact: true }).click();
        assert.equal(await page.evaluate(() => window.__micCalls), 0);
        await page.getByRole('button', { name: 'REC · Pregătește tema', exact: true }).click();
        await page.getByRole('button', { name: 'Sunt gata, am conectat căștile!', exact: true }).click();
        await expect(page.getByRole('button', { name: '■ Stop', exact: true })).toBeVisible();
        assert.equal(await page.evaluate(() => window.__micCalls), 1);
        assert.equal(await page.evaluate(() => window.__contexts[0].state), 'running');
        const helperLyrics = page.getByRole('region', { name: 'Versuri ajutătoare pentru temă', exact: true });
        await expect(helperLyrics).toBeVisible();
        await expect(helperLyrics.locator('[data-word-active="true"]')).toHaveText('Nota 0');
        await expect(helperLyrics.locator('[data-word-active="true"]')).toHaveText('Nota 1', { timeout: 3000 });
        assert.equal(await page.evaluate(() => window.__recordingConnections.some(link => link.type === 'microphone' && link.target === 'MediaStreamAudioDestinationNode')), true, 'microphone must feed the recorder before effects');
        assert.equal(await page.evaluate(() => window.__recordingConnections.some(link => ['voice', 'backing'].includes(link.type) && link.target === 'MediaStreamAudioDestinationNode')), false, 'processed voice and negative must never feed the recorder');
        assert.equal(await page.evaluate(() => window.__recordingConnections.some(link => link.type === 'backing' && link.target === 'AudioDestinationNode')), true, 'negative remains audible in headphones');

        const mix = page.getByRole('slider', { name: /Reverb Dry/ });
        await mix.focus(); await page.keyboard.press('End'); await expect(mix).toHaveValue('1');
        await page.getByRole('button', { name: '■ Stop', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Trimite tema', exact: true })).toBeVisible();
        await expect.poll(() => page.evaluate(() => window.__streams[0].getTracks()[0].readyState)).toBe('ended');
        await expect.poll(() => page.evaluate(() => window.__contexts[0].state)).toBe('closed');
        await page.getByRole('button', { name: '↺ Mai încerc o dată', exact: true }).click();
        await page.evaluate(() => { window.__denyMic = true; });
        await page.getByRole('button', { name: 'REC · Pregătește tema', exact: true }).click();
        await page.getByRole('button', { name: 'Sunt gata, am conectat căștile!', exact: true }).click();
        await expect(page.getByText('Ai refuzat accesul la microfon. Permite-l din bara de adrese și încearcă din nou.', { exact: true })).toBeVisible();
        await page.evaluate(() => { window.__denyMic = false; });
        await page.getByRole('button', { name: 'REC · Pregătește tema', exact: true }).click();
        await page.getByRole('button', { name: 'Sunt gata, am conectat căștile!', exact: true }).click();
        await expect(page.getByRole('button', { name: '■ Stop', exact: true })).toBeVisible();
        await expect(page.getByText('0:01', { exact: true })).toBeVisible();
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
        await expect(page.getByRole('button', { name: 'Trimite tema', exact: true })).toBeVisible();
        await expect.poll(() => page.evaluate(() => window.__streams.at(-1).getTracks()[0].readyState)).toBe('ended');
        await page.evaluate(() => { delete document.hidden; });
        assert.equal(f.homeworkRequests.length, 0, 'recording must not submit automatically');
        await page.getByRole('button', { name: 'Trimite tema', exact: true }).click();
        await expect(page.getByText('Tema a fost trimisă cu succes domnului profesor!', { exact: true })).toBeVisible();
        assert.equal(f.homeworkRequests.length, 1);
        assert.ok(f.homeworkRequests[0] > 0);
        await page.getByRole('dialog').getByRole('button', { name: 'Închide', exact: true }).first().click();
        await page.getByRole('button', { name: 'Vezi versuri — Piesă canto', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Karaoke · negativ — Piesă canto', exact: true })).toBeVisible();
        await page.getByRole('dialog').getByRole('button', { name: 'Închide', exact: true }).click();

        await expect(page.getByLabel('Versuri karaoke', { exact: true })).toHaveCount(0);
        await page.getByRole('button', { name: 'Redă Negativ — Piesă canto', exact: true }).click();
        await expect(page.getByLabel('Versuri karaoke', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Pauză karaoke', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Pauză karaoke', exact: true }).click();
        assert.equal(await page.locator('audio').nth(1).evaluate(audio => audio.paused), true);
        await page.locator('audio').nth(1).evaluate(audio => { audio.currentTime = 7.2; });
        await expect(page.getByLabel('Versuri karaoke', { exact: true }).locator('[data-word-active="true"]')).toHaveText('Nota 7');
        await page.getByRole('button', { name: 'Stop karaoke', exact: true }).click();
        await expect.poll(() => page.locator('audio').nth(1).evaluate(audio => audio.currentTime)).toBe(0);
        await expect(page.getByLabel('Versuri karaoke', { exact: true }).locator('[data-word-active="true"]')).toHaveText('Nota 0');
        await page.getByRole('button', { name: 'Play karaoke', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Pauză Negativ — Piesă canto', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Stop karaoke', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Play karaoke', exact: true })).toBeVisible();
        assert.equal(f.aiRequests.length, 0, 'student playback must never invoke AI');

        const karaoke = page.getByLabel('Versuri karaoke', { exact: true });
        await expect(karaoke).toBeVisible();
        await page.getByRole('dialog').getByRole('button', { name: 'Închide', exact: true }).click();
        await page.getByRole('button', { name: 'Redă Pozitiv — Piesă canto', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Karaoke · pozitiv — Piesă canto', exact: true })).toBeVisible();
        const position = page.getByRole('slider', { name: 'Poziție karaoke', exact: true });
        await expect(position).toBeEnabled();
        await page.getByRole('button', { name: 'Pauză karaoke', exact: true }).click();
        await position.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
        await expect(karaoke.locator('[data-word-active="true"]')).toHaveText('Nota 0');
        await page.locator('audio').first().evaluate(audio => { audio.currentTime = 7.2; });
        await expect(karaoke.locator('[data-word-active="true"]')).toHaveText('Nota 7');
        await expect.poll(() => karaoke.evaluate(element => element.scrollTop)).toBeGreaterThan(50);
        await page.locator('audio').first().evaluate(audio => { audio.currentTime = 2.2; });
        await expect(karaoke.locator('[data-word-active="true"]')).toHaveText('Nota 2');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.locator('audio').first().evaluate(audio => { audio.currentTime = 10.2; });
        await expect(karaoke.locator('[data-word-active="true"]')).toHaveText('Nota 10');
        await expect.poll(() => karaoke.evaluate(element => element.scrollTop)).toBeGreaterThan(100);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.deepEqual(f.errors, []);
        await context.close();
        console.log(`Canto ${viewport.width}px PASS: headphone guard, mic only after homework REC/confirmation, real MediaRecorder/reverb with fake mic, dry microphone-only recording graph, backing/reverb monitor-only, synchronized visual lyrics during REC, wet slider, stop/denial/background cleanup, negative auto-open, shared Play/Pause/Stop, playback/seek/word highlight/scroll and zero student AI requests.`);
    }
    for (const width of [390, 1440]) {
        const f = await open({ width, height: 1000 }, '/canto/');
        const { page } = f;
        await page.getByRole('button', { name: 'REC · Înregistrează tema', exact: true }).click();
        await page.getByRole('button', { name: 'REC · Pregătește tema', exact: true }).click();
        await page.getByRole('button', { name: 'Sunt gata, am conectat căștile!', exact: true }).click();
        await expect(page.getByRole('slider', { name: /Reverb Dry/ })).toBeVisible();
        await page.waitForTimeout(400);
        await page.getByRole('button', { name: '■ Stop', exact: true }).click();
        await page.getByRole('button', { name: '🎧 Trimite la Studio pentru Masterizare', exact: true }).click();
        await expect(page.getByRole('status').filter({ hasText: 'Înregistrarea ta a fost trimisă la Studio.' })).toBeVisible();
        assert.equal(f.studioRequests.length, 1);
        const request = f.studioRequests[0];
        assert.equal(request.student_id, userId);
        assert.equal(request.song_id, 'canto-piece');
        assert.equal(request.raw_audio_url, 'raw/' + userId + '/' + request.id + '/take.webm');
        assert.ok(f.uploads.some(path => path.endsWith('/student_records/' + request.raw_audio_url)));
        assert.equal(f.homeworkRequests.length, 0, 'Studio send must not submit a second homework');
        assert.equal(await page.evaluate(() => window.__recordingConnections.some(link => ['voice', 'backing'].includes(link.type) && link.target === 'MediaStreamAudioDestinationNode')), false);
        assert.deepEqual(f.errors, []);
        await f.context.close();
        console.log('Dry Studio upload ' + width + 'px PASS: microphone-only recording, private raw upload and matching request, no homework duplicate.');
    }
    for (const width of [390, 1440]) {
        const f = await open({ width, height: 1000 }, '/canto/', 'teacher');
        const { page } = f;
        await page.getByRole('button', { name: 'Vezi versuri — Piesă canto', exact: true }).click();
        await page.getByRole('button', { name: '✨ Generează Versuri Automat (AI)', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Confirm și generez', exact: true })).toBeDisabled();
        await page.getByRole('checkbox', { name: /Confirm că am dreptul/ }).check();
        await page.getByRole('button', { name: 'Confirm și generez', exact: true }).click();
        f.completeAi();
        const draft = page.getByRole('textbox', { name: 'Versuri AI de revizuit', exact: true });
        await expect(draft).toHaveValue('[00:01.00]<00:01.00>Vers AI<00:02.00>');
        assert.equal(f.writes.length, 0, 'Karaoke generation must remain a draft');
        await draft.fill('[00:01.00]<00:01.00>Revizie <00:01.50>profesor<00:02.00>');
        await page.getByRole('button', { name: 'Salvează versurile sincronizate', exact: true }).click();
        await expect(draft).toHaveCount(0);
        assert.equal(f.writes.length, 1);
        assert.deepEqual(Object.keys(f.writes[0].payload), ['versuri_text']);
        await page.getByRole('button', { name: 'Play karaoke', exact: true }).click();
        await page.getByRole('button', { name: 'Pauză karaoke', exact: true }).click();
        await page.locator('audio').nth(1).evaluate(audio => { audio.currentTime = 1.6; });
        await expect(page.getByLabel('Versuri karaoke', { exact: true }).locator('[data-word-active="true"]')).toHaveText('profesor');
        await page.reload();
        await page.getByRole('button', { name: 'Vezi versuri — Piesă canto', exact: true }).click();
        await expect(page.getByLabel('Versuri karaoke', { exact: true })).toContainText('Revizie profesor');
        assert.equal(f.aiRequests.length, 1, 'Opening saved lyrics must not generate again');
        assert.deepEqual(f.errors, []);
        await f.context.close();
        console.log('Canto lyrics AI window ' + width + 'px PASS: consent, reviewed draft, lyrics-only UPDATE, word clock and saved reload.');
    }
    for (const path of ['/admin/canto/', '/admin/piese/']) {
        const f = await open({ width: 1440, height: 1000 }, path, 'teacher');
        const { page } = f;
        const ai = page.getByRole('button', { name: '✨ Generează Versuri Automat (AI)', exact: true });
        if (path.includes('piese')) await page.getByRole('button', { name: '＋ Adaugă piesă', exact: true }).click();
        await expect(ai).toBeDisabled();
        if (path.includes('piese')) await page.getByRole('dialog').getByRole('button', { name: 'Închide' }).click();
        await page.getByRole('button', { name: /Editează/ }).first().click();
        await expect(ai).toBeEnabled();
        await ai.click();
        assert.equal(f.aiRequests.length, 0);
        await expect(page.getByRole('button', { name: 'Confirm și generez', exact: true })).toBeDisabled();
        await page.getByRole('checkbox', { name: /Confirm că am dreptul/ }).check();
        await page.getByRole('button', { name: 'Confirm și generez', exact: true }).click();
        await expect(page.getByText('Analizăm vocea și sincronizăm versurile... Durează aproximativ 1-2 minute', { exact: true })).toBeVisible();
        await expect(page.locator('main button[type=submit]').last()).toBeDisabled();
        f.completeAi();
        const draft = page.getByLabel('Versuri / text sincronizat (LRC)', { exact: true });
        await expect(draft).toHaveValue('[00:01.00]<00:01.00>Vers AI<00:02.00>');
        await expect(page.getByRole('button', { name: 'Salvează modificările', exact: true })).toBeEnabled();
        assert.equal(f.writes.length, 0, 'AI must not persist lyrics before manual save');
        assert.equal(f.aiRequests[0].audioPath, 'canto/positive.mp3');
        await draft.fill('[00:01.00]Revizie profesor');
        f.setAiFailure();
        await ai.click(); await page.getByRole('checkbox', { name: /Confirm că am dreptul/ }).check();
        await page.getByRole('button', { name: 'Confirm și generez', exact: true }).click();
        await expect(page.getByRole('alert').filter({ hasText: 'Generarea AI nu este configurată.' })).toBeVisible();
        await expect(draft).toHaveValue('[00:01.00]Revizie profesor');
        await page.getByRole('button', { name: 'Salvează modificările', exact: true }).click();
        await expect.poll(() => f.writes.length).toBe(1);
        assert.equal(f.writes[0].payload.versuri_text, '[00:01.00]Revizie profesor');
        if (path.includes('/canto/')) {
            const requestsAfterSave = f.aiRequests.length;
            await page.goto(base + '/canto/');
            await page.getByRole('button', { name: 'Redă Negativ — Piesă canto', exact: true }).click();
            await expect(page.getByLabel('Versuri karaoke', { exact: true })).toContainText('Revizie profesor');
            await page.locator('audio').nth(1).evaluate(audio => { audio.currentTime = 1.2; });
            await expect(page.getByLabel('Versuri karaoke', { exact: true }).locator('[data-active="true"]')).toHaveText('Revizie profesor');
            assert.equal(f.aiRequests.length, requestsAfterSave, 'saved lyrics survive reload and playback without regenerating');
        }
        assert.deepEqual(f.errors, []);
        await f.context.close();
        console.log(`AI ${path} PASS: saved-positive eligibility, consent, save lock, draft-only generation, editable result, explicit failure preserving draft, manual UPDATE.`);
    }
} finally {
    if (browser) await browser.close();
    if (server.exitCode === null && server.signalCode === null) { const exited = once(server, 'exit'); server.kill(); await exited; }
    await new Promise((resolve, reject) => upstream.close(error => error ? reject(error) : resolve()));
}
