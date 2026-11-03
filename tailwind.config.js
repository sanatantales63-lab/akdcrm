/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      spacing: {
        5.5: '1.375rem',
        8.5: '2.125rem',
        15: '3.75rem',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Manrope', 'Inter', 'sans-serif'],
      },
      colors: {
        akd: {
          bg: '#F8FAFC',
          surface: '#FFFFFF',
          text: '#0F172A',
          muted: '#64748B',
          border: '#E2E8F0',
          indigo: {
            DEFAULT: '#5448ED',
            hover: '#4338CA',
            light: '#6366F1',
            subtle: '#EEF2FF',
            border: '#C7D2FE',
          },
          gold: {
            DEFAULT: '#D97706',
            light: '#F59E0B',
            dark: '#B45309',
            subtle: '#FFFBEB',
            border: '#FDE68A',
          },
          charcoal: {
            DEFAULT: '#0F172A',
            deep: '#020617',
            soft: '#1E293B',
          },
          success: {
            DEFAULT: '#10B981',
            bg: '#ECFDF5',
            border: '#A7F3D0',
          },
          warning: {
            DEFAULT: '#F59E0B',
            bg: '#FFFBEB',
            border: '#FDE68A',
          },
          danger: {
            DEFAULT: '#EF4444',
            bg: '#FEF2F2',
            border: '#FECACA',
          },
        },
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(16, 24, 40, 0.04)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.03), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
        'card-hover': '0 4px 12px 0 rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        elevated: '0 10px 25px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.03)',
        dropdown: '0 12px 32px rgba(15, 23, 42, 0.10), 0 2px 6px rgba(15, 23, 42, 0.04)',
        primary: '0 2px 8px -1px rgba(84, 72, 237, 0.35)',
      },
    },
  },
  plugins: [],
};
