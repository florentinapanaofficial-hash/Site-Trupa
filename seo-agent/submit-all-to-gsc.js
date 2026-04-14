/**
 * submit-all-to-gsc.js — Trimitere TOATE paginile către Google Search Console
 * ──────────────────────────────────────────────────────────────────────────────
 * Trimite cereri URL_UPDATED către Google Indexing API pentru:
 *   1. Toate paginile statice (index, despre, membri, galerie, etc.)
 *   2. Toate paginile programmatic SEO (formatie-nunta/*)
 *   3. Sitemap-ul principal
 *
 * Prerequisite:
 *   1. Service Account cu Indexing API activat în Google Cloud Console
 *   2. .env cu GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY
 *   3. Service Account adăugat ca Owner în Google Search Console
 *      (Search Console → Setări → Utilizatori și permisiuni → Adaugă utilizator)
 *
 * Rulare:
 *   node seo-agent/submit-all-to-gsc.js              # trimite tot
 *   node seo-agent/submit-all-to-gsc.js --dry-run    # afișează URL-urile fără a trimite
 *   node seo-agent/submit-all-to-gsc.js --sitemap    # trimite și sitemap-ul
 * ──────────────────────────────────────────────────────────────────────────────
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── CLI flags ────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const INCLUDE_SITEMAP = process.argv.includes('--sitemap');

// ── Configurare ──────────────────────────────────────────
const SITE_URL = 'https://www.florentinapanaofficial.ro';

// ── Paginile statice ale site-ului ───────────────────────
const STATIC_PAGES = [
    '/',
    '/despre/',
    '/povestea-noastra/',
    '/membri/',
    '/galerie-video/',
    '/galerie-foto/',
    '/momente-cu-mirii/',
    '/comunitate/',
    '/aparitii-tv/',
    '/contact/',
    '/blog/',
    '/vlog/',
    '/publicatii/',
    '/politica-confidentialitate/',
    '/politica-cookie/',
    '/termeni-conditii/',
    '/colaboratori/saxofon/',
    '/colaboratori/tambal/',
];

// ── Încarcă .env manual ──────────────────────────────────
function loadEnv() {
    const envPath = join(ROOT, '.env');
    if (!existsSync(envPath)) {
        console.error('❌ Fișierul .env nu a fost găsit în rădăcina proiectului.');
        console.error('   Creează .env cu următoarele variabile:');
        console.error('   GOOGLE_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com');
        console.error('   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"');
        process.exit(1);
    }
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.substring(0, eqIdx).trim();
        let value = trimmed.substring(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

// ── Citire locații din programmatic SEO ───────────────────
function loadProgrammaticPages() {
    const locPath = join(ROOT, 'scripts', 'programmatic-seo', 'locations.json');
    if (!existsSync(locPath)) {
        console.warn('⚠️  locations.json nu a fost găsit — se trimit doar paginile statice.');
        return [];
    }
    const locations = JSON.parse(readFileSync(locPath, 'utf-8'));
    return locations.map((loc) => `/formatie-nunta/${loc.slug}/`);
}

// ── Pauză între request-uri ──────────────────────────────
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

// ── Trimitere request de indexare ────────────────────────
async function requestIndexing(indexing, url) {
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

// ── Trimitere sitemap prin Search Console API ────────────
async function submitSitemap(auth) {
    const searchConsole = google.searchconsole({ version: 'v1', auth });
    const sitemapUrl = `${SITE_URL}/sitemap-index.xml`;
    try {
        await searchConsole.sitemaps.submit({
            siteUrl: SITE_URL,
            feedpath: sitemapUrl,
        });
        console.log(`  ✅ Sitemap trimis: ${sitemapUrl}`);
        return { url: sitemapUrl, status: 'OK' };
    } catch (err) {
        const message = err.response?.data?.error?.message || err.message;
        console.log(`  ❌ Eroare sitemap: ${message}`);
        return { url: sitemapUrl, status: 'EROARE', error: message };
    }
}

// ── Main ─────────────────────────────────────────────────
async function main() {
    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║    GOOGLE SEARCH CONSOLE — Trimitere Completă a Tuturor Paginilor   ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

    // Construiește lista completă de URL-uri
    const programmaticPages = loadProgrammaticPages();
    const allPaths = [...STATIC_PAGES, ...programmaticPages];
    const allUrls = allPaths.map((p) => `${SITE_URL}${p}`);

    console.log(`  📋 Total pagini de trimis: ${allUrls.length}`);
    console.log(`     ├─ Pagini statice:       ${STATIC_PAGES.length}`);
    console.log(`     └─ Pagini programatice:  ${programmaticPages.length}`);
    if (INCLUDE_SITEMAP) console.log(`     └─ Sitemap:              Da`);
    console.log('');

    // ── Dry Run: afișează doar URL-urile ─────────────────
    if (DRY_RUN) {
        console.log('  🔍 MOD DRY-RUN — nu se trimit cereri\n');
        console.log('  Pagini statice:');
        STATIC_PAGES.forEach((p) => console.log(`    ${SITE_URL}${p}`));
        console.log('\n  Pagini programatic SEO:');
        programmaticPages.forEach((p) => console.log(`    ${SITE_URL}${p}`));
        if (INCLUDE_SITEMAP) {
            console.log(`\n  Sitemap: ${SITE_URL}/sitemap-index.xml`);
        }
        console.log(`\n  ✅ ${allUrls.length} URL-uri pregătite. Rulează fără --dry-run pentru a trimite.\n`);
        return;
    }

    // ── Încarcă credențialele ─────────────────────────────
    loadEnv();

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!clientEmail || !privateKey) {
        console.error('❌ Lipsesc credențialele Google din .env');
        console.error('   GOOGLE_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com');
        console.error('   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"');
        console.error('\n📖 Ghid configurare:');
        console.error('   1. Creează un Service Account în Google Cloud Console');
        console.error('   2. Activează „Web Search Indexing API" în proiectul Google Cloud');
        console.error('   3. Generează o cheie JSON pentru Service Account');
        console.error('   4. Adaugă email-ul Service Account ca Owner în Google Search Console');
        console.error('   5. Copiază client_email și private_key în .env\n');
        process.exit(1);
    }

    // ── Autentificare Google ─────────────────────────────
    const scopes = ['https://www.googleapis.com/auth/indexing'];
    if (INCLUDE_SITEMAP) {
        scopes.push('https://www.googleapis.com/auth/webmasters');
    }

    const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes,
    });

    const indexing = google.indexing({ version: 'v3', auth });

    console.log(`  🔑 Service Account: ${clientEmail}`);
    console.log(`  🌐 Site: ${SITE_URL}\n`);

    // ── Trimitere URL-uri ────────────────────────────────
    console.log('  ── Pagini Statice ──\n');
    const results = [];

    for (const path of STATIC_PAGES) {
        const url = `${SITE_URL}${path}`;
        process.stdout.write(`  ⏳ ${path} ...`);
        const result = await requestIndexing(indexing, url);
        if (result.status === 'OK') {
            console.log(` ✅ (${result.statusCode})`);
        } else {
            console.log(` ❌ ${result.statusCode} — ${result.error}`);
        }
        results.push(result);
        await sleep(1000);
    }

    if (programmaticPages.length > 0) {
        console.log('\n  ── Pagini Programatic SEO (Formație Nuntă per Oraș) ──\n');

        for (const path of programmaticPages) {
            const url = `${SITE_URL}${path}`;
            process.stdout.write(`  ⏳ ${path} ...`);
            const result = await requestIndexing(indexing, url);
            if (result.status === 'OK') {
                console.log(` ✅ (${result.statusCode})`);
            } else {
                console.log(` ❌ ${result.statusCode} — ${result.error}`);
            }
            results.push(result);
            await sleep(1000);
        }
    }

    // ── Trimitere Sitemap ────────────────────────────────
    if (INCLUDE_SITEMAP) {
        console.log('\n  ── Sitemap ──\n');
        await submitSitemap(auth);
    }

    // ── Raport Final ─────────────────────────────────────
    const ok = results.filter((r) => r.status === 'OK').length;
    const failed = results.filter((r) => r.status === 'EROARE').length;

    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║                         RAPORT FINAL                                ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
    console.log(`  ✅ Trimise cu succes:  ${ok}/${allUrls.length}`);
    if (failed > 0) {
        console.log(`  ❌ Erori:             ${failed}/${allUrls.length}`);
        console.log('\n  ── Detalii erori ──');
        results
            .filter((r) => r.status === 'EROARE')
            .forEach((r) => console.log(`    ${r.url} → ${r.error}`));
    }

    console.log('\n  📋 Pași următori:');
    console.log('     1. Verifică statusul în Google Search Console → URL Inspection');
    console.log('     2. Google va procesa cererile în câteva minute până la câteva ore');
    console.log('     3. Revizitează Search Console peste 24-48h pentru a verifica indexarea');
    if (!INCLUDE_SITEMAP) {
        console.log('     4. Rulează cu --sitemap pentru a trimite și sitemap-ul');
    }
    console.log('');
}

main().catch((err) => {
    console.error('❌ Eroare fatală:', err.message);
    process.exit(1);
});
