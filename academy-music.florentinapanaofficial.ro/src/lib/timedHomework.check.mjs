import test from 'node:test';
import assert from 'node:assert/strict';
import { submissionState, submitTimedHomework } from './timedHomework.js';

const start = '2026-10-24T10:00:00.000Z';
const end = '2026-10-24T11:00:00.000Z';
const payload = () => ({ assignmentId: 'assignment-id', submissionStart: start, submissionEnd: end, file: new File(['audio'], 'take.webm', { type: 'audio/webm;codecs=opus' }) });
function backend() {
    const calls = { uploads: [], inserts: [] };
    const client = {
        auth: { getUser: async () => ({ data: { user: { id: 'student-id' } }, error: null }) },
        from: (table) => table === 'homework_assignments' ? {
            select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: { submission_start: start, submission_end: end }, error: null }) }) }) }),
        } : { insert: (row) => {
            calls.inserts.push(row);
            return { select: () => ({ single: async () => ({ data: { id: 'homework-id' }, error: null }) }) };
        } },
        storage: { from: (bucket) => ({ upload: async (...args) => { calls.uploads.push({ bucket, args }); return { error: null }; } }) },
    };
    return { client, calls };
}

test('submission states include exact start/end and reject invalid intervals', () => {
    const from = Date.parse(start), until = Date.parse(end);
    assert.equal(submissionState(start, end, from - 1), 'upcoming');
    assert.equal(submissionState(start, end, from), 'open');
    assert.equal(submissionState(start, end, until), 'open');
    assert.equal(submissionState(start, end, until + 1), 'expired');
    for (const [a, b] of [['invalid', end], [start, ''], [end, start], [start, start]]) assert.equal(submissionState(a, b), 'invalid');
});

test('no backend operation is called outside the submission window', async (t) => {
    for (const now of [Date.parse(start) - 1, Date.parse(end) + 1]) {
        t.mock.method(Date, 'now', () => now);
        await assert.rejects(submitTimedHomework(null, payload()), /în afara intervalului/);
        t.mock.restoreAll();
    }
});

test('audio submission uses trusted dates, private UID path and no client-supplied evaluation', async (t) => {
    t.mock.method(Date, 'now', () => Date.parse(start));
    const { client, calls } = backend();
    assert.deepEqual(await submitTimedHomework(client, payload()), { id: 'homework-id' });
    assert.equal(calls.uploads.length, 1);
    assert.equal(calls.uploads[0].bucket, 'homework-audio');
    assert.match(calls.uploads[0].args[0], /^student-id\/assignment-id\/[a-f\d-]+\.webm$/);
    assert.deepEqual(calls.uploads[0].args[2], { contentType: 'audio/webm', upsert: false });
    assert.equal(calls.inserts[0].submission_start, start);
    assert.equal(calls.inserts[0].submission_end, end);
    assert.equal(calls.inserts[0].status, undefined);
    assert.equal(calls.inserts[0].teacher_feedback, undefined);
});

test('upload rejects empty, unsupported and oversized audio before contacting backend', async (t) => {
    t.mock.method(Date, 'now', () => Date.parse(start));
    for (const file of [{ type: 'image/png', size: 100 }, { type: 'audio/webm', size: 0 }, { type: 'audio/webm', size: 30 * 1024 * 1024 + 1 }]) {
        await assert.rejects(submitTimedHomework(null, { ...payload(), file }), /maximum 30 MB/);
    }
});

test('expiry during authentication prevents storage upload', async (t) => {
    let now = Date.parse(start);
    t.mock.method(Date, 'now', () => now);
    const { client, calls } = backend();
    client.auth.getUser = async () => { now = Date.parse(end) + 1; return { data: { user: { id: 'student-id' } }, error: null }; };
    await assert.rejects(submitTimedHomework(client, payload()), /în afara intervalului/);
    assert.equal(calls.uploads.length, 0);
    assert.equal(calls.inserts.length, 0);
});

test('expiry during upload is not reported as a successful submission', async (t) => {
    let now = Date.parse(start);
    t.mock.method(Date, 'now', () => now);
    t.mock.method(console, 'error', () => {});
    const { client, calls } = backend();
    client.storage.from = () => ({ upload: async () => { now = Date.parse(end) + 1; return { error: null }; } });
    await assert.rejects(submitTimedHomework(client, payload()), /predarea nu a fost confirmată/);
    assert.equal(calls.inserts.length, 0);
});
