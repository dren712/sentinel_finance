import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sentinel: {
          bg: '#080A0E',
          surface: '#0F131A',
          surfaceElevated: '#151A22',
          surfaceMuted: '#0B0E14',
          border: '#242B36',
          borderStrong: '#333D4D',
          accent: '#6EA8FF',
          accentHover: '#5A95EC',
          accentSubtle: 'rgba(110, 168, 255, 0.12)',
          success: '#45D39C',
          successSubtle: 'rgba(69, 211, 156, 0.12)',
          danger: '#FF5C6C',
          dangerSubtle: 'rgba(255, 92, 108, 0.12)',
          warning: '#E7A93B',
          warningSubtle: 'rgba(231, 169, 59, 0.12)',
          oracle: '#8B9BFF',
          oracleSubtle: 'rgba(139, 155, 255, 0.12)',
          text: '#F4F6F8',
          textMuted: '#8B95A3',
          textSubtle: '#5A6577',
          // Backwards compatibility tokens
          card: '#0F131A',
          cardBorder: '#242B36',
          pass: '#45D39C',
          passBg: 'rgba(69, 211, 156, 0.12)',
          fail: '#FF5C6C',
          failBg: 'rgba(255, 92, 108, 0.12)',
          muted: '#8B95A3',
        },
      },
      borderRadius: {
        'sharp-sm': '2px',
        'sharp': '4px',
        'sharp-md': '6px',
        'sharp-lg': '8px',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
