import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const folders = [
    ['public/images/galerie-foto-site', 'public/images/galerie-foto-site-optimized'],
    ['public/images/poze 09.07.2026', 'public/images/poze-09-07-2026-optimized'],
];
const extensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

for (const [sourceFolder, outputFolder] of folders) {
    const sourceDir = path.join(root, sourceFolder);
    const outputDir = path.join(root, outputFolder);
    await mkdir(outputDir, { recursive: true });

    const files = (await readdir(sourceDir)).filter((file) => extensions.has(path.extname(file).toLowerCase()));
    for (const file of files) {
        const input = path.join(sourceDir, file);
        const output = path.join(outputDir, `${path.basename(file, path.extname(file))}.webp`);
        await sharp(input)
            .resize({ width: 1600, withoutEnlargement: true })
            .webp({ quality: 78 })
            .toFile(output);
    }

    console.log(`Optimized ${files.length} images: ${outputFolder}`);
}