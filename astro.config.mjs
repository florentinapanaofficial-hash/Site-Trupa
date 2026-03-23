import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

const siteUrl = process.env.SITE_URL || 'https://www.florentinapanaofficial.ro';

export default defineConfig({
  site: siteUrl,
  devToolbar: { enabled: false },
  output: 'hybrid',
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [
    tailwind({
      config: {
        applyBaseStyles: false,
      },
    }),
    sitemap({
      customPages: [
        `${siteUrl}/comunitatea-noastra`,
        `${siteUrl}/momente-cu-mirii`,
      ],
    }),
  ],
});

