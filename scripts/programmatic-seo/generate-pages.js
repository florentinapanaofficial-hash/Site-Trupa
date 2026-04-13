/**
 * generate-pages.js — Motor Programmatic SEO
 * ──────────────────────────────────────────────────────────
 * Citește locations.json + template.astro și generează
 * pagini Astro în src/pages/formatie-nunta/[slug].astro
 *
 * Rulare:  node scripts/programmatic-seo/generate-pages.js
 * ──────────────────────────────────────────────────────────
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const TEMPLATE_PATH = join(__dirname, 'template.astro');
const LOCATIONS_PATH = join(__dirname, 'locations.json');
const CONTENT_BLOCKS_PATH = join(__dirname, 'content-blocks.json');
const OUTPUT_DIR = join(ROOT, 'src', 'pages', 'formatie-nunta');

// ── Citire input ─────────────────────────────────────────
const template = readFileSync(TEMPLATE_PATH, 'utf-8');
const locations = JSON.parse(readFileSync(LOCATIONS_PATH, 'utf-8'));
const contentBlocks = JSON.parse(readFileSync(CONTENT_BLOCKS_PATH, 'utf-8'));

// ── Creare folder output ─────────────────────────────────
mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Escaping pentru string-uri Astro ─────────────────────
function escapeAstroString(str) {
    return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n');
}

// ── Random pick dintr-un array ───────────────────────────
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ── Construiește {{CONTENT}} unic per oraș ───────────────
function buildContent(loc) {
    const intro = pickRandom(contentBlocks.intros);
    const service = pickRandom(contentBlocks.services);
    const outro = pickRandom(contentBlocks.outros);

    // Înlocuiește variabilele din content blocks
    const replaceVars = (text) =>
        text
            .replace(/\{\{ORAS\}\}/g, loc.oras)
            .replace(/\{\{KEYWORD\}\}/g, loc.keyword);

    return {
        intro: replaceVars(intro),
        service: replaceVars(service),
        outro: replaceVars(outro),
        full: [replaceVars(intro), replaceVars(service), replaceVars(outro)].join('\n\n'),
    };
}

// ── Generare pagini ──────────────────────────────────────
const report = [];
const contentReport = {}; // Pentru verificare conținut unic

for (const loc of locations) {
    let page = template;

    // Construiește conținut unic din content blocks
    const content = buildContent(loc);

    // Înlocuiește variabilele simple (string)
    page = page.replace(/\{\{ORAS\}\}/g, escapeAstroString(loc.oras));
    page = page.replace(/\{\{JUDET\}\}/g, escapeAstroString(loc.judet));
    page = page.replace(/\{\{KEYWORD\}\}/g, escapeAstroString(loc.keyword));
    page = page.replace(/\{\{SLUG\}\}/g, loc.slug);
    page = page.replace(/\{\{LAT\}\}/g, String(loc.lat));
    page = page.replace(/\{\{LNG\}\}/g, String(loc.lng));
    page = page.replace(/\{\{INTRO\}\}/g, escapeAstroString(loc.intro));
    page = page.replace(/\{\{PARAGRAF2\}\}/g, escapeAstroString(loc.paragraf2));
    page = page.replace(/\{\{PARAGRAF3\}\}/g, escapeAstroString(loc.paragraf3));
    page = page.replace(/\{\{CONTENT_INTRO\}\}/g, escapeAstroString(content.intro));
    page = page.replace(/\{\{CONTENT_SERVICES\}\}/g, escapeAstroString(content.service));
    page = page.replace(/\{\{CONTENT_OUTRO\}\}/g, escapeAstroString(content.outro));

    // Înlocuiește meta_desc (override sau gol)
    page = page.replace(/\{\{META_DESC\}\}/g, escapeAstroString(loc.meta_desc || ''));

    // Înlocuiește array-urile (JSON inline)
    page = page.replace(/\{\{LOCATII_POPULARE\}\}/g, JSON.stringify(loc.locatii_populare));
    page = page.replace(/\{\{ZONE_ACOPERITE\}\}/g, JSON.stringify(loc.zone_acoperite));
    page = page.replace(/\{\{KEYWORDS_SCHEMA\}\}/g, JSON.stringify(loc.keywords_schema || []));

    // Scrie fișierul
    const outputPath = join(OUTPUT_DIR, `${loc.slug}.astro`);
    writeFileSync(outputPath, page, 'utf-8');

    const title = `${loc.keyword} — Formația Florentina Pană`;
    report.push({
        slug: loc.slug,
        file: `src/pages/formatie-nunta/${loc.slug}.astro`,
        route: `/formatie-nunta/${loc.slug}`,
        title: title,
        titleLen: title.length,
    });

    // Salvează conținutul generat pentru verificare
    contentReport[loc.slug] = {
        intro: content.intro,
        services: content.service,
        outro: content.outro,
    };
}

// ── Raport ────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════════════════════════╗');
console.log('║              PROGRAMMATIC SEO — Pagini Generate                        ║');
console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

console.table(
    report.map((r, i) => ({
        '#': i + 1,
        'Fișier': r.file,
        'Rută': r.route,
        'Title': r.title,
        'Title chars': r.titleLen,
    }))
);

// Listează toate paginile din folder
const existing = readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.astro'));
console.log(`\n📄 Total pagini în formatie-nunta/: ${existing.length}`);
console.log(`   ${existing.map(f => f.replace('.astro', '')).join(', ')}`);

// ── Afișare conținut unic per oraș ───────────────────────
console.log('\n── Conținut Unic Generat (Content Blocks) ──\n');
for (const [slug, blocks] of Object.entries(contentReport)) {
    console.log(`  📍 ${slug.toUpperCase()}`);
    console.log(`  ┌─ INTRO: ${blocks.intro.substring(0, 80)}...`);
    console.log(`  ├─ SERVICES: ${blocks.services.substring(0, 80)}...`);
    console.log(`  └─ OUTRO: ${blocks.outro.substring(0, 80)}...`);
    console.log('');
}

console.log(`✅ Generare completă! Rulează 'npm run build' pentru a verifica.\n`);
