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
          bg: '#090B10',
          surface: '#111622',
          surfaceElevated: '#161D2C',
          surfaceMuted: '#0D111A',
          border: '#1E2638',
          borderStrong: '#2D3952',
          accent: '#2563EB',
          accentHover: '#1D4ED8',
          accentSubtle: 'rgba(37, 99, 235, 0.12)',
          success: '#10B981',
          successSubtle: 'rgba(16, 185, 129, 0.12)',
          danger: '#F43F5E',
          dangerSubtle: 'rgba(244, 63, 94, 0.12)',
          warning: '#F59E0B',
          warningSubtle: 'rgba(245, 158, 11, 0.12)',
          devnet: '#A855F7',
          devnetSubtle: 'rgba(168, 85, 247, 0.12)',
          text: '#F1F5F9',
          textMuted: '#94A3B8',
          textSubtle: '#64748B',
          // Backwards compatibility tokens
          card: '#111622',
          cardBorder: '#1E2638',
          pass: '#10B981',
          passBg: 'rgba(16, 185, 129, 0.12)',
          fail: '#F43F5E',
          failBg: 'rgba(244, 63, 94, 0.12)',
          muted: '#64748B',
        },
      },
      borderRadius: {
        DEFAULT: '0.375rem', // 6px
        sm: '0.25rem',       // 4px
        md: '0.375rem',      // 6px
        lg: '0.5rem',        // 8px (structural cards)
        xl: '0.75rem',       // 12px (major panels)
        '2xl': '0.75rem',    // architectural cap (no giant rounding)
        full: '9999px',      // circular status indicators only
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
