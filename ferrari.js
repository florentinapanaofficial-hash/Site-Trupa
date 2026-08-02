/**
 * ferrari.js — Asistent SEO YouTube (CLI interactiv + Gemini AI)
 * ═══════════════════════════════════════════════════════════════
 * Brand: Florentina Pană — „Vocea Piteștiului"
 *
 * Ce face:
 *   1. Pune 5 întrebări în terminal (readline)
 *   2. Trimite un prompt SEO către Gemini (cu retry/fallback)
 *   3. Afișează rezultatul și cere aprobare
 *   4. Salvează în raport-seo.txt (append)
 *   5. Opțional: generează Astro Gallery Data (alt + caption) pt. PhotoGallery
 *
 * Rulare:  node ferrari.js
 * Necesită: GEMINI_API_KEY în .env
 * ═══════════════════════════════════════════════════════════════
 */

import { appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// ── Configurare ──────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SITE_LINK = 'https://florentinapanaofficial.ro';
const OUTPUT_FILE = join(__dirname, 'raport-seo.txt');

// ── Verificare cheie API ─────────────────────────────────
if (!GEMINI_API_KEY || GEMINI_API_KEY.length < 10) {
    console.error('❌ GEMINI_API_KEY lipsește sau e invalidă în .env');
    process.exit(1);
}

// ── Inițializare Gemini ──────────────────────────────────
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Lista de modele în ordinea preferinței (fallback automat)
const MODEL_CHOICES = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-001'];

// Funcție de generare cu retry și fallback automat
async function generateWithRetry(prompt, maxRetries = 3) {
    for (const modelName of MODEL_CHOICES) {
        const currentModel = genAI.getGenerativeModel({ model: modelName });
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`   🔄 Încercăm ${modelName} (tentativa ${attempt}/${maxRetries})...`);
                const response = await currentModel.generateContent(prompt);
                console.log(`   ✅ Succes cu ${modelName}`);
                return response.response.text();
            } catch (err) {
                const is503 = err.message?.includes('503') || err.message?.includes('high demand');
                const is429 = err.message?.includes('429') || err.message?.includes('quota');
                if ((is503 || is429) && (attempt < maxRetries || modelName !== MODEL_CHOICES.at(-1))) {
                    console.log(`   ⚠️  ${modelName} indisponibil (${is503 ? '503' : '429'}), reîncercăm...`);
                    continue;
                }
                throw err;
            }
        }
    }
}

// ── Helper: întreabă o singură întrebare în terminal ─────
function ask(rl, question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer.trim()));
    });
}

// ── Construiește prompt-ul SEO pentru Gemini ─────────────
function buildPrompt({ videoLink, artist, gen, locatie, includeGallery }) {
    let galleryBlock = '';
    if (includeGallery) {
        galleryBlock = `

4. ASTRO GALLERY DATA: Generează 5 variații diferite de texte optimizate pentru atributele "alt" și "caption" ale fotografiilor din galeria web.
   Fiecare variație trebuie:
   - Să includă OBLIGATORIU numele brandului „Formația Florentina Pană" și locația „${locatie}"
   - Să fie elegantă, variată și naturală (NU repetitivă)
   - Să conțină cuvinte cheie SEO relevante (nuntă, eveniment, live, dans, atmosferă)
   - Format per linie: ALT: ... | CAPTION: ...

   Exemplu de format:
   ALT: Formația Florentina Pană la ${locatie} — Atmosferă de nuntă premium | CAPTION: Momente magice de dans și voie bună la ${locatie}

Include blocul ASTRO GALLERY DATA la final, după TAG-URI.`;
    }

    return `Ești un expert SEO pentru YouTube Shorts, specializat pe formații de evenimente din România.
Scrii în limba română CU diacritice corecte (ă, â, î, ș, ț).

REGULI STRICTE DE BUSINESS:

1. FORMAT: Rezultatul este pentru un YouTube Short (30-60 secunde).
   Textele trebuie să fie scurte, percutante, cu un "Hook" puternic în prima propoziție.

2. IERARHIA BRANDULUI:
   - Florentina Pană („Vocea Piteștiului") este LIDERUL ABSOLUT și imaginea centrală a trupei.
   - Ea cântă ABSOLUT TOATE genurile muzicale.
    - Cătălin Matei intervine ca membru al trupei pentru programe speciale de muzică populară de petrecere și jocuri tradiționale.
   - Formația are acompaniament live: orgă, vioară, acordeon.
    - Evită formulări de nișă rigidă (autentic/tradiționalism exclusiv, taraf, ansamblu).
    - Poziționează trupa ca „Formație Nuntă & Cover Band Live" cu „Show Live 100%".

3. SEO LOCAL: Folosește cu strictețe locația „${locatie}" pentru a atrage mirii din acea zonă.

CONTEXT VIDEOCLIP:
- Link: ${videoLink}
- La microfon: ${artist}
- Gen muzical: ${gen}
- Locație: ${locatie}

GENEREAZĂ EXACT URMĂTORUL OUTPUT (în limba română, cu diacritice):

1. TITLU: Maxim 60 de caractere. Atrage atenția imediat. Include locația sau genul muzical.

2. DESCRIERE SCURTĂ: 2-3 propoziții cu hook puternic + call-to-action către site-ul ${SITE_LINK}.

3. TAG-URI SEO: O listă de cuvinte cheie relevante, separate prin virgulă (minim 10 tag-uri).
    Obligatoriu includ variații cu: formație nuntă, cover band live, event band, muzică ușoară live, dance & party, muzică de petrecere, ${locatie}, ${gen}.
    Prioritizează primele tag-uri în această ordine: Cover Band, Event Band, Muzică ușoară live, Dance & Party, Muzică de petrecere.${galleryBlock}

Răspunde DOAR cu textul structurat (fără JSON, fără markdown).`;
}

// ── Formatare frumoasă în consolă ────────────────────────
function formatForConsole(result, videoLink) {
    const sep = '═'.repeat(60);
    const line = '─'.repeat(60);
    return `
${sep}
  🏎️  REZULTAT SEO — FERRARI AI + GEMINI
${sep}

🔗 Video: ${videoLink}

${line}
📌 ${result}
${line}
`;
}

// ── Formatare pentru salvare în fișier ───────────────────
function formatForFile(result, videoLink, { includeGallery = false, locatie = '' } = {}) {
    const now = new Date().toLocaleString('ro-RO', { dateStyle: 'full', timeStyle: 'short' });
    const sep = '═'.repeat(60);
    let galleryStatus = '';
    if (includeGallery) {
        galleryStatus = `\n📷 Status Galerie: Date pregătite (Așteptare fișiere foto)\n   Locație asociată: ${locatie}\n`;
    }
    return `
${sep}
  🏎️  SEO — Generat: ${now}
${sep}

🔗 Video: ${videoLink}

${result}
${galleryStatus}
${sep}

`;
}

// ── Main ────────────────────────────────────────────────
async function main() {
    console.log('');
    console.log('  🏎️  ══════════════════════════════════════════');
    console.log('       FERRARI AI — Asistent SEO YouTube');
    console.log('       Brand: Florentina Pană | Gemini AI');
    console.log('  🏎️  ══════════════════════════════════════════');
    console.log('');

    // Creăm interfața readline
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    try {
        // Pasul 1: Colectăm datele de la utilizator
        const videoLink = await ask(rl, '🎬 Care este ID-ul sau link-ul videoclipului? ');
        const artist = await ask(rl, '🎤 Cine este la microfon? (Ex: Flori, Cătălin, Instrumentar) ');
        const gen = await ask(rl, '🎵 Ce gen se cântă? (Ex: Horă, Grecească, Machedonească, Manele, Caffe concert) ');
        const locatie = await ask(rl, '📍 Care este locația? (Ex: Orhideea Events Pitești) ');
        const galleryAnswer = await ask(rl, '🖼️  Această locație se aplică și pentru descrierea fotografiilor din galerie? (Y/N) ');
        const includeGallery = galleryAnswer.toUpperCase() === 'Y';

        // Validare minimală — nu trimitem câmpuri goale
        if (!videoLink || !artist || !gen || !locatie) {
            console.error('\n❌ Toate câmpurile sunt obligatorii. Reîncearcă.\n');
            rl.close();
            process.exit(1);
        }

        if (includeGallery) {
            console.log('   📷 Galerie activată — Gemini va genera și date Astro Gallery.');
        }

        // Pasul 2: Trimitem prompt-ul către Gemini (cu retry automat)
        console.log('\n⏳ Generăm metadate SEO cu Gemini...\n');
        const prompt = buildPrompt({ videoLink, artist, gen, locatie, includeGallery });
        const result = await generateWithRetry(prompt);

        // Pasul 3: Afișăm rezultatul
        console.log(formatForConsole(result, videoLink));

        // Pasul 4: Întrebăm dacă aprobă
        const approve = await ask(rl, '✅ Aprobă și salvează? (Y/N) ');

        if (approve.toUpperCase() === 'Y') {
            // Salvăm în raport-seo.txt (append)
            const fileContent = formatForFile(result, videoLink, { includeGallery, locatie });
            appendFileSync(OUTPUT_FILE, fileContent, 'utf-8');
            console.log(`\n💾 Salvat cu succes în → raport-seo.txt`);
            if (includeGallery) {
                console.log('   📷 Date galerie incluse — gata de Copy-Paste în PhotoGallery.astro');
            }
            console.log('');
        } else {
            console.log('\n🚫 Operațiune anulată.\n');
        }
    } catch (err) {
        console.error(`\n💥 Eroare: ${err.message}\n`);
        process.exit(1);
    } finally {
        rl.close();
    }
}

main();