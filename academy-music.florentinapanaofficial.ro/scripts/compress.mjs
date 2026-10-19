import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompress, gzip, constants } from 'node:zlib';
import { promisify } from 'node:util';

const dist = fileURLToPath(new URL('../dist/client/', import.meta.url));
const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);
let count = 0;
for (const filename of await readdir(dist, { recursive: true })) {
    if (!/\.(html|css|js|mjs|svg|json)$/.test(filename)) continue;
    const path = join(dist, filename);
    const content = await readFile(path);
    if (content.length < 1024) continue;
    const [compressedBrotli, compressedGzip] = await Promise.all([
        brotli(content, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }),
        gzipAsync(content, { level: 9 }),
    ]);
    await Promise.all([writeFile(`${path}.br`, compressedBrotli), writeFile(`${path}.gz`, compressedGzip)]);
    count += 1;
}
console.log(`Precompressed ${count} assets (Brotli + Gzip).`);