import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sentinel: {
          bg: '#090B10',
          card: '#121620',
          cardBorder: '#1E2638',
          accent: '#3B82F6',
          pass: '#10B981',
          passBg: 'rgba(16, 185, 129, 0.1)',
          fail: '#EF4444',
          failBg: 'rgba(239, 68, 68, 0.1)',
          warning: '#F59E0B',
          muted: '#6B7280',
          textMuted: '#9CA3AF',
        },
      },
    },
  },
  plugins: [],
};

export default config;
