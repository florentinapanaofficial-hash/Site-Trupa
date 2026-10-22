import assert from 'node:assert/strict';
import { once } from 'node:events';
import { startWorkerPreview } from './worker-preview.mjs';

const worker = startWorkerPreview();
let output = '';
worker.stdout.on('data', (chunk) => { output += chunk; });
worker.stderr.on('data', (chunk) => { output += chunk; });

try {
    const origin = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Workers preview did not start: ${output}`)), 30000);
        worker.once('error', (error) => { clearTimeout(timer); reject(error); });
        worker.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Wrangler exited (${code}): ${output}`)); });
        worker.stdout.on('data', () => {
            const address = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
            if (address) { clearTimeout(timer); resolve(address); }
        });
    });
    let home;
    try { home = await fetch(origin, { signal: AbortSignal.timeout(10000) }); }
    catch (error) { throw new Error(`Workers request failed at ${origin}: ${error.message}\n${output}`); }
    assert.equal(home.status, 200);
    assert.equal(home.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.ok(home.headers.get('content-security-policy'));

    const api = await fetch(`${origin}/api/games/generate/`, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'teorie', level: 'incepator' }),
        signal: AbortSignal.timeout(10000),
    });
    assert.equal(api.status, 401);
    assert.match(api.headers.get('content-type') || '', /application\/json/);
    console.log('PASS: Cloudflare workerd served SSR and rejected an unauthenticated AI request.');
} finally {
    if (worker.exitCode === null && worker.signalCode === null) {
        const exited = once(worker, 'exit');
        worker.kill();
        await exited;
    }
}