import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';

const siteUrl = process.env.SITE_URL || 'https://www.florentinapanaofficial.ro';

export default defineConfig({
  site: siteUrl,
  devToolbar: { enabled: false },
  security: {
    checkOrigin: false,
  },
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,
  // Dezactivăm prefetch-ul global, deoarece site-ul este static și JS-ul de navigare
  // adăuga lanțuri critice inutile la pagina de pornire. Prefetch-ul poate fi reactivat
  // doar pentru secțiuni cu trafic explicit și fără impact pe LCP.
  prefetch: false,
  build: {
    inlineStylesheets: 'always',
  },
  vite: {
    build: {
      cssMinify: 'lightningcss',
      minify: 'esbuild',
    },
  },
  adapter: node({
    mode: 'middleware',
  }),
  integrations: [
    sitemap({
      customPages: [
        `${siteUrl}/comunitate/`,
        `${siteUrl}/momente-cu-mirii/`,
        `${siteUrl}/membri/`,
        `${siteUrl}/aparitii-tv/`,
        `${siteUrl}/shorts/`,
        `${siteUrl}/vlog/`,
        `${siteUrl}/cauti-formatie-nunta/`,
        `${siteUrl}/formatie-nunta/curtea-de-arges/`,
        `${siteUrl}/formatie-nunta/ramnicu-valcea/`,
        `${siteUrl}/formatie-nunta/valcea/`,
      ],
      filter: (page) => {
        // Exclude pagina de redirect /comunitatea-noastra/ (301 → /comunitate/)
        const url = new URL(page);
        if (url.pathname === '/comunitatea-noastra/') return false;
        // Exclude pagina eliminata /colaboratori/tambal/ (redirect + noindex)
        if (url.pathname === '/colaboratori/tambal/') return false;
        // Exclude /live-preview/ — pagină de campanie (teaser 60s), nu trebuie indexată
        if (url.pathname === '/live-preview/') return false;
        // Exclude /mini-tv/ — redirect 301 → /live/ (pagina a fost integrată)
        if (url.pathname === '/mini-tv/') return false;
        // Exclude /blog/ — redirect 301 → /publicatii/ (Ahrefs: 3XX redirect in sitemap)
        if (url.pathname === '/blog/') return false;
        // Exclude vechiul URL Early Booking, redirectat 301 către versiunea 2027.
        if (url.pathname === '/publicatii/pret-formatie-nunta-2026/') return false;
        // Exclude /youtube-redirect/ — pagină intermediară noindex, fără linkuri interne (Ahrefs: canonical fără linkuri)
        if (url.pathname === '/youtube-redirect/') return false;
        // Păstrează doar versiunea cu trailing slash
        return page.endsWith('/');
      },
    }),
  ],
});

