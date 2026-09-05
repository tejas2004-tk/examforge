import { useEffect, useState } from 'react';

const TOKENS = [
  'accent',
  'accent-hover',
  'positive',
  'caution',
  'critical',
  'info',
  'ink',
  'ink-muted',
  'ink-subtle',
  'line',
  'line-strong',
  'surface',
  'surface-raised',
  'canvas',
];

const read = () => {
  const out = {};
  if (typeof window === 'undefined') return out;
  const styles = getComputedStyle(document.documentElement);
  for (const name of TOKENS) {
    const triplet = styles.getPropertyValue(`--${name}`).trim();
    // Tokens are bare "R G B" triplets so Tailwind can apply opacity modifiers.
    out[name] = triplet ? `rgb(${triplet})` : 'currentColor';
  }
  return out;
};

/**
 * Recharts needs concrete colour strings, which would otherwise freeze the charts in
 * one theme. Reading the CSS custom properties and re-reading them when the theme
 * attribute flips keeps every series on the same palette as the rest of the page.
 */
export function useChartColors() {
  const [colors, setColors] = useState(read);

  useEffect(() => {
    const refresh = () => setColors(read());
    refresh();

    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', refresh);

    return () => {
      observer.disconnect();
      media.removeEventListener('change', refresh);
    };
  }, []);

  return colors;
}

/** Ordered series palette; distinguishable in both themes and safe for six-plus series. */
export const seriesColors = (c) => [c.accent, c.info, c.caution, c.positive, c.critical, c['ink-muted']];

export const axisProps = (c) => ({
  stroke: c['ink-subtle'],
  tick: { fill: c['ink-muted'], fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: c.line },
});

export const tooltipProps = (c) => ({
  cursor: { fill: c.line, fillOpacity: 0.4 },
  contentStyle: {
    background: c['surface-raised'],
    border: `1px solid ${c.line}`,
    borderRadius: 6,
    color: c.ink,
    fontSize: 12,
    boxShadow: 'none',
  },
  labelStyle: { color: c['ink-muted'], marginBottom: 2 },
  itemStyle: { color: c.ink },
});
