/**
 * Post-build compression: generates .gz and .br for all static assets.
 * sirv serves these automatically when gzip/brotli options are enabled.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';

const DIST = 'dist/client';
const COMPRESSIBLE = new Set(['.css', '.js', '.mjs', '.html', '.svg', '.json', '.xml', '.txt']);
const MIN_SIZE = 256; // skip tiny files

async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
        const full = join(dir, e.name);
        if (e.isDirectory()) files.push(...await walk(full));
        else if (COMPRESSIBLE.has(extname(e.name).toLowerCase())) files.push(full);
    }
    return files;
}

const files = await walk(DIST);
let totalSaved = 0;

for (const file of files) {
    const raw = await readFile(file);
    if (raw.length < MIN_SIZE) continue;

    const gz = gzipSync(raw, { level: 9 });
    const br = brotliCompressSync(raw, {
        params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    });

    await writeFile(file + '.gz', gz);
    await writeFile(file + '.br', br);

    const saved = raw.length - br.length;
    totalSaved += saved;
    const pct = ((1 - br.length / raw.length) * 100).toFixed(1);
    console.log(`  ${file}  ${raw.length} → gz:${gz.length} br:${br.length}  (−${pct}%)`);
}

console.log(`\n✓ ${files.length} files compressed, ${(totalSaved / 1024).toFixed(1)} KB saved (brotli)`);
