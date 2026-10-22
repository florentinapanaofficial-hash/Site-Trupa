import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { PGlite } from '@electric-sql/pglite';
import { createAIGameHandler } from '../src/lib/aiGamesServer.js';
import { aiGamesClient, aiProviderResponse } from './fixtures/ai-games.mjs';
import { startWorkerPreview } from './worker-preview.mjs';

const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const token = id => 'header.' + Buffer.from(JSON.stringify({ sub: id, session_id: sessionId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.signature';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
create function storage.extension(text) returns text language sql as $$select split_part($1,'.',2)$$;
create schema realtime; create table realtime.messages(extension text);
create function realtime.topic() returns text language sql stable as $$select 'academy:online'$$;
grant usage on schema auth,storage,realtime to authenticated;`);
await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
await db.exec(`grant select on public.profiles to authenticated; insert into auth.users values ('${ids[0]}','{"full_name":"Elev Unu"}'),('${ids[1]}','{"full_name":"Elev Doi"}');`);
let queue = Promise.resolve();
function serial(task) { const result = queue.then(task); queue = result.catch(() => { }); return result; }
function player(id, task) { return serial(async () => { await db.exec(`reset role; set request.jwt.claim.sub='${id}'; set role authenticated;`); return task(); }); }
function admin(sql) { return serial(async () => { await db.exec("reset role; set request.jwt.claim.sub='';"); await db.exec(sql); }); }
const upstream = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.url.startsWith('/auth/v1/user')) { const sub = JSON.parse(Buffer.from(request.headers.authorization.split('.')[1], 'base64url').toString()).sub; return response.end(JSON.stringify({ id: sub })); }
    if (request.url === '/rest/v1/rpc/academy_check_session') return response.end('"ok"');
    response.statusCode = 500; response.end('{"error":"Unexpected test request"}');
});
upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
const server = startWorkerPreview({ NODE_ENV: 'production', VITE_SUPABASE_URL: 'http://127.0.0.1:' + upstream.address().port, VITE_SUPABASE_ANON_KEY: 'test-anon', SUPABASE_SERVICE_ROLE_KEY: 'test-service' });
let output = ''; server.stdout.on('data', chunk => output += chunk); server.stderr.on('data', chunk => output += chunk);
let browser;
try {
    const base = await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('SSR not ready: ' + output)), 15000); server.once('error', reject); server.stdout.on('data', () => { const url = output.match(new RegExp('http:' + String.fromCharCode(47, 47) + '127[.]0[.]0[.]1:[0-9]+'))?.[0]; if (url) { clearTimeout(timer); resolve(url); } }); });
    for (const [authorized, origin, status] of [[false, base, 401], [true, 'https://evil.test', 403], [true, base, 400]]) {
        const guard = await fetch(base + '/api/games/generate/', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.1', Origin: origin, ...(authorized ? { Authorization: 'Bearer ' + token(ids[0]) } : {}) }, body: JSON.stringify({ topic: 'invalid', level: 'incepator' }) });
        assert.equal(guard.status, status); assert.equal(guard.headers.get('Cache-Control'), 'private, no-store'); assert.equal(typeof (await guard.json()).error, 'string');
    }
    console.log('PASS: built Astro AI route rejects anonymous, cross-origin and invalid-topic requests before any provider call.');
    browser = await chromium.launch({ headless: true });
    const rpcNames = new Set(['game_set_profile', 'game_opponents', 'game_rhythm_start', 'game_rhythm_finish', 'game_leaderboard', 'game_live_create', 'game_live_join', 'game_live_cancel', 'game_live_answer', 'game_live_state', 'game_live_inbox']);
    let aiConfigured = false; let aiCalls = 0; let failAnswerResponse = true; let lastPattern; let failLibrary = false; let failSave = true; let saves = 0; let signRequests = 0;
    async function open(id, width, path = '/jocuri/?tab=duel') {
        const context = await browser.newContext({ viewport: { width, height: 1000 }, extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.1' } });
        await context.routeWebSocket('**/realtime/v1/**', ws => ws.close());
        await context.addCookies([{ name: 'academy-access', value: token(id), url: base, httpOnly: true, sameSite: 'Lax' }]);
        await context.addInitScript(({ value, id }) => { localStorage.setItem('academy-music-auth', JSON.stringify({ access_token: value, refresh_token: 'test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user: { id, aud: 'authenticated' } })); }, { value: token(id), id });
        const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', async route => {
            const request = route.request(); const url = new URL(request.url());
            const fulfill = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
            if (url.pathname.startsWith('/auth/v1/')) return fulfill({ id });
            if (url.pathname.startsWith('/storage/v1/object/sign/avatar.svg')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="40" fill="gold"/></svg>' });
            if (url.pathname.startsWith('/storage/v1/object/sign/')) { signRequests++; return fulfill({ signedURL: '/object/sign/avatar.svg?token=test' }); }
            if (url.pathname === '/api/games/generate/') {
                const handler = createAIGameHandler({ env: { VITE_SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service', OPENAI_API_KEY: aiConfigured ? 'test-openai-key' : '' }, createClient: aiGamesClient(db, serial), fetch: async () => { aiCalls++; return aiProviderResponse(); }, logger: { error() { } } });
                const response = await handler({ request: new Request(request.url(), { method: request.method(), headers: await request.allHeaders(), body: request.postData() }), locals: { academySecurity: { user: { id } } } });
                if (request.postDataJSON().action === 'answer' && failAnswerResponse && response.ok) { failAnswerResponse = false; return fulfill({ error: 'Test: răspuns salvat, conexiune întreruptă.' }, 503); }
                return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
            }
            if (!url.pathname.startsWith('/rest/v1/')) return route.continue();
            const name = url.pathname.split('/').at(-1);
            if (url.pathname.includes('/rpc/') && rpcNames.has(name)) {
                const payload = request.postDataJSON() || {};
                if (name === 'game_rhythm_finish' && failSave) { failSave = false; return fulfill({ message: 'Test: conexiune întreruptă la salvare.' }, 503); }
                try {
                    const data = await player(id, async () => {
                        const keys = Object.keys(payload); assert.ok(keys.every(k => /^p_[a-z_]+$/.test(k)));
                        const values = keys.map(k => typeof payload[k] === 'object' && payload[k] !== null ? JSON.stringify(payload[k]) : payload[k]);
                        return (await db.query('select public.' + name + '(' + keys.map((k, i) => k + '=>$' + (i + 1)).join(',') + ') as value', values)).rows[0].value;
                    });
                    if (name === 'game_rhythm_start') lastPattern = data.pattern;
                    if (name === 'game_rhythm_finish') saves++;
                    return fulfill(data);
                } catch (e) { return fulfill({ message: e.message, code: e.code }, 400); }
            }
            if (name === 'profiles') return fulfill({ id, full_name: id === ids[0] ? 'Elev Unu' : 'Elev Doi', role: 'student', is_active: true, disciplines: ['orga', 'canto'] });
            if (name === 'game_profiles') return fulfill(await player(id, async () => (await db.query('select alias,visible from public.game_profiles')).rows[0] || null));
            if (name === 'quizzes' && failLibrary) { failLibrary = false; return fulfill({ message: 'Test: biblioteca indisponibilă.' }, 400); }
            if (name === 'quizzes') return fulfill(await player(id, async () => (await db.query('select id,title from public.quizzes where is_published order by title')).rows));
            if (name === 'live_quiz_rooms') return fulfill(await player(id, async () => (await db.query('select id,code,title,status,host_id,opponent_id,created_at from public.live_quiz_rooms order by created_at desc')).rows));
            return fulfill(name === 'start_activity_session' ? sessionId : []);
        });
        await page.goto(base + path); await expect(page.getByRole('heading', { name: 'Jocuri muzicale', exact: true })).toBeVisible();
        return { context, page, errors };
    }
    const a = await open(ids[0], 390); const b = await open(ids[1], 1440);
    for (const [fixture, alias] of [[a, 'Pianist A'], [b, 'Pianist B']]) {
        const form = fixture.page.getByRole('form', { name: 'Identitate în jocuri' });
        await form.getByRole('textbox').fill(alias); await form.getByRole('checkbox').check();
        await form.getByRole('button', { name: 'Salvează preferințele' }).click(); await expect(form.getByText('Preferințele au fost salvate.')).toBeVisible();
    }
    await b.page.goto(base + '/dashboard/');
    failLibrary = true; await a.page.reload();
    await expect(a.page.getByRole('alert').filter({ hasText: 'Test: biblioteca indisponibilă.' })).toBeVisible();
    await a.page.waitForTimeout(2200);
    await expect(a.page.getByRole('alert').filter({ hasText: 'Test: biblioteca indisponibilă.' })).toBeVisible();
    await a.page.getByRole('button', { name: 'Actualizează quiz-urile și adversarii' }).click();
    await a.page.getByLabel('Quiz pregătit').selectOption('academy-duel-notatie-1');
    await a.page.getByLabel('Adversar', { exact: true }).selectOption(ids[1]);
    await a.page.getByRole('button', { name: 'Trimite provocarea' }).click();
    await expect(a.page.getByText('Așteptăm adversarul. Când acceptă, duelul începe automat.')).toBeVisible();
    await expect(b.page.getByRole('link', { name: 'Vezi provocările' })).toBeVisible({ timeout: 15000 });
    await b.page.getByRole('link', { name: 'Vezi provocările' }).click();
    await expect(b.page.getByRole('button', { name: 'Acceptă duelul' })).toBeVisible({ timeout: 10000 });
    await b.page.getByRole('button', { name: 'Acceptă duelul' }).click();
    await expect(a.page.getByRole('heading', { name: 'Câte spații se află între cele cinci linii ale portativului?' })).toBeVisible({ timeout: 8000 });
    await expect(b.page.getByRole('heading', { name: 'Câte spații se află între cele cinci linii ale portativului?' })).toBeVisible();
    await a.page.getByRole('radio', { name: 'Patru', exact: true }).check(); await a.page.getByRole('button', { name: 'Validează răspunsul' }).click();
    await expect(a.page.getByText('Răspuns înregistrat. Așteptăm adversarul sau expirarea timpului.')).toBeVisible();
    await b.page.reload(); await b.page.getByRole('button', { name: 'Deschide duelul' }).click();
    await expect(b.page.getByRole('radio', { name: 'Patru', exact: true })).toBeVisible();
    await b.page.getByRole('radio', { name: 'Trei', exact: true }).check(); await b.page.getByRole('button', { name: 'Validează răspunsul' }).click();
    await expect(a.page.getByText('Urmează automat întrebarea următoare.')).toBeVisible({ timeout: 8000 });
    await expect(a.page.getByRole('heading', { name: 'Ce sunet urmează după mi în șirul ascendent al notelor naturale?' })).toBeVisible({ timeout: 10000 });
    const room = (await db.query('select id from public.live_quiz_rooms order by created_at desc limit 1')).rows[0].id;
    await admin(`update public.live_quiz_rooms set deadline=clock_timestamp()-interval '5 minutes' where id='${room}'`);
    await expect(a.page.getByText('🏆 Câștigător: Pianist A', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(b.page.getByText('🏆 Câștigător: Pianist A', { exact: true })).toBeVisible({ timeout: 10000 });
    console.log('PASS: targeted peer invitation, acceptance, two authenticated contexts, answer isolation, reconnect, automatic progression/expiry and winner with real SQL behind UI.');
    await a.page.goto(base + '/jocuri/?tab=ritm');
    await a.page.getByRole('button', { name: 'Începe o rundă' }).click();
    await expect(a.page.getByLabel('Notele rundei')).toBeVisible();
    await a.page.evaluate(pattern => {
        const labels = { 60: 'Do', 62: 'Re', 64: 'Mi', 65: 'Fa', 67: 'Sol' };
        for (const note of pattern) setTimeout(() => document.querySelector('[aria-label="Cântă ' + labels[note.note] + '"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), note.time * 1000);
    }, lastPattern);
    await expect(a.page.getByRole('alert').filter({ hasText: 'Test: conexiune întreruptă' })).toBeVisible({ timeout: 15000 });
    await a.page.getByRole('button', { name: 'Reîncearcă salvarea rundei' }).click();
    await expect(a.page.getByText(/Scor salvat:/)).toBeVisible(); assert.equal(saves, 1);
    const attempt = (await db.query('select score,hits from public.rhythm_attempts where finished_at is not null')).rows[0]; assert.ok(attempt.hits >= 10, 'At least ten timed browser presses should match: ' + JSON.stringify(attempt));
    await admin(`update public.profiles set avatar_path=id::text||'/photo.webp';`);
    await a.page.goto(base + '/jocuri/?tab=clasament'); await expect(a.page.getByLabel('Podium', { exact: true })).toBeVisible(); await expect(a.page.getByRole('list', { name: 'Punctaje' }).getByText('Pianist A', { exact: true })).toBeVisible();
    assert.ok(signRequests > 0, 'Opt-in avatar requests must be signed');
    for (const fixture of [a, b]) { const overflow = await fixture.page.evaluate(() => document.documentElement.scrollWidth > innerWidth); assert.equal(overflow, false); assert.deepEqual(fixture.errors, []); }
    await a.page.getByRole('form', { name: 'Identitate în jocuri' }).getByRole('checkbox').uncheck(); await a.page.getByRole('button', { name: 'Salvează preferințele' }).click();
    await expect(a.page.getByRole('list', { name: 'Punctaje' }).getByText('Pianist A', { exact: true })).toHaveCount(0);
    console.log('PASS: mobile rhythm timed presses, server score, failed-save retry without duplicates, opt-in avatar podium, withdrawal and zero viewport overflow/page errors.');
    await a.page.goto(base + '/jocuri/?tab=ai');
    await expect(a.page.getByRole('heading', { name: '✨ Antrenament muzical cu AI' })).toBeVisible();
    await a.page.getByLabel('Tema quiz-ului').selectOption('instrumente');
    await a.page.getByLabel('Nivel', { exact: true }).selectOption('mediu');
    await a.page.getByRole('button', { name: 'Generează un joc nou' }).click();
    await expect(a.page.getByRole('alert').filter({ hasText: 'OPENAI_API_KEY' })).toBeVisible(); assert.equal(aiCalls, 0);
    aiConfigured = true;
    await a.page.getByRole('button', { name: 'Generează un joc nou' }).click();
    await expect(a.page.getByRole('heading', { name: 'Exercițiul 1: ce notă urmează după Do?' })).toBeVisible();
    assert.equal(aiCalls, 1);
    const aiRegion = a.page.getByRole('region', { name: 'Joc muzical AI' });
    await aiRegion.getByRole('button', { name: 'Re', exact: true }).click();
    await expect(aiRegion.getByRole('alert').filter({ hasText: 'Test: răspuns salvat' })).toBeVisible();
    await aiRegion.getByRole('button', { name: 'Reîncearcă același răspuns' }).click();
    await expect(aiRegion.getByText('Bravo, răspuns corect!', { exact: true })).toBeVisible();
    await aiRegion.getByRole('button', { name: 'Întrebarea următoare' }).click();
    await aiRegion.getByRole('button', { name: 'Mi', exact: true }).click();
    await expect(aiRegion.getByText('Mai învățăm împreună! Răspunsul corect: Re')).toBeVisible();
    await a.page.reload();
    await expect(a.page.getByRole('heading', { name: 'Exercițiul 2: ce notă urmează după Do?' })).toBeVisible();
    await expect(aiRegion.getByText('Mai învățăm împreună! Răspunsul corect: Re')).toBeVisible();
    for (let index = 2; index < 5; index++) {
        await aiRegion.getByRole('button', { name: 'Întrebarea următoare' }).click();
        await expect(aiRegion.getByRole('heading', { name: 'Exercițiul ' + (index + 1) + ': ce notă urmează după Do?' })).toBeVisible();
        await aiRegion.getByRole('button', { name: 'Re', exact: true }).click();
        await expect(aiRegion.getByText('Bravo, răspuns corect!', { exact: true })).toBeVisible();
    }
    await aiRegion.getByRole('button', { name: 'Vezi rezultatul' }).click();
    await expect(aiRegion.getByText('🎵 Joc încheiat! 4 din 5 răspunsuri corecte.')).toBeVisible();
    const aiSaved = await serial(async () => { await db.exec('reset role;'); return (await db.query('select status,score,answers,topic,level from public.ai_game_sessions')).rows; });
    assert.equal(aiSaved.length, 1); assert.equal(aiSaved[0].score, 4); assert.equal(aiSaved[0].answers.length, 5); assert.equal(aiSaved[0].status, 'completed'); assert.equal(aiSaved[0].topic, 'instrumente'); assert.equal(aiSaved[0].level, 'mediu');
    assert.equal(aiCalls, 1); assert.deepEqual(a.errors, []); assert.equal(await a.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await aiRegion.getByRole('button', { name: 'Alege un alt antrenament' }).click();
    await aiRegion.getByRole('button', { name: 'Generează un joc nou' }).click();
    await expect(aiRegion.getByRole('alert').filter({ hasText: 'Așteaptă un minut' })).toBeVisible(); assert.equal(aiCalls, 1);
    console.log('PASS: AI quiz mobile UI, missing-key error, mocked OpenAI + real SQL endpoint, sequential feedback, lost-answer response/idempotent retry, reload/resume, saved score 4/5 and quota without extra provider call.');
    await b.page.goto(base + '/jocuri/?tab=ai');
    await b.page.getByRole('button', { name: 'Generează un joc nou' }).click();
    const desktopAI = b.page.getByRole('region', { name: 'Joc muzical AI' });
    for (let index = 0; index < 5; index++) {
        await expect(desktopAI.getByRole('heading', { name: 'Exercițiul ' + (index + 1) + ': ce notă urmează după Do?' })).toBeVisible();
        await desktopAI.getByRole('button', { name: 'Re', exact: true }).click();
        await expect(desktopAI.getByText('Bravo, răspuns corect!', { exact: true })).toBeVisible();
        await desktopAI.getByRole('button', { name: index === 4 ? 'Vezi rezultatul' : 'Întrebarea următoare' }).click();
    }
    await expect(desktopAI.getByText('🎵 Joc încheiat! 5 din 5 răspunsuri corecte.')).toBeVisible();
    assert.equal(aiCalls, 2); assert.deepEqual(b.errors, []); assert.equal(await b.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    console.log('PASS: desktop AI player completes all five questions and persists an independent second-student result, no runtime errors or overflow.');
    await a.context.close(); await b.context.close();
} finally {
    if (browser) await browser.close();
    server.kill(); await once(server, 'exit'); await new Promise(resolve => upstream.close(resolve)); await db.close();
}
