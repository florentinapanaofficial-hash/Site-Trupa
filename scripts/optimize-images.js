/**
 * optimize-images.js
 * ──────────────────────────────────────────────────────────
 * Citește imagini brute din _raw_images/, le convertește
 * în WebP (calitate 80%, max 1920px lățime), le salvează
 * în src/assets/ și șterge originalele.
 *
 * Rulare:  node scripts/optimize-images.js
 * ──────────────────────────────────────────────────────────
 */
import { readdir, stat, unlink, mkdir } from 'node:fs/promises';
import { join, extname, basename, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const INPUT_DIR = join(ROOT, '_raw_images');
const OUTPUT_DIR = join(ROOT, 'src', 'assets');

const SUPPORTED_EXT = new Set(['.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.gif', '.webp', '.avif']);
const MAX_WIDTH = 1920;
const WEBP_QUALITY = 80;

// ── Utilități ────────────────────────────────────────────
function formatBytes(bytes) {
    if (bytes >= 1_048_576) return (bytes / 1_048_576).toFixed(2) + ' MB';
    return (bytes / 1024).toFixed(1) + ' KB';
}

function slugify(name) {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')   // elimină diacritice
        .replace(/[^a-z0-9]+/g, '-')       // caractere speciale → cratimă
        .replace(/^-+|-+$/g, '');          // trim cratime
}

// ── Procesare ────────────────────────────────────────────
async function run() {
    // Asigură-te că folderele există
    await mkdir(INPUT_DIR, { recursive: true });
    await mkdir(OUTPUT_DIR, { recursive: true });

    const files = (await readdir(INPUT_DIR)).filter((f) =>
        SUPPORTED_EXT.has(extname(f).toLowerCase())
    );

    if (files.length === 0) {
        console.log('\n⚠  Nicio imagine găsită în _raw_images/.');
        console.log('   Adaugă fișiere JPG/PNG/TIFF acolo și rerulează.\n');
        process.exit(0);
    }

    console.log(`\n🔧 Procesez ${files.length} imagine(i) din _raw_images/ ...\n`);

    const report = [];

    for (const file of files) {
        const inputPath = join(INPUT_DIR, file);
        const { name } = parse(file);
        const safeName = slugify(name);
        const outputName = `${safeName}.webp`;
        const outputPath = join(OUTPUT_DIR, outputName);

        const originalStat = await stat(inputPath);
        const originalSize = originalStat.size;

        // Citește metadata pentru a decide dacă trebuie redimensionată
        const image = sharp(inputPath);
        const meta = await image.metadata();

        let pipeline = image;
        const wasResized = meta.width > MAX_WIDTH;

        if (wasResized) {
            pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
        }

        await pipeline
            .webp({ quality: WEBP_QUALITY })
            .toFile(outputPath);

        const newStat = await stat(outputPath);
        const newSize = newStat.size;
        const savings = ((1 - newSize / originalSize) * 100).toFixed(1);

        // Șterge originalul
        await unlink(inputPath);

        // Import relativ Astro (din src/pages/ sau src/components/)
        const astroImport = safeName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

        report.push({
            original: file,
            output: outputName,
            oldSize: formatBytes(originalSize),
            newSize: formatBytes(newSize),
            savings: savings + '%',
            resized: wasResized ? `${meta.width}px → ${MAX_WIDTH}px` : 'nu',
            importVar: astroImport,
        });
    }

    // ── Raport ───────────────────────────────────────────
    console.log('╔══════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    RAPORT OPTIMIZARE IMAGINI                            ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

    console.table(
        report.map((r, i) => ({
            '#': i + 1,
            'Fișier original': r.original,
            'Fișier nou': r.output,
            'Mărime veche': r.oldSize,
            'Mărime nouă': r.newSize,
            'Economie': r.savings,
            'Redimensionat': r.resized,
        }))
    );

    console.log('\n── Cod Astro (copiază în componenta ta) ────────────────────\n');

    for (const r of report) {
        console.log(`  // ${r.original} → ${r.output}`);
        console.log(`  import ${r.importVar} from '../assets/${r.output}';`);
        console.log(`  <Image src={${r.importVar}} alt="Descriere imagine" />\n`);
    }

    console.log(`✅ ${report.length} imagine(i) optimizate → src/assets/`);
    console.log(`🗑  Fișierele brute au fost șterse din _raw_images/\n`);
}

run().catch((err) => {
    console.error('❌ Eroare la optimizare:', err.message);
    process.exit(1);
});
