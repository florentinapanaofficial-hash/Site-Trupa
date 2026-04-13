import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Citire și parsare date ──────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(__dirname, 'seo-data.json'), 'utf-8');
const pages = JSON.parse(raw);

// ── Reguli de identificare a oportunităților ────────────────────────
const CTR_THRESHOLD = 0.03;   // sub 3 %
const IMP_THRESHOLD = 50;     // minim 50 afișări
const POS_MIN = 11;     // „striking distance" – de la poziția 11
const POS_MAX = 20;     // … până la poziția 20

function detectReasons(entry) {
    const reasons = [];
    if (entry.impressions > IMP_THRESHOLD && entry.ctr < CTR_THRESHOLD) {
        reasons.push('CTR slab (Regula 1)');
    }
    if (entry.position >= POS_MIN && entry.position <= POS_MAX) {
        reasons.push('Striking Distance (Regula 2)');
    }
    return reasons;
}

// ── Filtrare oportunitări ───────────────────────────────────────────
const opportunities = pages
    .map((p) => {
        const reasons = detectReasons(p);
        return reasons.length > 0 ? { ...p, reasons } : null;
    })
    .filter(Boolean);

// ── Scor de urgență (mai multe motive + mai multe afișări = mai urgent)
opportunities.sort((a, b) => {
    if (b.reasons.length !== a.reasons.length) return b.reasons.length - a.reasons.length;
    return b.impressions - a.impressions;
});

const top5 = opportunities.slice(0, 5);

// ── Afișare rezultate ───────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║        TOP 5 – Cele mai urgente oportunități SEO           ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

if (top5.length === 0) {
    console.log('  Nicio oportunitate identificată cu regulile curente.\n');
    process.exit(0);
}

console.table(
    top5.map((o, i) => ({
        '#': i + 1,
        'Cuvânt cheie': o.query,
        'URL': o.page.replace('https://formatialuminitza.ro', ''),
        'Afișări': o.impressions,
        'CTR %': (o.ctr * 100).toFixed(2) + ' %',
        'Poziție': o.position.toFixed(1),
        'Motiv': o.reasons.join(' + '),
    }))
);

console.log(`\nTotal oportunități găsite: ${opportunities.length}`);
console.log('Notă: Prioritizează paginile cu ambele reguli – optimizează titlul/meta + conținutul.\n');
