import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLrc, activeLyricIndex } from './lrc.js';
import { resolveAudioSource } from './pieces.js';
import { noteFrequency, recordedNote, MAX_RECORDING_MS, PIANO_KEYS, INSTRUMENTS, createVoice } from './piano.js';
import { startMetronome } from './metronome.js';
import { classConfig } from './liveClass.js';
import { classClaims, signClassToken } from '../../supabase/functions/_shared/class-token.js';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { demoSequence, parseStudioMidi, matchNote, accuracy, loopPosition, StudioClock, visibleNotes, STUDIO_METERS, studioBeats, createStudioMixer, createStudioPlayback, createHomeworkCapture } from './interactiveStudio.js';
import midiPackage from '@tonejs/midi';
import { scoreTimeline, scoreMidi, pitchFromStaff, scorePitchNumber } from './scoreEditor.js';
import { parseMidi } from 'midi-file';
import { createHomeworkUpload } from './homeworkUpload.js';
import { generateKeyPairSync } from 'node:crypto';
import { loginEmailForIdentity, signInWithIdentity } from './studentCredentials.js';
import { runInNewContext } from 'node:vm';
import { transformWithEsbuild } from 'vite';
import { cantoPayload, saveCantoPiece, saveMusicPiece, saveStudyResource, validateScorePdf, validateCantoMp3, MAX_CANTO_MP3 } from './canto.js';

test('Canto validates text and MP3, preserves unchanged audio and rolls back new uploads on failure', async () => {
    const form = { title: ' Titlu manual ', grupa: ' Grupa 1 ', versuri_text: 'Strofa 1\n\n<script>text</script>', positive_url: 'https://cdn.example/voice.mp3', negative_url: '', is_published: true };
    assert.equal(cantoPayload(form).title, 'Titlu manual');
    assert.equal(cantoPayload(form).versuri_text, form.versuri_text);
    assert.throws(() => cantoPayload({ ...form, positive_url: 'javascript:alert(1)' }));
    assert.throws(() => cantoPayload({ ...form, title: ' ' }));
    const mp3 = new File(['ID3audio'], 'nume-fisier.mp3', { type: 'audio/mpeg' });
    await validateCantoMp3(mp3);
    await assert.rejects(validateCantoMp3(new File(['<html>'], 'fals.mp3', { type: 'audio/mpeg' })));
    await assert.rejects(validateCantoMp3({ name: 'mare.mp3', type: 'audio/mpeg', size: MAX_CANTO_MP3 + 1 }));
    const uploaded = [];
    const cleaned = [];
    let saved;
    let fail = false;
    const response = { select: () => ({ single: async () => ({ data: fail ? null : { id: 'piece', ...saved }, error: fail ? { message: 'denied' } : null }) }) };
    const query = { ...response, eq: () => query };
    const client = { from: (table) => {
        assert.equal(table, 'pieces');
        return { insert: (payload) => { saved = payload; return response; }, update: (payload) => { saved = payload; return query; } };
    } };
    const options = { client, form, userId: 'teacher', upload: async (path) => uploaded.push(path), removeUploaded: async (paths) => { cleaned.push(...paths); } };
    const created = await saveCantoPiece({ ...options, files: { pozitiv: mp3 } });
    assert.equal(created.title, 'Titlu manual');
    assert.equal(saved.positive_url, null);
    assert.match(saved.audio_pozitiv_path, /^canto\/[a-f0-9-]+\/pozitiv.mp3$/);
    await saveCantoPiece({ ...options, piece: { id: 'piece' } });
    assert.equal('audio_pozitiv_path' in saved, false);
    assert.equal('audio_negativ_path' in saved, false);
    fail = true;
    await assert.rejects(saveCantoPiece({ ...options, files: { pozitiv: mp3, negativ: mp3 } }));
    assert.deepEqual(cleaned, uploaded.slice(1));
});

test('Canto migration is repeatable, preserves pieces and uses caller RLS in its view', async () => {
    const db = new PGlite();
    try {
        await db.exec(`
            create role anon;
            create role authenticated;
            create table public.pieces (
                id text primary key, title text, discipline text, positive_url text, negative_url text,
                audio_pozitiv_path text, audio_negativ_path text, is_published boolean
            );
            insert into public.pieces (id,title,discipline,is_published) values
                ('canto','Titlu profesor','canto',true), ('draft','Ascunsa','canto',false), ('orga','Orga','orga',true);
            alter table public.pieces enable row level security;
            grant select on public.pieces to authenticated;
            create policy published on public.pieces for select to authenticated using (is_published);
            create table public.canto_playlist (
                id text primary key, titlu_piesa text not null, grupo text, positivo_url text,
                negativo_url text, versuri_text text, created_at timestamptz not null default now()
            );
            insert into public.canto_playlist (id,titlu_piesa) values ('legacy','Piesă veche');
        `);
        const migration = await readFile(new URL('../../supabase/migrations/20261019_canto_library.sql', import.meta.url), 'utf8');
        await db.exec(migration);
        await db.exec(migration);
        const legacy = await db.query(`select id,titlu_piesa from public.canto_playlist_legacy`);
        assert.deepEqual(legacy.rows, [{ id: 'legacy', titlu_piesa: 'Piesă veche' }]);
        await db.query(`update public.pieces set grupa = $1, versuri_text = $2 where id = 'canto'`, ['Grupa mică', 'Prima strofă\nA doua linie']);
        await assert.rejects(db.query(`update public.pieces set versuri_text = $1 where id = 'canto'`, ['x'.repeat(100001)]));
        await db.exec('set role authenticated');
        const { rows } = await db.query('select * from public.canto_playlist');
        assert.equal(rows.length, 1);
        assert.equal(rows[0].titlu_piesa, 'Titlu profesor');
        assert.equal(rows[0].grupa, 'Grupa mică');
        assert.equal(rows[0].versuri_text, 'Prima strofă\nA doua linie');
        await assert.rejects(db.exec(`update public.canto_playlist set titlu_piesa = 'Modificat'`));
        await db.exec('reset role; set role anon');
        await assert.rejects(db.exec('select * from public.canto_playlist'));
        await db.exec('reset role');
        assert.equal((await db.query('select count(*)::int as count from public.pieces')).rows[0].count, 3);
    } finally {
        await db.close();
    }
});

test('create-student requires an active teacher and stores synthetic email and real metadata', async () => {
    let handler;
    let role = 'teacher';
    let sessionAllowed = true;
    let active = true;
    let duplicate = false;
    let profileFailure = false;
    const creations = [];
    const deletions = [];
    const profiles = [];
    const admin = {
        auth: {
            admin: {
                createUser: async (input) => { creations.push(input); return { data: { user: { id: 'new-student' } } }; },
                deleteUser: async (id) => { deletions.push(id); return {}; },
            }
        },
        from: () => ({
            select: () => ({ eq: (field) => ({ maybeSingle: async () => ({ data: field === 'username' ? (duplicate ? { id: 'existing' } : null) : { role, is_active: active } }) }) }),
            update: (changes) => {
                profiles.push(changes);
                return { eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: profileFailure ? null : { id: 'new-student' } }) }) }) };
            },
        }),
    };
    const source = await readFile(new URL('../../supabase/functions/create-student/index.ts', import.meta.url), 'utf8');
    const transformed = await transformWithEsbuild(source.replace(/^import .*;\r?\n/, ''), 'create-student.ts', { loader: 'ts', target: 'es2022' });
    runInNewContext(transformed.code, {
        Request, Response, Set,
        Deno: { env: { get: (name) => name }, serve: (callback) => { handler = callback; } },
        createClient: (_url, key) => key === 'SUPABASE_SERVICE_ROLE_KEY' ? admin : { rpc: async () => ({ data: sessionAllowed }), auth: { getUser: async () => ({ data: { user: { id: 'teacher' } } }) } },
    });
    const input = { firstName: 'Andrei', lastName: 'Popescu', username: 'andrei.popescu', password: 'ParolaTest!1234' };
    const request = (body = input, authorization = 'Bearer session') => new Request('https://academy.example/create-student', { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await handler(request(input, ''))).status, 401);
    sessionAllowed = false;
    assert.equal((await handler(request())).status, 403);
    assert.equal(creations.length, 0);
    sessionAllowed = true;
    role = 'student';
    assert.equal((await handler(request())).status, 403);
    role = 'teacher'; active = false;
    assert.equal((await handler(request())).status, 403);
    active = true;
    assert.equal((await handler(request({ ...input, username: 'bad@name' }))).status, 400);
    duplicate = true;
    assert.equal((await handler(request())).status, 409);
    duplicate = false;
    assert.equal(creations.length, 0);
    assert.equal((await handler(request())).status, 201);
    assert.deepEqual(JSON.parse(JSON.stringify(creations[0])), { email: loginEmailForIdentity(input.username), password: input.password, email_confirm: true, app_metadata: { academy_provisioned: true }, user_metadata: { full_name: 'Andrei Popescu' } });
    assert.deepEqual(JSON.parse(JSON.stringify(profiles[0])), { full_name: 'Andrei Popescu', username: 'andrei.popescu', role: 'student' });
    profileFailure = true;
    assert.equal((await handler(request())).status, 500);
    assert.deepEqual(deletions, ['new-student']);
});

test('student username login uses the new domain and preserves legacy accounts', async () => {
    assert.equal(loginEmailForIdentity(' Andrei.Popescu '), 'andrei.popescu@student.academy.local');
    assert.equal(loginEmailForIdentity(' Teacher@Example.com '), 'teacher@example.com');
    const calls = [];
    let failure = null;
    const auth = {
        signInWithPassword: async (credentials) => {
            calls.push(credentials);
            return { error: failure, data: { user: { id: 'student' } } };
        }
    };
    await signInWithIdentity(auth, 'andrei.popescu', 'secret');
    assert.deepEqual(calls, [{ email: 'andrei.popescu@student.academy.local', password: 'secret' }]);
    calls.length = 0;
    failure = { code: 'invalid_credentials' };
    await assert.rejects(() => signInWithIdentity(auth, 'andrei.popescu', 'wrong'));
    assert.deepEqual(calls.map((call) => call.email), ['andrei.popescu@student.academy.local', 'andrei.popescu@students.academy.invalid']);
    calls.length = 0;
    await assert.rejects(() => signInWithIdentity(auth, 'teacher@example.com', 'wrong'));
    assert.equal(calls.length, 1);
    calls.length = 0;
    failure = { code: 'over_request_rate_limit' };
    await assert.rejects(() => signInWithIdentity(auth, 'andrei.popescu', 'secret'));
    assert.equal(calls.length, 1);
    calls.length = 0;
    auth.signInWithPassword = async (credentials) => {
        calls.push(credentials);
        return calls.length === 1 ? { error: { code: 'invalid_credentials' } } : { data: { user: { id: 'legacy' } } };
    };
    assert.equal((await signInWithIdentity(auth, 'andrei.popescu', 'secret')).user.id, 'legacy');
});

test('Drive homework validates JSON/legacy service accounts, authorization, multipart uploads and partial failures', async () => {
    const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
    const env = { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon', GOOGLE_CLIENT_EMAIL: 'test@example.invalid', GOOGLE_PRIVATE_KEY: privateKey.replace(/\n/g, '\\n'), GOOGLE_DRIVE_FOLDER_ID: 'folder' };
    let role = 'student';
    let active = true;
    let user = { id: 'student-id' };
    let uploads = 0;
    let fail = false;
    let catalogFail = false;
    let expectedEmail = env.GOOGLE_CLIENT_EMAIL;
    let failAtUpload = null;
    let driveResponse = { id: 'file-id', webViewLink: 'https://drive.google.com/file/d/file-id/view' };
    const catalogRows = [];
    const upload = createHomeworkUpload({
        env, createClient: () => ({
            auth: { getUser: async () => ({ data: { user } }) },
            from: (table) => {
                if (table === 'catalog_teme') return {
                    insert: async (row) => {
                        if (catalogFail) return { error: { message: 'sensitive database error' } };
                        catalogRows.push(row);
                        return { error: null };
                    }
                };
                assert.equal(table, 'profiles');
                return { select: () => ({ eq: () => ({ single: async () => ({ data: { role, is_active: active, full_name: 'Elev test' } }) }) }) };
            },
        }), createDrive: async (credentials) => {
            assert.equal(credentials.key, privateKey);
            assert.equal(credentials.email, expectedEmail);
            return {
                files: {
                    create: async (options) => {
                        uploads += 1;
                        assert.deepEqual(options.requestBody.parents, ['folder']);
                        assert.equal(options.supportsAllDrives, true);
                        assert.ok(['audio/midi', 'audio/mpeg'].includes(options.media.mimeType));
                        assert.match(options.requestBody.name, /^Elev_test_(Audio|MIDI)\.(mid|mp3)$/);
                        let content = '';
                        for await (const chunk of options.media.body) content += chunk.toString();
                        assert.equal(content, options.media.mimeType === 'audio/mpeg' ? 'ID3audio' : 'MThdtest');
                        if (fail || uploads === failAtUpload) throw new Error('secret upstream error');
                        return { data: driveResponse };
                    }
                }
            };
        }
    });
    const request = (headers = {}, name = 'tema.mid', bytes = 'MThdtest', metadata = {}) => {
        const form = new FormData();
        form.set('file', new Blob([bytes], { type: 'audio/midi' }), name);
        for (const [key, value] of Object.entries(metadata)) form.set(key, value);
        return new Request('https://academy.example/api/upload-homework/', { method: 'POST', headers: { Authorization: 'Bearer session', ...headers }, body: form });
    };
    assert.equal((await upload(request({ Authorization: '' }))).status, 401);
    assert.equal((await upload(request({ Origin: 'https://evil.example' }))).status, 403);
    user = null;
    assert.equal((await upload(request())).status, 401);
    user = { id: 'student-id' };
    role = 'inspector';
    assert.equal((await upload(request())).status, 403);
    role = 'student'; active = false;
    assert.equal((await upload(request())).status, 403);
    active = true;
    env.GOOGLE_PRIVATE_KEY = 'invalid';
    assert.equal((await upload(request())).status, 503);
    env.GOOGLE_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n');
    assert.equal((await upload(request({}, 'tema.html'))).status, 415);
    assert.equal((await upload(request({}, 'tema.constructor'))).status, 415);
    assert.equal((await upload(request({}, 'tema.mid', 'not-midi'))).status, 415);
    assert.equal((await upload(request({}, 'tema.mid', 'MThdtest', { title: 'a'.repeat(201) }))).status, 400);
    assert.equal((await upload(request({}, 'tema.mid', 'MThdtest', { studentNote: 'a'.repeat(501) }))).status, 400);
    assert.equal((await upload(request({}, 'tema.mid', 'MThdtest', { pieceId: 'invalid' }))).status, 400);
    assert.equal((await upload(request({ 'Content-Length': String(56 * 1024 * 1024) }))).status, 413);
    assert.equal(uploads, 0);
    const result = await upload(request());
    assert.equal(result.status, 201);
    assert.deepEqual(await result.json(), { success: true, id: 'file-id', webViewLink: 'https://drive.google.com/file/d/file-id/view' });
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.deepEqual(catalogRows, [{ student_id: 'student-id', student_name: 'Elev test', drive_url: 'https://drive.google.com/file/d/file-id/view', title: '', student_note: null, piece_id: null }]);
    catalogFail = true;
    const catalogFailure = await upload(request());
    assert.equal(catalogFailure.status, 503);
    assert.match(await catalogFailure.text(), /înscrierea în catalog nu a fost confirmată/);
    assert.equal(catalogRows.length, 1);
    fail = true;
    const failure = await upload(request());
    assert.equal(failure.status, 502);
    assert.doesNotMatch(await failure.text(), /secret upstream error/);
    assert.equal(catalogRows.length, 1);
    fail = false;
    catalogFail = false;
    assert.equal((await upload(request({}, 'tema.mid', 'MThdtest', { title: ' Studiu ', studentNote: ' Mesaj ', pieceId: '11111111-1111-4111-8111-111111111111' }))).status, 201);
    assert.deepEqual(catalogRows[1], { student_id: 'student-id', student_name: 'Elev test', drive_url: 'https://drive.google.com/file/d/file-id/view', title: 'Studiu', student_note: 'Mesaj', piece_id: '11111111-1111-4111-8111-111111111111' });

    const jsonCredentials = { type: 'service_account', client_email: 'json@example.invalid', private_key: privateKey };
    const validJson = JSON.stringify(jsonCredentials);
    env.GOOGLE_CREDENTIALS = validJson;
    expectedEmail = jsonCredentials.client_email;
    // JSON credentials must win over even a complete legacy configuration.
    const jsonResult = await upload(request({}, 'tema.mp3', 'ID3audio'));
    assert.equal(jsonResult.status, 201);
    assert.deepEqual(await jsonResult.json(), { success: true, id: 'file-id', webViewLink: driveResponse.webViewLink });
    delete env.GOOGLE_CLIENT_EMAIL;
    delete env.GOOGLE_PRIVATE_KEY;
    env.GOOGLE_CREDENTIALS = JSON.stringify({ ...jsonCredentials, private_key: privateKey.replace(/\n/g, '\\n') });
    assert.equal((await upload(request())).status, 201);
    const beforeInvalid = uploads;
    const catalogBeforeInvalid = catalogRows.length;
    const ecKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ type: 'pkcs8', format: 'pem' });
    for (const invalid of ['', '{secret-invalid-json', 'null', '[]', '"text"', '42',
        JSON.stringify({ ...jsonCredentials, type: 'authorized_user' }),
        JSON.stringify({ ...jsonCredentials, client_email: undefined }),
        JSON.stringify({ ...jsonCredentials, client_email: 'invalid' }),
        JSON.stringify({ ...jsonCredentials, private_key: undefined }),
        JSON.stringify({ ...jsonCredentials, private_key: 'secret-invalid-key' }),
        JSON.stringify({ ...jsonCredentials, private_key: ecKey }),
    ]) {
        env.GOOGLE_CREDENTIALS = invalid;
        const invalidResponse = await upload(request());
        assert.equal(invalidResponse.status, 503);
        assert.equal(invalidResponse.headers.get('content-type'), 'application/json');
        const error = await invalidResponse.json();
        assert.match(error.error, /GOOGLE_CREDENTIALS/);
        assert.doesNotMatch(error.error, /secret-invalid|BEGIN PRIVATE KEY|json@example/);
    }
    env.GOOGLE_CLIENT_EMAIL = 'legacy@example.invalid';
    env.GOOGLE_PRIVATE_KEY = privateKey;
    env.GOOGLE_CREDENTIALS = '{invalid-json-with-valid-legacy';
    assert.equal((await upload(request())).status, 503);
    assert.equal(uploads, beforeInvalid);
    assert.equal(catalogRows.length, catalogBeforeInvalid);
    env.GOOGLE_CREDENTIALS = validJson;
    delete env.GOOGLE_CLIENT_EMAIL;
    delete env.GOOGLE_PRIVATE_KEY;
    const folder = env.GOOGLE_DRIVE_FOLDER_ID;
    delete env.GOOGLE_DRIVE_FOLDER_ID;
    assert.equal((await upload(request())).status, 503);
    env.GOOGLE_DRIVE_FOLDER_ID = folder;
    delete env.GOOGLE_CREDENTIALS;
    assert.equal((await upload(request())).status, 503);
    env.GOOGLE_CREDENTIALS = validJson;
    const malformed = new Request('https://academy.example/api/upload-homework/', {
        method: 'POST', headers: { Authorization: 'Bearer token', 'Content-Type': 'multipart/form-data; boundary=test' }, body: 'broken',
    });
    assert.equal((await upload(malformed)).status, 400);
    const wrongType = new Request('https://academy.example/api/upload-homework/', {
        method: 'POST', headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal((await upload(wrongType)).status, 415);
    assert.equal(uploads, beforeInvalid);

    const pairRequest = () => {
        const form = new FormData();
        form.set('file', new File(['ID3audio'], 'tema.mp3', { type: 'audio/mpeg' }));
        form.set('midiFile', new File(['MThdtest'], 'tema.mid', { type: 'audio/midi' }));
        return new Request('https://academy.example/api/upload-homework/', { method: 'POST', headers: { Authorization: 'Bearer token' }, body: form });
    };
    const beforePair = uploads;
    const pairResult = await upload(pairRequest());
    assert.equal(pairResult.status, 201);
    assert.equal(uploads, beforePair + 2);
    assert.deepEqual(await pairResult.json(), { success: true, id: 'file-id', webViewLink: driveResponse.webViewLink, midiId: 'file-id', midiWebViewLink: driveResponse.webViewLink });
    assert.equal(catalogRows.at(-1).midi_url, driveResponse.webViewLink);
    const beforePartial = catalogRows.length;
    failAtUpload = uploads + 2;
    const partialResult = await upload(pairRequest());
    assert.equal(partialResult.status, 502);
    const partialBody = await partialResult.json();
    assert.match(partialBody.error, /Audio a fost încărcat/);
    assert.equal(partialBody.success, undefined);
    assert.equal(catalogRows.length, beforePartial);
    failAtUpload = null;
    const goodResponse = driveResponse;
    for (const invalid of [{}, { webViewLink: goodResponse.webViewLink }, { id: 'id', webViewLink: 'https://untrusted.example/file' }]) {
        driveResponse = invalid;
        const invalidResult = await upload(request());
        assert.equal(invalidResult.status, 502);
        assert.equal((await invalidResult.json()).success, undefined);
        assert.equal(catalogRows.length, beforePartial);
    }
    driveResponse = goodResponse;
    catalogFail = true;
    const jsonCatalogFailure = await upload(request());
    assert.equal(jsonCatalogFailure.status, 503);
    assert.match((await jsonCatalogFailure.json()).error, /înscrierea în catalog/);
    catalogFail = false;
    fail = true;
    const jsonDriveFailure = await upload(request());
    assert.equal(jsonDriveFailure.status, 502);
    assert.doesNotMatch(await jsonDriveFailure.text(), /secret upstream/);
});

test('score editor maps staff positions and exports exact note/rest timings including trailing silence', () => {
    assert.equal(pitchFromStaff(100, 100, 10), 'E4');
    assert.equal(pitchFromStaff(80, 100, 10), 'B4');
    assert.equal(pitchFromStaff(60, 100, 10), 'F5');
    assert.equal(pitchFromStaff(200, 100, 10), 'C4');
    assert.equal(scorePitchNumber('C4'), 60);
    const composition = [{ pitch: null, duration: '8' }, { pitch: 'C4', duration: 'q' }, { pitch: null, duration: 'h' }, { pitch: 'E4', duration: 'h' }, { pitch: 'G4', duration: '8' }, { pitch: null, duration: 'q' }];
    const timeline = scoreTimeline(composition);
    assert.equal(timeline.duration, 3.5);
    assert.deepEqual(timeline.events.map((event) => event.time), [0, 0.25, 0.75, 1.75, 2.75, 3]);
    const bytes = scoreMidi(composition, 'accordion');
    const midi = new midiPackage.Midi(bytes);
    assert.deepEqual(midi.tracks[0].notes.map((note) => [note.midi, note.time, note.duration]), [[60, 0.25, 0.5], [64, 1.75, 1], [67, 2.75, 0.25]]);
    const raw = parseMidi(bytes);
    assert.equal(raw.tracks[0].reduce((ticks, event) => ticks + event.deltaTime, 0) / raw.header.ticksPerBeat, 7);
    assert.equal(midi.tracks[0].instrument.number, 21);
    const rests = parseMidi(scoreMidi([{ pitch: null, duration: 'h' }]));
    assert.equal(rests.tracks[0].reduce((ticks, event) => ticks + event.deltaTime, 0), rests.header.ticksPerBeat * 2);
    assert.throws(() => scoreTimeline([{ pitch: 'C#4', duration: 'q' }]), /valid/);
});

test('homework capture mixes only student and MP3, finalizes chunks and reuses one media source', async () => {
    const connections = [];
    const disconnected = [];
    let stopped = false;
    let sources = 0;
    const destination = { stream: { getTracks: () => [{ stop() { stopped = true; } }] } };
    const mixer = { student: { connect(target) { connections.push(['student', target]); }, disconnect(target) { disconnected.push(target); } } };
    const audio = { destination: {}, createMediaStreamDestination: () => destination, createMediaElementSource() { sources += 1; return { connect(target) { connections.push(['mp3', target]); }, disconnect() { } }; } };
    let instance;
    class FakeRecorder {
        static isTypeSupported(type) { return type === 'audio/mp4'; }
        constructor(stream, options) { this.stream = stream; this.mimeType = options.mimeType; this.state = 'inactive'; instance = this; }
        start() { this.state = 'recording'; }
        stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['final'], { type: this.mimeType }) }); this.onstop(); }
    }
    const capture = createHomeworkCapture(audio, mixer, {}, FakeRecorder);
    assert.deepEqual(connections, [['mp3', audio.destination], ['mp3', destination], ['student', destination]]);
    let blob;
    capture.start((result) => { blob = result; }, assert.fail);
    instance.ondataavailable({ data: new Blob(['first']) });
    capture.stop();
    assert.equal(blob.type, 'audio/mp4');
    assert.equal(await blob.text(), 'firstfinal');
    capture.start((result) => { blob = result; }, assert.fail);
    capture.stop();
    assert.equal(await blob.text(), 'final');
    assert.equal(sources, 1);
    capture.dispose();
    assert.deepEqual(disconnected, [destination]);
    assert.equal(stopped, true);
    assert.throws(() => createHomeworkCapture(audio, mixer, {}, null), /MediaRecorder/);
});

test('studio meters accent only the first beat and follow MIDI tempo maps', () => {
    const midi = new midiPackage.Midi();
    midi.header.tempos = [{ ticks: 0, bpm: 120 }, { ticks: midi.header.ppq * 2, bpm: 60 }];
    midi.header.update();
    midi.addTrack().addNote({ midi: 60, ticks: 0, durationTicks: midi.header.ppq * 16 });
    const sequence = parseStudioMidi(midi.toArray());
    for (const signature of STUDIO_METERS) {
        const [count, unit] = signature.split('/').map(Number);
        const beats = studioBeats(sequence, 0, 14, signature).slice(0, count + 1);
        assert.equal(beats.length, count + 1);
        assert.deepEqual(beats.map((beat) => beat.accent), Array.from({ length: count + 1 }, (_, index) => index % count === 0));
        assert.equal(beats[1].time, unit === 4 ? 0.5 : 0.25);
    }
    assert.deepEqual(studioBeats(sequence, 0, 3.1, '3/4').map((beat) => beat.time), [0, 0.5, 1, 2, 3]);
});

test('studio routes demo and student independently, schedules on transport and cancels stale audio', () => {
    const audio = fakeAudio();
    const mixer = createStudioMixer(audio);
    assert.notEqual(mixer.demo, mixer.student);
    mixer.setDemo(0);
    mixer.setStudent(0.4);
    assert.deepEqual(audio.calls.slice(-2), [['setTargetAtTime', 0, 0, 0.01], ['setTargetAtTime', 0.4, 0, 0.01]]);
    const studentVoice = createVoice(audio, 72, 0, 'piano', undefined, mixer.student);
    assert.equal(studentVoice.gain.destination, mixer.student);
    const sequence = demoSequence();
    const playback = createStudioPlayback(audio, mixer);
    playback.sync({ sequence, position: 0.9, rate: 1, metronome: true });
    assert.equal(audio.oscillators[1].started, 0.09999999999999998);
    assert.equal(audio.oscillators[2].frequency.value, 800);
    const count = audio.oscillators.length;
    playback.sync({ sequence, position: 0.9, rate: 1, metronome: true });
    assert.equal(audio.oscillators.length, count);
    playback.reset();
    playback.sync({ sequence, position: 0.95, rate: 0.5, metronome: true });
    assert.ok(Math.abs(audio.oscillators.at(-1).started - 0.1) < 0.000001);
    playback.sync({ sequence, position: 1.5, rate: 1, signature: '3/4', metronome: true });
    assert.equal(audio.oscillators.at(-1).frequency.value, 1200);
    playback.sync({ sequence, position: 1.5, rate: 1, running: false });
    assert.equal(audio.oscillators.at(-1).stopped, 0);
    playback.sync({ sequence, position: 0.001, rate: 1, metronome: true });
    assert.equal(audio.oscillators.at(-1).frequency.value, 1200);
    assert.equal(audio.oscillators.at(-1).started, 0);
    playback.reset();
    const beforeLoop = audio.oscillators.length;
    playback.sync({ sequence, position: 0.95, rate: 1, end: 1.1 });
    assert.equal(audio.oscillators.length, beforeLoop + 1);
    assert.ok(Math.abs(audio.oscillators.at(-1).stopped - 0.28) < 0.000001);
    audio.state = 'suspended';
    playback.sync({ sequence, position: 1, rate: 1, metronome: true });
    assert.equal(audio.oscillators.length, beforeLoop + 1);
    assert.equal(audio.oscillators.at(-1).stopped, 0);
    audio.state = 'running';
    playback.sync({ sequence, position: 0.001, rate: 1, signature: '3/4', metronome: true });
    assert.equal(audio.oscillators.at(-1).frequency.value, 1200);
});

test('interactive studio parses MIDI and scores each onset once within a real-time tempo window', () => {
    const sequence = demoSequence();
    assert.equal(sequence.notes.length, 15);
    assert.equal(sequence.notes[0].note, 60);
    assert.equal(sequence.notes[0].time, 1);
    assert.throws(() => parseStudioMidi(new Uint8Array([1, 2, 3])));
    assert.equal(matchNote(sequence.notes, 60, 1.08, new Set(), 0.5)?.id, 0);
    assert.equal(matchNote(sequence.notes, 60, 1.1, new Set(), 0.5), null);
    assert.equal(matchNote(sequence.notes, 61, 1, new Set()), null);
    assert.equal(matchNote(sequence.notes, 60, 1, new Set([0])), null);
    assert.equal(matchNote(sequence.notes, 60, 1, new Set(), 1, 1.1, 2), null);
    assert.equal(visibleNotes(sequence, 1.1).length, 1);
    assert.equal(visibleNotes(sequence, 1.5).length, 0);
    assert.equal(accuracy(12, 15), 80);
    assert.equal(accuracy(0, 0), 0);
    assert.equal(loopPosition(4.2, 1, 4), 1.2000000000000002);
});

test('studio clock preserves position through pause, tempo changes and seeking', () => {
    let now = 0;
    const clock = new StudioClock(() => now);
    clock.play();
    now = 2;
    clock.setRate(0.5);
    now = 4;
    assert.equal(clock.read(), 3);
    clock.pause();
    now = 9;
    assert.equal(clock.read(), 3);
    clock.seek(1);
    clock.play();
    now = 11;
    assert.equal(clock.read(), 2);
});

test('LRC supports fractional seconds, repeated timestamps, sorting and offset', () => {
    const lines = parseLrc('[ar:Artist]\n[offset:-500]\n[00:12.50][00:20.125] Refren\n[00:01] Start\ninvalid');
    assert.deepEqual(lines, [{ time: 0.5, text: 'Start' }, { time: 12, text: 'Refren' }, { time: 19.625, text: 'Refren' }]);
    assert.equal(activeLyricIndex(lines, 0), -1);
    assert.equal(activeLyricIndex(lines, 12), 1);
    assert.equal(activeLyricIndex(lines, 1), 0);
    assert.deepEqual(parseLrc('[00:99] invalid'), []);
});

test('audio resolves only direct HTTP URLs and never legacy Storage paths', () => {
    assert.equal(resolveAudioSource({ audio_negativ_path: 'private/file.mp3' }, 'negativ'), null);
    assert.equal(resolveAudioSource({ negative_url: 'javascript:alert(1)' }, 'negativ'), null);
    assert.deepEqual(resolveAudioSource({ audio_negativ_path: 'old', negative_url: 'https://media.example/song.mp3' }, 'negativ'), { kind: 'url', value: 'https://media.example/song.mp3' });
});

test('piano tunes A4 to 440 Hz and records milliseconds without audio data', () => {
    assert.equal(noteFrequency(69), 440);
    assert.equal(noteFrequency(81), 880);
    assert.deepEqual(recordedNote(60, 1100, 1600, 1000), { note: 60, timestamp: 100, duration: 500 });
    assert.deepEqual(recordedNote(60, 299900, 305000, 0), { note: 60, timestamp: 299900, duration: 100 });
    assert.equal(MAX_RECORDING_MS, 300000);
});

test('SQL migrations preserve legacy results, grade new quizzes and isolate students with RLS', async () => {
    const db = new PGlite();
    const student = '11111111-1111-4111-8111-111111111111';
    const other = '22222222-2222-4222-8222-222222222222';
    const teacher = '33333333-3333-4333-8333-333333333333';
    try {
        await db.exec(`
            create role anon; create role authenticated; create role service_role;
            create schema auth;
            create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
            grant usage on schema auth to authenticated;
            create table public.profiles(id uuid primary key, role text, is_active boolean);
            insert into public.profiles values ('${student}','student',true),('${other}','student',true),('${teacher}','teacher',true);
            grant select on public.profiles to authenticated;
            create function public.is_teacher() returns boolean language sql stable security definer as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'teacher' and is_active) $$;
            create table public.quiz_results(id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), quiz_id text not null, score smallint not null, total smallint not null, created_at timestamptz not null default now());
            insert into public.quiz_results(user_id, quiz_id, score, total) values ('${student}','legacy',1,2);
        `);
        const quizzes = await readFile(new URL('../../supabase/setup_quizzes.sql', import.meta.url), 'utf8');
        const homework = await readFile(new URL('../../supabase/setup_student_homework.sql', import.meta.url), 'utf8');
        await db.exec(quizzes);
        await db.exec(quizzes);
        await db.exec(homework);
        await db.exec(homework);
        await db.exec(`set role authenticated; set request.jwt.claim.sub = '${student}';`);
        assert.equal((await db.query('select * from public.quiz_results')).rows.length, 1);
        assert.equal((await db.query('select id,prompt,options from public.quiz_questions')).rows.length, 2);
        await assert.rejects(db.query('select correct_option from public.quiz_questions'), /permission denied/);
        const graded = await db.query(`insert into public.quiz_results(user_id,quiz_id,score,total,answers,attempt_id) values ('${student}','note-muzicale-intro',99,99,'[0,1]',gen_random_uuid()) returning score,total`);
        assert.deepEqual(graded.rows[0], { score: 2, total: 2 });
        await assert.rejects(db.query(`insert into public.quiz_results(user_id,quiz_id,score,total,answers,attempt_id) values ('${other}','note-muzicale-intro',2,2,'[0,1]',gen_random_uuid())`), /row-level security/);
        await assert.rejects(db.query(`insert into public.quiz_results(user_id,quiz_id,score,total,answers,attempt_id) values ('${student}','note-muzicale-intro',2,2,'[7,1]',gen_random_uuid())`), /Invalid option/);
        await db.query(`insert into public.student_homework(student_id,attempt_id,events) values ('${student}',gen_random_uuid(),'[{"note":60,"timestamp":0,"duration":500}]')`);
        await assert.rejects(db.query(`insert into public.student_homework(student_id,attempt_id,events) values ('${student}',gen_random_uuid(),'[{"note":60,"timestamp":0,"duration":999999}]')`), /check constraint/);
        await assert.rejects(db.query(`insert into public.student_homework(student_id,attempt_id,events) values ('${other}',gen_random_uuid(),'[{"note":60,"timestamp":0,"duration":100}]')`), /row-level security/);
        await db.exec(`set request.jwt.claim.sub = '${other}';`);
        assert.equal((await db.query('select * from public.quiz_results')).rows.length, 0);
        assert.equal((await db.query('select * from public.student_homework')).rows.length, 0);
        await assert.rejects(db.query(`update public.quizzes set title = 'Hacked' returning *`).then((result) => { if (!result.rows.length) throw new Error('RLS denied'); }), /denied/);
        await db.exec(`set request.jwt.claim.sub = '${teacher}';`);
        assert.equal((await db.query('select * from public.student_homework')).rows.length, 1);
        await db.exec(`reset role; update public.profiles set is_active = false where id = '${student}'; set role authenticated; set request.jwt.claim.sub = '${student}';`);
        assert.equal((await db.query('select * from public.quizzes')).rows.length, 0);
        await assert.rejects(db.query(`insert into public.student_homework(student_id,attempt_id,events) values ('${student}',gen_random_uuid(),'[{"note":60,"timestamp":0,"duration":100}]')`), /row-level security/);
    } finally { await db.close(); }
});

function fakeAudio() {
    const calls = [];
    const oscillators = [];
    const audio = {
        currentTime: 0, destination: {}, calls, oscillators,
        createGain() { return { connect(destination) { this.destination = destination; }, disconnect() { }, gain: Object.fromEntries(['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'cancelAndHoldAtTime', 'setTargetAtTime'].map((method) => [method, (...args) => calls.push([method, ...args])])) }; },
        createOscillator() { const oscillator = { frequency: {}, connect() { }, disconnect() { }, start(time) { this.started = time; }, stop(time) { this.stopped = time; } }; oscillators.push(oscillator); return oscillator; },
    };
    return audio;
}

test('three octaves, distinct QWERTY mappings and ADSR presets use only oscillators', () => {
    assert.equal(PIANO_KEYS.length, 37);
    assert.equal(PIANO_KEYS[0].note, 48);
    assert.equal(PIANO_KEYS.at(-1).note, 84);
    assert.equal(PIANO_KEYS.filter((key) => !key.black).length, 22);
    const mapped = PIANO_KEYS.filter((key) => key.key);
    assert.equal(new Set(mapped.map((key) => key.key)).size, 25);
    assert.deepEqual(PIANO_KEYS.filter((key) => !key.black).slice(0, 15).map((key) => key.key), [...'zxcvbnmasdfghjk']);
    for (const [name, preset] of Object.entries(INSTRUMENTS)) {
        const audio = fakeAudio();
        const voice = createVoice(audio, 69, 1, name, 0.5);
        assert.equal(voice.oscillator.type, preset.type);
        assert.equal(voice.oscillator.frequency.value, 440);
        assert.equal(voice.oscillator.stopped, 1.5 + preset.release + 0.01);
        assert.ok(audio.calls.some((call) => call[0] === 'exponentialRampToValueAtTime' && call[1] === preset.sustain));
        assert.ok(audio.calls.some((call) => call[0] === 'cancelAndHoldAtTime' && call[1] === 1.5));
    }
    const fallback = fakeAudio();
    const gainFactory = fallback.createGain;
    fallback.createGain = () => {
        const gain = gainFactory();
        delete gain.gain.cancelAndHoldAtTime;
        gain.gain.cancelScheduledValues = (time) => fallback.calls.push(['cancelScheduledValues', time]);
        return gain;
    };
    createVoice(fallback, 60, 1, 'flute', 0.02);
    assert.ok(fallback.calls.some((call) => call[0] === 'cancelScheduledValues'));
});

test('virtual piano lazy-loads desktop samples after selecting the native mobile fallback', async () => {
    const source = await readFile(new URL('../components/VirtualPiano.jsx', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /import\s+.*from\s+['"]tone['"]/);
    const mobileGate = source.indexOf("if (deviceType === 'mobile')");
    const audioImport = source.indexOf("await import('tone')");
    assert.ok(mobileGate >= 0 && audioImport > mobileGate);
    assert.ok(source.indexOf('new Tone.Sampler', audioImport) > audioImport);
    assert.match(source, /splitView = true/);
    assert.match(source, /SecurePdfViewer path=\{selectedPiece\.score_path\}/);
    const studio = await readFile(new URL('../pages/studio.astro', import.meta.url), 'utf8');
    assert.match(studio, /splitView=\{false\} desktopSamples=\{false\}/);
});

test('metronome schedules on the audio clock, accents four beats and cancels pending work', () => {
    const audio = fakeAudio();
    const visuals = new Map();
    let scheduler;
    let cleared = false;
    let bpm = 120;
    const timers = { setInterval(callback) { scheduler = callback; return 1; }, clearInterval() { cleared = true; }, setTimeout(callback) { const id = visuals.size + 1; visuals.set(id, callback); return id; }, clearTimeout(id) { visuals.delete(id); } };
    const stop = startMetronome(audio, () => bpm, () => { }, timers);
    for (const time of [0.5, 1, 1.5, 2]) { audio.currentTime = time; scheduler(); }
    assert.deepEqual(audio.oscillators.map((oscillator) => oscillator.started), [0.05, 0.55, 1.05, 1.55, 2.05]);
    assert.deepEqual(audio.oscillators.map((oscillator) => oscillator.frequency.value), [1200, 800, 800, 800, 1200]);
    bpm = 240;
    audio.currentTime = 2.5; scheduler();
    audio.currentTime = 2.75; scheduler();
    assert.equal(audio.oscillators.at(-1).started, 2.8);
    stop();
    assert.equal(cleared, true);
    assert.equal(visuals.size, 0);
    assert.ok(audio.oscillators.every((oscillator) => oscillator.stopped === undefined));
});

test('Jitsi JWT binds a short-lived token to one room and grants lobby bypass only to teachers', async () => {
    for (const role of ['teacher', 'student', 'profesor', 'elev', 'inspector']) {
        const teacher = ['teacher', 'profesor'].includes(role);
        const claims = classClaims({ id: 'user', role, is_active: true, full_name: 'Test' }, 'group-id', { appId: 'academy', domain: 'meet.example.invalid' }, 1000);
        assert.equal(claims.room, 'academy-group-id');
        assert.equal(claims.exp, 1300);
        assert.equal(claims.context.user.moderator, teacher ? 'true' : 'false');
        assert.equal(claims.context.user.lobby_bypass, teacher);
        const token = await signClassToken(claims, 'a'.repeat(32));
        const [header, payload, signature] = token.split('.');
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('a'.repeat(32)), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
        assert.ok(await crypto.subtle.verify('HMAC', key, Buffer.from(signature, 'base64url'), new TextEncoder().encode(`${header}.${payload}`)));
    }
    assert.throws(() => classClaims({ role: 'profesor', is_active: false }, 'group', {}));
    const inspector = classConfig('inspector');
    assert.equal(inspector.startWithAudioMuted, true);
    assert.equal(inspector.startWithVideoMuted, true);
    assert.equal(inspector.disableInitialGUM, true);
    assert.equal(inspector.toolbarButtons.includes('microphone'), false);
    assert.equal(inspector.disableAEC, true);
    assert.equal(inspector.disableNS, true);
});

test('online and catalog RLS isolate students, deny inspector writes and preserve server dates', async () => {
    const db = new PGlite();
    const student = '11111111-1111-4111-8111-111111111111';
    const other = '22222222-2222-4222-8222-222222222222';
    const teacher = '33333333-3333-4333-8333-333333333333';
    const inspector = '44444444-4444-4444-8444-444444444444';
    try {
        await db.exec(`
            create role anon; create role authenticated; create role service_role; create schema auth;
            create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
            create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
            create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
            create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
            alter table storage.objects enable row level security;
            create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
            create function storage.extension(text) returns text language sql immutable as $$ select split_part($1,'.',2) $$;
            create schema realtime; create table realtime.messages(extension text);
            create function realtime.topic() returns text language sql stable as $$ select 'academy:online' $$;
            grant usage on schema auth,storage,realtime to authenticated;
        `);
        for (const filename of ['schema.sql', 'setup_quizzes.sql', 'setup_student_homework.sql', 'setup_online_classes.sql', 'setup_online_classes.sql', 'setup_catalog_teme.sql', 'setup_catalog_teme.sql']) await db.exec(await readFile(new URL(`../../supabase/${filename}`, import.meta.url), 'utf8'));
        await db.exec(`
            insert into auth.users(id) values('${student}'),('${other}'),('${teacher}'),('${inspector}');
            update profiles set role='profesor' where id='${teacher}';
            update profiles set role='inspector' where id='${inspector}';
            grant select,insert,update,delete on all tables in schema public,storage to authenticated;
            revoke insert,update,delete on catalog_teme from authenticated;
            grant insert(student_id,student_name,drive_url,title,student_note,piece_id) on catalog_teme to authenticated;
            insert into pieces(title,discipline) values('Global','orga');
            set role authenticated; set request.jwt.claim.sub='${teacher}';
        `);
        const first = (await db.query(`select save_online_group(null,'Grupa 1',1::smallint,'16:00'::time,60::smallint,array['${student}']::uuid[]) id`)).rows[0].id;
        const second = (await db.query(`select save_online_group(null,'Grupa 2',2::smallint,'17:00'::time,45::smallint,array['${other}']::uuid[]) id`)).rows[0].id;
        await assert.rejects(db.query(`select save_online_group('${second}','Changed',2::smallint,'17:00'::time,45::smallint,array['${student}']::uuid[])`), /unique/);
        assert.equal((await db.query(`select name from online_groups where id='${second}'`)).rows[0].name, 'Grupa 2');
        for (const user of [student, other]) {
            await db.exec(`set request.jwt.claim.sub='${user}';`);
            assert.equal((await db.query('select * from online_groups')).rows.length, 1);
            assert.equal((await db.query('select * from pieces')).rows.length, 1);
            const blocked = user === student ? second : first;
            assert.equal((await db.query(`select can_join_online_group('${blocked}') allowed`)).rows[0].allowed, false);
            await assert.rejects(db.query(`select save_online_group(null,'Hacked',1::smallint,'10:00'::time,60::smallint,'{}')`), /Acces refuzat/);
        }
        await db.query(`insert into student_homework(student_id,attempt_id,events) values('${other}',gen_random_uuid(),'[{"note":48,"timestamp":0,"duration":100},{"note":84,"timestamp":200,"duration":100}]')`);
        await db.query(`insert into catalog_teme(student_id,student_name,drive_url) values('${other}','','https://drive.google.com/file/d/other-file/view')`);
        assert.equal((await db.query('select * from catalog_teme')).rows.length, 1);
        assert.ok((await db.query('select created_at from catalog_teme')).rows[0].created_at);
        await assert.rejects(db.query(`insert into catalog_teme(student_id,student_name,drive_url) values('${student}','','https://drive.google.com/file/d/spoof/view')`), /row-level security/);
        await assert.rejects(db.query(`insert into catalog_teme(student_id,student_name,drive_url) values('${other}','Alt elev','https://drive.google.com/file/d/name-spoof/view')`), /row-level security/);
        await assert.rejects(db.query(`insert into catalog_teme(student_id,student_name,drive_url,created_at) values('${other}','','https://drive.google.com/file/d/date-spoof/view','2099-01-01')`), /permission denied/);
        await assert.rejects(db.query(`insert into catalog_teme(student_id,student_name,drive_url) values('${other}','','https://evil.example/file')`), /check constraint/);
        await assert.rejects(db.query(`insert into catalog_teme(student_id,student_name,drive_url) values('${other}','','https://drive.google.com/file/d/other-file/view')`), /unique/);
        await db.exec(`set request.jwt.claim.sub='${student}';`);
        assert.equal((await db.query('select * from catalog_teme')).rows.length, 0);
        await db.query(`insert into catalog_teme(student_id,student_name,drive_url) values('${student}','','https://drive.google.com/file/d/student-file/view')`);
        await db.exec(`set request.jwt.claim.sub='${teacher}';`);
        assert.equal((await db.query('select * from catalog_teme')).rows.length, 2);
        await assert.rejects(db.query('delete from catalog_teme'), /permission denied/);
        await db.exec(`set request.jwt.claim.sub='${inspector}';`);
        assert.equal((await db.query('select * from catalog_teme')).rows.length, 0);
        await assert.rejects(db.query(`insert into catalog_teme(student_id,student_name,drive_url) values('${inspector}','','https://drive.google.com/file/d/inspector-file/view')`), /row-level security/);
        assert.equal((await db.query('select * from online_groups')).rows.length, 2);
        assert.equal((await db.query('select * from pieces')).rows.length, 1);
        assert.equal((await db.query(`update profiles set full_name='Hacked' where id='${inspector}' returning id`)).rows.length, 0);
        await assert.rejects(db.query(`insert into student_homework(student_id,attempt_id,events) values('${inspector}',gen_random_uuid(),'[{"note":60,"timestamp":0,"duration":100}]')`), /row-level security/);
        await assert.rejects(db.query(`insert into storage.objects(bucket_id,name) values('portfolio','${inspector}/file.webm')`), /row-level security/);
        assert.equal((await db.query(`delete from online_groups returning id`)).rows.length, 0);
        await db.exec(`reset role; set request.jwt.claim.sub=''; update profiles set is_active=false where id='${student}'; set role authenticated; set request.jwt.claim.sub='${student}';`);
        assert.equal((await db.query('select * from online_groups')).rows.length, 0);
        assert.equal((await db.query('select * from pieces')).rows.length, 0);
        assert.equal((await db.query('select * from catalog_teme')).rows.length, 0);
        await assert.rejects(db.query(`insert into catalog_teme(student_id,student_name,drive_url) values('${student}','','https://drive.google.com/file/d/inactive-file/view')`), /row-level security/);
    } finally { await db.close(); }
});

test('music UPDATE preserves row identity, assignments and existing files; validates PDF and rolls back only new uploads', async () => {
    const existing = { id: 'existing-piece', discipline: 'orga', audio_pozitiv_path: 'old/positive.mp3', score_path: 'old/score.pdf', created_by: 'original-teacher' };
    const form = { title: 'Updated title', description: 'Updated study notes', level: 'mediu', tags: 'legato, ritm', versuri_text: '[00:01.00]Strofa', positive_url: '', negative_url: '', is_published: true };
    const mp3 = new File(['ID3valid-audio'], 'negative.mp3', { type: 'audio/mpeg' });
    const pdf = new File(['%PDF-1.7 valid-score'], 'score.pdf', { type: 'application/pdf' });
    const uploaded = [], removed = [], filters = [];
    let writes = 0, failed = false, payload;
    const query = { eq: (key,value) => { filters.push([key,value]); return query; }, select: () => ({ single: async () => ({ data: failed ? null : { ...existing, ...payload }, error: failed ? { message: 'denied' } : null }) }) };
    const options = {
        client: { from: table => { assert.equal(table, 'pieces'); return { update: value => { writes++; payload = value; return query; }, insert: () => { throw Error('must UPDATE, never INSERT'); } }; } },
        upload: async path => { uploaded.push(path); }, removeUploaded: async paths => { removed.push(...paths); }, form, piece: existing, userId: 'teacher',
    };
    const saved = await saveMusicPiece({ ...options, files: { negativ: mp3 } });
    assert.equal(saved.id, existing.id);
    assert.equal(saved.audio_pozitiv_path, existing.audio_pozitiv_path);
    assert.equal(saved.score_path, existing.score_path);
    assert.equal(saved.created_by, existing.created_by);
    assert.equal(payload.versuri_text, '[00:01.00]Strofa');
    assert.equal('created_by' in payload, false);
    assert.equal('score_path' in payload, false);
    assert.match(payload.audio_negativ_path, /^orga\/[a-f0-9-]+\/negativ.mp3$/);
    assert.deepEqual(filters, [['id','existing-piece'],['discipline','orga']]);
    const scoreUpdate = await saveMusicPiece({ ...options, files: { score: pdf } });
    assert.match(scoreUpdate.score_path, /^orga\/[a-f0-9-]+\/score.pdf$/);
    assert.equal(scoreUpdate.audio_pozitiv_path, existing.audio_pozitiv_path);
    await assert.rejects(validateScorePdf(new File(['not pdf'], 'false.pdf', { type: 'application/pdf' })), /antet PDF/);
    const before = writes;
    await assert.rejects(saveMusicPiece({ ...options, files: { score: new File(['invalid'], 'score.pdf', { type: 'application/pdf' }) } }));
    assert.equal(writes, before);
    const successfulUploads = uploaded.length;
    failed = true;
    await assert.rejects(saveMusicPiece({ ...options, files: { pozitiv: mp3, score: pdf } }));
    assert.deepEqual(removed, uploaded.slice(successfulUploads));
    assert.equal(removed.includes(existing.score_path), false);
    assert.equal(removed.includes(existing.audio_pozitiv_path), false);
    await assert.rejects(saveMusicPiece({ ...options, piece: { ...existing, discipline: 'canto' } }), /Disciplină/);
});


test('RED resource update preserves existing PDF and cleans up a new PDF if database update is rejected', async () => {
    const resource = { id: 'resource', file_path: 'old/resource.pdf' };
    const form = { title: 'Lecție', discipline: 'comun', category: 'fisa-teoretica', description: 'Teorie', external_url: '' };
    let payload, failed = false;
    const removed = [], uploaded = [];
    const query = { eq: (key,id) => { assert.equal(key, 'id'); assert.equal(id, resource.id); return query; }, select: () => ({ single: async () => ({ data: failed ? null : { ...resource, ...payload }, error: failed ? { message: 'denied' } : null }) }) };
    const options = { resource, form, userId: 'teacher', client: { from: table => { assert.equal(table, 'resources'); return { update: value => { payload=value; return query; } }; } }, upload: async path => uploaded.push(path), removeUploaded: async paths => removed.push(...paths) };
    const saved = await saveStudyResource(options);
    assert.equal(saved.file_path, resource.file_path);
    assert.equal('file_path' in payload, false);
    assert.equal('created_by' in payload, false);
    const pdf = new File(['%PDF-1.7 lesson'], 'lesson.pdf', { type: 'application/pdf' });
    failed = true;
    await assert.rejects(saveStudyResource({ ...options, file: pdf }));
    assert.deepEqual(removed, uploaded);
    assert.equal(removed.includes(resource.file_path), false);
    await assert.rejects(saveStudyResource({ ...options, form: { ...form, external_url: 'javascript:alert(1)' } }));
});
