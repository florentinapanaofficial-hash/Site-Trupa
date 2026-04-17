/**
 * gsc-errors.js — Verificare Erori Google Search Console
 * ──────────────────────────────────────────────────────────
 * Inspectează toate paginile site-ului prin URL Inspection API
 * și raportează statusul de indexare + erorile detectate.
 *
 * Prerequisite:
 *   1. Service Account cu Search Console API activat în Google Cloud Console
 *   2. .env cu GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY
 *   3. Service Account adăugat ca Owner în Google Search Console
 *
 * Rulare:
 *   node seo-agent/gsc-errors.js               # inspectează toate paginile
 *   node seo-agent/gsc-errors.js --dry-run      # afișează URL-urile fără a verifica
 *   node seo-agent/gsc-errors.js --only-errors   # afișează doar paginile cu probleme
 * ──────────────────────────────────────────────────────────
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── CLI flags ────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const ONLY_ERRORS = process.argv.includes('--only-errors');

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
        return [];
    }
    const locations = JSON.parse(readFileSync(locPath, 'utf-8'));
    return locations.map((loc) => `/formatie-nunta/${loc.slug}/`);
}

// ── Pauză între request-uri ──────────────────────────────
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

// ── Inspectare URL ───────────────────────────────────────
async function inspectUrl(searchConsole, url) {
    try {
        const res = await searchConsole.urlInspection.index.inspect({
            requestBody: {
                inspectionUrl: url,
                siteUrl: SITE_URL,
            },
        });

        const result = res.data.inspectionResult;
        const indexStatus = result?.indexStatusResult;
        const mobileUsability = result?.mobileUsabilityResult;
        const richResults = result?.richResultsResult;

        return {
            url,
            verdict: indexStatus?.verdict || 'NECUNOSCUT',
            coverageState: indexStatus?.coverageState || '—',
            robotsTxtState: indexStatus?.robotsTxtState || '—',
            indexingState: indexStatus?.indexingState || '—',
            lastCrawlTime: indexStatus?.lastCrawlTime || '—',
            pageFetchState: indexStatus?.pageFetchState || '—',
            crawledAs: indexStatus?.crawledAs || '—',
            referringUrls: indexStatus?.referringUrls || [],
            mobileVerdict: mobileUsability?.verdict || '—',
            mobileIssues: mobileUsability?.issues || [],
            richVerdict: richResults?.verdict || '—',
            richIssues: richResults?.detectedItems?.flatMap((i) => i.items?.flatMap((it) => it.issues || []) || []) || [],
            status: 'OK',
        };
    } catch (err) {
        const message = err.response?.data?.error?.message || err.message;
        const code = err.response?.status || err.code;
        return {
            url,
            status: 'EROARE_API',
            error: message,
            errorCode: code,
        };
    }
}

// ── Categorii de verdict ─────────────────────────────────
function verdictIcon(verdict) {
    switch (verdict) {
        case 'PASS': return '✅';
        case 'PARTIAL': return '⚠️';
        case 'FAIL': return '❌';
        case 'NEUTRAL': return '➖';
        default: return '❓';
    }
}

// ── Main ─────────────────────────────────────────────────
async function main() {
    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║     GOOGLE SEARCH CONSOLE — Raport Erori & Status Indexare         ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

    const programmaticPages = loadProgrammaticPages();
    const allPaths = [...STATIC_PAGES, ...programmaticPages];
    const allUrls = allPaths.map((p) => `${SITE_URL}${p}`);

    console.log(`  📋 Total pagini de verificat: ${allUrls.length}`);
    console.log(`     ├─ Pagini statice:       ${STATIC_PAGES.length}`);
    console.log(`     └─ Pagini programatice:  ${programmaticPages.length}\n`);

    // ── Dry Run ──────────────────────────────────────────
    if (DRY_RUN) {
        console.log('  🔍 MOD DRY-RUN — nu se trimit cereri\n');
        console.log('  Pagini statice:');
        STATIC_PAGES.forEach((p) => console.log(`    ${SITE_URL}${p}`));
        if (programmaticPages.length > 0) {
            console.log('\n  Pagini programatic SEO:');
            programmaticPages.forEach((p) => console.log(`    ${SITE_URL}${p}`));
        }
        console.log(`\n  ✅ ${allUrls.length} URL-uri pregătite. Rulează fără --dry-run pentru a verifica.\n`);
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
        process.exit(1);
    }

    // ── Autentificare Google ─────────────────────────────
    const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    const searchConsole = google.searchconsole({ version: 'v1', auth });

    console.log(`  🔑 Service Account: ${clientEmail}`);
    console.log(`  🌐 Site: ${SITE_URL}\n`);

    // ── Inspectare URL-uri ───────────────────────────────
    const results = [];
    let indexed = 0;
    let errors = 0;
    let warnings = 0;

    for (let i = 0; i < allUrls.length; i++) {
        const url = allUrls[i];
        const path = allPaths[i];
        process.stdout.write(`  [${i + 1}/${allUrls.length}] ${path} ... `);

        const result = await inspectUrl(searchConsole, url);
        results.push(result);

        if (result.status === 'EROARE_API') {
            console.log(`❌ API Error: ${result.errorCode} — ${result.error}`);
            errors++;
        } else if (result.verdict === 'PASS') {
            indexed++;
            if (!ONLY_ERRORS) {
                console.log(`✅ Indexat | Crawl: ${result.pageFetchState} | Mobile: ${result.mobileVerdict}`);
            } else {
                process.stdout.write('\r' + ' '.repeat(80) + '\r');
            }
        } else if (result.verdict === 'PARTIAL') {
            warnings++;
            console.log(`⚠️  Parțial | ${result.coverageState} | Crawl: ${result.pageFetchState}`);
        } else {
            errors++;
            console.log(`❌ ${result.verdict} | ${result.coverageState} | Crawl: ${result.pageFetchState}`);
        }

        // Rate limit: ~1 request / secundă
        if (i < allUrls.length - 1) {
            await sleep(1200);
        }
    }

    // ── Sumar ────────────────────────────────────────────
    console.log('\n\n  ═══════════════════════════════════════════════════');
    console.log('  📊 SUMAR RAPORT');
    console.log('  ═══════════════════════════════════════════════════');
    console.log(`  ✅ Indexate:        ${indexed}/${allUrls.length}`);
    console.log(`  ⚠️  Avertismente:   ${warnings}`);
    console.log(`  ❌ Erori:           ${errors}`);
    console.log('  ═══════════════════════════════════════════════════\n');

    // ── Detalii erori ────────────────────────────────────
    const problemPages = results.filter(
        (r) => r.status === 'EROARE_API' || (r.verdict && r.verdict !== 'PASS')
    );

    if (problemPages.length > 0) {
        console.log('  🔍 DETALII PAGINI CU PROBLEME:\n');

        for (const page of problemPages) {
            const path = page.url.replace(SITE_URL, '');
            console.log(`  ── ${path} ──`);

            if (page.status === 'EROARE_API') {
                console.log(`     Eroare API: ${page.errorCode} — ${page.error}`);
                console.log('');
                continue;
            }

            console.log(`     Verdict:         ${verdictIcon(page.verdict)} ${page.verdict}`);
            console.log(`     Coverage:        ${page.coverageState}`);
            console.log(`     Indexare:        ${page.indexingState}`);
            console.log(`     Robots.txt:      ${page.robotsTxtState}`);
            console.log(`     Fetch:           ${page.pageFetchState}`);
            console.log(`     Crawler:         ${page.crawledAs}`);
            console.log(`     Ultimul crawl:   ${page.lastCrawlTime}`);

            if (page.mobileIssues.length > 0) {
                console.log(`     Mobile:          ${verdictIcon(page.mobileVerdict)} ${page.mobileVerdict}`);
                page.mobileIssues.forEach((issue) => {
                    console.log(`       ⚠ ${issue.severity}: ${issue.message}`);
                });
            }

            if (page.richIssues.length > 0) {
                console.log(`     Rich Results:    ${verdictIcon(page.richVerdict)} ${page.richVerdict}`);
                page.richIssues.forEach((issue) => {
                    console.log(`       ⚠ ${issue.severity}: ${issue.issueMessage}`);
                });
            }

            console.log('');
        }
    } else {
        console.log('  🎉 Toate paginile sunt indexate fără erori!\n');
    }
}

main().catch((err) => {
    console.error('\n❌ Eroare fatală:', err.message);
    process.exit(1);
});
