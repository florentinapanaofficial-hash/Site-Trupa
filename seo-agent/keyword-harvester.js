/**
 * keyword-harvester.js — Keyword Harvester via Google Autocomplete
 * ──────────────────────────────────────────────────────────────────
 * Extrage sugestii de cuvinte cheie din Google Suggest (API public)
 * folosind tehnica „seed + alfabet" pentru acoperire maximă.
 *
 * Rulare:  node seo-agent/keyword-harvester.js
 *    sau:  node seo-agent/keyword-harvester.js "formatie nunta"
 * ──────────────────────────────────────────────────────────────────
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, 'harvested-keywords.json');

// ── Configurare ──────────────────────────────────────────
const DEFAULT_SEED = 'formatie nunta';
const ALPHABET = 'aăâbcdefghiîjklmnopqrsștțuvwxyz';
const PREFIXES = ['', ' pret', ' cel mai', ' cum'];
const DELAY_MS = 250; // pauză între request-uri (politicos cu Google)

// ── Negative Keywords (competitori / trupe concurente) ───
// Adaugă aici nume de trupe/artiști concurenți pe care
// NU vrei să le vizezi. Se verifică cu includes().
const NEGATIVE_KEYWORDS = [
    'alex ban',
    'dane bogdan',
    'lucian band',
    'lucian',
    'kiazim',
    'vatra',
    'trupa modern',
    'neam de lautari',
    'dragasani',
    'drăgășani',
    'show band',
    'vegas band',
    'vegas',
    'moldova',
    'republica moldova',
    'timisoara',
    'timișoara',
    'cluj',
    'iasi',
    'iași',
    'oradea',
];

// ── Zonă geografică permisă ──────────────────────────────
// Dacă un keyword conține un nume de oraș/județ care NU e în
// această listă, va fi eliminat. Keywords-urile generale
// (fără locație) sunt păstrate.
const ALLOWED_AREAS = [
    'pitesti', 'pitești',
    'arges', 'argeș',
    'bucuresti', 'bucurești',
    'ilfov',
    'dambovita', 'dâmbovița',
    'valcea', 'vâlcea',
    'mioveni',
    'curtea de arges', 'curtea de argeș',
    'campulung', 'câmpulung',
];

// ── Lista de orașe/județe din România (pentru detectare locație) ──
const ALL_RO_LOCATIONS = [
    'alba', 'arad', 'bacau', 'bacău', 'bihor', 'bistrita', 'bistrița',
    'botosani', 'botoșani', 'braila', 'brăila', 'brasov', 'brașov',
    'buzau', 'buzău', 'calarasi', 'călărași', 'caras', 'caraș',
    'cluj', 'constanta', 'constanța', 'covasna', 'dolj', 'craiova',
    'galati', 'galați', 'giurgiu', 'gorj', 'harghita', 'hunedoara',
    'ialomita', 'ialomița', 'iasi', 'iași', 'maramures', 'maramureș',
    'mehedinti', 'mehedinți', 'mures', 'mureș', 'neamt', 'neamț',
    'olt', 'prahova', 'ploiesti', 'ploiești', 'satu mare',
    'salaj', 'sălaj', 'sibiu', 'suceava', 'teleorman',
    'timis', 'timiș', 'timisoara', 'timișoara', 'tulcea',
    'vaslui', 'vrancea', 'oradea', 'targu mures', 'târgu mureș',
    'targoviste', 'târgoviște', 'baia mare', 'deva', 'resita', 'reșița',
    'slatina', 'alexandria', 'focsani', 'focșani', 'slobozia',
    'zalau', 'zalău', 'sfantu gheorghe', 'sfântu gheorghe',
    'miercurea ciuc', 'piatra neamt', 'piatra neamț',
    'ramnicu valcea', 'râmnicu vâlcea',
    // Include și ALLOWED_AREAS pentru matching complet
    'pitesti', 'pitești', 'arges', 'argeș', 'bucuresti', 'bucurești',
    'ilfov', 'dambovita', 'dâmbovița', 'valcea', 'vâlcea',
    'mioveni', 'curtea de arges', 'curtea de argeș',
    'campulung', 'câmpulung',
];

// ── Funcție fetch sugestii ───────────────────────────────
async function fetchSuggestions(query) {
    const url = new URL('https://suggestqueries.google.com/complete/search');
    url.searchParams.set('client', 'chrome');
    url.searchParams.set('hl', 'ro');
    url.searchParams.set('gl', 'ro');
    url.searchParams.set('q', query);

    try {
        const res = await fetch(url.toString(), {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' },
        });
        if (!res.ok) return [];
        const data = await res.json();
        // Răspunsul e un array: [query, [sugestii], ...]
        return Array.isArray(data[1]) ? data[1] : [];
    } catch {
        return [];
    }
}

// ── Pauză între request-uri ──────────────────────────────
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

// ── Funcție principală de harvest ────────────────────────
async function harvest(seed) {
    console.log(`\n🌾 Keyword Harvester — seed: "${seed}"\n`);
    const allKeywords = new Set();
    let requestCount = 0;

    // Pas 1: Fetch direct pe seed
    for (const prefix of PREFIXES) {
        const query = seed + prefix;
        process.stdout.write(`  ⏳ "${query}" ...`);
        const results = await fetchSuggestions(query);
        results.forEach((kw) => allKeywords.add(kw.toLowerCase().trim()));
        requestCount++;
        console.log(` → ${results.length} sugestii`);
        await sleep(DELAY_MS);
    }

    // Pas 2: Seed + fiecare literă din alfabet
    for (const letter of ALPHABET) {
        const query = `${seed} ${letter}`;
        process.stdout.write(`  ⏳ "${query}" ...`);
        const results = await fetchSuggestions(query);
        results.forEach((kw) => allKeywords.add(kw.toLowerCase().trim()));
        requestCount++;
        console.log(` → ${results.length} sugestii`);
        await sleep(DELAY_MS);
    }

    // Pas 3: Variante cu prefix + alfabet (nivel 2 — doar prefixele scurte)
    for (const prefix of PREFIXES.slice(1)) {
        for (const letter of 'abcdefimnprst') {
            // Doar literele cele mai frecvente pentru a nu exagera
            const query = `${seed}${prefix} ${letter}`;
            process.stdout.write(`  ⏳ "${query}" ...`);
            const results = await fetchSuggestions(query);
            results.forEach((kw) => allKeywords.add(kw.toLowerCase().trim()));
            requestCount++;
            console.log(` → ${results.length} sugestii`);
            await sleep(DELAY_MS);
        }
    }

    return { keywords: allKeywords, requestCount };
}

// ── Main ─────────────────────────────────────────────────
async function main() {
    const seed = process.argv[2] || DEFAULT_SEED;

    const { keywords, requestCount } = await harvest(seed);

    // Filtrare negative keywords (competitori)
    const beforeFilter = keywords.size;
    let eliminatedNeg = 0;
    let eliminatedGeo = 0;

    const filtered = [...keywords].filter((kw) => {
        // 1. Filtrare negative keywords
        if (NEGATIVE_KEYWORDS.some((neg) => kw.includes(neg))) {
            eliminatedNeg++;
            return false;
        }
        // 2. Filtrare geografică: dacă keyword-ul conține un
        //    oraș/județ din România, acesta TREBUIE să fie în ALLOWED_AREAS
        const mentionedLocation = ALL_RO_LOCATIONS.find((loc) => kw.includes(loc));
        if (mentionedLocation && !ALLOWED_AREAS.some((area) => kw.includes(area))) {
            eliminatedGeo++;
            return false;
        }
        return true;
    });
    const eliminated = eliminatedNeg + eliminatedGeo;

    // Sortare alfabetică
    const sorted = filtered.sort((a, b) => a.localeCompare(b, 'ro'));

    // Salvare JSON
    const output = {
        seed,
        harvestedAt: new Date().toISOString(),
        totalKeywords: sorted.length,
        totalRequests: requestCount,
        negativeKeywords: NEGATIVE_KEYWORDS,
        allowedAreas: ALLOWED_AREAS,
        eliminated: { negative: eliminatedNeg, geographic: eliminatedGeo, total: eliminated },
        keywords: sorted,
    };

    writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

    // ── Raport consolă ──────────────────────────────────
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║              KEYWORD HARVESTER — Rezultate                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    console.log(`  Seed:              "${seed}"`);
    console.log(`  Request-uri:       ${requestCount}`);
    console.log(`  Brute extrase:     ${beforeFilter}`);
    console.log(`  🚫 Eliminate neg:   ${eliminatedNeg} (competitori/negative)`);
    console.log(`  🗺️  Eliminate geo:   ${eliminatedGeo} (în afara zonei)`);
    console.log(`  ✅ Curate rămase:   ${sorted.length}`);
    console.log(`  Salvat în:         seo-agent/harvested-keywords.json`);

    // Top 10 cele mai interesante (cele mai lungi = mai specifice = mai ușor de rankat)
    const top10 = [...sorted]
        .filter((kw) => kw.length > seed.length + 3) // doar long-tail
        .sort((a, b) => b.length - a.length)
        .slice(0, 10);

    console.log('\n  ── Top 10 Long-Tail Keywords (cele mai specifice) ──\n');
    top10.forEach((kw, i) => {
        console.log(`    ${String(i + 1).padStart(2)}. ${kw}`);
    });

    // Grupare pe categorii
    const categories = {
        'Cu oraș': sorted.filter((k) => /pitesti|bucuresti|arges|ploiesti|craiova|brasov|sibiu|timisoara|cluj/i.test(k)),
        'Cu preț': sorted.filter((k) => /pret|cost|tarif|ieftin|scump/i.test(k)),
        'Cu tip': sorted.filter((k) => /nunta|botez|corporate|eveniment|petrecere/i.test(k)),
        'Cu gen': sorted.filter((k) => /populara|usoara|manele|lautari|jazz|rock/i.test(k)),
    };

    console.log('\n  ── Categorii identificate ──\n');
    for (const [cat, kws] of Object.entries(categories)) {
        if (kws.length > 0) {
            console.log(`    ${cat}: ${kws.length} cuvinte`);
        }
    }

    console.log(`\n✅ Harvest complet!\n`);
}

main().catch((err) => {
    console.error('❌ Eroare:', err.message);
    process.exit(1);
});
