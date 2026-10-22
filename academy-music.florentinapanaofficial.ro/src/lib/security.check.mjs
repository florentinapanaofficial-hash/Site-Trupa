import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { clientIP, createSecurityBackend, secureAcademyRequest, SecurityError, readAuthInput, verifiedSessionId } from './securityServer.js';
import { POST as register } from '../pages/api/auth/register.js';

const student = '11111111-1111-4111-8111-111111111111';
const teacher = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
const first = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const second = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const token = (sid = first) => `header.${Buffer.from(JSON.stringify({ session_id: sid })).toString('base64url')}.signature`;
const request = (body, headers = {}) => new Request('https://academy.test/api/auth/register/', {
    method: 'POST', headers: { Origin: 'https://academy.test', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});

test('proxy trust: ignores spoofed leftmost IP, rejects missing/unconfigured headers, normalizes mapped IPv4', () => {
    const env = { NODE_ENV: 'production', ACADEMY_TRUSTED_IP_HEADER: 'x-forwarded-for', ACADEMY_TRUSTED_PROXY_HOPS: '1' };
    assert.equal(clientIP(request({}, { 'x-forwarded-for': '1.2.3.4, 198.51.100.8' }), '127.0.0.1', env), '198.51.100.8');
    assert.throws(() => clientIP(request({}), '127.0.0.1', env), SecurityError);
    assert.throws(() => clientIP(request({}), '127.0.0.1', { NODE_ENV: 'production' }), SecurityError);
    assert.throws(() => clientIP(request({}, { 'x-forwarded-for': '1.2.3.4' }), '127.0.0.1', { ...env, ACADEMY_TRUSTED_PROXY_HOPS: '2' }), SecurityError);
    assert.equal(clientIP(request({}), '::ffff:127.0.0.1', {}), '127.0.0.1');
    assert.equal(clientIP(request({}), '198.51.100.8', { NODE_ENV: 'production' }, true), '198.51.100.8');
    assert.throws(() => verifiedSessionId('broken'), SecurityError);
    assert.throws(() => verifiedSessionId('header.bnVsbA.signature'), SecurityError);
    assert.equal(verifiedSessionId(token()), first);
});

test('registration rejects absent, false, string consent and cross-origin before contacting Supabase', async () => {
    for (const parentalConsent of [undefined, false, 'true', 1]) {
        const response = await register({ request: request({ email: 'parent@example.test', password: 'securepassword123', fullName: 'Elev', parentalConsent }) });
        assert.equal(response.status, 400);
        assert.equal((await response.json()).code, 'consent_required');
    }
    const response = await register({ request: request({ parentalConsent: true }, { Origin: 'https://evil.test' }) });
    assert.equal(response.status, 403);
    await assert.rejects(readAuthInput(request({ text: 'x'.repeat(9000) })), (error) => error.status === 413);
});

test('server verifies JWT with Auth before decoding session or registering it', async () => {
    let calls = 0;
    let authStatus = 401;
    const backend = createSecurityBackend({ VITE_SUPABASE_URL: 'https://test.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' }, () => ({
        auth: { getUser: async () => ({ data: { user: null }, error: { status: authStatus } }) },
        rpc: async () => { calls++; return { data: 'ok' }; },
    }));
    await assert.rejects(backend.check(token(), request({}), '127.0.0.1', true), (error) => error.status === 401);
    authStatus = 0;
    await assert.rejects(backend.check(token(), request({}), '127.0.0.1', true), (error) => error.status === 503);
    assert.equal(calls, 0);
});

test('middleware distinguishes JSON failures, page redirects, expired sessions and database outages', async () => {
    const env = { VITE_SUPABASE_URL: 'https://test.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' };
    for (const [path, result, error, status] of [
        ['/canto/', 'replaced', null, 303], ['/api/upload-homework/', 'locked', null, 403],
        ['/canto/', null, { code: 'db_down' }, 503], ['/canto/', 'ok', null, null],
    ]) {
        const deleted = [];
        const url = new URL(`https://academy.test${path}`);
        const context = {
            request: new Request(url), url, clientAddress: '127.0.0.1', locals: {}, cookies: {
                get: () => ({ value: token() }), delete: (...args) => deleted.push(args),
            }
        };
        const response = await secureAcademyRequest(context, env, () => ({
            auth: { getUser: async () => ({ data: { user: { id: student } } }) },
            rpc: async () => ({ data: result, error }),
        }));
        assert.equal(response?.status ?? null, status);
        if (status === 303) assert.equal(response.headers.get('Location'), '/login/?reason=replaced');
        if (status === 403) assert.match((await response.json()).error, /MOMENTAN ACCESUL ESTE RESTRICȚIONAT/);
        if (status === 503) assert.equal(deleted.length, 0);
        if (status === null) assert.equal(context.locals.academySecurity.sessionId, first);
    }
});

test('public homepage avoids backend configuration and clears expired cookies without hiding outages', async () => {
    const context = (value) => ({ request: new Request('https://academy.test/'), url: new URL('https://academy.test/'), clientAddress: '127.0.0.1', locals: {}, cookies: { get: () => value ? { value } : undefined, delete: () => { } } });
    assert.equal(await secureAcademyRequest(context(), {}, () => { throw Error('must not create client'); }), null);
    const env = { VITE_SUPABASE_URL: 'https://test.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' };
    const invalidClient = () => ({ auth: { getUser: async () => ({ data: { user: null }, error: { status: 401 } }) } });
    assert.equal(await secureAcademyRequest(context(token()), env, invalidClient), null);
    const unavailableClient = () => ({ auth: { getUser: async () => ({ data: { user: null }, error: { status: 503 } }) } });
    assert.equal((await secureAcademyRequest(context(token()), env, unavailableClient)).status, 503);
});

test('SQL migration: real RLS, atomic IP locking, session replacement, consent and server-only mutations', async (t) => {
    const db = new PGlite();
    try {
        await db.exec(`
            create role anon; create role authenticated; create role service_role bypassrls;
            create schema auth;
            create table auth.users(id uuid primary key, raw_user_meta_data jsonb, raw_app_meta_data jsonb);
            create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
            create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
            create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
            create schema storage;
            create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
            create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
            alter table storage.objects enable row level security;
            create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
            create function storage.extension(text) returns text language sql immutable as $$ select split_part($1,'.',2) $$;
            create schema realtime; create table realtime.messages(extension text);
            create function realtime.topic() returns text language sql stable as $$ select 'academy:online' $$;
            grant usage on schema auth,storage,realtime to authenticated,service_role;
        `);
        for (const name of ['schema.sql', 'setup_quizzes.sql', 'setup_student_homework.sql', 'setup_online_classes.sql', 'setup_catalog_teme.sql']) {
            await db.exec(await readFile(new URL(`../../supabase/${name}`, import.meta.url), 'utf8'));
        }
        await db.exec(await readFile(new URL('../../supabase/migrations/20261019_canto_library.sql', import.meta.url), 'utf8'));
        await db.exec(`
            insert into auth.users(id) values('${student}'),('${teacher}'),('${other}');
            update profiles set role='teacher' where id='${teacher}';
            create table lessons(id uuid primary key default gen_random_uuid(),title text);
            alter table lessons enable row level security;
            create policy legacy_lesson_access on lessons for all to authenticated using(true) with check(true);
            insert into lessons(title) values('Existing lesson');
            grant select,insert,update,delete on all tables in schema public,storage to authenticated;
            insert into pieces(title,discipline,is_published) values('Published piece','canto',true);
            insert into storage.objects(bucket_id,name) values('avatars','${student}/avatar.webp');
        `);
        const migration = await readFile(new URL('../../supabase/migrations/20261020000005_security_sessions.sql', import.meta.url), 'utf8');
        await db.exec(migration);
        await db.exec(migration);
        const claims = async (role, uid, sid) => {
            await db.exec(`reset role; set role ${role};`);
            await db.query(`select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)`, [uid || '', JSON.stringify({ sub: uid, session_id: sid, role })]);
        };
        const owner = async () => { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claims','{}',false)`); };
        const check = async (uid, sid, ip, register = false) => (await db.query('select academy_check_session($1,$2,$3,$4,$5) result', [uid, sid, ip, 'Test agent', register])).rows[0].result;
        await t.test('staged activation preserves legacy users; global enforcement denies unregistered sessions', async () => {
            await claims('authenticated', student, first);
            assert.equal((await db.query('select academy_session_allowed() allowed')).rows[0].allowed, true);
            await owner();
            await db.exec('update academy_security_config set enforce_sessions=true');
            await claims('authenticated', student, first);
            assert.equal((await db.query('select count(*)::int n from pieces')).rows[0].n, 0);
        });
        await t.test('only server registers; replacement immediately revokes old JWT in RLS and Storage', async () => {
            await owner();
            assert.equal(await check(student, first, '198.51.100.1', true), 'ok');
            assert.equal(await check(teacher, first, '198.51.100.1', true), 'ok');
            await claims('authenticated', student, first);
            assert.equal((await db.query('select count(*)::int n from pieces')).rows[0].n, 1);
            assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n, 1);
            await assert.rejects(check(student, second, '198.51.100.1', true), /permission denied/);
            await assert.rejects(db.query(`update profiles set active_session_id='${second}' where id='${student}'`), /Security fields/);
            await assert.rejects(db.query(`update profiles set is_locked=true where id='${student}'`), /Security fields/);
            await assert.rejects(db.query(`insert into pieces(title,discipline) values('Unauthorized','canto')`), /row-level security/);
            assert.equal((await db.query('select count(*)::int n from user_security_logs')).rows[0].n, 0);
            await owner();
            assert.equal(await check(student, second, '198.51.100.1', true), 'ok');
            assert.equal(await check(student, first, '198.51.100.99'), 'replaced');
            assert.equal((await db.query('select count(*)::int n from user_security_logs where user_id=$1', [student])).rows[0].n, 1);
            await claims('authenticated', student, first);
            assert.equal((await db.query('select count(*)::int n from pieces')).rows[0].n, 0);
            assert.equal((await db.query('select count(*)::int n from profiles')).rows[0].n, 0);
            assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n, 0);
            await assert.rejects(db.query('select start_activity_session()'), /Unauthorized/);
            assert.equal((await db.query('select academy_active() allowed')).rows[0].allowed, false);
        });
        await t.test('student lesson writes blocked even if a legacy permissive policy grants ALL; teacher CRUD works', async () => {
            await claims('authenticated', student, second);
            assert.equal((await db.query('select count(*)::int n from lessons')).rows[0].n, 1);
            await assert.rejects(db.query("insert into lessons(title) values('Bad')"), /row-level security/);
            assert.equal((await db.query("update lessons set title='Bad' returning id")).rows.length, 0);
            assert.equal((await db.query('delete from lessons returning id')).rows.length, 0);
            assert.equal((await db.query("update pieces set title='Unauthorized' returning id")).rows.length, 0);
            await claims('authenticated', teacher, first);
            const original = (await db.query('select id from pieces limit 1')).rows[0].id;
            const updated = (await db.query("update pieces set description='New study notes',versuri_text='[00:01.00]Text',score_path='orga/new-score.pdf',audio_negativ_path='orga/new-negative.mp3' where id=$1 returning id,description,score_path", [original])).rows[0];
            assert.equal(updated.id, original);
            assert.equal(updated.description, 'New study notes');
            assert.equal(updated.score_path, 'orga/new-score.pdf');
            const id = (await db.query("insert into lessons(title) values('Teacher') returning id")).rows[0].id;
            assert.equal((await db.query("update lessons set title='Updated' where id=$1 returning title", [id])).rows[0].title, 'Updated');
            assert.equal((await db.query('delete from lessons where id=$1 returning id', [id])).rows.length, 1);
        });
        await t.test('third distinct IP locks persistently and creates one admin alert; duplicate IP does not count twice', async () => {
            await owner();
            assert.equal(await check(student, second, '198.51.100.1'), 'ok');
            assert.equal(await check(student, second, '198.51.100.2'), 'ok');
            assert.equal(await check(student, second, '198.51.100.3'), 'locked');
            assert.equal(await check(student, first, '198.51.100.4', true), 'locked');
            assert.equal((await db.query('select count(*)::int n from security_alerts where user_id=$1', [student])).rows[0].n, 1);
            await claims('authenticated', student, second);
            assert.equal((await db.query('select count(*)::int n from pieces')).rows[0].n, 0);
            await claims('authenticated', teacher, first);
            assert.equal((await db.query('select count(*)::int n from security_alerts')).rows[0].n, 1);
        });
        await t.test('consent is enforced on direct Auth inserts, timestamped by DB and immutable to students', async () => {
            await owner();
            await assert.rejects(db.query("insert into auth.users(id) values(gen_random_uuid())"), /Parental consent/);
            await assert.rejects(db.query(`insert into auth.users(id,raw_user_meta_data) values(gen_random_uuid(),'{"parental_consent":"true","consent_version":"2026-10-20"}')`), /Parental consent/);
            const parent = '44444444-4444-4444-8444-444444444444';
            await db.query(`insert into auth.users(id,raw_user_meta_data) values($1,'{"parental_consent":true,"consent_version":"2026-10-20"}')`, [parent]);
            assert.equal((await db.query('select policy_version from parental_consents where user_id=$1', [parent])).rows[0].policy_version, '2026-10-20');
            await db.exec(`insert into auth.users(id,raw_app_meta_data) values(gen_random_uuid(),'{"academy_provisioned":true}')`);
            await claims('authenticated', teacher, first);
            await assert.rejects(db.exec('delete from parental_consents'), /permission denied/);
        });
        await t.test('logout revokes JWT without restoring staged legacy access or revoking a newer session', async () => {
            await owner();
            await db.exec('update academy_security_config set enforce_sessions=false');
            await db.query('select academy_end_session($1,$2)', [teacher, second]);
            await claims('authenticated', teacher, first);
            assert.equal((await db.query('select academy_session_allowed() allowed')).rows[0].allowed, true);
            await owner();
            await db.query('select academy_end_session($1,$2)', [teacher, first]);
            await claims('authenticated', teacher, first);
            assert.equal((await db.query('select academy_session_allowed() allowed')).rows[0].allowed, false);
        });
    } finally { await db.close(); }
});
