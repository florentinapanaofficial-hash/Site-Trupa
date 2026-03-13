/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,vue,svelte}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Oswald', 'sans-serif'],
      },

      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },

      animation: {
        'fade-up': 'fade-up 600ms ease-out both',
        'fade-up-delayed': 'fade-up 900ms ease-out both',
      },

      colors: {
        /* ── Fundaluri ── */
        ink: '#0C080F',   /* negru-scenă */
        night: '#170F1C',   /* bg-mid */
        graphite: '#221629',   /* suprafețe carduri */

        /* ── Accente ── */
        electric: '#F5A623',   /* auriu scenă — accent principal */
        gold: '#F5A623',
        'gold-light': '#FFD166',
        rose: '#E8325A',   /* roșu scenă */
        teal: '#0BBCD6',   /* cyan spotlighturi */
        cyanglow: '#0BBCD6',

        /* ── Aliasuri de compatibilitate ── */
        neon: '#3B82F6',
        hotpink: '#E8325A',
      },

      boxShadow: {
        soft: '0 18px 45px rgba(0, 0, 0, 0.35)',
        neon: '0 0 22px rgba(245, 166, 35, 0.45)',
        gold: '0 0 26px rgba(245, 166, 35, 0.50)',
        rose: '0 0 22px rgba(232, 50, 90, 0.40)',
      },
    },
  },
  plugins: [],
};