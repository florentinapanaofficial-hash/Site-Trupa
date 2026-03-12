/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,vue,svelte}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
      },

      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },

      animation: {
        'fade-up': 'fade-up 600ms ease-out both',
        'fade-up-delayed': 'fade-up 800ms ease-out both',
      },

      colors: {
        pastel: {
          pink: '#F9D7E8',
          blue: '#CDE9FF',
          purple: '#E0D7FF',
          mint: '#D6F5EA',
          cream: '#FFF4E0',
        },

        electric: '#7C3AED',
        neon: '#3B82F6',
        hotpink: '#EC4899',
        cyanglow: '#22D3EE',
        night: '#0F0F0F',
        graphite: '#1F1F1F',
      },

      boxShadow: {
        soft: '0 18px 45px rgba(15, 23, 42, 0.08)',
        neon: '0 0 20px #3B82F6',
      },
    },
  },
  plugins: [],
};