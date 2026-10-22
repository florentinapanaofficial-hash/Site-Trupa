import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));

export function startWorkerPreview(variables = {}) {
    const args = [wrangler, 'dev', '--local', '--ip', '127.0.0.1', '--port', '0'];
    for (const [key, value] of Object.entries(variables)) args.push('--var', `${key}:${value}`);
    return spawn(process.execPath, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
}