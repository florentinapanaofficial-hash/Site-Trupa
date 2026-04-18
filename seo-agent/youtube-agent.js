/**
 * youtube-agent.js — Audit SEO pentru canalul YouTube
 * ──────────────────────────────────────────────────────────
 * Analizează ultimele 10 videoclipuri de pe canal și verifică:
 * - Lungimea titlului (≤60 caractere = optim)
 * - Descrierea (lungime + prezența link-ului către site)
 * - Tag-uri (existența lor)
 * - Statistici (vizualizări + like-uri)
 *
 * Prerequisite:
 * 1. YouTube Data API v3 activat în Google Cloud Console
 * 2. .env cu YOUTUBE_API_KEY
 *
 * Rulare:
 *   node seo-agent/youtube-agent.js
 * ──────────────────────────────────────────────────────────
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Constante ────────────────────────────────────────────
const CHANNEL_ID = 'UCNi3X-Qm3V4aaOAFSOlzHew';
const SITE_LINK = 'florentinapanaofficial.ro';

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

// ── Banner ASCII ─────────────────────────────────────────
function printBanner() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║        🎬  YouTube SEO Audit — Florentina Pana  🎬      ║
║──────────────────────────────────────────────────────────║
║  Canal: ${CHANNEL_ID}                    ║
║  Site:  ${SITE_LINK.padEnd(46)}║
╚══════════════════════════════════════════════════════════╝
`);
}

// ── Analiză video individual ─────────────────────────────
function analyzeVideo(video) {
    const { snippet, statistics, id } = video;
    const title = snippet.title || '';
    const description = snippet.description || '';
    const tags = snippet.tags || [];
    const url = `https://youtu.be/${id}`;

    console.log(`┌──────────────────────────────────────────────────────────`);
    console.log(`│ 🎥 ${title}`);
    console.log(`│    ${url}`);
    console.log(`├──────────────────────────────────────────────────────────`);

    // Titlu
    if (title.length <= 60) {
        console.log(`│ ✅ Titlu: Optim (${title.length} caractere)`);
    } else {
        console.log(`│ ⚠️  Titlu: Prea lung (${title.length} caractere — se taie pe mobil)`);
    }

    // Descriere
    if (!description || description.length < 100) {
        console.log(`│ ⚠️  Descriere: Prea scurtă (sub 100 caractere)`);
    } else if (!description.toLowerCase().includes(SITE_LINK.toLowerCase())) {
        console.log(`│ ❌ Link Site: Lipsește link-ul către site-ul oficial!`);
    } else {
        console.log(`│ ✅ Descriere: Optimă și conține link către site`);
    }

    // Tag-uri
    if (tags.length > 0) {
        console.log(`│ ✅ Tag-uri: ${tags.length} tag-uri adăugate`);
    } else {
        console.log(`│ ❌ Tag-uri: Lipsesc complet!`);
    }

    // Statistici
    const views = Number(statistics.viewCount || 0).toLocaleString('ro-RO');
    const likes = Number(statistics.likeCount || 0).toLocaleString('ro-RO');
    console.log(`│ 📊 Vizualizări: ${views} | 👍 Like-uri: ${likes}`);
    console.log(`└──────────────────────────────────────────────────────────\n`);
}

// ── Funcția principală ───────────────────────────────────
async function main() {
    loadEnv();

    if (!process.env.YOUTUBE_API_KEY) {
        console.error('❌ YOUTUBE_API_KEY nu este definită în .env');
        process.exit(1);
    }

    const youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY });

    printBanner();
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
        part: 'snippet,statistics',
        id: videoIds.join(','),
    });

    console.log(`📋 S-au găsit ${detailsRes.data.items.length} videoclipuri. Analiză SEO:\n`);

    // Pas 3 — Generarea raportului
    for (const video of detailsRes.data.items) {
        analyzeVideo(video);
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Audit complet! Verifică recomandările de mai sus.');
    console.log('═══════════════════════════════════════════════════════════');
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
