import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    // Fără asta, Vite urcă în arbore și preia `postcss.config.mjs` al site-ului principal (Tailwind 3).
    css: {
        postcss: { plugins: [] },
    },
    server: {
        port: 5180,
        strictPort: false,
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    // pdf.js depășește 300 kB; separat, nu blochează primul render.
                    pdfjs: ['pdfjs-dist'],
                    supabase: ['@supabase/supabase-js'],
                },
            },
        },
    },
});
