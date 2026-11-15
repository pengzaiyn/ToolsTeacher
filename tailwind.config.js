/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        brand: {
          red: '#C8102E',
          redHover: '#A30D25',
          redSoft: '#FDF2F4',
          navy: '#1A365D',
          navyHover: '#132846',
          navySoft: '#EEF2F7',
        },
        surface: {
          page: '#F8FAFC',
          card: '#FFFFFF',
          subtle: '#F1F5F9',
        },
        ink: {
          primary: '#0F172A',
          secondary: '#475569',
          muted: '#64748B',
        },
        line: {
          DEFAULT: '#E2E8F0',
          strong: '#CBD5E1',
        },
        status: {
          successBg: '#ECFDF5',
          successText: '#065F46',
          successBorder: '#A7F3D0',
          warningBg: '#FFFBEB',
          warningText: '#92400E',
          warningBorder: '#FDE68A',
          dangerBg: '#FEF2F2',
          dangerText: '#991B1B',
          dangerBorder: '#FECACA',
        },
      },
    },
  },
  plugins: [],
};

