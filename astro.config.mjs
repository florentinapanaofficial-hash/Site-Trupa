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
        `${siteUrl}/comunitatea-noastra/`,
        `${siteUrl}/momente-cu-mirii/`,
      ],
      filter: (page) => {
        // Exclude pagina de redirect /comunitate/ (301 → /comunitatea-noastra/)
        const url = new URL(page);
        if (url.pathname === '/comunitate/') return false;
        // Păstrează doar versiunea cu trailing slash
        return page.endsWith('/');
      },
    }),
  ],
});

