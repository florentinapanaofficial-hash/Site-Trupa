import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const DIST_DIR = 'dist/client';
const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 160;
const REQUIRED_OPEN_GRAPH = ['og:type', 'og:title', 'og:description', 'og:url', 'og:image'];
const REQUIRED_TWITTER = ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];
const SKIP_INTERNAL_HREF = /^(#|tel:|mailto:|javascript:)/i;

const failures = [];
const warnings = [];

function fail(file, message) {
    failures.push(`${file}: ${message}`);
}

function warn(file, message) {
    warnings.push(`${file}: ${message}`);
}

function anchorValues(html, attribute) {
    const pattern = new RegExp(`<a\\b[^>]*\\b${attribute}\\s*=\\s*["']([^"']+)["'][^>]*>`, 'gi');
    return [...html.matchAll(pattern)].map((match) => match[1].trim());
}

function metaValues(html, attribute, value) {
    const pattern = new RegExp(`<meta\\b[^>]+${attribute}=["']${value}["'][^>]*\\bcontent=["']([^"']*)["']`, 'i');
    const reversePattern = new RegExp(`<meta\\b[^>]+\\bcontent=["']([^"']*)["'][^>]+${attribute}=["']${value}["']`, 'i');
    return [html.match(pattern)?.[1], html.match(reversePattern)?.[1]].filter(Boolean);
}

function countMatches(html, pattern) {
    return [...html.matchAll(pattern)].length;
}

function decodeHtml(value) {
    return value
        .replaceAll('&amp;', '&')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'")
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>');
}

function isExcludedPage(html) {
    return /<meta\b[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html)
        || /<meta\b[^>]+http-equiv=["']refresh["']/i.test(html);
}

function validateMeta(file, html) {
    if (isExcludedPage(html)) return;

    const titles = [...html.matchAll(/<title\b[^>]*>([^<]*)<\/title>/gi)].map((match) => decodeHtml(match[1].trim()));
    const descriptions = metaValues(html, 'name', 'description');
    const canonicals = [...html.matchAll(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi)];

    if (titles.length !== 1 || !titles[0]) fail(file, `title trebuie să existe o singură dată (găsite: ${titles.length})`);
    else if (titles[0].length > MAX_TITLE_LENGTH) fail(file, `title are ${titles[0].length} caractere; maxim ${MAX_TITLE_LENGTH}`);

    if (descriptions.length !== 1 || !descriptions[0]) fail(file, `meta description trebuie să existe o singură dată (găsite: ${descriptions.length})`);
    else if (descriptions[0].length > MAX_DESCRIPTION_LENGTH) fail(file, `description are ${descriptions[0].length} caractere; maxim ${MAX_DESCRIPTION_LENGTH}`);

    if (canonicals.length !== 1) fail(file, `canonical trebuie să existe o singură dată (găsite: ${canonicals.length})`);
    else if (!/href=["']https:\/\//i.test(canonicals[0][0])) fail(file, 'canonical nu este absolut HTTPS');

    const h1Count = countMatches(html, /<h1\b[^>]*>/gi);
    if (h1Count !== 1) fail(file, `pagina trebuie să aibă exact un H1 (găsite: ${h1Count})`);

    for (const property of REQUIRED_OPEN_GRAPH) {
        if (metaValues(html, 'property', property).length !== 1) fail(file, `lipsește sau este duplicat ${property}`);
    }
    for (const name of REQUIRED_TWITTER) {
        if (metaValues(html, 'name', name).length !== 1) fail(file, `lipsește sau este duplicat ${name}`);
    }
}

function validateLinksAndImages(file, html) {
    const hrefs = anchorValues(html, 'href');
    for (const href of hrefs) {
        if (!href.startsWith('/') || SKIP_INTERNAL_HREF.test(href) || href.startsWith('//')) continue;
        const path = href.split(/[?#]/, 1)[0];
        if (path && path !== '/' && !path.endsWith('/')) fail(file, `link intern fără trailing slash: ${href}`);
    }

    const images = [...html.matchAll(/<img\b[^>]*>/gi)];
    for (const image of images) {
        const alt = image[0].match(/\balt=["']([^"']*)["']/i)?.[1].trim();
        if (alt === undefined || !alt) fail(file, 'imagine fără atribut alt completat');
    }
}

async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) files.push(...await walk(path));
        else if (extname(entry.name).toLowerCase() === '.html') files.push(path);
    }
    return files;
}

if (!existsSync(DIST_DIR)) {
    console.error(`Lipsește ${DIST_DIR}. Rulează mai întâi npm run build.`);
    process.exit(2);
}

const files = await walk(DIST_DIR);
for (const path of files) {
    const file = relative(DIST_DIR, path).replaceAll('\\', '/');
    const html = await readFile(path, 'utf8');
    if (file === 'admin/index.html' || file.startsWith('admin/')) continue;
    validateMeta(file, html);
    validateLinksAndImages(file, html);
}

const robotsPath = 'public/robots.txt';
if (existsSync(robotsPath)) {
    const robots = await readFile(robotsPath, 'utf8');
    if (!robots.includes('Sitemap:')) warn('public/robots.txt', 'nu conține o linie Sitemap');
} else {
    fail('public/robots.txt', 'fișierul lipsește');
}

console.log(`\nSEO audit local: ${files.length} pagini HTML verificate`);
for (const message of failures) console.log(`[FAIL] ${message}`);
for (const message of warnings) console.log(`[WARN] ${message}`);
console.log(`\nRezultat: ${failures.length} FAIL | ${warnings.length} WARN`);
process.exit(failures.length > 0 ? 1 : 0);