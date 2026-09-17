/**
 * Redenumește fișierele din public/images/galerie-foto-site/ care conțin `&` —
 * caracter care poate cauza 404 în anumite medii de hosting/CDN — în kebab-case
 * ASCII curat (& → si, diacritice transliterate, totul minuscule).
 * Actualizează și referințele din src/data/siteContent.json.
 *
 * Rulare: node scripts/rename-gallery-special-chars.mjs
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GALLERY_DIR = path.join(ROOT, 'public', 'images', 'galerie-foto-site');
const SITE_CONTENT_PATH = path.join(ROOT, 'src', 'data', 'siteContent.json');

/** Transformă un nume de fișier cu diacritice/spații/`&` în kebab-case ASCII. */
function toKebabCase(filename) {
    const ext = path.extname(filename);
    const base = filename.slice(0, -ext.length);
    const ascii = base
        .replace(/&/g, ' si ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // elimină diacriticele (ă→a, ș→s, ț→t...)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `${ascii}${ext.toLowerCase()}`;
}

const RENAMES = [
    'Galerie Foto Claudiu & Florentina Pană 2.jpg',
    'Galerie Foto Claudiu & Florentina Pană 3.jpg',
    'Galerie Foto Claudiu & Florentina Pană 4.jpg',
    'Galerie Foto Claudiu & Florentina Pană 5.jpg',
    'Galerie Foto Claudiu & Florentina Pană 6.jpg',
    'Galerie Foto Claudiu & Florentina Pană 7.jpg',
    'Galerie Foto Claudiu & Florentina Pană 8.jpg',
].map((oldName) => ({ oldName, newName: toKebabCase(oldName) }));

let siteContent = readFileSync(SITE_CONTENT_PATH, 'utf8');

for (const { oldName, newName } of RENAMES) {
    const oldPath = path.join(GALLERY_DIR, oldName);
    const newPath = path.join(GALLERY_DIR, newName);

    if (existsSync(newPath)) {
        console.log(`⏭  Deja există: ${newName}`);
    } else if (existsSync(oldPath)) {
        renameSync(oldPath, newPath);
        console.log(`✔ Redenumit: ${oldName} → ${newName}`);
    } else {
        console.warn(`⚠ Nu găsesc pe disc: ${oldName}`);
    }

    // Referința în JSON e URL-encodată (%26, %C4%83) — o înlocuim cu calea nouă, simplă.
    const encodedOld = `/images/galerie-foto-site/${encodeURIComponent(oldName).replace(/%20/g, ' ')}`;
    const newSrc = `/images/galerie-foto-site/${newName}`;
    if (siteContent.includes(encodedOld)) {
        siteContent = siteContent.split(encodedOld).join(newSrc);
        console.log(`  ↳ actualizat în siteContent.json`);
    }
}

writeFileSync(SITE_CONTENT_PATH, siteContent, 'utf8');
console.log('\nGata. Rulează din nou `astro check` / `npm run build` pentru validare.');
