import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';

const siteUrl = process.env.SITE_URL || 'https://www.florentinapanaofficial.ro';

export default defineConfig({
  site: siteUrl,
  devToolbar: { enabled: false },
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,
  // Prefetch-ul la hover păstrează navigarea rapidă după intenția explicită
  // a utilizatorului, fără să consume thread-ul principal la încărcarea mobilă.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
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
        // Exclude /youtube-redirect/ — pagină intermediară noindex, fără linkuri interne (Ahrefs: canonical fără linkuri)
        if (url.pathname === '/youtube-redirect/') return false;
        // Păstrează doar versiunea cu trailing slash
        return page.endsWith('/');
      },
    }),
  ],
});

