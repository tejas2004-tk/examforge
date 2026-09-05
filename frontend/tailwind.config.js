/** @type {import('tailwindcss').Config} */

// Every colour resolves through a CSS custom property holding a bare "R G B"
// triplet, so a single :root / .dark swap in index.css re-themes the whole app
// and Tailwind opacity modifiers (bg-surface/60) keep working.
const token = (name) => ({ opacityValue }) =>
  opacityValue === undefined
    ? `rgb(var(--${name}))`
    : `rgb(var(--${name}) / ${opacityValue})`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        surface: token('surface'),
        'surface-raised': token('surface-raised'),
        'surface-sunken': token('surface-sunken'),
        line: token('line'),
        'line-strong': token('line-strong'),
        panel: token('panel'),
        'panel-ink': token('panel-ink'),
        ink: token('ink'),
        'ink-muted': token('ink-muted'),
        'ink-subtle': token('ink-subtle'),
        accent: {
          DEFAULT: token('accent'),
          hover: token('accent-hover'),
          soft: token('accent-soft'),
          ink: token('accent-ink'),
          on: token('on-accent'),
        },
        positive: {
          DEFAULT: token('positive'),
          soft: token('positive-soft'),
          ink: token('positive-ink'),
        },
        caution: {
          DEFAULT: token('caution'),
          soft: token('caution-soft'),
          ink: token('caution-ink'),
        },
        critical: {
          DEFAULT: token('critical'),
          soft: token('critical-soft'),
          ink: token('critical-ink'),
          on: token('on-critical'),
        },
        info: { DEFAULT: token('info'), soft: token('info-soft'), ink: token('info-ink') },
      },
      fontFamily: {
        sans: [
          'IBM Plex Sans',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Sans',
          'sans-serif',
        ],
        mono: [
          'IBM Plex Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'Liberation Mono',
          'monospace',
        ],
      },
      fontSize: {
        // Display sizes carry their own tracking; Tailwind's defaults read loose
        // at scale and this build leans editorial rather than airy.
        'display-xl': ['2.75rem', { lineHeight: '3rem', letterSpacing: '-0.03em', fontWeight: '600' }],
        'display-lg': ['2.125rem', { lineHeight: '2.4rem', letterSpacing: '-0.025em', fontWeight: '600' }],
        display: ['1.625rem', { lineHeight: '2rem', letterSpacing: '-0.02em', fontWeight: '600' }],
        title: ['1.0625rem', { lineHeight: '1.5rem', letterSpacing: '-0.011em', fontWeight: '600' }],
        eyebrow: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.08em', fontWeight: '600' }],
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.375rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        // Two low-alpha layers read as depth; one large blur reads as haze.
        card: '0 1px 1px 0 rgb(var(--shadow) / 0.04), 0 1px 3px -1px rgb(var(--shadow) / 0.06)',
        raised: '0 1px 2px 0 rgb(var(--shadow) / 0.06), 0 6px 14px -6px rgb(var(--shadow) / 0.10)',
        overlay: '0 4px 10px -4px rgb(var(--shadow) / 0.14), 0 18px 40px -12px rgb(var(--shadow) / 0.24)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in': { from: { opacity: '0', transform: 'translateX(10px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-left': { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.16s ease-out both',
        'fade-in': 'fade-in 0.14s ease-out both',
        'slide-in': 'slide-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-left': 'slide-left 0.22s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};
