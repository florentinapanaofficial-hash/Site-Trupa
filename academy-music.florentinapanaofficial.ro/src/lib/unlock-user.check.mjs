import assert from 'node:assert/strict';
import test from 'node:test';
import { createUnlockUserHandler } from '../pages/api/admin/unlock-user.ts';

const teacherId = '11111111-1111-4111-8111-111111111111';
const studentId = '22222222-2222-4222-8222-222222222222';
const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const token = 'header.' + Buffer.from(JSON.stringify({ sub: teacherId, session_id: sessionId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.signature';

function createFixture({ teacher = { role: 'teacher', is_active: true, is_locked: false }, student = { role: 'student', is_locked: true }, deleteError = null, updateError = null } = {}) {
    const events = [];
    const profiles = new Map([
        [teacherId, { id: teacherId, ...teacher }],
        ...(student ? [[studentId, { id: studentId, ...student }]] : []),
    ]);
    const clientFactory = (_url, key) => {
        if (key === 'anon-key') return { auth: { getUser: async () => ({ data: { user: { id: teacherId } }, error: null }) } };
        assert.equal(key, 'service-key');
        return {
            rpc: async (name) => {
                assert.equal(name, 'academy_check_session');
                events.push('session-check');
                return { data: 'ok', error: null };
            },
            from(table) {
                let operation = 'select';
                let id;
                const builder = {
                    select() { return builder; },
                    eq(column, value) { if (column === 'id') id = value; return builder; },
                    in() { return builder; },
                    maybeSingle: async () => {
                        if (operation === 'update') {
                            events.push('unlock');
                            if (updateError) return { data: null, error: updateError };
                            const profile = profiles.get(id);
                            if (!profile || !['student', 'elev'].includes(profile.role)) return { data: null, error: null };
                            profile.is_locked = false;
                            profile.active_session_id = null;
                            return { data: { id }, error: null };
                        }
                        events.push(`profile:${id}`);
                        return { data: profiles.get(id) || null, error: null };
                    },
                    delete() { operation = 'delete'; return builder; },
                    update() { operation = 'update'; return builder; },
                    then(resolve, reject) {
                        events.push(`delete:${table}:${id}`);
                        return Promise.resolve({ error: deleteError }).then(resolve, reject);
                    },
                };
                return builder;
            },
        };
    };
    const handler = createUnlockUserHandler(clientFactory);
    async function post({ userId = studentId, origin = 'https://academy.example', authenticated = true } = {}) {
        const request = new Request('https://academy.example/api/admin/unlock-user/', {
            method: 'POST',
            headers: { Origin: origin, 'Content-Type': 'application/json', 'User-Agent': 'unlock-test' },
            body: JSON.stringify({ user_id: userId }),
        });
        return handler({
            request,
            cookies: { get: (name) => name === 'academy-access' && authenticated ? { value: token } : undefined },
            clientAddress: '192.0.2.1',
            locals: { workerEnv: { VITE_SUPABASE_URL: 'https://academy.example', VITE_SUPABASE_ANON_KEY: 'anon-key', SUPABASE_SERVICE_ROLE_KEY: 'service-key' } },
        });
    }
    return { events, profiles, post };
}

test('active teacher unlocks a locked student and resets the IP history before clearing the lock', async () => {
    const fixture = createFixture();
    const response = await fixture.post();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, message: 'Contul elevului a fost deblocat.' });
    assert.equal(fixture.profiles.get(studentId).is_locked, false);
    assert.ok(fixture.events.indexOf(`delete:user_security_logs:${studentId}`) < fixture.events.indexOf('unlock'));
});

test('rejects non-teachers without changing student or IP security records', async () => {
    const fixture = createFixture({ teacher: { role: 'student', is_active: true, is_locked: false } });
    const response = await fixture.post();
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, 'forbidden');
    assert.equal(fixture.events.some((event) => event.startsWith('delete:') || event === 'unlock'), false);
    assert.equal(fixture.profiles.get(studentId).is_locked, true);
});

test('rejects inactive or locked teacher accounts', async () => {
    for (const teacher of [{ role: 'teacher', is_active: false, is_locked: false }, { role: 'profesor', is_active: true, is_locked: true }]) {
        const fixture = createFixture({ teacher });
        const response = await fixture.post();
        assert.equal(response.status, 403);
        assert.equal((await response.json()).code, 'forbidden');
    }
});

test('validates same-origin request and UUID before touching Supabase', async () => {
    const unauthenticated = createFixture();
    const unauthenticatedResponse = await unauthenticated.post({ authenticated: false });
    assert.equal(unauthenticatedResponse.status, 401);
    assert.equal((await unauthenticatedResponse.json()).code, 'unauthorized');
    assert.deepEqual(unauthenticated.events, []);

    const fixture = createFixture();
    const originResponse = await fixture.post({ origin: 'https://attacker.example' });
    assert.equal(originResponse.status, 403);
    assert.equal((await originResponse.json()).code, 'invalid_origin');
    const idResponse = await fixture.post({ userId: 'not-a-uuid' });
    assert.equal(idResponse.status, 400);
    assert.equal((await idResponse.json()).code, 'invalid_input');
    assert.deepEqual(fixture.events, []);
});

test('does not unlock teacher accounts or report a missing student as successful', async () => {
    const teacherTarget = createFixture({ student: { role: 'profesor', is_locked: true } });
    assert.equal((await teacherTarget.post()).status, 400);
    assert.equal(teacherTarget.events.some((event) => event.startsWith('delete:') || event === 'unlock'), false);
    const missingTarget = createFixture({ student: null });
    const response = await missingTarget.post();
    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, 'student_not_found');
});

test('does not clear the IP history if it was already unlocked', async () => {
    const fixture = createFixture({ student: { role: 'student', is_locked: false } });
    const response = await fixture.post();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);
    assert.equal(fixture.events.some((event) => event.startsWith('delete:') || event === 'unlock'), false);
});

test('reports IP-history and profile-update failures instead of claiming success', async () => {
    const historyFailure = createFixture({ deleteError: { code: 'db_down' } });
    assert.equal((await historyFailure.post()).status, 503);
    assert.equal(historyFailure.events.includes('unlock'), false);
    const updateFailure = createFixture({ updateError: { code: 'db_down' } });
    const response = await updateFailure.post();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).success, undefined);
});
