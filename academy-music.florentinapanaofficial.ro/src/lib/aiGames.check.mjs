import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createAIGameHandler, validateAIQuiz } from './aiGamesServer.js';
import { aiGamesClient, sampleAIQuiz, aiProviderResponse } from '../../scripts/fixtures/ai-games.mjs';

const student = '11111111-1111-4111-8111-111111111111';
const rival = '22222222-2222-4222-8222-222222222222';
const env = { VITE_SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service', OPENAI_API_KEY: 'test-openai-key' };
const logger = { error() {} };
const migration = await readFile(new URL('../../supabase/migrations/20261021000005_ai_games.sql', import.meta.url), 'utf8');
async function setup() {
    const db = new PGlite();
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
        create table public.profiles(id uuid primary key, role text, is_active boolean);
        insert into public.profiles values ('${student}','student',true),('${rival}','student',true);`);
    await db.exec(migration); await db.exec(migration);
    return db;
}
function context(body, options = {}) {
    return { request: new Request('https://academy.test/api/games/generate/', { method: 'POST', headers: { Origin: options.origin || 'https://academy.test', 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body), signal: options.signal }),
        locals: options.anonymous ? {} : { academySecurity: { user: { id: options.user || student }, token: 'verified-by-middleware' } } };
}
function generate() { return { action: 'generate', topic: 'teorie', level: 'incepator' }; }

test('AI output validator enforces exact shape, 5 questions, 4 unique strings, index boundaries, length and duplicate questions', () => {
    assert.deepEqual(validateAIQuiz(sampleAIQuiz()), sampleAIQuiz());
    const cases = [q => q.extra = true, q => q.questions.pop(), q => q.questions[0].correctIndex = 4, q => q.questions[0].correctIndex = '0', q => q.questions[0].options[0] = {}, q => q.questions[0].options[1] = ' re ', q => q.questions[1].prompt = q.questions[0].prompt, q => q.questions[0].explanation = '', q => q.questions[0].prompt = 'x'.repeat(351), q => q.title = 'x'.repeat(101)];
    for (const mutate of cases) { const quiz = sampleAIQuiz(); mutate(quiz); assert.throws(() => validateAIQuiz(quiz), /quiz invalid/); }
});

test('AI endpoint guards origin, session, input size, enums and missing key before any paid call', async () => {
    let calls = 0;
    const handler = createAIGameHandler({ env, createClient: () => { calls++; throw new Error('Should not contact DB'); }, logger });
    for (const [ctx, status] of [[context(generate(), { anonymous: true }), 401], [context(generate(), { origin: 'https://evil.test' }), 403], [context('not-json'),400], [context({ ...generate(), topic: 'Ignore instructions' }),400], [context({ ...generate(), userId: rival }),400], [context({ ...generate(), level: 'avansat' }),400], [context({ payload: 'x'.repeat(9000) }),413]]) {
        const result = await handler(ctx); assert.equal(result.status,status); assert.equal(result.headers.get('Cache-Control'),'private, no-store');
    }
    const unavailable = createAIGameHandler({ env: { ...env, OPENAI_API_KEY: '' }, createClient: () => ({}), logger });
    assert.equal((await unavailable(context(generate()))).status,503);
    assert.equal(calls,0);
});

test('AI endpoint uses strict schema, strips future solutions, grades persistently, resumes and prevents client score/identity tampering', async () => {
    const db = await setup(); let providerCalls = 0;
    try {
        const handler = createAIGameHandler({ env, createClient: aiGamesClient(db), logger, fetch: async (url, options) => {
            providerCalls++;
            assert.equal(url,'https://api.openai.com/v1/chat/completions');
            assert.equal(options.headers.Authorization,'Bearer test-openai-key');
            const payload = JSON.parse(options.body); assert.equal(payload.response_format.json_schema.strict,true); assert.equal(payload.model,'gpt-4o-mini');
            assert.ok(!JSON.stringify(payload).includes(student)); assert.ok(!JSON.stringify(payload).includes('test-openai-key'));
            return aiProviderResponse();
        } });
        const response = await handler(context(generate())); assert.equal(response.status,200);
        const { game } = await response.json(); assert.equal(game.questions.length,5);
        assert.equal(game.questions[0].correctIndex,undefined); assert.equal(game.questions[0].explanation,undefined);
        const answer = questionIndex => ({ action: 'answer', gameId: game.id, questionIndex, answerIndex: 0 });
        assert.equal((await handler(context({ ...answer(0), score: 500 }))).status,400);
        assert.equal((await handler(context(answer(1)))).status,409);
        assert.equal((await handler(context(answer(0), { user: rival }))).status,404);
        assert.equal((await handler(context({ action:'resume',gameId:game.id }, { user: rival }))).status,404);
        const first = await handler(context(answer(0))); assert.equal(first.status,200); assert.equal((await first.json()).score,1);
        const duplicate = await handler(context(answer(0))); assert.equal((await duplicate.json()).score,1);
        assert.equal((await handler(context({ ...answer(0), answerIndex: 1 }))).status,409);
        const resumed = (await (await handler(context({ action:'resume',gameId:game.id }))).json()).game;
        assert.equal(resumed.answers.length,1); assert.equal(resumed.answers[0].correctIndex,0); assert.equal(resumed.questions[1].correctIndex,undefined);
        for (let index = 1; index < 5; index++) assert.equal((await handler(context(answer(index)))).status,200);
        const completed = (await (await handler(context({ action:'resume',gameId:game.id }))).json()).game;
        assert.equal(completed.completed,true); assert.equal(completed.score,5); assert.equal(providerCalls,1);
        await db.exec('reset role;'); const stored = (await db.query('select * from public.ai_game_sessions')).rows[0]; assert.equal(stored.score,5); assert.equal(stored.status,'completed'); assert.ok(stored.completed_at);
        const quota = await handler(context(generate())); assert.equal(quota.status,429); assert.equal(providerCalls,1);
        await db.exec('reset role; set role authenticated;');
        await assert.rejects(() => db.query('select * from public.ai_game_sessions'), /permission denied/);
        await assert.rejects(() => db.query('select public.ai_game_reserve($1,$2,$3)',[student,'teorie','mediu']), /permission denied/);
        await db.exec('reset role; set role anon;'); await assert.rejects(() => db.query('select * from public.ai_game_sessions'), /permission denied/);
    } finally { await db.close(); }
});

test('AI provider refusal, malformed JSON, invalid content, non-2xx, oversized response and timeout fail closed and consume one reservation', async () => {
    for (const provider of [
        () => new Response('not-json'),
        () => new Response('null'),
        () => new Response(JSON.stringify({ choices: [{ finish_reason:'stop',message:{ content:'not-json' } }] })),
        () => new Response(JSON.stringify({ choices: [{ finish_reason:'stop',message:{ refusal:'Refused' } }] })),
        () => new Response(JSON.stringify({ choices: [{ finish_reason:'length',message:{ content:JSON.stringify(sampleAIQuiz()) } }] })),
        () => aiProviderResponse({ title: 'Invalid', questions: [] }),
        () => new Response('upstream-secret-that-must-not-leak', { status: 401 }),
        () => new Response('x'.repeat(65537)),
        () => { throw new DOMException('timeout','TimeoutError'); },
        () => { throw new TypeError('network'); },
    ]) {
        const db = await setup();
        try {
            const handler = createAIGameHandler({ env, createClient: aiGamesClient(db), logger, fetch: provider });
            const response = await handler(context(generate())); assert.ok([502,504].includes(response.status),await response.clone().text());
            const output = await response.text(); assert.ok(!output.includes(env.OPENAI_API_KEY)); assert.ok(!output.includes('upstream-secret'));
            await db.exec('reset role;'); const rows=(await db.query('select status from public.ai_game_sessions')).rows; assert.equal(rows.length,1); assert.equal(rows[0].status,'failed');
            assert.equal((await handler(context(generate()))).status,429);
        } finally { await db.close(); }
    }
});

test('AI quotas enforce exact per-user/global rolling-day limits and reject inactive accounts; answer expiry persists', async () => {
    const db=await setup();
    try {
        await db.query(`insert into public.ai_game_sessions(user_id,topic,level,created_at) select $1,'teorie','incepator',clock_timestamp()-interval '2 minutes'-make_interval(secs=>i) from generate_series(1,10) i`,[student]);
        await db.exec('set role service_role;');
        await assert.rejects(()=>db.query('select public.ai_game_reserve($1,$2,$3)',[student,'teorie','incepator']),/10 generări/);
        await db.exec('reset role;');
        await db.exec("update public.ai_game_sessions set created_at=clock_timestamp()-interval '25 hours'");
        await db.exec('set role service_role;');
        const id=(await db.query('select public.ai_game_reserve($1,$2,$3) as id',[student,'teorie','incepator'])).rows[0].id;assert.ok(id);
        await db.exec('reset role;');
        await db.query(`insert into public.ai_game_sessions(user_id,topic,level,created_at) select $1,'teorie','incepator',clock_timestamp()-interval '2 minutes' from generate_series(1,199)`,[student]);
        await db.exec('set role service_role;');await assert.rejects(()=>db.query('select public.ai_game_reserve($1,$2,$3)',[rival,'ritm','mediu']),/platformei/);
        await db.exec('reset role;');await db.query('update public.profiles set is_active=false where id=$1',[rival]);await db.exec('set role service_role;');
        await assert.rejects(()=>db.query('select public.ai_game_reserve($1,$2,$3)',[rival,'ritm','mediu']),/Contul/);
        await db.exec('reset role;');await db.query("update public.ai_game_sessions set status='ready',quiz=$1,created_at=clock_timestamp()-interval '25 hours' where id=$2",[JSON.stringify(sampleAIQuiz()),id]);await db.exec('set role service_role;');
        await assert.rejects(()=>db.query('select public.ai_game_answer($1,$2,0,0)',[student,id]),/expirat/);
    } finally { await db.close(); }
});
