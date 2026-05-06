import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

const siteUrl = process.env.SITE_URL || 'https://www.florentinapanaofficial.ro';

export default defineConfig({
  site: siteUrl,
  devToolbar: { enabled: false },
  output: 'hybrid',
  trailingSlash: 'always',
  compressHTML: true,
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
    tailwind({
      config: {
        applyBaseStyles: false,
      },
    }),
    sitemap({
      customPages: [
        `${siteUrl}/comunitate/`,
        `${siteUrl}/momente-cu-mirii/`,
        `${siteUrl}/membri/`,
        `${siteUrl}/aparitii-tv/`,
        `${siteUrl}/formatie-nunta/curtea-de-arges/`,
      ],
      filter: (page) => {
        // Exclude pagina de redirect /comunitatea-noastra/ (301 → /comunitate/)
        const url = new URL(page);
        if (url.pathname === '/comunitatea-noastra/') return false;
        // Păstrează doar versiunea cu trailing slash
        return page.endsWith('/');
      },
    }),
  ],
});

