import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

const env = loadEnv(process.env.NODE_ENV || 'production', fileURLToPath(new URL('.', import.meta.url)), 'VITE_');
const serverEnv = { ...loadEnv(process.env.NODE_ENV || 'production', fileURLToPath(new URL('..', import.meta.url)), ''), ...loadEnv(process.env.NODE_ENV || 'production', fileURLToPath(new URL('.', import.meta.url)), '') };
for (const key of ['GOOGLE_CREDENTIALS', 'GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_DRIVE_FOLDER_ID', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
    if (!process.env[key] && serverEnv[key]) process.env[key] = serverEnv[key];
}

export default defineConfig({
    site: 'https://academy-music.florentinapanaofficial.ro',
    output: 'server',
    adapter: node({ mode: 'standalone' }),
    server: { host: '0.0.0.0', port: 4180 },
    trailingSlash: 'always',
    security: {
        allowedDomains: [
            { hostname: 'academy-music.florentinapanaofficial.ro' },
            { hostname: 'localhost' },
            { hostname: '127.0.0.1' },
            ...(serverEnv.ACADEMY_PUBLIC_ORIGIN ? [{ hostname: new URL(serverEnv.ACADEMY_PUBLIC_ORIGIN).hostname }] : []),
        ],
    },
    integrations: [react(), mdx()],
    vite: {
        ssr: { external: ['googleapis', '@supabase/supabase-js'] },
        define: Object.fromEntries(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_SIGNED_URL_TTL'].map((key) => [`import.meta.env.${key}`, JSON.stringify(process.env[key] || env[key] || '')])),
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