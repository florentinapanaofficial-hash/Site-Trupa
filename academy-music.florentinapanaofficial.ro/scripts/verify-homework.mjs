import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium, expect } from '@playwright/test';

const fixture = 'virtual:timed-homework';
const mock = 'virtual:homework-backend';
const result = await build({
    root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, logLevel: 'error',
    plugins: [react(), {
        name: 'timed-homework-browser-test', enforce: 'pre',
        resolveId(id) {
            if (id === fixture || id === mock) return '\0' + id;
            if (id.includes('lib/supabase') || id.includes('lib/media')) return '\0' + mock;
        },
        load(id) {
            if (id === '\0' + mock) return `
                const state = window.backend = { uploads: [], reviews: [], promotions: [], assignments: [], rows: [], level: 'modul_1' };
                export const getSignedAudioUrl = async (bucket, path) => { state.signed = { bucket, path }; return '/test.wav'; };
                export const supabase = {
                    auth: { getUser: async () => ({ data: { user: { id: 'student-id' } }, error: null }) },
                    storage: { from: bucket => ({ upload: async (path) => { state.uploads.push({ bucket, path }); return { error: null }; } }) },
                    from(table) {
                        let action = 'read', payload, filters = [];
                        const matches = row => filters.every(([key, value]) => row[key] === value);
                        const execute = () => {
                            if (table === 'profiles') {
                                if (action === 'update') { if (state.rejectModuleUpdate || !filters.some(([key,value]) => key === 'study_level' && value === state.level)) return { data: null, error: new Error('Modulul nu a putut fi salvat.') }; state.promotions.push({ payload, filters }); state.level = payload.study_level; }
                                return { data: { id: 'student-id', role: 'student', study_level: state.level }, error: null };
                            }
                            const rows = table === 'homework_assignments' ? state.assignments : state.rows;
                            if (action === 'insert') { const row = { id: crypto.randomUUID(), status: 'pending', ...payload }; rows.push(row); return { data: row, error: null }; }
                            if (action === 'update') { const row = rows.find(matches); Object.assign(row, payload); state.reviews.push(payload); return { data: row, error: null }; }
                            return { data: rows.filter(matches), error: null };
                        };
                        const query = {
                            select() { return query; }, eq(key, value) { filters.push([key, value]); return query; },
                            in() { return query; }, not() { return query; }, order() { return query; },
                            insert(value) { action = 'insert'; payload = value; return query; },
                            update(value) { action = 'update'; payload = value; return query; },
                            single: async () => { const response = execute(); if (Array.isArray(response.data)) response.data = response.data[0]; return response; },
                            then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject); },
                        };
                        return query;
                    },
                };`;
            if (id === '\0' + fixture) return `
                import React from 'react'; import { createRoot } from 'react-dom/client'; import { flushSync } from 'react-dom';
                import HomeworkSubmit from '/src/components/student/HomeworkSubmit.tsx';
                import HomeworkEvaluator from '/src/components/admin/HomeworkEvaluator.tsx';
                import CantoStudio from '/src/components/student/CantoStudio.tsx';
                const root = createRoot(document.getElementById('fixture'));
                let revision = 0;
                window.mountStudent = (start, end) => {
                    window.backend.assignments = [{ id: 'assignment-id', student_id: 'student-id', submission_start: start, submission_end: end }];
                    flushSync(() => root.render(React.createElement(HomeworkSubmit, { key: ++revision, assignmentId: 'assignment-id', submissionStart: start, submissionEnd: end })));
                };
                window.mountStudio = (start, end) => {
                    window.backend.assignments = [{ id: 'assignment-id', student_id: 'student-id', submission_start: start, submission_end: end }];
                    flushSync(() => root.render(React.createElement(CantoStudio, { key: ++revision, assignmentId: 'assignment-id', submissionStart: start, submissionEnd: end, pieces: [{ id: 'piece-id', title: 'Negativ test', audio_negativ_path: 'karaoke-audio:negative/test.wav' }] })));
                };
                window.mountTeacher = () => {
                    window.backend.rows = [{ id: 'homework-id', student_id: 'student-id', audio_path: 'student-id/assignment-id/take.webm', status: 'pending', teacher_feedback: '', created_at: new Date().toISOString() }];
                    flushSync(() => root.render(React.createElement(HomeworkEvaluator, { key: ++revision, studentId: 'student-id' })));
                };`;
        },
    }],
    build: { write: false, rollupOptions: { input: fixture } },
});
const entry = result.output.find((item) => item.type === 'chunk' && item.isEntry);
const wav = Buffer.alloc(44 + 44100 * 2 * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
for (let index = 44; index < wav.length; index += 2) wav.writeInt16LE(Math.round(Math.sin((index - 44) / 2 * 2 * Math.PI * 220 / 44100) * 3000), index);
const server = createServer((request, response) => {
    if (request.url === '/test.wav') { response.setHeader('Content-Type', 'audio/wav'); response.end(wav); return; }
    if (request.url === '/fixture.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(entry.code); }
    else { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><html lang="ro"><meta charset="utf-8"><body><div id="fixture"></div><script type="module" src="/fixture.js"></script></body></html>'); }
});
let browser;
const microphoneFixture = join(tmpdir(), `academy-canto-mic-${process.pid}.wav`);
await writeFile(microphoneFixture, wav);
try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${microphoneFixture}`, '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
    for (const width of [390, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => {
            window.micStreams = [];
            const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
            navigator.mediaDevices.getUserMedia = async (constraints) => {
                if (window.denyMicrophone) throw new DOMException('Microfon refuzat', 'NotAllowedError');
                const stream = await original(constraints);
                window.micStreams.push(stream);
                if (window.delayMicrophone) await new Promise(resolve => { window.resolveMicrophone = resolve; });
                return stream;
            };
            const Recorder = window.MediaRecorder;
            window.MediaRecorder = class extends Recorder {
                constructor(stream, options) { super(stream, options); window.recordedTrackIds = stream.getAudioTracks().map(track => track.id); }
            };
        });
        await page.clock.install({ time: new Date('2026-10-24T10:00:00Z') });
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => typeof window.mountStudent === 'function');
        await page.evaluate(() => window.mountStudent('2026-10-24T10:00:02Z', '2026-10-24T10:00:05Z'));
        await expect(page.getByText('Tema se deblochează pe', { exact: false })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Înregistrează/Trimite tema' })).toHaveCount(0);
        await page.clock.fastForward(2000);
        await expect(page.getByRole('button', { name: 'Înregistrează/Trimite tema' })).toBeVisible();
        await page.locator('input[type="file"]').setInputFiles({ name: 'tema.webm', mimeType: 'audio/webm', buffer: Buffer.from('test-audio') });
        await page.getByRole('button', { name: 'Înregistrează/Trimite tema' }).click();
        await expect(page.getByText('Tema a fost trimisă pentru evaluare.')).toBeVisible();
        assert.equal(await page.evaluate(() => window.backend.uploads.length), 1);
        await page.evaluate(() => window.mountStudent('2026-10-24T09:00:00Z', '2026-10-24T09:30:00Z'));
        await expect(page.getByText('Timpul pentru predare a expirat')).toBeVisible();
        await expect(page.locator('input[type="file"]')).toHaveCount(0);
        await page.evaluate(() => window.mountStudent('invalid', 'invalid'));
        await expect(page.getByRole('alert')).toContainText('Interval de predare invalid');
        await page.evaluate(() => window.mountStudio('2026-10-24T09:00:00Z', '2026-10-24T11:00:00Z'));
        await expect(page.getByRole('button', { name: 'Înregistrează vocea', exact: true })).toBeDisabled();
        await page.getByLabel('Folosesc căști').check();
        await page.getByLabel('Negativ din repertoriu').selectOption('piece-id');
        await expect(page.getByLabel('Negativ', { exact: true })).toHaveAttribute('src', '/test.wav');
        assert.deepEqual(await page.evaluate(() => window.backend.signed), { bucket: 'karaoke-audio', path: 'negative/test.wav' });
        await page.getByRole('button', { name: 'Înregistrează vocea', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Oprește înregistrarea' })).toBeEnabled();
        await page.waitForTimeout(700);
        await page.clock.runFor(500);
        assert.deepEqual(await page.evaluate(() => window.recordedTrackIds), await page.evaluate(() => window.micStreams.at(-1).getAudioTracks().map(track => track.id)));
        await expect.poll(async () => {
            await page.clock.runFor(100);
            return page.getByRole('meter', { name: 'Nivel microfon' }).evaluate(element => element.value);
        }).toBeGreaterThan(0);
        await page.getByRole('button', { name: 'Oprește înregistrarea' }).click();
        await expect(page.getByLabel('Vocea înregistrată', { exact: true })).toBeVisible();
        assert.equal(await page.evaluate(() => window.micStreams.at(-1).getTracks().every(track => track.readyState === 'ended')), true);
        const previewUrl = await page.getByLabel('Vocea înregistrată', { exact: true }).getAttribute('src');
        assert.ok(await page.evaluate(async url => (await (await fetch(url)).blob()).size > 100, previewUrl));
        await page.getByLabel('Vocea înregistrată', { exact: true }).evaluate(element => element.play());
        await expect.poll(() => page.getByLabel('Vocea înregistrată', { exact: true }).evaluate(element => !element.paused)).toBe(true);
        await page.getByRole('button', { name: 'Trimite vocea ca temă' }).click();
        await expect(page.getByText('Vocea a fost trimisă pentru evaluare.')).toBeVisible();
        assert.equal(await page.evaluate(() => window.backend.uploads.length), 2);
        await page.evaluate(() => window.mountStudio(new Date(Date.now() - 1000).toISOString(), new Date(Date.now() + 5000).toISOString()));
        await page.getByLabel('Folosesc căști').check();
        await page.getByRole('button', { name: 'Înregistrează vocea', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Oprește înregistrarea' })).toBeEnabled();
        await page.waitForTimeout(400);
        await page.clock.runFor(6000);
        await expect(page.getByLabel('Vocea înregistrată', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Trimite vocea ca temă' })).toBeDisabled();
        assert.equal(await page.evaluate(() => window.micStreams.at(-1).getTracks().every(track => track.readyState === 'ended')), true);
        assert.equal(await page.evaluate(() => window.backend.uploads.length), 2);
        await page.evaluate(() => { window.denyMicrophone = true; window.mountStudio('2026-10-24T09:00:00Z', '2026-10-24T11:00:00Z'); });
        await page.getByLabel('Folosesc căști').check();
        await page.getByRole('button', { name: 'Înregistrează vocea', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('Microfon refuzat');
        await page.evaluate(() => { window.denyMicrophone = false; window.mountStudio('2026-10-24T09:00:00Z', '2026-10-24T11:00:00Z'); });
        await page.getByLabel('Folosesc căști').check();
        await page.getByRole('button', { name: 'Înregistrează vocea', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Oprește înregistrarea' })).toBeEnabled();
        await page.evaluate(() => window.mountTeacher());
        await expect.poll(() => page.evaluate(() => window.micStreams.at(-1).getTracks().every(track => track.readyState === 'ended'))).toBe(true);
        await expect(page.getByRole('button', { name: 'Aprobă', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Încarcă / reînnoiește audio' }).click();
        await expect(page.locator('audio')).toHaveAttribute('src', '/test.wav');
        await page.getByLabel('Feedback opțional').fill('Bravo!');
        await page.getByRole('button', { name: 'Aprobă', exact: true }).click();
        await expect(page.getByText('Stare: Aprobată')).toBeVisible();
        await page.getByLabel('Feedback opțional').fill('Repetă ritmul.');
        await page.getByRole('button', { name: 'Respinge', exact: true }).click();
        await expect(page.getByText('Stare: Respinsă')).toBeVisible();
        assert.deepEqual(await page.evaluate(() => window.backend.reviews), [{ status: 'approved', teacher_feedback: 'Bravo!' }, { status: 'rejected', teacher_feedback: 'Repetă ritmul.' }]);
        const moduleSelector = page.getByRole('combobox', { name: 'Modul de studiu', exact: true });
        assert.equal(await moduleSelector.locator('option').count(), 6);
        await moduleSelector.selectOption('modul_3');
        assert.equal(await page.evaluate(() => window.backend.promotions.length), 0, 'selection alone does not save');
        await page.getByRole('button', { name: 'Salvează modulul', exact: true }).click();
        await expect(page.getByText('Modul actual: Modulul 3 — Intermediar', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Salvează modulul', exact: true })).toBeDisabled();
        for (const [module, label] of [['modul_5', 'Modulul 5 — Măiestrie / Performance'], ['modul_2', 'Modulul 2 — Elementar'], ['modul_4', 'Modulul 4 — Avansat'], ['modul_1', 'Modulul 1 — Începător / Inițiere']]) {
            await moduleSelector.selectOption(module);
            await page.getByRole('button', { name: 'Salvează modulul', exact: true }).click();
            await expect(page.getByText('Modul actual: ' + label, { exact: true })).toBeVisible();
        }
        assert.deepEqual(await page.evaluate(() => window.backend.promotions.map(row => row.payload.study_level)), ['modul_3', 'modul_5', 'modul_2', 'modul_4', 'modul_1']);
        assert.deepEqual(await page.evaluate(() => window.backend.promotions[0].filters), [['id', 'student-id'], ['study_level', 'modul_1']]);
        await page.evaluate(() => { window.backend.rejectModuleUpdate = true; });
        await moduleSelector.selectOption('modul_5');
        await page.getByRole('button', { name: 'Salvează modulul', exact: true }).click();
        await expect(page.getByRole('alert')).toHaveText('Modulul nu a putut fi salvat.');
        await expect(page.getByText('Modul actual: Modulul 1 — Începător / Inițiere', { exact: true })).toBeVisible();
        assert.equal(await page.evaluate(() => window.backend.promotions.length), 5);
        await page.evaluate(() => { window.backend.rejectModuleUpdate = false; });
        await page.getByLabel('Început (ora locală)').fill('2026-10-25T12:00');
        await page.getByLabel('Sfârșit (ora locală)').fill('2026-10-25T13:00');
        await page.getByRole('button', { name: 'Salvează intervalul' }).click();
        await expect(page.getByText('Intervalul de predare a fost creat.')).toBeVisible();
        await page.evaluate(() => { window.delayMicrophone = true; window.mountStudio('2026-10-24T09:00:00Z', '2026-10-24T11:00:00Z'); });
        await page.getByLabel('Folosesc căști').check();
        await page.getByRole('button', { name: 'Înregistrează vocea', exact: true }).click();
        await page.waitForFunction(() => typeof window.resolveMicrophone === 'function');
        await page.evaluate(() => { window.mountTeacher(); window.resolveMicrophone(); });
        await expect.poll(() => page.evaluate(() => window.micStreams.at(-1).getTracks().every(track => track.readyState === 'ended'))).toBe(true);
        assert.equal(await page.evaluate(() => window.backend.uploads.length), 2);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.deepEqual(errors, []);
        await page.close();
        console.log(`Timed audio homework + Canto Studio browser PASS (${width}px)`);
    }
} finally {
    await browser?.close();
    await unlink(microphoneFixture);
    await new Promise(resolve => server.close(resolve));
}
