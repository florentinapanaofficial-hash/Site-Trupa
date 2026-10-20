import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { parseLrc, activeLyricIndex, parseTimestamp } from './lrc.js';
import { startLiveMonitor } from './liveMonitor.js';
import { transcriptionToLrc } from '../../supabase/functions/_shared/lyrics.js';
import { createLyricsHandler } from '../../supabase/functions/generate-lyrics/handler.js';

test('LRC parses line/word timestamps, offsets, repeated verses and seek backwards without inventing word times', () => {
    assert.equal(parseTimestamp('01:03.5'), 63.5);
    assert.equal(parseTimestamp('00:60.00'), null);
    const plain = parseLrc('[00:02.50] Salut\n[00:01.00][00:05.00]Refren\n[offset:-500]');
    assert.deepEqual(plain.map(line => line.time), [0.5, 2, 4.5]);
    assert.equal(plain[0].words, undefined);
    assert.equal(activeLyricIndex(plain, 0), -1);
    assert.equal(activeLyricIndex(plain, 4.6), 2);
    assert.equal(activeLyricIndex(plain, 0.6), 0);
    const enhanced = parseLrc('[00:01.00]<00:01.00>Bună <00:01.30><00:01.50>ziua<00:02.00>')[0];
    assert.equal(enhanced.words[activeLyricIndex(enhanced.words, 1.1)].text, 'Bună ');
    assert.equal(enhanced.words[activeLyricIndex(enhanced.words, 1.4)].text, '');
    assert.equal(enhanced.words[activeLyricIndex(enhanced.words, 1.6)].text, 'ziua');
    assert.deepEqual(parseLrc('Text fără timpi\n[ar:Profesor]'), []);
});

test('Whisper word output becomes enhanced LRC with real word boundaries and line fallback', () => {
    const lrc = transcriptionToLrc({ words: [{ start: 59.999, end: 60.4, word: 'Salut' }, { start: 61, end: 61.3, word: 'lume!' }] });
    assert.match(lrc, /^\[01:00.00\]<01:00.00>Salut <01:00.40><01:01.00>lume! <01:01.30>$/);
    assert.equal(parseLrc(lrc)[0].words[0].time, 60);
    assert.equal(transcriptionToLrc({ segments: [{ start: 2, text: 'linie' }] }), '[00:02.00] linie');
    assert.throws(() => transcriptionToLrc({ text: 'Fără timpi' }));
    assert.throws(() => transcriptionToLrc({ words: [{ start: -1, end: 1, word: 'invalid' }] }));
    assert.throws(() => transcriptionToLrc({ words: [{ start: 2, end: 3, word: 'Stop!' }, { start: 1, end: 2, word: 'invalid' }] }));
});

function audioMock() {
    const nodes = [];
    const gain = () => ({ value: 0, setTargetAtTime(value) { this.value = value; } });
    function node(type) {
        const result = { type, connections: [], disconnected: false, gain: gain(), threshold: gain(), knee: gain(), ratio: gain(), attack: gain(), release: gain(), connect(target) { this.connections.push(target); return target; }, disconnect() { this.disconnected = true; } };
        nodes.push(result); return result;
    }
    const track = { stopped: 0, stop() { this.stopped++; } };
    const stream = { getTracks: () => [track] };
    const context = { state: 'suspended', currentTime: 0, sampleRate: 1000, destination: node('destination'), async resume() { this.state = 'running'; }, async close() { this.state = 'closed'; }, createMediaStreamSource: () => node('source'), createGain: () => node('gain'), createConvolver: () => node('convolver'), createDynamicsCompressor: () => node('limiter'), createBuffer: (channels, length) => ({ getChannelData: () => new Float32Array(length), length, numberOfChannels: channels }) };
    return { nodes, context, stream, track };
}

test('live monitor routes dry and convolver wet paths through gain/limiter and releases every resource', async () => {
    const mock = audioMock(), abort = new AbortController();
    const live = await startLiveMonitor({ signal: abort.signal, createContext: () => mock.context, getUserMedia: async constraints => { assert.equal(constraints.video, false); return mock.stream; } });
    const source = mock.nodes.find(node => node.type === 'source');
    assert.equal(source.connections.length, 2);
    assert.ok(source.connections.some(node => node.type === 'convolver'));
    assert.equal(mock.nodes.find(node => node.type === 'convolver').buffer.length, 1800);
    live.setMix(1);
    const gains = mock.nodes.filter(node => node.type === 'gain');
    assert.ok(Math.abs(gains[0].gain.value) < 1e-10);
    assert.equal(gains[1].gain.value, 1);
    live.setMix(0); assert.equal(gains[0].gain.value, 1); assert.equal(gains[1].gain.value, 0);
    abort.abort(); live.stop();
    assert.equal(mock.track.stopped, 1);
    assert.equal(mock.context.state, 'closed');
    assert.ok(mock.nodes.filter(node => node.type !== 'destination').every(node => node.disconnected));
});

test('pending microphone permission is cancelled safely and rejected permission closes AudioContext', async () => {
    const mock = audioMock(), abort = new AbortController();
    let resolve, called = false;
    const pending = startLiveMonitor({ signal: abort.signal, createContext: () => mock.context, getUserMedia: () => { called = true; return new Promise(done => { resolve = done; }); } });
    await Promise.resolve(); assert.equal(called, true); abort.abort(); resolve(mock.stream);
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(mock.track.stopped, 1); assert.equal(mock.context.state, 'closed');
    const rejected = audioMock();
    await assert.rejects(startLiveMonitor({ signal: new AbortController().signal, createContext: () => rejected.context, getUserMedia: async () => { throw new DOMException('Denied', 'NotAllowedError'); } }), { name: 'NotAllowedError' });
    assert.equal(rejected.context.state, 'closed');
});

const teacherId = '11111111-1111-4111-8111-111111111111';
const pieceId = '22222222-2222-4222-8222-222222222222';
function edgeFixture(options = {}) {
    const calls = { provider: 0, download: 0, reserved: 0 };
    function query(table) {
        return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: table === 'profiles' ? { role: options.role || 'teacher', is_active: true, is_locked: options.locked || false } : { id: pieceId, audio_pozitiv_path: 'canto/positive.mp3', positive_url: options.externalPositive ? 'https://media.example/positive.mp3' : null }, error: null }; } };
    }
    const auth = { auth: { getUser: async () => ({ data: { user: options.invalidAuth ? null : { id: teacherId } }, error: null }) }, from: query, rpc: async () => ({ data: options.session !== false, error: null }) };
    const admin = { from: query, rpc: async () => { calls.reserved++; return { data: options.reserved !== false, error: options.noMigration ? { message: 'missing' } : null }; }, storage: { from: name => { assert.equal(name, 'academy-media'); return { info: async () => ({ data: { size: options.size ?? 5 } }), download: async () => { calls.download++; return { data: new Blob(['ID3mock']) }; } }; } } };
    const handler = createLyricsHandler({ createClient: (url, key) => key === 'anon' ? auth : admin, env: key => key === 'SUPABASE_ANON_KEY' ? 'anon' : key === 'OPENAI_API_KEY' && options.noKey ? undefined : 'test', logger: { error() {} }, fetch: async (url, request) => { calls.provider++; assert.equal(url, 'https://api.openai.com/v1/audio/transcriptions'); assert.equal(request.body.get('model'), 'whisper-1'); assert.deepEqual(request.body.getAll('timestamp_granularities[]'), ['word', 'segment']); return new Response(JSON.stringify({ words: [{ start: 1, end: 1.5, word: 'Bună' }] }), { status: options.providerStatus || 200 }); } });
    const request = (input = {}, headers = {}) => new Request('http://edge.test', { method: 'POST', headers: { Authorization: 'Bearer verified', Origin: 'http://localhost:5180', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ pieceId, audioPath: 'canto/positive.mp3', consent: true, ...input }) });
    return { handler, calls, request };
}

test('AI endpoint denies students, locked/revoked sessions, wrong paths and missing consent before accessing audio/provider', async () => {
    for (const [options, input, status] of [[{ externalPositive: true }, {}, 400], [{ role: 'student' }, {}, 403], [{ locked: true }, {}, 403], [{ session: false }, {}, 403], [{ invalidAuth: true }, {}, 401], [{}, { audioPath: 'https://attacker.test/file.mp3' }, 400], [{}, { consent: false }, 400], [{ noKey: true }, {}, 503], [{ size: 25 * 1024 * 1024 }, {}, 413], [{ reserved: false }, {}, 429], [{ noMigration: true }, {}, 503]]) {
        const f = edgeFixture(options);
        assert.equal((await f.handler(f.request(input))).status, status);
        assert.equal(f.calls.provider, 0); assert.equal(f.calls.download, 0);
    }
    const f = edgeFixture();
    assert.equal((await f.handler(f.request({}, { Origin: 'https://attacker.test' }))).status, 403);
    assert.equal((await f.handler(f.request({ extra: 'x'.repeat(3000) }))).status, 413);
    assert.equal((await f.handler(new Request('http://edge.test', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5180' } }))).status, 204);
    assert.equal((await f.handler(new Request('http://edge.test', { method: 'POST' }))).status, 401);
});

test('AI endpoint transcribes authorized saved positive only and returns draft LRC, never writes piece', async () => {
    const f = edgeFixture();
    const response = await f.handler(f.request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5180');
    const data = await response.json(); assert.match(data.lrc, /<00:01.00>Bună/); assert.equal(data.reviewRequired, true);
    assert.equal(f.calls.provider, 1); assert.equal(f.calls.reserved, 1);
    const failed = edgeFixture({ providerStatus: 429 });
    assert.equal((await failed.handler(failed.request())).status, 502);
});

test('AI cooldown migration allows service-only atomic reservation every two minutes, never stores audio/lyrics', async () => {
    const db = new PGlite();
    try {
        await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid primary key); CREATE TABLE public.profiles(id uuid primary key, role text, is_active boolean, is_locked boolean); INSERT INTO auth.users VALUES ('${teacherId}'); INSERT INTO public.profiles VALUES ('${teacherId}', 'teacher', true, false);`);
        await db.exec(await readFile(new URL('../../supabase/migrations/20261020000006_generate_lyrics.sql', import.meta.url), 'utf8'));
        await db.exec('SET ROLE service_role');
        assert.equal((await db.query('select public.academy_reserve_lyrics_request($1) as ok', [teacherId])).rows[0].ok, true);
        assert.equal((await db.query('select public.academy_reserve_lyrics_request($1) as ok', [teacherId])).rows[0].ok, false);
        await db.exec("UPDATE public.academy_lyrics_requests SET last_requested_at = now() - interval '3 minutes'");
        assert.equal((await db.query('select public.academy_reserve_lyrics_request($1) as ok', [teacherId])).rows[0].ok, true);
        await db.exec('RESET ROLE; SET ROLE authenticated');
        await assert.rejects(db.query('select public.academy_reserve_lyrics_request($1)', [teacherId]), /permission denied/);
        await assert.rejects(db.query('select * from public.academy_lyrics_requests'), /permission denied/);
    } finally { await db.close(); }
});
