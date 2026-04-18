/**
 * ferrari.js — Motor AI Premium pentru Optimizare YouTube
 * ═══════════════════════════════════════════════════════
 * Brand: Florentina Pană | Zona: Argeș / Pitești
 *
 * Ce face:
 *   1. Verifică validitatea cheilor API (Self-Check)
 *   2. Citește ultimele 10 videoclipuri de pe canal
 *   3. Trimite titlurile către GPT-4o pentru metadate SEO premium
 *   4. Salvează totul în  raport-final-seo.txt
 *
 * Rulare:
 *   node ferrari.js
 * ═══════════════════════════════════════════════════════
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// ── Configurare ──────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || 'UCNi3X-Qm3V4aaOAFSOlzHew';
const SITE_LINK = 'https://florentinapanaofficial.ro';
const OUTPUT_FILE = join(__dirname, 'raport-final-seo.txt');

// ── Self-Check: Verificare Chei API ─────────────────────
async function selfCheck() {
    console.log('\n🔍 SELF-CHECK — Verificăm cheile API...\n');
    let ok = true;

    // 1) OpenAI
    if (!OPENAI_API_KEY || OPENAI_API_KEY.length < 20) {
        console.error('  ❌ OPENAI_API_KEY lipsește sau e invalidă în .env');
        ok = false;
    } else {
        try {
            const testClient = new OpenAI({ apiKey: OPENAI_API_KEY });
            await testClient.models.list({ limit: 1 });
            console.log('  ✅ OpenAI API — conexiune validă');
        } catch (err) {
            console.error(`  ❌ OpenAI API — eroare: ${err.message}`);
            ok = false;
        }
    }

    // 2) YouTube
    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY.length < 10) {
        console.error('  ❌ YOUTUBE_API_KEY lipsește sau e invalidă în .env');
        ok = false;
    } else {
        try {
            const yt = google.youtube({ version: 'v3', auth: YOUTUBE_API_KEY });
            await yt.channels.list({ part: 'id', id: CHANNEL_ID });
            console.log('  ✅ YouTube API  — conexiune validă');
        } catch (err) {
            console.error(`  ❌ YouTube API — eroare: ${err.message}`);
            ok = false;
        }
    }

    if (!ok) {
        console.error('\n🛑 Self-Check EȘUAT. Verifică fișierul .env și reîncearcă.\n');
        process.exit(1);
    }
    console.log('\n🟢 Toate cheile sunt valide. Pornim motorul!\n');
}

// ── Prompt AI: Storytelling luxos, cald, convingător ────
function buildPrompt(oldTitle) {
    return `Ești un copywriter de lux, specializat pe nișa evenimentelor premium din România.
Scrii cu căldură, eleganță și emoție autentică — NICIODATĂ robotic sau generic.
Evită clișeele de tipul "cea mai frumoasă nuntă" sau "o seară de neuitat".

CONTEXT:
- Videoclip analizat: "${oldTitle}"
- Artist: Florentina Pană — voce de elită în județul Argeș
- Locații premium vizate: Ramada Pitești, Star Plaza, Garden Resort, Magic Events
- Piață țintă: miri din Pitești, Mioveni, Curtea de Argeș, Câmpulung, Topoloveni

SARCINI (în limba română, cu diacritice corecte):

1. TITLU (max 70 caractere)
   - Creează un titlu magnetic cu cârlig emoțional (curiosity gap, social proof sau senzorial)
   - Include locația (Pitești / Argeș) natural
   - Adaugă 1-2 emoji-uri discrete și elegante (✨🎤🌟💃)
   - NU folosi: "cel mai", "unic", "spectaculos", "de neuitat"

2. DESCRIERE (exact 3 paragrafe separate prin \\n\\n)
   - Paragraf 1 — ATMOSFERA: Descrie senzorial ce simte un invitat când Florentina cântă. Folosește imagini vivide (fiorul de pe piele, lumina reflectoarelor, aplauzele spontane).
   - Paragraf 2 — EXPERIENȚĂ & AUTORITATE: Menționează peste 15 ani de scenă, sălile premium din Argeș (Ramada Pitești, Star Plaza, Garden Resort), repertoriu vast (populară, internațională, latino, covers). Include natural: "formație nuntă Pitești", "muzică evenimente Argeș", "artist nuntă Mioveni".
   - Paragraf 3 — CALL-TO-ACTION: Urgență elegantă ("locurile pentru 2026-2027 se ocupă rapid") + link ${SITE_LINK} + îndemn la contact.

3. TAG-URI: Exact 15 tag-uri SEO locale, separate prin virgulă.
   OBLIGATORIU includ: formatie nunta pitesti, muzica evenimente arges, artist nunta mioveni, formatie nunta arges, trupa cover pitesti.

FORMAT RĂSPUNS — strict JSON valid, fără text în afara JSON-ului:
{
  "titlu": "...",
  "descriere": "Paragraf 1...\\n\\nParagraf 2...\\n\\nParagraf 3...",
  "taguri": "tag1, tag2, tag3, ..."
}`;
}

// ── Generare conținut AI ────────────────────────────────
async function generateAIContent(openai, oldTitle) {
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.8,
        messages: [
            {
                role: 'system',
                content: 'Ești un copywriter premium pentru industria evenimentelor din România. Răspunzi EXCLUSIV în JSON valid, în limba română cu diacritice corecte.'
            },
            { role: 'user', content: buildPrompt(oldTitle) }
        ],
        response_format: { type: 'json_object' },
    });

    return JSON.parse(completion.choices[0].message.content);
}

// ── Formatare raport ────────────────────────────────────
function formatReport(videos) {
    const now = new Date().toLocaleString('ro-RO', { dateStyle: 'full', timeStyle: 'short' });
    const sep = '═'.repeat(65);
    const line = '─'.repeat(65);

    let report = '';
    report += `${sep}\n`;
    report += `   🏎️  RAPORT FINAL SEO — FLORENTINA PANĂ\n`;
    report += `   Motor: GPT-4o  |  Zona: Argeș / Pitești\n`;
    report += `   Generat: ${now}\n`;
    report += `${sep}\n\n`;
    report += `   ℹ️  Instrucțiuni:\n`;
    report += `   Deschide YouTube Studio → selectează videoclipul → Editare →\n`;
    report += `   copiază Titlul, Descrierea și Tag-urile de mai jos.\n\n`;

    videos.forEach((v, i) => {
        report += `${sep}\n`;
        report += `  VIDEOCLIP #${i + 1}\n`;
        report += `  ${v.url}\n`;
        report += `${sep}\n\n`;

        report += `📌 TITLU ORIGINAL:\n`;
        report += `   ${v.oldTitle}\n\n`;

        report += `✅ TITLU OPTIMIZAT (copy-paste în YouTube Studio):\n`;
        report += `   ${v.newTitle}\n\n`;

        report += `${line}\n\n`;

        report += `📝 DESCRIERE OPTIMIZATĂ (copy-paste în YouTube Studio):\n\n`;
        // Descrierea pe paragrafe cu indent
        const paragraphs = v.description.split(/\n\n+/);
        paragraphs.forEach(p => {
            report += `   ${p.trim()}\n\n`;
        });

        // Adaugă blocul standard de footer la descriere
        report += `   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        report += `   📍 Zonă acoperită: Pitești, Argeș, Mioveni, Curtea de Argeș,\n`;
        report += `      Câmpulung, Topoloveni, București și împrejurimi\n\n`;
        report += `   🌐 Rezervări și detalii:\n`;
        report += `   👉 ${SITE_LINK}\n\n`;

        report += `${line}\n\n`;

        report += `🏷️  TAG-URI RECOMANDATE (copy-paste în YouTube Studio):\n\n`;
        const tags = v.tags.split(',').map(t => t.trim()).filter(Boolean);
        tags.forEach(tag => {
            report += `   ${tag}\n`;
        });

        report += `\n\n`;
    });

    report += `${sep}\n`;
    report += `   ✅ RAPORT COMPLET — ${videos.length} videoclipuri procesate\n`;
    report += `   🌐 ${SITE_LINK}\n`;
    report += `${sep}\n`;

    return report;
}

// ── Main ────────────────────────────────────────────────
async function main() {
    console.log('');
    console.log('  🏎️  ══════════════════════════════════════════');
    console.log('       FERRARI AI — Optimizare YouTube SEO');
    console.log('       Brand: Florentina Pană | Zona: Argeș');
    console.log('  🏎️  ══════════════════════════════════════════');

    // Pasul 1: Self-Check
    await selfCheck();

    // Pasul 2: Inițializare clienți
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const youtube = google.youtube({ version: 'v3', auth: YOUTUBE_API_KEY });

    // Pasul 3: Fetch ultimele 10 videoclipuri
    console.log('📡 Citim ultimele 10 videoclipuri de pe canal...\n');

    const searchRes = await youtube.search.list({
        part: 'id',
        channelId: CHANNEL_ID,
        maxResults: 10,
        order: 'date',
        type: 'video',
    });

    const videoIds = searchRes.data.items.map(item => item.id.videoId).filter(Boolean);
    if (videoIds.length === 0) {
        console.error('❌ Nu am găsit videoclipuri pe canal. Verifică YOUTUBE_CHANNEL_ID.');
        process.exit(1);
    }

    const detailsRes = await youtube.videos.list({
        part: 'snippet,statistics',
        id: videoIds.join(','),
    });

    console.log(`   Găsite: ${detailsRes.data.items.length} videoclipuri\n`);

    // Pasul 4: Procesare AI pentru fiecare video
    const results = [];

    for (const [index, video] of detailsRes.data.items.entries()) {
        const title = video.snippet.title;
        const views = video.statistics?.viewCount || '—';
        console.log(`🧠 [${index + 1}/${detailsRes.data.items.length}] AI optimizează: "${title}" (${views} vizualizări)`);

        try {
            const aiData = await generateAIContent(openai, title);
            results.push({
                url: `https://youtu.be/${video.id}`,
                oldTitle: title,
                newTitle: aiData.titlu,
                description: aiData.descriere,
                tags: aiData.taguri,
            });
            console.log(`   ✅ Gata — titlu nou: ${aiData.titlu}\n`);
        } catch (err) {
            console.error(`   ❌ Eroare AI pentru "${title}": ${err.message}\n`);
            results.push({
                url: `https://youtu.be/${video.id}`,
                oldTitle: title,
                newTitle: '⚠️ EROARE — regenerează manual',
                description: `Eroare la generare: ${err.message}`,
                tags: '',
            });
        }
    }

    // Pasul 5: Generare raport și salvare
    const report = formatReport(results);
    writeFileSync(OUTPUT_FILE, report, 'utf-8');

    console.log('');
    console.log(`✅ RAPORT SALVAT → raport-final-seo.txt`);
    console.log(`   ${results.length} videoclipuri procesate cu succes.`);
    console.log(`   Deschide fișierul și copiază conținutul în YouTube Studio.\n`);
}

main().catch(err => {
    console.error('\n💥 Eroare fatală:', err.message);
    process.exit(1);
});