/**
 * force-index.js — Forțare Indexare Google (Indexing API)
 * ──────────────────────────────────────────────────────────
 * Trimite cereri URL_UPDATED către Google Indexing API
 * pentru toate paginile generate din locations.json.
 *
 * Prerequisite:
 *   1. Service Account cu Indexing API activat
 *   2. .env cu GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY
 *   3. Service Account adăugat ca Owner în Search Console
 *
 * Rulare:  node seo-agent/force-index.js
 * ──────────────────────────────────────────────────────────
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Încarcă .env manual (fără dependențe externe) ────────
function loadEnv() {
    const envPath = join(ROOT, '.env');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.substring(0, eqIdx).trim();
        let value = trimmed.substring(eqIdx + 1).trim();
        // Elimină ghilimele
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

loadEnv();

// ── Validare credențiale ─────────────────────────────────
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!clientEmail || !privateKey) {
    console.error('❌ Lipsesc credențialele Google din .env');
    console.error('   Asigură-te că ai setat GOOGLE_CLIENT_EMAIL și GOOGLE_PRIVATE_KEY');
    process.exit(1);
}

// ── Citire locații ───────────────────────────────────────
const LOCATIONS_PATH = join(ROOT, 'scripts', 'programmatic-seo', 'locations.json');
const locations = JSON.parse(readFileSync(LOCATIONS_PATH, 'utf-8'));

const SITE_URL = 'https://www.florentinapanaofficial.ro';

// Construiește lista de URL-uri de indexat
const urls = locations.map((loc) => `${SITE_URL}/formatie-nunta/${loc.slug}/`);

// ── Autentificare Google ─────────────────────────────────
const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/indexing'],
});

const indexing = google.indexing({ version: 'v3', auth });

// ── Pauză între request-uri ──────────────────────────────
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

// ── Trimitere request de indexare ────────────────────────
async function requestIndexing(url) {
    try {
        const res = await indexing.urlNotifications.publish({
            requestBody: {
                url: url,
                type: 'URL_UPDATED',
            },
        });
        return { url, status: 'OK', statusCode: res.status };
    } catch (err) {
        const message = err.response?.data?.error?.message || err.message;
        const code = err.response?.status || err.code;
        return { url, status: 'EROARE', statusCode: code, error: message };
    }
}

// ── Main ─────────────────────────────────────────────────
async function main() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║         GOOGLE INDEXING API — Forțare Indexare              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    console.log(`  Service Account: ${clientEmail}`);
    console.log(`  URL-uri de indexat: ${urls.length}\n`);

    const results = [];

    for (const url of urls) {
        process.stdout.write(`  ⏳ ${url} ...`);
        const result = await requestIndexing(url);
        if (result.status === 'OK') {
            console.log(` ✅ (${result.statusCode})`);
        } else {
            console.log(` ❌ ${result.statusCode} — ${result.error}`);
        }
        results.push(result);
        await sleep(1000); // 1 secundă între request-uri — respectă rate limits
    }

    // ── Raport final ─────────────────────────────────────
    const ok = results.filter((r) => r.status === 'OK').length;
    const failed = results.filter((r) => r.status === 'EROARE').length;

    console.log('\n── Raport Final ──\n');
    console.log(`  ✅ Trimise cu succes: ${ok}/${urls.length}`);
    if (failed > 0) {
        console.log(`  ❌ Erori: ${failed}/${urls.length}`);
        console.log('\n  ── Detalii erori ──');
        results
            .filter((r) => r.status === 'EROARE')
            .forEach((r) => console.log(`    ${r.url} → ${r.error}`));
    }

    console.log(`\n✅ Proces complet!`);
    if (ok > 0) {
        console.log('   Google va procesa cererile în câteva minute până la câteva ore.');
        console.log('   Verifică statusul în Google Search Console → URL Inspection.\n');
    }
}

main().catch((err) => {
    console.error('❌ Eroare fatală:', err.message);
    process.exit(1);
});
