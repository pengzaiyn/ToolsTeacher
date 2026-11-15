/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        brand: {
          red: 'rgb(var(--color-brand-red) / <alpha-value>)',
          redHover: 'rgb(var(--color-brand-red-hover) / <alpha-value>)',
          redSoft: 'rgb(var(--color-brand-red-soft) / <alpha-value>)',
          redText: 'rgb(var(--color-brand-red-accent) / <alpha-value>)',
          navy: 'rgb(var(--color-brand-navy) / <alpha-value>)',
          navyHover: 'rgb(var(--color-brand-navy-hover) / <alpha-value>)',
          navySoft: 'rgb(var(--color-brand-navy-soft) / <alpha-value>)',
          navyText: 'rgb(var(--color-brand-navy-accent) / <alpha-value>)',
        },
        surface: {
          page: 'rgb(var(--color-surface-page) / <alpha-value>)',
          card: 'rgb(var(--color-surface-card) / <alpha-value>)',
          subtle: 'rgb(var(--color-surface-subtle) / <alpha-value>)',
          bright: 'rgb(var(--color-surface-bright) / <alpha-value>)',
        },
        ink: {
          primary: 'rgb(var(--color-ink-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-ink-secondary) / <alpha-value>)',
          muted: 'rgb(var(--color-ink-muted) / <alpha-value>)',
          card: 'rgb(var(--color-ink-card) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--color-line) / <alpha-value>)',
          strong: 'rgb(var(--color-line-strong) / <alpha-value>)',
        },
        status: {
          successBg: 'rgb(var(--color-status-success-bg) / <alpha-value>)',
          successText: 'rgb(var(--color-status-success-text) / <alpha-value>)',
          successBorder: 'rgb(var(--color-status-success-border) / <alpha-value>)',
          warningBg: 'rgb(var(--color-status-warning-bg) / <alpha-value>)',
          warningText: 'rgb(var(--color-status-warning-text) / <alpha-value>)',
          warningBorder: 'rgb(var(--color-status-warning-border) / <alpha-value>)',
          dangerBg: 'rgb(var(--color-status-danger-bg) / <alpha-value>)',
          dangerText: 'rgb(var(--color-status-danger-text) / <alpha-value>)',
          dangerBorder: 'rgb(var(--color-status-danger-border) / <alpha-value>)',
          dangerSolid: 'rgb(var(--color-status-danger-solid) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};