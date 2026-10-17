/**
 * Submit the public sitemap to Google Search Console without calling Indexing API.
 * Run manually after the deployed sitemap is reachable.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const DEFAULT_SITE_URL = 'https://www.florentinapanaofficial.ro';
const DRY_RUN = process.argv.includes('--dry-run');

function loadEnv() {
    const envPath = join(ROOT, '.env');
    if (!existsSync(envPath)) return;

    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const separator = trimmed.indexOf('=');
        if (separator < 0) continue;

        const key = trimmed.slice(0, separator).trim();
        let value = trimmed.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
    }
}

function getPropertyCandidates(siteUrl) {
    const hostname = new URL(siteUrl).hostname;
    const bareDomain = hostname.replace(/^www\./, '');
    const withoutWww = siteUrl.replace('://www.', '://');

    return [...new Set([
        siteUrl,
        `${siteUrl}/`,
        withoutWww,
        `${withoutWww}/`,
        `sc-domain:${bareDomain}`,
    ])];
}

async function verifyPublicSitemap(sitemapUrl) {
    const response = await fetch(sitemapUrl, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
        throw new Error(`Sitemap-ul public a răspuns HTTP ${response.status}: ${sitemapUrl}`);
    }

    const xml = await response.text();
    if (!/<(?:sitemapindex|urlset)(?:\s|>)/i.test(xml)) {
        throw new Error(`Răspunsul nu pare să fie un sitemap XML valid: ${sitemapUrl}`);
    }
}

async function main() {
    loadEnv();

    const siteUrl = (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
    const sitemapUrl = `${siteUrl}/sitemap-index.xml`;
    const propertyCandidates = getPropertyCandidates(siteUrl);

    console.log(`Sitemap: ${sitemapUrl}`);
    if (DRY_RUN) {
        console.log('Dry-run: nu se verifică rețeaua și nu se trimite nimic.');
        console.log(`Proprietăți Search Console încercate: ${propertyCandidates.join(', ')}`);
        return;
    }

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!clientEmail || !privateKey) {
        throw new Error('Lipsesc GOOGLE_CLIENT_EMAIL sau GOOGLE_PRIVATE_KEY din environment/.env.');
    }

    await verifyPublicSitemap(sitemapUrl);

    const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/webmasters'],
    });
    const searchConsole = google.searchconsole({ version: 'v1', auth });
    let lastError = 'Service account-ul nu are acces la proprietățile Search Console testate.';

    for (const property of propertyCandidates) {
        try {
            await searchConsole.sitemaps.submit({ siteUrl: property, feedpath: sitemapUrl });
            console.log(`Sitemap trimis la Google Search Console pentru proprietatea: ${property}`);
            return;
        } catch (error) {
            lastError = error.response?.data?.error?.message || error.message;
        }
    }

    throw new Error(`Trimiterea sitemap-ului a eșuat: ${lastError}`);
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});