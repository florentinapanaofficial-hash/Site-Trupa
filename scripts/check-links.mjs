/**
 * Link checker — scanează fișierele sursă pentru URL-uri externe
 * și verifică statusul HTTP al fiecăruia.
 *
 * Utilizare:  node scripts/check-links.mjs
 *   --fix     arată sugestii de reparare (redirect → URL final)
 *   --timeout 8000   timeout per request (ms, implicit 8000)
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const SRC_DIR = 'src';
const SCANNABLE = new Set(['.astro', '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.mdx']);
const TIMEOUT = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--timeout') ?? '8000', 10);
const SHOW_FIX = process.argv.includes('--fix');

// Exclude known tracking / privacy redirects that always 3xx or block bots
const SKIP_PATTERNS = [
    /fonts\.googleapis\.com/,
    /fonts\.gstatic\.com/,
    /www\.googletagmanager\.com/,
    /www\.google-analytics\.com/,
    /wa\.me\//,
];

async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
        const full = join(dir, e.name);
        if (e.isDirectory()) files.push(...await walk(full));
        else if (SCANNABLE.has(extname(e.name).toLowerCase())) files.push(full);
    }
    return files;
}

function extractUrls(content) {
    const re = /https?:\/\/[^\s"'`<>\)\]\}\\]+/g;
    const urls = new Set();
    let m;
    while ((m = re.exec(content))) {
        let url = m[0].replace(/[.,;:!?)]+$/, ''); // strip trailing punctuation
        urls.add(url);
    }
    return [...urls];
}

async function checkUrl(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
        const res = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkChecker/1.0)' },
        });
        clearTimeout(timer);
        return { url, status: res.status, ok: res.ok, redirected: res.redirected, finalUrl: res.url };
    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') return { url, status: 0, ok: false, error: 'TIMEOUT' };
        return { url, status: 0, ok: false, error: err.code || err.message };
    }
}

// ── Main ──
const files = await walk(SRC_DIR);
const urlMap = new Map(); // url → Set<file>

for (const file of files) {
    const content = await readFile(file, 'utf-8');
    for (const url of extractUrls(content)) {
        if (SKIP_PATTERNS.some(p => p.test(url))) continue;
        if (!urlMap.has(url)) urlMap.set(url, new Set());
        urlMap.get(url).add(file);
    }
}

console.log(`\n🔍 Verificare ${urlMap.size} URL-uri unice din ${files.length} fișiere...\n`);

const results = [];
const CONCURRENCY = 5;
const entries = [...urlMap.entries()];

for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    const checks = await Promise.all(batch.map(([url]) => checkUrl(url)));
    results.push(...checks.map((r, j) => ({ ...r, files: [...batch[j][1]] })));
}

// Report
const broken = results.filter(r => !r.ok);
const ok = results.filter(r => r.ok);

if (broken.length === 0) {
    console.log(`✅ Toate cele ${ok.length} link-uri externe sunt valide!\n`);
} else {
    console.log(`⚠️  ${broken.length} link-uri cu probleme:\n`);
    for (const r of broken) {
        const status = r.error || `HTTP ${r.status}`;
        console.log(`  ❌ [${status}] ${r.url}`);
        for (const f of r.files) console.log(`     └─ ${f}`);
        if (SHOW_FIX && r.redirected && r.finalUrl) {
            console.log(`     💡 Redirect → ${r.finalUrl}`);
        }
    }
    console.log(`\n  ${ok.length} OK · ${broken.length} probleme\n`);
}

process.exit(broken.length > 0 ? 1 : 0);
