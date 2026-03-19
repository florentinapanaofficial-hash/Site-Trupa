import { readFileSync, existsSync } from 'fs';

const hp = readFileSync('dist/client/index.html', 'utf8');
const blog = readFileSync('dist/client/blog/din-culisele-unui-eveniment-live/index.html', 'utf8');
const vid = readFileSync('dist/client/video/muzica-populara-moment-live-adb9aa9cfly/index.html', 'utf8');
const rb = readFileSync('public/robots.txt', 'utf8');
const sax = readFileSync('dist/client/colaboratori/saxofon/index.html', 'utf8');
const tam = readFileSync('dist/client/colaboratori/tambal/index.html', 'utf8');
const con = readFileSync('dist/client/contact/index.html', 'utf8');
const cors = readFileSync('src/lib/cors.ts', 'utf8');
const com = readFileSync('src/pages/api/comentarii.ts', 'utf8');
const upl = readFileSync('src/pages/api/upload-photo.ts', 'utf8');

let pass = 0, fail = 0;
const t = (label, cond) => {
    cond ? pass++ : fail++;
    console.log((cond ? '[OK]  ' : '[FAIL]'), label);
};

console.log('\n=== 1) HOMEPAGE SEO ===');
t('title prezent', /<title>[^<]+<\/title>/.test(hp));
t('canonical https', hp.includes('rel="canonical" href="https://'));
t('og:type=website', hp.includes('og:type" content="website"'));
t('og:image absolut (https)', hp.includes('og:image" content="https://'));
t('og:image:width=1200', hp.includes('og:image:width" content="1200"'));
t('og:image:height=630', hp.includes('og:image:height" content="630"'));
t('og:locale=ro_RO', hp.includes('og:locale" content="ro_RO"'));
t('og:site_name', hp.includes('og:site_name'));
t('twitter:card', hp.includes('twitter:card'));
t('FAQPage JSON-LD', hp.includes('"FAQPage"'));
t('MusicGroup+LocalBusiness LD', hp.includes('MusicGroup') && hp.includes('LocalBusiness'));

console.log('\n=== 2) BLOG ARTICLE ===');
t('og:type=article', blog.includes('og:type" content="article"'));
t('article:published_time', blog.includes('article:published_time'));
t('article:author', blog.includes('article:author'));
t('JSON-LD @type Article', blog.includes('"Article"'));
t('Article publisher', blog.includes('"publisher"'));

console.log('\n=== 3) VIDEO PAGE ===');
t('og:type=video.other', vid.includes('og:type" content="video.other"'));
t('og:image=YouTube thumbnail', vid.includes('img.youtube.com'));
t('JSON-LD VideoObject', vid.includes('VideoObject'));
t('VideoObject embedUrl', vid.includes('embedUrl'));

console.log('\n=== 4) robots.txt ===');
t('Disallow /admin/', rb.includes('Disallow: /admin/'));
t('Disallow /api/', rb.includes('Disallow: /api/'));
t('Sitemap line', rb.includes('Sitemap:'));

console.log('\n=== 5) SITEMAP ===');
t('sitemap-index.xml present', existsSync('dist/client/sitemap-index.xml'));

console.log('\n=== 6) COLABORATORI — Person JSON-LD ===');
t('Person schema saxofon', sax.includes('"Person"'));
t('worksFor saxofon', sax.includes('worksFor'));
t('Person schema tambal', tam.includes('"Person"'));
t('worksFor tambal', tam.includes('worksFor'));

console.log('\n=== 7) CORS module ===');
t('checkOrigin exported', cors.includes('export function checkOrigin'));
t('CorsResult type exported', cors.includes('export type CorsResult'));
t('FALLBACK_ORIGIN hardcoded', cors.includes('florentinapanaofficial.ro'));
t('PUBLIC_SITE_URL read', cors.includes('PUBLIC_SITE_URL'));
t('PUBLIC_SITE_URL_WWW read', cors.includes('PUBLIC_SITE_URL_WWW'));
t('allowed:false branch', cors.includes('allowed: false'));

console.log('\n=== 8) API — CORS + OPTIONS (source) ===');
t('comentarii: checkOrigin import', com.includes("from '../../lib/cors.js'"));
t('comentarii: OPTIONS handler', com.includes('export const OPTIONS'));
t('comentarii: 403 cors block POST', com.includes("status: 403") && com.includes('Origin not allowed'));
t('comentarii: 403 cors block GET', (com.match(/403/g) || []).length >= 2);
t('comentarii: Vary: Origin', com.includes("'Vary': 'Origin'"));
t('comentarii: rate limit 429', com.includes('429'));
t('upload: checkOrigin import', upl.includes("from '../../lib/cors.js'"));
t('upload: OPTIONS handler', upl.includes('export const OPTIONS'));
t('upload: 403 cors block', upl.includes("status: 403"));
t('upload: rate limit 429', upl.includes('429'));
t('upload: MIME validation', upl.includes('ALLOWED_MIME_TYPES'));
t('upload: size limit 5MB', upl.includes('5 * 1024 * 1024'));

console.log('\n=== 9) GA4 events (contact.html + hoisted bundle) ===');
import { readdirSync } from 'fs';
import { join } from 'path';
const hoistedDir = 'dist/client/_astro';
const hoistedContent = readdirSync(hoistedDir)
    .filter(f => f.startsWith('hoisted') && f.endsWith('.js'))
    .map(f => readFileSync(join(hoistedDir, f), 'utf8'))
    .join('\n');
t('click_phone (html attr)', con.includes('click_phone'));
t('click_whatsapp (html attr)', con.includes('click_whatsapp'));
t('generate_lead (hoisted bundle)', hoistedContent.includes('generate_lead'));

console.log(`\n${'='.repeat(40)}`);
console.log(`TOTAL: ${pass} OK  |  ${fail} FAIL`);
console.log(fail === 0 ? '>>> VERDICT: READY <<<' : '>>> VERDICT: NOT READY <<<');
