import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const siteUrl = (process.env.SITE_URL || 'https://www.florentinapanaofficial.ro').replace(/\/$/, '');
const indexNowKey = process.env.INDEXNOW_KEY;
const keyLocation = process.env.INDEXNOW_KEY_LOCATION || `${siteUrl}/${indexNowKey}.txt`;
const endpoint = process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/indexnow';
const clientRoot = join(process.cwd(), 'dist', 'client');

if (!indexNowKey) {
    console.log('IndexNow: INDEXNOW_KEY nu este setat; trimiterea este omisă.');
    process.exit(0);
}

async function collectHtmlFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await collectHtmlFiles(path));
        else if (entry.isFile() && entry.name === 'index.html') files.push(path);
    }
    return files;
}

const htmlFiles = await collectHtmlFiles(clientRoot);
const urlList = htmlFiles.map((file) => {
    const relativePath = file.slice(clientRoot.length).replaceAll('\\', '/');
    const route = relativePath.replace(/\/index\.html$/, '/') || '/';
    return `${siteUrl}${route}`;
});

for (let offset = 0; offset < urlList.length; offset += 10_000) {
    const urlListBatch = urlList.slice(offset, offset + 10_000);
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
            host: new URL(siteUrl).host,
            key: indexNowKey,
            keyLocation,
            urlList: urlListBatch,
        }),
    });

    if (!response.ok) {
        throw new Error(`IndexNow a răspuns cu ${response.status}: ${await response.text()}`);
    }

    console.log(`IndexNow: ${urlListBatch.length} URL-uri trimise.`);
}