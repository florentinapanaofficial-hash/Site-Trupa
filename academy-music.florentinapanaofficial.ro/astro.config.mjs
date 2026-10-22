import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

const env = loadEnv(process.env.NODE_ENV || 'production', fileURLToPath(new URL('.', import.meta.url)), 'VITE_');

export default defineConfig({
    site: 'https://academy-music.florentinapanaofficial.ro',
    output: 'server',
    adapter: cloudflare({ imageService: 'compile' }),
    session: false,
    server: { host: '0.0.0.0', port: 4180 },
    trailingSlash: 'always',
    security: {
        allowedDomains: [
            { hostname: 'academy-music.florentinapanaofficial.ro' },
            { hostname: 'localhost' },
            { hostname: '127.0.0.1' },
        ],
    },
    integrations: [react(), mdx()],
    vite: {
        resolve: {
            alias: [{ find: /^node-fetch$/, replacement: fileURLToPath(new URL('./src/lib/native-fetch.js', import.meta.url)) }],
        },
        define: Object.fromEntries(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_SIGNED_URL_TTL'].map((key) => [`import.meta.env.${key}`, JSON.stringify(env[key] || process.env[key] || '')])),
        plugins: [tailwindcss()],
        css: { postcss: { plugins: [] } },
        build: {
            rollupOptions: {
                output: {
                    manualChunks(moduleId) {
                        if (moduleId.includes('pdfjs-dist')) return 'pdfjs';
                        if (moduleId.includes('@supabase/')) return 'supabase';
                    }
                }
            }
        },
    },
});