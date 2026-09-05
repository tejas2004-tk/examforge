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
        },
        positive: { DEFAULT: token('positive'), soft: token('positive-soft'), ink: token('positive-ink') },
        caution: { DEFAULT: token('caution'), soft: token('caution-soft'), ink: token('caution-ink') },
        critical: { DEFAULT: token('critical'), soft: token('critical-soft'), ink: token('critical-ink') },
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'JetBrains Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Tightened tracking on display sizes; the defaults read loose at scale.
        'display-lg': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.025em', fontWeight: '680' }],
        display: ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '-0.02em', fontWeight: '660' }],
        title: ['1.125rem', { lineHeight: '1.6rem', letterSpacing: '-0.011em', fontWeight: '620' }],
        eyebrow: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.055em', fontWeight: '600' }],
      },
      borderRadius: { md: '0.5rem', lg: '0.625rem', xl: '0.875rem', '2xl': '1.125rem' },
      boxShadow: {
        // Layered, low-alpha shadows read as depth; a single large blur reads as haze.
        card: '0 1px 2px 0 rgb(var(--shadow) / 0.05), 0 1px 3px 0 rgb(var(--shadow) / 0.04)',
        raised: '0 2px 4px -1px rgb(var(--shadow) / 0.07), 0 6px 16px -4px rgb(var(--shadow) / 0.09)',
        overlay: '0 12px 32px -8px rgb(var(--shadow) / 0.22), 0 4px 12px -4px rgb(var(--shadow) / 0.12)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in': { from: { opacity: '0', transform: 'translateX(12px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'fade-up': 'fade-up 0.18s ease-out both',
        'slide-in': 'slide-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};
