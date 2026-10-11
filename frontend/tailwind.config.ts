import type { Config } from 'tailwindcss';
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: { extend: { colors: { brand: { DEFAULT: '#0ea5e9', accent: '#10b981' } } } },
  plugins: []
} satisfies Config;