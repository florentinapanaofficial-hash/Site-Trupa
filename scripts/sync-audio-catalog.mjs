import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { secureLogger } from '../src/lib/secure-logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const audioDir = path.join(rootDir, 'public', 'Audio');
const outputPath = path.join(rootDir, 'src', 'data', 'audio-catalog.generated.json');
const defaultArtist = process.env.AUDIO_DEFAULT_ARTIST || 'Formația Florentina Pană';

const supportedExtensions = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac']);

function slugify(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'general';
}

function toTitleCase(value) {
    return value
        .replace(/[\-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

function normalizeForMatch(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function inferGenres(input) {
    const text = normalizeForMatch(input);
    const genres = new Set();

    if (/(popular|hora|sarba|doina|lautareasca|folclor)/.test(text)) {
        genres.add('populara');
    }

    if (/(manele|oriental|balcanic)/.test(text)) {
        genres.add('manele');
    }

    if (/(pop|dance|hit|radio|club|international|internationala)/.test(text)) {
        genres.add('pop');
    }

    if (genres.size === 0) {
        genres.add('petrecere');
    }

    return Array.from(genres);
}

async function walkAudioFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await walkAudioFiles(fullPath)));
            continue;
        }

        const ext = path.extname(entry.name).toLowerCase();
        if (supportedExtensions.has(ext)) {
            const stats = await fs.stat(fullPath);
            files.push({ fullPath, mtimeMs: stats.mtimeMs });
        }
    }

    return files;
}

async function generateCatalog() {
    let files = [];
    try {
        files = await walkAudioFiles(audioDir);
    } catch {
        files = [];
    }

    files.sort((a, b) => b.mtimeMs - a.mtimeMs);

    const grouped = new Map();

    for (const item of files) {
        const relative = path.relative(audioDir, item.fullPath).split(path.sep).join('/');
        const parts = relative.split('/');
        const categoryRaw = parts.length > 1 ? parts[0] : 'Selecție Generală';
        const categoryId = slugify(categoryRaw);
        const categoryTitle = parts.length > 1 ? toTitleCase(categoryRaw) : 'Selecție Generală';

        const baseName = path.basename(parts[parts.length - 1], path.extname(parts[parts.length - 1]));
        const genreContext = `${categoryRaw} ${baseName}`;
        const song = {
            name: toTitleCase(baseName),
            artist: defaultArtist,
            file: relative,
            genres: inferGenres(genreContext),
        };

        if (!grouped.has(categoryId)) {
            grouped.set(categoryId, {
                id: categoryId,
                title: categoryTitle,
                songs: [],
            });
        }

        grouped.get(categoryId).songs.push(song);
    }

    const catalog = {
        generatedAt: new Date().toISOString(),
        totalTracks: files.length,
        categories: Array.from(grouped.values()),
    };

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

    secureLogger.info(`Catalog sincronizat: ${catalog.totalTracks} piese în ${catalog.categories.length} categorii.`);
    secureLogger.info(`Fișier: ${outputPath}`);
}

generateCatalog().catch((error) => {
    secureLogger.error('Eroare la generarea catalogului audio:', error);
    process.exitCode = 1;
});
