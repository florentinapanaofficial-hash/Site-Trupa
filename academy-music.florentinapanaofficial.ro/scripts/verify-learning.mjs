import { chromium, expect } from '@playwright/test';
import { loadEnv, build } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import midiPackage from '@tonejs/midi';
import { spawnSync } from 'node:child_process';

async function verifyScoreEditor(page, viewport) {
    const editor = page.getByRole('region', { name: 'Editor de partituri' });
    await editor.scrollIntoViewIfNeeded();
    await expect(editor.locator('svg[aria-label^="Partitură"]')).toHaveCount(1);
    assert.equal(await page.evaluate(() => document.fonts.check('24px Bravura') && document.fonts.check('14px Academico')), true);
    await expect(editor.getByRole('button', { name: 'Play Compoziție', exact: true })).toBeDisabled();
    await expect(editor.getByRole('button', { name: 'Exportă MIDI', exact: true })).toBeDisabled();
    const staff = editor.locator('.score-staff');
    await staff.click({ position: { x: 180, y: 155 } });
    await expect(editor.getByRole('status')).toContainText('1 / 128');
    await editor.getByText('Optime', { exact: true }).click();
    await editor.getByRole('button', { name: 'Pauză', exact: true }).click();
    await editor.getByText('Doime', { exact: true }).click();
    await editor.getByRole('button', { name: 'Adaugă Mi4', exact: true }).click();
    await editor.getByRole('button', { name: 'Adaugă Sol4', exact: true }).click();
    await editor.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(editor.getByRole('status')).toContainText('3 / 128');
    const downloadEvent = page.waitForEvent('download');
    await editor.getByRole('button', { name: 'Exportă MIDI', exact: true }).click();
    const download = await downloadEvent;
    assert.equal(download.suggestedFilename(), 'compozitia-mea.mid');
    const midi = new midiPackage.Midi(await readFile(await download.path()));
    assert.deepEqual(midi.tracks[0].notes.map((note) => [note.midi, note.time, note.duration]), [[60, 0, 0.5], [64, 0.75, 1]]);
    await editor.getByLabel('Instrument partitură').selectOption('accordion');
    const before = await page.evaluate(() => window.testAudioContexts.flatMap((audio) => audio.testOscillators).length);
    await editor.getByRole('button', { name: 'Play Compoziție', exact: true }).click();
    await expect(editor.getByRole('button', { name: 'Oprește compoziția', exact: true })).toBeVisible();
    const playback = await page.evaluate((before) => window.testAudioContexts.flatMap((audio) => audio.testOscillators).slice(before).map((entry) => ({ type: entry.node.type, start: entry.starts[0]?.when })), before);
    assert.equal(playback.length, 2);
    assert.ok(playback.every((entry) => entry.type === 'sawtooth'));
    assert.ok(Math.abs(playback[1].start - playback[0].start - 0.75) < 0.000001);
    await editor.getByRole('button', { name: 'Oprește compoziția', exact: true }).click();
    await expect(editor.getByRole('button', { name: 'Play Compoziție', exact: true })).toBeVisible();
    await editor.getByRole('button', { name: 'Clear All', exact: true }).click();
    await expect(editor.locator('svg[aria-label]')).toHaveAttribute('aria-label', 'Partitură în cheia Sol, 0 note și pauze');
    await editor.getByText('Pătrime', { exact: true }).click();
    if (viewport.width < 500) await editor.getByRole('button', { name: 'Adaugă Do5', exact: true }).tap();
    else await editor.getByRole('button', { name: 'Adaugă Do5', exact: true }).click();
    await editor.getByRole('button', { name: 'Play Compoziție', exact: true }).click();
    await expect(editor.getByRole('button', { name: 'Play Compoziție', exact: true })).toBeVisible({ timeout: 3000 });
    for (let index = 0; index < 12; index += 1) await editor.getByRole('button', { name: 'Adaugă Re5', exact: true }).click();
    const scroller = editor.getByLabel('Portativ cu derulare orizontală');
    assert.equal(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth), true);
    await scroller.evaluate((element) => { element.scrollLeft = 400; });
    await expect(editor.locator('svg[aria-label]')).toHaveAttribute('aria-label', 'Partitură în cheia Sol, 13 note și pauze');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: fileURLToPath(new URL(`score-editor-${viewport.width}.png`, shots)), fullPage: true });
    await editor.getByRole('button', { name: 'Clear All', exact: true }).click();
    const metadata = await page.evaluate(() => ({ title: document.title.length, description: document.querySelector('meta[name=description]').content.length, missingAlt: document.querySelectorAll('img:not([alt])').length }));
    assert.ok(metadata.title >= 50 && metadata.title <= 58 && metadata.description >= 130 && metadata.description <= 150);
    assert.equal(metadata.missingAlt, 0);
    console.log(`PASS ${viewport.width}px: VexFlow SVG/local fonts, staff click, mobile notes, rests/durations, undo/clear, ADSR scheduling, stop/completion, downloaded MIDI timing, long-score overflow, metadata`);
}

async function verifyInteractiveStudio(page, viewport) {
    const studio = page.getByRole('region', { name: 'Studio interactiv MIDI' });
    await expect.poll(() => studio.evaluate((element) => !element.closest('astro-island').hasAttribute('ssr'))).toBe(true);
    await expect(studio.getByRole('button', { name: 'REC', exact: true })).toBeVisible();
    await expect(studio.locator('canvas')).toHaveCount(0);
    const midi = new midiPackage.Midi();
    const track = midi.addTrack();
    track.addNote({ midi: 60, time: 0.6, duration: 0.5 });
    track.addNote({ midi: 64, time: 0.6, duration: 0.5 });
    track.addNote({ midi: 62, time: 1.8, duration: 0.4 });
    await studio.getByLabel('Încarcă MIDI', { exact: true }).setInputFiles({ name: 'test-studio.mid', mimeType: 'audio/midi', buffer: Buffer.from(midi.toArray()) });
    await expect(studio.getByText('test-studio.mid')).toBeVisible();
    await studio.getByLabel('Volum Demo', { exact: true }).fill('0.35');
    await studio.getByLabel('Volumul Meu', { exact: true }).fill('0.7');
    await studio.getByRole('button', { name: 'Mute Demo', exact: true }).click();
    await expect(studio.getByRole('button', { name: 'Mute Demo', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(studio.getByLabel('Măsură', { exact: true }).locator('option')).toHaveText(['2/4', '3/4', '4/4', '6/8', '9/8', '12/8']);
    await studio.getByLabel('Măsură', { exact: true }).selectOption('3/4');
    await studio.getByLabel('Metronom studio', { exact: true }).check();
    await studio.getByRole('button', { name: /Schimbă vederea/ }).click();
    await expect(studio.locator('canvas')).toHaveCount(1);
    const initialCanvas = await studio.locator('canvas').evaluate((canvas) => canvas.toDataURL());
    assert.ok(await studio.locator('canvas').evaluate((canvas) => {
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let gold = 0;
        for (let index = 0; index < pixels.length; index += 4) if (pixels[index] === 232 && pixels[index + 1] === 196) gold += 1;
        return gold > 100;
    }));
    const teacher = studio.getByRole('group', { name: 'Claviatura profesorului' });
    const student = studio.getByRole('group', { name: 'Claviatura elevului' });
    const doKey = student.getByRole('button', { name: 'Do4', exact: true });
    await doKey.scrollIntoViewIfNeeded();
    await studio.getByRole('button', { name: 'Pornește studiul' }).click();
    await studio.evaluate((element) => new Promise((resolve, reject) => {
        const deadline = performance.now() + 4000;
        const playChord = () => {
            if (element.querySelector('[aria-label="Claviatura profesorului"] [data-note="60"]').dataset.state === 'teacher') {
                document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
                document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }));
                resolve();
            } else if (performance.now() > deadline) reject(new Error('Teacher note did not light'));
            else requestAnimationFrame(playChord);
        };
        playChord();
    }));
    await expect(teacher.locator('[data-note="60"]')).toHaveAttribute('data-state', 'teacher');
    await expect(doKey).toHaveAttribute('data-state', 'correct');
    assert.notEqual(await studio.locator('canvas').evaluate((canvas) => canvas.toDataURL()), initialCanvas);
    await expect(student.getByRole('button', { name: 'Mi4', exact: true })).toHaveAttribute('data-state', 'correct');
    await page.keyboard.up('a');
    await page.keyboard.up('d');
    await page.keyboard.press('w');
    await expect(student.getByRole('button', { name: 'Do♯4', exact: true })).toHaveAttribute('data-state', 'wrong');
    await expect(studio.getByText(/Rezultat final/)).toContainText('67%');
    await expect(studio.getByText('2 / 3 note corecte · 1 apăsări greșite')).toBeVisible();
    const graph = await page.evaluate(() => {
        const audio = window.testAudioContexts[0];
        return {
            demo: audio.testGains[0].gain.value, student: audio.testGains[1].gain.value,
            demoNotes: audio.testOscillators.filter((entry) => entry.node.testOutput?.testOutput === audio.testGains[0]).length,
            studentNotes: audio.testOscillators.filter((entry) => entry.node.testOutput?.testOutput === audio.testGains[1]).length,
            clicks: audio.testOscillators.flatMap((entry) => entry.starts).filter((start) => [800, 1200].includes(start.frequency)).map((start) => start.frequency),
        };
    });
    assert.equal(graph.demo, 0);
    assert.ok(Math.abs(graph.student - 0.7) < 0.00001);
    assert.ok(graph.demoNotes >= 3);
    assert.ok(graph.studentNotes >= 3);
    assert.deepEqual(graph.clicks.slice(0, 4), [1200, 800, 800, 1200]);
    await studio.getByRole('button', { name: 'Mute Demo', exact: true }).click();
    assert.equal(await page.evaluate(() => window.testAudioContexts[0].testGains[0].testTargets.at(-1)), 0.35);
    await studio.getByLabel('Volumul Meu', { exact: true }).fill('0');
    assert.equal(await page.evaluate(() => window.testAudioContexts[0].testGains[1].testTargets.at(-1)), 0);
    assert.equal(await page.evaluate(() => window.testAudioContexts[0].testGains[0].testTargets.at(-1)), 0.35);
    await studio.getByLabel('Volumul Meu', { exact: true }).fill('0.7');
    await studio.getByRole('button', { name: 'Reia studiul' }).click();
    await studio.getByLabel('Tempo studio').fill('0.5');
    await expect(studio.getByText('50%', { exact: true })).toBeVisible();
    await studio.getByLabel('Poziție studiu').fill('0.5');
    await studio.getByRole('button', { name: /^A ·/ }).click();
    await studio.getByLabel('Poziție studiu').fill('1.2');
    await studio.getByRole('button', { name: /^B ·/ }).click();
    await studio.getByLabel('Buclă A–B', { exact: true }).check();
    await studio.getByRole('button', { name: 'Pornește studiul' }).click();
    await expect.poll(async () => Number(await studio.getByLabel('Poziție studiu').inputValue()), { intervals: [20] }).toBeGreaterThan(1.05);
    await expect.poll(async () => Number(await studio.getByLabel('Poziție studiu').inputValue()), { intervals: [20] }).toBeLessThan(0.8);
    await studio.getByRole('button', { name: 'Pauză studiu' }).click();
    await studio.getByRole('button', { name: /Schimbă vederea/ }).click();
    await expect(studio.locator('canvas')).toHaveCount(0);
    await studio.getByLabel('Buclă A–B', { exact: true }).uncheck();
    const encoded = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=3', '-f', 'mp3', 'pipe:1']);
    if (encoded.status === 0) {
        await studio.getByLabel('Încarcă MP3', { exact: true }).setInputFiles({ name: 'backing-test.mp3', mimeType: 'audio/mpeg', buffer: encoded.stdout });
        await expect.poll(() => studio.locator('audio').evaluate((audio) => audio.readyState)).toBeGreaterThan(0);
        await studio.getByRole('button', { name: 'Pornește studiul' }).click();
        await expect.poll(() => studio.locator('audio').evaluate((audio) => audio.currentTime)).toBeGreaterThan(0.2);
        assert.equal(await studio.locator('audio').evaluate((audio) => audio.playbackRate), 0.5);
        assert.equal(await studio.locator('audio').evaluate((audio) => audio.preservesPitch), true);
        await studio.getByLabel('Tempo studio').fill('0.75');
        await expect.poll(() => studio.locator('audio').evaluate((audio) => audio.playbackRate)).toBe(0.75);
        await studio.getByLabel('Măsură', { exact: true }).selectOption('6/8');
        await studio.getByLabel('Tempo studio').fill('0.5');
        assert.ok(await studio.evaluate((element) => Math.abs(Number(element.querySelector('[aria-label="Poziție studiu"]').value) - element.querySelector('audio').currentTime) < 0.1));
        await studio.getByRole('button', { name: 'Pauză studiu' }).click();
        assert.equal(await studio.locator('audio').evaluate((audio) => audio.paused), true);
        await studio.getByLabel('Poziție studiu').fill('0.5');
        await studio.getByRole('button', { name: /^A ·/ }).click();
        await studio.getByLabel('Buclă A–B', { exact: true }).check();
        await studio.getByRole('button', { name: 'Pornește studiul' }).click();
        await expect.poll(() => studio.locator('audio').evaluate((audio) => audio.currentTime), { intervals: [20] }).toBeGreaterThan(1.05);
        await expect.poll(() => studio.locator('audio').evaluate((audio) => audio.currentTime), { intervals: [20] }).toBeLessThan(0.8);
        const synchronization = await page.evaluate(() => window.testAudioContexts[0].testOscillators.flatMap((entry) => entry.starts).filter((start) => start.mediaPosition !== null && [800, 1200].includes(start.frequency)).map((start) => {
            const position = start.mediaPosition + Math.max(0, start.when - start.audioTime) * start.rate;
            const quarter = Math.round(position / 0.25) * 0.25;
            return Math.abs(position - quarter);
        }));
        assert.ok(synchronization.length > 2);
        assert.ok(synchronization.every((error) => error < 0.02));
        await studio.getByRole('button', { name: 'Elimină MP3' }).click();
        await studio.getByLabel('Buclă A–B', { exact: true }).uncheck();
        console.log(`PASS ${viewport.width}px: real MP3 decoding, synchronized MIDI clock, playbackRate, preservesPitch, pause, A-B audio loop`);
    } else console.log('SKIP real MP3 fixture: install ffmpeg to enable audio integration checks');
    await studio.getByRole('button', { name: 'Conectează MIDI' }).click();
    await expect(studio.getByText('Test USB')).toBeVisible();
    await page.evaluate(() => window.testMidiInput.onmidimessage({ data: [0x90, 60, 100] }));
    await expect(doKey).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => window.testMidiInput.onmidimessage({ data: [0x90, 60, 0] }));
    await expect(doKey).toHaveAttribute('aria-pressed', 'false');
    await doKey.scrollIntoViewIfNeeded();
    if (viewport.width < 500) await doKey.tap();
    else { await doKey.hover(); await page.mouse.down(); await expect(doKey).toHaveAttribute('aria-pressed', 'true'); await page.mouse.up(); }
    await expect(doKey).toHaveAttribute('aria-pressed', 'false');
    await studio.getByLabel('Încarcă MIDI', { exact: true }).setInputFiles({ name: 'broken.mid', mimeType: 'audio/midi', buffer: Buffer.from('broken') });
    await expect(studio.getByRole('alert')).toBeVisible();
    await studio.getByRole('button', { name: /Schimbă vederea/ }).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await studio.scrollIntoViewIfNeeded();
    await page.screenshot({ path: fileURLToPath(new URL(`interactive-studio-${viewport.width}.png`, shots)), fullPage: true });
    console.log(`PASS ${viewport.width}px: MIDI import, chord scoring, final accuracy, tempo, A-B loop, Canvas pixels/simple mode, USB MIDI, pointer/touch, invalid file`);
    console.log(`PASS ${viewport.width}px: independent real GainNodes, demo mute with visual guidance, student volume, 3/4 accents, meter/tempo changes and MP3 metronome alignment`);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const env = loadEnv('production', root, 'VITE_');
const base = process.env.ACADEMY_TEST_URL || 'http://127.0.0.1:4185';
const student = '11111111-1111-4111-8111-111111111111';
const user = { id: student, aud: 'authenticated', role: 'authenticated', email: 'test@example.invalid', app_metadata: {}, user_metadata: {} };
const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: student, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.test`;
const browser = await chromium.launch();
const scoreOnly = process.argv.includes('--score-editor');
const homeworkOnly = process.argv.includes('--homework');
const driveOnly = process.argv.includes('--drive-upload');
const catalogOnly = process.argv.includes('--drive-catalog');
const shots = new URL('../.astro/screenshots/', import.meta.url);
await mkdir(shots, { recursive: true });

async function verifyHomeworkRecording() {
    const encoded = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=3', '-f', 'mp3', 'pipe:1']);
    const silence = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '2', '-f', 'mp3', 'pipe:1']);
    if (encoded.status !== 0 || silence.status !== 0) { console.log('SKIP homework recording: ffmpeg is required for real audio fixtures'); return; }
    const fixtureId = 'virtual:homework-fixture';
    const result = await build({
        root, configFile: false, logLevel: 'error',
        plugins: [react(), {
            name: 'homework-test-fixture', resolveId(id) { if (id === fixtureId) return `\0${fixtureId}`; }, load(id) {
                if (id !== `\0${fixtureId}`) return;
                return `import React from 'react'; import { createRoot } from 'react-dom/client'; import InteractiveStudio, { uploadHomeworkToDrive } from '/src/components/InteractiveStudio.jsx';
                import { supabase } from '/src/lib/supabase.js';
                supabase.auth.getSession = async () => ({ data: { session: { access_token: 'homework-test-token' } } });
                window.testDriveUpload = uploadHomeworkToDrive;
                window.homeworkUploads = []; window.rejectHomework = true;
                window.homeworkRoot = createRoot(document.getElementById('fixture'));
                window.setHomeworkMode = (mode) => window.homeworkRoot.render(React.createElement(InteractiveStudio, { isHomeworkMode: mode, onSubmitHomework: async (payload) => {
                    window.homeworkUploads.push(payload); if (window.rejectHomework) throw new Error('Upload test indisponibil');
                    return uploadHomeworkToDrive(payload);
                } })); window.setHomeworkMode(true);`;
            }
        }],
        build: { write: false, rollupOptions: { input: fixtureId } },
    });
    const output = Array.isArray(result) ? result[0].output : result.output;
    const entry = output.find((item) => item.type === 'chunk' && item.isEntry);
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
        const context = await browser.newContext({ viewport, hasTouch: viewport.width < 500 });
        const page = await context.newPage();
        const errors = [];
        const driveUploads = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.route(`${base}/api/upload-homework/`, async (route) => {
            const request = route.request();
            assert.equal(request.headers().authorization, 'Bearer homework-test-token');
            assert.match(request.headers()['content-type'], /^multipart\/form-data; boundary=/);
            assert.ok(request.postDataBuffer().includes(Buffer.from('name="file"')));
            driveUploads.push(request.postDataBuffer().length);
            await route.fulfill({ status: driveUploads.length === 1 ? 502 : 201, contentType: 'application/json', body: JSON.stringify(driveUploads.length === 1 ? { error: 'Drive temporar indisponibil' } : { webViewLink: 'https://drive.google.com/file/d/test-homework/view' }) });
        });
        await page.addInitScript(() => {
            window.recordingEdges = [];
            window.nativeRecorders = [];
            const connect = AudioNode.prototype.connect;
            AudioNode.prototype.connect = function (destination, ...args) { window.recordingEdges.push([this, destination]); return connect.call(this, destination, ...args); };
            const Recorder = window.MediaRecorder;
            window.MediaRecorder = class extends Recorder { constructor(...args) { super(...args); window.nativeRecorders.push(this); } };
        });
        await page.route(`${base}/__homework-test__/**`, async (route) => {
            const filename = new URL(route.request().url()).pathname.replace('/__homework-test__/', '');
            if (!filename) {
                const css = output.filter((item) => item.type === 'asset' && item.fileName.endsWith('.css')).map((item) => `<link rel="stylesheet" href="${item.fileName}">`).join('');
                await route.fulfill({ contentType: 'text/html', body: `<html lang="ro"><head><meta name="viewport" content="width=device-width,initial-scale=1">${css}</head><body style="background:#070609;color:white;margin:16px"><main id="fixture" style="max-width:880px;margin:auto"></main><script type="module" src="${entry.fileName}"></script></body></html>` });
            } else {
                const asset = output.find((item) => item.fileName === filename);
                if (!asset) { await route.fulfill({ status: 404, body: '' }); return; }
                await route.fulfill({ contentType: filename.endsWith('.css') ? 'text/css' : 'application/javascript', body: asset.type === 'chunk' ? asset.code : asset.source });
            }
        });
        await page.goto(`${base}/__homework-test__/`);
        const studio = page.getByRole('region', { name: 'Studio interactiv MIDI' });
        await expect(studio.getByRole('button', { name: 'REC', exact: true })).toBeVisible();
        await expect(studio.getByRole('button', { name: 'REC', exact: true })).toBeDisabled();
        if (driveOnly) {
            const failure = await page.evaluate(async () => {
                try { await window.testDriveUpload({ blob: new Blob(['audio'], { type: 'audio/webm' }), fileName: 'tema.webm' }); }
                catch (error) { return error.message; }
            });
            assert.equal(failure, 'Drive temporar indisponibil');
            const result = await page.evaluate(() => window.testDriveUpload({ blob: new Blob(['audio'], { type: 'audio/webm' }), fileName: 'tema.webm' }));
            assert.equal(result.webViewLink, 'https://drive.google.com/file/d/test-homework/view');
            assert.equal(driveUploads.length, 2);
            assert.deepEqual(errors, []);
            console.log(`PASS ${viewport.width}px: browser Drive helper sends multipart + JWT, rejects API failure and returns webViewLink after retry (mocked API, no REC)`);
            await context.close();
            continue;
        }
        const midi = new midiPackage.Midi();
        midi.addTrack().addNote({ midi: 60, time: 0.2, duration: 0.3 });
        await studio.getByLabel('Încarcă MIDI', { exact: true }).setInputFiles({ name: 'short.mid', mimeType: 'audio/midi', buffer: Buffer.from(midi.toArray()) });
        await studio.getByLabel('Încarcă MP3', { exact: true }).setInputFiles({ name: 'backing.mp3', mimeType: 'audio/mpeg', buffer: encoded.stdout });
        const backing = studio.locator('audio:not([controls])');
        await expect.poll(() => backing.evaluate((audio) => audio.readyState)).toBeGreaterThan(0);
        await studio.getByLabel('Poziție studiu').fill('0.4');
        await studio.getByLabel('Metronom studio').check();
        await studio.getByRole('button', { name: 'REC', exact: true }).click();
        await expect(studio.getByRole('button', { name: 'STOP', exact: true })).toBeVisible();
        assert.ok(await backing.evaluate((audio) => audio.currentTime < 0.5 && !audio.paused));
        await expect(studio.getByLabel('Poziție studiu')).toBeDisabled();
        try { await expect.poll(() => backing.evaluate((audio) => audio.currentTime), { intervals: [20] }).toBeGreaterThan(1); }
        catch (failure) {
            console.error('REC startup state', await backing.evaluate((audio) => ({ time: audio.currentTime, paused: audio.paused, ready: audio.readyState, ended: audio.ended, error: audio.error?.message, recorder: window.nativeRecorders.map((recorder) => recorder.state), alerts: [...document.querySelectorAll('[role="alert"]')].map((element) => element.textContent), buttons: [...document.querySelectorAll('.is-homework button')].map((element) => element.textContent) })));
            throw failure;
        }
        await expect(studio.getByRole('button', { name: 'STOP', exact: true })).toBeVisible();
        await studio.focus();
        await page.keyboard.down('a');
        await expect(studio.getByRole('group', { name: 'Claviatura elevului' }).getByRole('button', { name: 'Do4', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await page.keyboard.up('a');
        const routing = await page.evaluate(() => {
            const edges = window.recordingEdges;
            const incoming = edges.filter(([, target]) => target instanceof MediaStreamAudioDestinationNode);
            return { count: incoming.length, media: incoming.filter(([source]) => source instanceof MediaElementAudioSourceNode).length, student: incoming.filter(([source]) => source instanceof GainNode && Math.abs(source.gain.value - 0.8) < 0.001).length };
        });
        assert.deepEqual(routing, { count: 2, media: 1, student: 1 });
        await studio.getByRole('button', { name: 'STOP', exact: true }).click();
        const preview = studio.getByLabel('Audiție temă', { exact: true });
        await expect(preview).toBeVisible();
        await expect.poll(() => preview.evaluate((audio) => audio.readyState)).toBeGreaterThan(0);
        await preview.evaluate((audio) => audio.play());
        await expect.poll(() => preview.evaluate((audio) => audio.currentTime)).toBeGreaterThan(0);
        await preview.evaluate((audio) => audio.pause());
        await studio.getByRole('button', { name: 'Trimite Tema', exact: true }).click();
        await expect(studio.getByRole('alert')).toHaveText('Upload test indisponibil');
        await expect(preview).toBeVisible();
        await page.evaluate(() => { window.rejectHomework = false; });
        await studio.getByRole('button', { name: 'Trimite Tema', exact: true }).click();
        await expect(studio.getByRole('alert')).toHaveText('Drive temporar indisponibil');
        await studio.getByRole('button', { name: 'Trimite Tema', exact: true }).click();
        await expect(studio.getByRole('button', { name: 'Temă trimisă', exact: true })).toBeDisabled();
        await expect(studio.getByRole('alert')).toHaveText('Tema a fost trimisă cu succes domnului profesor!');
        await expect(studio.getByRole('link', { name: 'Deschide în Drive' })).toHaveAttribute('href', 'https://drive.google.com/file/d/test-homework/view');
        assert.equal(await page.evaluate(() => window.homeworkUploads[0].fileName === window.homeworkUploads[1].fileName && window.homeworkUploads[1].blob.size > 0 && window.homeworkUploads[1].contentType.startsWith('audio/')), true);
        await studio.getByRole('button', { name: 'REC', exact: true }).click();
        await expect(studio.getByRole('button', { name: 'STOP', exact: true })).toBeVisible();
        await expect(preview).toBeVisible({ timeout: 6000 });
        assert.equal(await backing.evaluate((audio) => audio.paused), true);
        assert.equal(await page.evaluate(() => window.recordingEdges.filter(([source, target]) => source instanceof MediaElementAudioSourceNode && target instanceof MediaStreamAudioDestinationNode).length), 1);
        await studio.getByLabel('Încarcă MP3', { exact: true }).setInputFiles({ name: 'silence.mp3', mimeType: 'audio/mpeg', buffer: silence.stdout });
        await expect.poll(() => backing.evaluate((audio) => audio.readyState)).toBeGreaterThan(0);
        await studio.getByRole('button', { name: 'REC', exact: true }).click();
        await expect(studio.getByRole('button', { name: 'STOP', exact: true })).toBeVisible();
        await expect(preview).toBeVisible({ timeout: 5000 });
        await studio.getByRole('button', { name: 'Trimite Tema', exact: true }).click();
        await expect(studio.getByRole('button', { name: 'Temă trimisă', exact: true })).toBeDisabled();
        const rms = await page.evaluate(async () => {
            const audio = new AudioContext();
            try {
                const decoded = await audio.decodeAudioData(await window.homeworkUploads.at(-1).blob.arrayBuffer());
                const samples = decoded.getChannelData(0);
                return Math.sqrt(samples.reduce((total, sample) => total + sample * sample, 0) / samples.length);
            } finally { await audio.close(); }
        });
        assert.ok(rms < 0.00001, `Demo/metronome leaked into recording: RMS ${rms}`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.screenshot({ path: fileURLToPath(new URL(`homework-recording-${viewport.width}.png`, shots)), fullPage: true });
        await page.evaluate(() => window.setHomeworkMode(false));
        await expect(studio.getByRole('button', { name: 'REC', exact: true })).toHaveCount(0);
        await expect(preview).toHaveCount(0);
        await page.evaluate(() => window.homeworkRoot.unmount());
        assert.equal(await page.evaluate(() => window.nativeRecorders.every((recorder) => recorder.state === 'inactive' && recorder.stream.getTracks().every((track) => track.readyState === 'ended'))), true);
        assert.deepEqual(errors, []);
        console.log(`PASS ${viewport.width}px: homework-only REC, real MediaRecorder, MP3 from zero, student+backing graph, manual/end stop, preview playback, upload retry, repeated takes, no demo/metronome in decoded audio, cleanup`);
        await context.close();
    }
}
try {
    if (!scoreOnly && !catalogOnly) await verifyHomeworkRecording();
    for (const viewport of homeworkOnly || driveOnly ? [] : [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
        const context = await browser.newContext({ viewport, hasTouch: viewport.width < 500 });
        const page = await context.newPage();
        const errors = [];
        const storageRequests = [];
        const homework = [];
        const attempts = [];
        const catalogRows = [];
        let catalogRole = 'elev';
        let rejectCatalogUpload = true;
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => { if (/violates.*security policy|refused to execute/i.test(message.text())) errors.push(message.text()); });
        page.on('request', (request) => { if (request.url().includes('/storage/v1/')) storageRequests.push(request.url()); });
        await page.addInitScript(({ token, user }) => {
            localStorage.setItem('academy-music-auth', JSON.stringify({ access_token: token, refresh_token: 'test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user }));
            window.testMidiInput = { id: 'usb-test', name: 'Test USB', state: 'connected', onmidimessage: null };
            Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: async () => ({ inputs: new Map([['usb-test', window.testMidiInput]]), onstatechange: null }) });
            const NativeAudioContext = window.AudioContext;
            window.testAudioContexts = [];
            window.AudioContext = class extends NativeAudioContext {
                constructor(...args) { super(...args); this.testGains = []; this.testOscillators = []; window.testAudioContexts.push(this); }
                createGain() {
                    const gain = super.createGain();
                    gain.testTargets = [];
                    const setTarget = gain.gain.setTargetAtTime.bind(gain.gain);
                    gain.gain.setTargetAtTime = (value, time, constant) => { gain.testTargets.push(value); return setTarget(value, time, constant); };
                    const connect = gain.connect.bind(gain);
                    gain.connect = (destination) => { gain.testOutput = destination; return connect(destination); };
                    this.testGains.push(gain);
                    return gain;
                }
                createOscillator() {
                    const oscillator = super.createOscillator();
                    const record = { node: oscillator, starts: [] };
                    this.testOscillators.push(record);
                    const connect = oscillator.connect.bind(oscillator);
                    oscillator.connect = (destination) => { oscillator.testOutput = destination; return connect(destination); };
                    const start = oscillator.start.bind(oscillator);
                    oscillator.start = (when) => {
                        const media = document.querySelector('[aria-label="Studio interactiv MIDI"] audio');
                        record.starts.push({ when, audioTime: this.currentTime, frequency: oscillator.frequency.value, mediaPosition: media?.currentSrc.startsWith('blob:') && !media.paused ? media.currentTime : null, rate: media?.playbackRate });
                        return start(when);
                    };
                    return oscillator;
                }
            };
        }, { token, user });
        if (!env.VITE_SUPABASE_URL) throw new Error('Browser test requires a configured Supabase URL; all Supabase requests will be mocked.');
        await page.route(`${new URL(env.VITE_SUPABASE_URL).origin}/**`, async (route) => {
            const path = new URL(route.request().url()).pathname;
            let data = [];
            if (path === '/auth/v1/user') data = user;
            else if (path.endsWith('/profiles')) data = { id: student, role: catalogRole, is_active: true, full_name: 'Elev test' };
            else if (path.endsWith('/catalog_teme')) data = catalogRows;
            else if (path.endsWith('/quizzes')) data = { title: 'Notele muzicale' };
            else if (path.endsWith('/quiz_questions')) data = [
                { id: 'first', prompt: 'Ce notă urmează după Do?', options: ['Re', 'Fa', 'Sol'], position: 0 },
                { id: 'second', prompt: 'Câte note naturale are gama Do major?', options: ['Cinci', 'Șapte', 'Nouă'], position: 1 },
            ];
            else if (path.endsWith('/quiz_results')) { attempts.push(route.request().postDataJSON()); data = { score: 2, total: 2 }; }
            else if (path.endsWith('/student_homework')) { homework.push(route.request().postDataJSON()); data = null; }
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
        });
        if (catalogOnly) {
            await page.route(`${base}/api/upload-homework/`, async (route) => {
                const request = route.request();
                assert.equal(request.headers().authorization, `Bearer ${token}`);
                const form = await new Response(request.postDataBuffer(), { headers: { 'Content-Type': request.headers()['content-type'] } }).formData();
                assert.ok(form.get('file').size > 0);
                assert.equal(form.get('title'), 'Studiu pentru profesor');
                assert.equal(form.get('studentNote'), 'Tema de astăzi');
                if (rejectCatalogUpload) {
                    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Catalog indisponibil pentru test' }) });
                    return;
                }
                const row = { id: `catalog-${catalogRows.length}`, student_id: student, student_name: 'Elev test', title: form.get('title'), student_note: form.get('studentNote'), created_at: new Date().toISOString(), drive_url: `https://drive.google.com/file/d/catalog-${catalogRows.length}/view` };
                catalogRows.unshift(row);
                await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: row.id, webViewLink: row.drive_url }) });
            });
            await page.goto(`${base}/portofoliu/`);
            await expect(page.getByRole('heading', { name: 'Portofoliul meu' })).toBeVisible();
            await page.getByLabel('Titlu', { exact: true }).fill('Studiu pentru profesor');
            await page.getByLabel('Mesaj pentru profesor (opțional)').fill('Tema de astăzi');
            const midi = new midiPackage.Midi();
            midi.addTrack().addNote({ midi: 60, time: 0, duration: 0.5 });
            await page.getByLabel('Fișier audio, MIDI, video sau foto').setInputFiles({ name: 'tema.mid', mimeType: 'audio/midi', buffer: Buffer.from(midi.toArray()) });
            await page.getByRole('button', { name: 'Trimite tema', exact: true }).click();
            await expect(page.getByText('Catalog indisponibil pentru test', { exact: true })).toBeVisible();
            assert.equal(await page.locator('#file').evaluate((input) => input.files.length), 1);
            rejectCatalogUpload = false;
            await page.getByRole('button', { name: 'Trimite tema', exact: true }).click();
            await expect(page.getByText('Tema a fost trimisă cu succes domnului profesor!', { exact: true })).toBeVisible();
            const catalog = page.getByRole('region', { name: 'Teme Google Drive' });
            await expect(catalog.getByRole('link', { name: 'Deschide în Drive' })).toHaveAttribute('href', catalogRows[0].drive_url);
            await expect(catalog.getByText('Tema de astăzi')).toBeVisible();
            await page.getByLabel('Titlu', { exact: true }).fill('Studiu pentru profesor');
            await page.getByLabel('Mesaj pentru profesor (opțional)').fill('Tema de astăzi');
            await page.getByLabel('Fișier audio, MIDI, video sau foto').setInputFiles({ name: 'tema.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3audio-upload-fixture') });
            await page.getByRole('button', { name: 'Trimite tema', exact: true }).click();
            await expect(catalog.getByRole('link', { name: 'Deschide în Drive' })).toHaveCount(2);
            await expect(page.getByText('Tema a fost trimisă cu succes domnului profesor!', { exact: true })).toBeVisible();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            await page.screenshot({ path: fileURLToPath(new URL(`drive-catalog-student-${viewport.width}.png`, shots)), fullPage: true });
            catalogRole = 'profesor';
            await page.goto(`${base}/admin/`);
            await expect(page.getByRole('region', { name: 'Teme Google Drive' }).getByRole('link', { name: 'Deschide în Drive' })).toHaveCount(2);
            await expect(page.getByRole('region', { name: 'Teme Google Drive' }).getByRole('link', { name: 'Deschide în Drive' }).first()).toHaveAttribute('href', catalogRows[0].drive_url);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            await page.screenshot({ path: fileURLToPath(new URL(`drive-catalog-teacher-${viewport.width}.png`, shots)), fullPage: true });
            assert.deepEqual(storageRequests, []);
            assert.deepEqual(errors, []);
            console.log(`PASS ${viewport.width}px: portfolio MIDI/audio multipart + metadata + JWT, API failure/retry, exact confirmation, student and teacher Drive catalog, no Storage requests, no overflow (mocked services, audio upload fixture only)`);
            await context.close();
            continue;
        }
        await page.goto(`${base}/studio/`);
        if (scoreOnly) {
            await verifyScoreEditor(page, viewport);
            assert.deepEqual(errors, []);
            await context.close();
            continue;
        }
        await verifyInteractiveStudio(page, viewport);
        await verifyScoreEditor(page, viewport);
        const piano = page.getByRole('region', { name: 'Claviatură virtuală' });
        await expect.poll(() => piano.evaluate((element) => !element.closest('astro-island').hasAttribute('ssr'))).toBe(true);
        await expect(piano.getByRole('button', { name: 'Înregistrează Tema' })).toBeEnabled();
        await piano.getByRole('button', { name: 'Înregistrează Tema' }).click();
        await page.keyboard.down('a');
        await expect(piano.getByRole('button', { name: 'Do4, tasta A', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await page.keyboard.up('a');
        await expect(piano.getByRole('button', { name: 'Do4, tasta A', exact: true })).toHaveAttribute('aria-pressed', 'false');
        const mouseKey = piano.getByRole('button', { name: 'Re4, tasta S', exact: true });
        await mouseKey.hover();
        await page.mouse.down();
        await expect(mouseKey).toHaveAttribute('aria-pressed', 'true');
        await page.mouse.up();
        await piano.getByRole('button', { name: 'Oprește', exact: true }).click();
        await expect(piano.getByRole('button', { name: 'Ascultă', exact: true })).toBeEnabled();
        await piano.getByRole('button', { name: 'Ascultă', exact: true }).click();
        await expect(piano.getByRole('button', { name: 'Trimite tema' })).toBeEnabled();
        await piano.getByRole('button', { name: 'Trimite tema' }).click();
        await expect(piano.getByText('Tema a fost trimisă.')).toBeVisible();
        assert.equal(await piano.locator('button[aria-pressed]').count(), 38);
        await piano.getByLabel('Instrument', { exact: true }).selectOption('accordion');
        await piano.getByRole('button', { name: 'Pornește metronomul' }).click();
        await expect(piano.getByRole('button', { name: 'Oprește metronomul' })).toBeVisible();
        await piano.getByRole('button', { name: 'Oprește metronomul' }).click();
        assert.equal(homework.length, 1);
        assert.equal(homework[0].events.length, 2);
        assert.deepEqual(Object.keys(homework[0].events[0]).sort(), ['duration', 'note', 'timestamp']);
        await page.getByRole('button', { name: 'Re', exact: true }).click();
        await page.getByRole('button', { name: 'Șapte', exact: true }).click();
        await expect(page.getByText('2 / 2 · 100%')).toBeVisible();
        assert.deepEqual(attempts[0].answers, [0, 1]);
        const karaoke = page.getByRole('region', { name: 'Karaoke', exact: true });
        await karaoke.scrollIntoViewIfNeeded();
        await expect(karaoke.locator('audio')).toHaveAttribute('controlslist', 'nodownload');
        await karaoke.locator('audio').evaluate((audio) => { audio.currentTime = 13; audio.dispatchEvent(new Event('timeupdate')); });
        await expect(karaoke.locator('[aria-current="true"]')).toHaveText('Urmărește pulsul muzical');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        await page.screenshot({ path: fileURLToPath(new URL(`studio-${viewport.width}.png`, shots)), fullPage: true });
        await page.goto(`${base}/revista/notele-muzicale/`);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Notele muzicale: mini-curs interactiv');
        assert.equal(await page.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0), true);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        await page.screenshot({ path: fileURLToPath(new URL(`revista-${viewport.width}.png`, shots)), fullPage: true });
        await page.goto(`${base}/login/`);
        await expect(page.locator('#root')).not.toBeEmpty();
        assert.deepEqual(errors, []);
        assert.deepEqual(storageRequests, []);
        console.log(`PASS ${viewport.width}px: piano, JSON homework, quiz, karaoke, MDX, SPA, CSP, images, overflow`);
        await context.close();
    }
    assert.equal((await fetch(`${base}/revista/nu-exista/`)).status, 404);
    for (const role of scoreOnly || homeworkOnly || driveOnly || catalogOnly ? [] : ['profesor', 'elev', 'inspector']) {
        for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
            const context = await browser.newContext({ viewport });
            const page = await context.newPage();
            const failures = [];
            const writes = [];
            page.on('pageerror', (error) => failures.push(error.message));
            const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
            const otherId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
            const groups = [
                { id: groupId, name: 'Grupa de pian', weekday: 1, start_time: '16:00:00', duration_minutes: 60 },
                { id: otherId, name: 'Grupa de canto', weekday: 3, start_time: '17:30:00', duration_minutes: 45 },
            ];
            await page.addInitScript(({ token, user }) => localStorage.setItem('academy-music-auth', JSON.stringify({ access_token: token, refresh_token: 'test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user })), { token, user });
            await page.route(`${new URL(env.VITE_SUPABASE_URL).origin}/**`, async (route) => {
                const url = new URL(route.request().url());
                const path = url.pathname;
                let data = [];
                let status = 200;
                if (path === '/auth/v1/user') data = user;
                else if (path.endsWith('/profiles')) data = url.searchParams.has('role') ? [{ id: student, full_name: 'Elev de test' }] : { id: student, full_name: 'Cont de test', role, is_active: true };
                else if (path.endsWith('/online_groups')) data = role === 'elev' ? groups.slice(0, 1) : groups;
                else if (path.endsWith('/online_group_members')) data = [];
                else if (path.endsWith('/save_online_group')) { writes.push(route.request().postDataJSON()); data = groupId; }
                else if (path.endsWith('/class-access')) {
                    const requested = route.request().postDataJSON().groupId;
                    if (role === 'elev' && requested !== groupId) { status = 403; data = { error: 'Acces refuzat' }; }
                    else data = { domain: 'meet.academy.invalid', roomName: `academy-${requested}`, jwt: 'signed-test-token', role, groupName: groups.find((group) => group.id === requested)?.name };
                }
                await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
            });
            await page.route('https://meet.academy.invalid/external_api.js*', (route) => route.fulfill({
                contentType: 'text/javascript', body: `
                window.JitsiMeetExternalAPI = class {
                    constructor(domain, options) {
                        this.listeners = {};
                        this.frame = document.createElement('iframe');
                        this.frame.title = 'Sala Jitsi de test';
                        this.frame.style.width = '100%'; this.frame.style.height = '100%';
                        options.parentNode.appendChild(this.frame);
                        window.__jitsi = { config: options.configOverwrite, commands: [], room: options.roomName };
                        setTimeout(() => {
                            this.emit('videoConferenceJoined', { id: 'local-test' });
                            this.emit('knockingParticipant', { participant: { id: 'waiting-student', name: 'Elev în așteptare' } });
                        }, 100);
                    }
                    addListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
                    on(name, callback) { this.addListener(name, callback); }
                    emit(name, value) { for (const callback of this.listeners[name] || []) callback(value); }
                    executeCommand(...args) { window.__jitsi.commands.push(args); }
                    getIFrame() { return this.frame; }
                    dispose() { this.frame.remove(); }
                };
            ` }));
            await page.goto(`${base}/cursuri-online/`);
            await expect(page.getByRole('heading', { name: 'Grupa de pian', exact: true })).toBeVisible();
            await expect(page.getByText('Luni, 16:00 · 60 min · Europe/Bucharest', { exact: false })).toBeVisible();
            await expect(page.getByRole('heading', { name: 'Grupa de canto', exact: true })).toHaveCount(role === 'elev' ? 0 : 1);
            await expect(page.getByRole('button', { name: 'Creează grupă' })).toHaveCount(role === 'profesor' ? 1 : 0);
            if (role === 'profesor') {
                await page.getByRole('button', { name: 'Creează grupă' }).click();
                await page.getByLabel('Denumire').fill('Grupă nouă');
                await page.getByRole('button', { name: 'Salvează', exact: true }).click();
                await expect(page.getByRole('button', { name: 'Salvează', exact: true })).toHaveCount(0);
                assert.equal(writes[0].group_name, 'Grupă nouă');
                assert.equal(writes[0].day_number, 1);
            }
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            await page.screenshot({ path: fileURLToPath(new URL(`groups-${role}-${viewport.width}.png`, shots)), fullPage: true });
            await page.getByRole('link', { name: role === 'inspector' ? 'Asistă la curs' : 'Intră la curs' }).first().click();
            await expect(page.locator('iframe[title="Sala Jitsi de test"]')).toBeVisible();
            await expect.poll(() => page.evaluate(() => window.__jitsi?.commands.some((command) => command[0] === 'setNoiseSuppressionEnabled'))).toBe(true);
            assert.equal(await page.evaluate(() => window.__jitsi.room), `academy-${groupId}`);
            assert.equal(await page.evaluate(() => window.__jitsi.config.disableAEC), true);
            if (role === 'profesor') {
                await expect(page.getByRole('button', { name: 'Aprobă Elev în așteptare' })).toBeVisible();
                await page.getByRole('button', { name: 'Aprobă Elev în așteptare' }).click();
                assert.equal(await page.evaluate(() => window.__jitsi.commands.some((command) => command[0] === 'answerKnockingParticipant' && command[2] === true)), true);
                assert.equal(await page.evaluate(() => window.__jitsi.commands.some((command) => command[0] === 'toggleLobby' && command[1] === true)), true);
            }
            if (role === 'inspector') {
                const frame = page.locator('iframe[title="Sala Jitsi de test"]');
                await expect(frame).toHaveAttribute('allow', /camera 'none'; microphone 'none'/);
                assert.equal(await page.evaluate(() => window.__jitsi.config.startWithAudioMuted && window.__jitsi.config.startWithVideoMuted && window.__jitsi.config.disableInitialGUM), true);
                await page.goto(`${base}/portofoliu/`);
                await expect(page.getByRole('button', { name: 'Trimite tema' })).toHaveCount(0);
            }
            if (role === 'elev') {
                await page.goto(`${base}/cursuri-online/${otherId}/`);
                await expect(page.getByRole('alert')).toContainText('Acces indisponibil');
                await expect(page.locator('iframe')).toHaveCount(0);
            }
            assert.deepEqual(failures, []);
            console.log(`PASS ${role} ${viewport.width}px: groups, schedule, role controls, LiveClass, audio config, lobby/observer restrictions`);
            await context.close();
        }
    }
} finally { await browser.close(); }