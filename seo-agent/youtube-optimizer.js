/**
 * youtube-optimizer.js — Generator SEO Local (Argeș / Pitești)
 * ──────────────────────────────────────────────────────────
 * Analizează ultimele 10 videoclipuri de pe canalul YouTube
 * și generează metadate SEO optimizate (titlu, descriere, tag-uri)
 * orientate pe zona Argeș / Pitești.
 *
 * NU modifică nimic pe YouTube — salvează totul în:
 *   recomandari-seo-arges.txt  (rădăcina proiectului)
 *
 * Prerequisite:
 * 1. YouTube Data API v3 activat în Google Cloud Console
 * 2. .env cu YOUTUBE_API_KEY
 *
 * Rulare:
 *   node seo-agent/youtube-optimizer.js
 * ──────────────────────────────────────────────────────────
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Constante ────────────────────────────────────────────
const CHANNEL_ID = 'UCNi3X-Qm3V4aaOAFSOlzHew';
const SITE_LINK = 'florentinapanaofficial.ro';
const OUTPUT_FILE = join(ROOT, 'recomandari-seo-arges.txt');

const LOCAL_KEYWORDS = ['argeș', 'arges', 'pitești', 'pitesti'];
const SEO_TAGS = [
    'formatie nunta arges',
    'trupa cover pitesti',
    'muzica live nunti',
    'formatie evenimente arges',
    'muzica nunta pitesti',
    'trupa nunta arges',
    'Florentina Pana',
    'formatii nunti arges pitesti',
    'muzica populara arges',
    'cover band pitesti',
    'formatie live nunta',
    'trupa evenimente pitesti',
    'cantareata nunta arges',
    'muzica usoara nunti',
    'formatie botez arges',
];

// ── Încarcă .env manual ──────────────────────────────────
function loadEnv() {
    const envPath = join(ROOT, '.env');
    if (!existsSync(envPath)) {
        console.error('❌ Fișierul .env nu a fost găsit în rădăcina proiectului.');
        console.error('   Creează .env cu următoarea variabilă:');
        console.error('   YOUTUBE_API_KEY=cheia_ta_de_api');
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

// ── Detectare cuvinte cheie locale în text ───────────────
function hasLocalKeywords(text) {
    const lower = text.toLowerCase();
    return LOCAL_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Detectare esență clip din titlul original ────────────
function extractEssence(title) {
    // Curăță elemente comune din titluri (emoji, pipe, dash trailing)
    let clean = title
        .replace(/[🎵🎶🎤🎧🎷🔥💃🕺❤️✨🎬🎹🎸🥁💍👰🤵]/gu, '')
        .replace(/\s*[|–—-]\s*florentina\s*pan[aă]\s*(official)?/gi, '')
        .replace(/\s*[|–—-]\s*forma[tț]i[ea]\s*/gi, '')
        .replace(/\s*[|–—-]\s*cover\s*/gi, '')
        .replace(/\s*[|–—-]\s*live\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    // Trunchiază dacă e prea lung pentru a lăsa loc sufixului
    if (clean.length > 35) {
        clean = clean.substring(0, 35).replace(/\s\S*$/, '').trim();
    }
    return clean || title.substring(0, 30).trim();
}

// ── Generare titlu optimizat (max 60 caractere) ──────────
function generateTitle(originalTitle) {
    const hasLocal = hasLocalKeywords(originalTitle);
    const isShort = originalTitle.length <= 60;

    // Dacă e deja OK, returnăm originalul
    if (isShort && hasLocal) return null;

    const essence = extractEssence(originalTitle);
    const suffixes = [
        ' | Florentina Pană — Nuntă Argeș',
        ' | Florentina Pană — Pitești',
        ' | Nuntă Argeș — Florentina Pană',
        ' — Florentina Pană | Argeș',
    ];

    for (const suffix of suffixes) {
        const candidate = essence + suffix;
        if (candidate.length <= 60) return candidate;
    }

    // Fallback: trunchiază mai agresiv
    const short = essence.substring(0, 22).replace(/\s\S*$/, '').trim();
    return (short + ' | Florentina Pană — Argeș').substring(0, 60);
}

// ── Generare descriere optimizată ────────────────────────
function generateDescription(originalTitle) {
    return `🎶 ${originalTitle}

Trăiește magia muzicii live alături de Florentina Pană și formația sa! Specialiști în evenimente deosebite — nunți, botezuri și petreceri private — în zona Argeș, Pitești și în toată țara.

🎤 De ce să ne alegi?
✔️ Repertoriu vast: muzică populară, internațională, latino, covers moderne
✔️ Experiență de peste 15 ani pe scenă
✔️ Sonorizare profesională inclusă
✔️ Atmosferă garantată de la prima secundă

📍 Zonă acoperită: Argeș, Pitești, Câmpulung, Curtea de Argeș, București și împrejurimi

🌐 Detalii complete și ofertă personalizată:
👉 https://${SITE_LINK}

📞 Contactează-ne acum pentru o ofertă personalizată — locurile se ocupă rapid!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#formațieNuntăArgeș #muzicăLive #FlorentinaPană #nuntăPitești #formațieEvenimente #trupăCover #muzicăNuntă #evenimenteArgeș #liveMusic #nuntă2025`;
}

// ── Formatare bloc video pentru fișierul text ────────────
function formatVideoBlock(index, video, newTitle, newDescription) {
    const { snippet, id } = video;
    const url = `https://youtu.be/${id}`;
    const sep = '═'.repeat(65);
    const subSep = '─'.repeat(65);

    let block = '';
    block += `${sep}\n`;
    block += `  VIDEOCLIP #${index + 1}\n`;
    block += `  ${url}\n`;
    block += `${sep}\n\n`;

    // Titlul original vs. optimizat
    block += `📌 TITLU ORIGINAL:\n`;
    block += `   ${snippet.title}  (${snippet.title.length} caractere)\n\n`;

    if (newTitle) {
        block += `✅ TITLU OPTIMIZAT (copy-paste în YouTube Studio):\n`;
        block += `   ${newTitle}  (${newTitle.length} caractere)\n\n`;
    } else {
        block += `✅ Titlul este deja optimizat — nu necesită modificări.\n\n`;
    }

    block += `${subSep}\n\n`;

    // Descriere optimizată
    block += `📝 DESCRIERE OPTIMIZATĂ (copy-paste în YouTube Studio):\n\n`;
    block += newDescription.split('\n').map(line => `   ${line}`).join('\n');
    block += `\n\n${subSep}\n\n`;

    // Tag-uri
    block += `🏷️  TAG-URI RECOMANDATE (copy-paste, unul pe linie în YouTube Studio):\n\n`;
    for (const tag of SEO_TAGS) {
        block += `   ${tag}\n`;
    }

    block += `\n\n`;
    return block;
}

// ── Funcția principală ───────────────────────────────────
async function main() {
    loadEnv();

    if (!process.env.YOUTUBE_API_KEY) {
        console.error('❌ YOUTUBE_API_KEY nu este definită în .env');
        process.exit(1);
    }

    const youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY });

    console.log(`
╔══════════════════════════════════════════════════════════╗
║   🚀  YouTube SEO Optimizer — Argeș / Pitești  🚀      ║
║──────────────────────────────────────────────────────────║
║  Canal: ${CHANNEL_ID}                    ║
║  Site:  ${SITE_LINK.padEnd(46)}║
╚══════════════════════════════════════════════════════════╝
`);

    console.log('⏳ Se preiau ultimele 10 videoclipuri…\n');

    // Pas 1 — Preluarea ID-urilor videoclipurilor
    const searchRes = await youtube.search.list({
        part: 'id',
        channelId: CHANNEL_ID,
        maxResults: 10,
        order: 'date',
        type: 'video',
    });

    const videoIds = searchRes.data.items.map(item => item.id.videoId);

    if (videoIds.length === 0) {
        console.log('⚠️  Nu s-au găsit videoclipuri pe acest canal.');
        return;
    }

    // Pas 2 — Preluarea detaliilor complete
    const detailsRes = await youtube.videos.list({
        part: 'snippet',
        id: videoIds.join(','),
    });

    const videos = detailsRes.data.items;
    console.log(`📋 S-au găsit ${videos.length} videoclipuri. Se generează recomandări SEO…\n`);

    // Pas 3 — Generare conținut fișier
    const header = `${'═'.repeat(65)}
   RECOMANDĂRI SEO — YOUTUBE — ZONA ARGEȘ / PITEȘTI
   Generat automat de youtube-optimizer.js
   Data: ${new Date().toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })}
${'═'.repeat(65)}

   ℹ️  Instrucțiuni:
   Deschide YouTube Studio → selectează videoclipul → Editare →
   copiază Titlul, Descrierea și Tag-urile de mai jos.

   ⚠️  Acest fișier NU modifică nimic pe YouTube!
   Totul se face manual prin copy-paste, pentru siguranță.

\n\n`;

    let body = '';
    let optimizedCount = 0;

    for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        const newTitle = generateTitle(video.snippet.title);
        const newDescription = generateDescription(video.snippet.title);

        if (newTitle) optimizedCount++;

        body += formatVideoBlock(i, video, newTitle, newDescription);

        // Progress în consolă
        const status = newTitle ? '🔧 Optimizat' : '✅ OK';
        console.log(`  ${status}  ${video.snippet.title.substring(0, 50)}…`);
    }

    const footer = `${'═'.repeat(65)}
   📊 SUMAR
${'═'.repeat(65)}
   Total videoclipuri analizate: ${videos.length}
   Titluri care necesită optimizare: ${optimizedCount}
   Titluri deja optimizate: ${videos.length - optimizedCount}
${'═'.repeat(65)}
   Generat de: youtube-optimizer.js
   Florentina Pană — https://${SITE_LINK}
${'═'.repeat(65)}\n`;

    // Pas 4 — Salvare fișier
    const fullContent = header + body + footer;
    writeFileSync(OUTPUT_FILE, fullContent, 'utf-8');

    console.log(`
╔══════════════════════════════════════════════════════════╗
║  ✅ Fișier generat cu succes!                            ║
║  📄 ${OUTPUT_FILE.padEnd(52)}║
║  📋 ${String(videos.length).padStart(2)} videoclipuri analizate                          ║
║  🔧 ${String(optimizedCount).padStart(2)} titluri necesită optimizare                    ║
╚══════════════════════════════════════════════════════════╝
`);
}

main().catch(err => {
    console.error('\n❌ Eroare la comunicarea cu YouTube API:\n');
    if (err.response) {
        console.error(`   Status: ${err.response.status}`);
        console.error(`   Mesaj:  ${err.response.data?.error?.message || 'Necunoscut'}`);
    } else {
        console.error(`   ${err.message}`);
    }
    process.exit(1);
});
