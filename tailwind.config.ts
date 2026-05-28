import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        laboratory: {
          navy: '#0f2f57',
          blue: '#1f5f99',
          ink: '#172033',
          line: '#d9e2ec',
          panel: '#f4f7fa',
        },
      },
      boxShadow: {
        soft: '0 12px 32px rgba(15, 47, 87, 0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config;
