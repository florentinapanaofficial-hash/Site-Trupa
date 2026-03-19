/**
 * update-seo.js
 *
 * Citește siteContent.json, trimite câmpurile SEO la Ollama (mistral),
 * primeşte variante optimizate pentru cuvinte cheie locale și salvează
 * JSON-ul actualizat pe disc.
 *
 * Utilizare:
 *   node scripts/update-seo.js           # rescrie fișierul
 *   node scripts/update-seo.js --dry-run # afișează rezultatul fără a salva
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Configurare ────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_PATH = resolve(__dirname, "../src/data/siteContent.json");
const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "mistral";
const DRY_RUN = process.argv.includes("--dry-run");

// Cuvinte-cheie locale pe care vrem să le includem în SEO
const LOCAL_KEYWORDS = [
    "formație nuntă Pitești",
    "muzică live Argeș 2026",
    "trupă nuntă Argeș",
    "Florentina Pană formație",
    "muzică live botez Pitești",
    "trupă evenimente Pitești",
];

// ── Utilitare ──────────────────────────────────────────────────────────────────

/** Apelează Ollama și returnează răspunsul complet ca string */
async function askOllama(prompt) {
    const body = JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        format: "json",
        options: {
            temperature: 0.4,
        },
    });

    let res;
    try {
        res = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            signal: AbortSignal.timeout(120_000), // 2 minute timeout
        });
    } catch (err) {
        if (err.name === "TimeoutError") {
            throw new Error(
                "Ollama nu a răspuns în 2 minute. Asigură-te că serverul rulează: `ollama serve`"
            );
        }
        throw new Error(
            `Nu s-a putut conecta la Ollama (${OLLAMA_URL}). Asigură-te că rulezi \`ollama serve\`.\nDetaliu: ${err.message}`
        );
    }

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Ollama a returnat eroare ${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.response ?? "";
}

/** Construiește prompt-ul pentru Ollama, cu feedback opțional despre erorile anterioare */
function buildPrompt(current, feedback = null) {
    const feedbackSection = feedback
        ? `\nATENȚIE: Încercarea anterioară a eșuat din cauza acestor probleme:\n${feedback}\nCorectează ACESTE PROBLEME SPECIFICE în răspunsul tău.\n`
        : "";

    return `Ești un specialist SEO pentru piața din România. 
Trebuie să rescrii metadatele SEO pentru un site de formație muzicală.

Date despre formație:
- Nume: Florentina Pană Formație
- Locație: Pitești, județul Argeș; disponibilitate națională
- Servicii: muzică live pentru nunți, botezuri, evenimente corporate
- Caracteristici: repertoriu variat, artiști profesioniști, show energic

Câmpurile SEO actuale:
{
  "title": "${current.title}",
  "description": "${current.description}"
}

Cuvinte-cheie locale pe care TREBUIE să le incluzi natural (cel puțin 3-4 dintre ele):
${LOCAL_KEYWORDS.map((k) => `- ${k}`).join("\n")}

Reguli STRICTE — respectă-le cu exactitate:
- seo.title: MAXIM 60 de caractere (numără atent!), include numele formației și un cuvânt-cheie
- seo.description: ÎNTRE 140 și 160 de caractere (numără atent!), include 3-4 cuvinte-cheie, un call-to-action clar
- Textul trebuie să fie în română corectă, cu diacritice
- NU folosi ghilimele escaped sau caractere speciale ciudate
${feedbackSection}
Răspunde EXCLUSIV cu un obiect JSON valid, fără text suplimentar, cu exact aceste două câmpuri:
{
  "title": "...",
  "description": "..."
}`;
}

/**
 * Parsează răspunsul Ollama și returnează { seo, errors }.
 * `errors` este un array de string-uri (gol = valid).
 */
function parseOllamaResponse(raw) {
    // Extragem primul bloc JSON găsit (modelul uneori adaugă text în jur)
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
        throw new Error(
            `Ollama nu a returnat JSON valid.\nRăspuns primit:\n${raw}`
        );
    }

    let parsed;
    try {
        parsed = JSON.parse(match[0]);
    } catch {
        throw new Error(
            `JSON invalid în răspunsul Ollama.\nRăspuns primit:\n${raw}`
        );
    }

    if (typeof parsed.title !== "string" || typeof parsed.description !== "string") {
        throw new Error(
            `Răspunsul Ollama nu conține "title" și "description" ca string-uri.\nRăspuns primit:\n${raw}`
        );
    }

    const title = parsed.title.trim();
    const description = parsed.description.trim();
    const errors = [];

    if (title.length > 60) {
        errors.push(
            `title are ${title.length} caractere — depășește limita de 60. Scurtează-l la maxim 60 de caractere.`
        );
    }
    if (description.length < 140) {
        errors.push(
            `description are ${description.length} caractere — sub minimul de 140. Adaugă mai mult text.`
        );
    }
    if (description.length > 160) {
        errors.push(
            `description are ${description.length} caractere — depășește limita de 160. Scurtează-o.`
        );
    }

    return { seo: { title, description }, errors };
}

/** Trunchiază title/description la limitele SEO, la granița de cuvânt */
function applyFallbackTruncation({ title, description }) {
    let t = title;
    if (t.length > 60) {
        // Caută ultimul spațiu înainte de caracterul 58 (lasă loc pentru "…")
        const cut = t.lastIndexOf(" ", 58);
        t = (cut > 20 ? t.slice(0, cut) : t.slice(0, 59)) + "…";
    }

    let d = description;
    if (d.length > 160) {
        const cut = d.lastIndexOf(" ", 157);
        d = (cut > 80 ? d.slice(0, cut) : d.slice(0, 159)) + "…";
    }
    // Dacă e sub 140 nu trunchiem (mai bine puțin decât trunchiat aiurea)
    if (d.length < 140) {
        console.warn(
            `  ⚠  description are doar ${d.length} ch după trunchiere — editează manual pentru a atinge 140 ch.`
        );
    }

    return { title: t, description: d };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
    console.log("📖 Citesc siteContent.json...");
    let content;
    try {
        content = JSON.parse(readFileSync(CONTENT_PATH, "utf-8"));
    } catch (err) {
        throw new Error(`Nu pot citi siteContent.json: ${err.message}`);
    }

    const currentSeo = content.seo ?? {};
    console.log("\nSEO actual:");
    console.log(`  title:       ${currentSeo.title}`);
    console.log(`  description: ${currentSeo.description}`);

    const MAX_RETRIES = 3;
    let newSeo = null;
    let feedback = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log(
            `\n🤖 Trimit la Ollama (mistral)... tentativa ${attempt}/${MAX_RETRIES} (30-60 sec)`
        );
        const prompt = buildPrompt(currentSeo, feedback);
        const raw = await askOllama(prompt);

        console.log("\n📩 Răspuns brut Ollama:");
        console.log(raw);

        const { seo, errors } = parseOllamaResponse(raw);

        if (errors.length === 0) {
            newSeo = seo;
            console.log(`\n✅ SEO valid la tentativa ${attempt}:`);
            console.log(`  title       (${seo.title.length} ch): ${seo.title}`);
            console.log(`  description (${seo.description.length} ch): ${seo.description}`);
            break;
        }

        console.log(`\n⚠  Constrângeri nerespectate la tentativa ${attempt}:`);
        errors.forEach((e) => console.log(`   - ${e}`));
        feedback = errors.join("\n");

        if (attempt === MAX_RETRIES) {
            console.warn(
                `\n⚠  Ollama nu a respectat limitele după ${MAX_RETRIES} încercări. Aplică trunchiere automată.`
            );
            newSeo = applyFallbackTruncation(seo);
            console.log(`\n✅ SEO după trunchiere:`);
            console.log(`  title       (${newSeo.title.length} ch): ${newSeo.title}`);
            console.log(`  description (${newSeo.description.length} ch): ${newSeo.description}`);
        }
    }

    if (DRY_RUN) {
        console.log("\n🔵 Mod dry-run: fișierul NU a fost modificat.");
        return;
    }

    // Actualizăm doar title și description; ogImage și orice alt câmp rămân intacte
    content.seo = {
        ...currentSeo,
        title: newSeo.title,
        description: newSeo.description,
    };

    writeFileSync(CONTENT_PATH, JSON.stringify(content, null, 2) + "\n", "utf-8");
    console.log("\n💾 siteContent.json actualizat cu succes.");
    console.log("\n📋 Pași următori:");
    console.log("  git add src/data/siteContent.json");
    console.log('  git commit -m "seo: actualizare automată cu Ollama mistral"');
    console.log("  git push   # Netlify va face deploy automat");
}

main().catch((err) => {
    console.error("\n❌ Eroare:", err.message);
    process.exit(1);
});
