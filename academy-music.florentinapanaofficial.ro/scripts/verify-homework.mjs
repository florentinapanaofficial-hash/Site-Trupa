import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
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
                const state = window.backend = { uploads: [], reviews: [], promotions: [], assignments: [], rows: [], level: 'incepator' };
                export const getSignedAudioUrl = async (bucket, path) => { state.signed = { bucket, path }; return '/test.wav'; };
                export const supabase = {
                    auth: { getUser: async () => ({ data: { user: { id: 'student-id' } }, error: null }) },
                    storage: { from: bucket => ({ upload: async (path) => { state.uploads.push({ bucket, path }); return { error: null }; } }) },
                    from(table) {
                        let action = 'read', payload, filters = [];
                        const matches = row => filters.every(([key, value]) => row[key] === value);
                        const execute = () => {
                            if (table === 'profiles') {
                                if (action === 'update') { state.promotions.push({ payload, filters }); state.level = payload.study_level; }
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
                import React from 'react'; import { createRoot } from 'react-dom/client';
                import HomeworkSubmit from '/src/components/student/HomeworkSubmit.tsx';
                import HomeworkEvaluator from '/src/components/admin/HomeworkEvaluator.tsx';
                const root = createRoot(document.getElementById('fixture'));
                let revision = 0;
                window.mountStudent = (start, end) => {
                    window.backend.assignments = [{ id: 'assignment-id', student_id: 'student-id', submission_start: start, submission_end: end }];
                    root.render(React.createElement(HomeworkSubmit, { key: ++revision, assignmentId: 'assignment-id', submissionStart: start, submissionEnd: end }));
                };
                window.mountTeacher = () => {
                    window.backend.rows = [{ id: 'homework-id', student_id: 'student-id', audio_path: 'student-id/assignment-id/take.webm', status: 'pending', teacher_feedback: '', created_at: new Date().toISOString() }];
                    root.render(React.createElement(HomeworkEvaluator, { key: ++revision, studentId: 'student-id' }));
                };`;
        },
    }],
    build: { write: false, rollupOptions: { input: fixture } },
});
const entry = result.output.find((item) => item.type === 'chunk' && item.isEntry);
const server = createServer((request, response) => {
    if (request.url === '/fixture.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(entry.code); }
    else { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><html lang="ro"><meta charset="utf-8"><body><div id="fixture"></div><script type="module" src="/fixture.js"></script></body></html>'); }
});
let browser;
try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    browser = await chromium.launch({ headless: true });
    for (const width of [390, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
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
        await page.evaluate(() => window.mountTeacher());
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
        await page.getByRole('button', { name: 'Deblochează nivelul următor: Mediu', exact: true }).click();
        await expect(page.getByText('Nivel actual: Mediu')).toBeVisible();
        await page.getByRole('button', { name: 'Deblochează nivelul următor: Avansat', exact: true }).click();
        await expect(page.getByText('Elevul este deja la nivelul maxim.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Deblochează nivelul următor', exact: true })).toBeDisabled();
        assert.deepEqual(await page.evaluate(() => window.backend.promotions.map(row => row.payload.study_level)), ['mediu', 'avansat']);
        await page.getByLabel('Început (ora locală)').fill('2026-10-25T12:00');
        await page.getByLabel('Sfârșit (ora locală)').fill('2026-10-25T13:00');
        await page.getByRole('button', { name: 'Salvează intervalul' }).click();
        await expect(page.getByText('Intervalul de predare a fost creat.')).toBeVisible();
        assert.deepEqual(errors, []);
        await page.close();
        console.log(`Timed audio homework browser PASS (${width}px)`);
    }
} finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
}
