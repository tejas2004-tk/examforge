/**
 * Display formatters shared by every page.
 *
 * These lean on Intl rather than a date library: the app only ever renders
 * absolute dates, coarse relative times, durations and percentages, all of
 * which Intl covers in every browser the build targets.
 */

const DEFAULT_LOCALE = undefined; // undefined lets Intl use the browser locale.

/** Anything the API might hand us for a timestamp, coerced to a valid Date. */
function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function memoFormatter(factory) {
  const cache = new Map();
  return (key, ...args) => {
    if (!cache.has(key)) cache.set(key, factory(...args));
    return cache.get(key);
  };
}

const dateFormatter = memoFormatter(
  (locale, options) => new Intl.DateTimeFormat(locale ?? DEFAULT_LOCALE, options),
);

/** "12 Mar 2025". Returns the placeholder for null/invalid input. */
export function formatDate(value, { locale, placeholder = '—', ...options } = {}) {
  const date = toDate(value);
  if (!date) return placeholder;
  const opts = { day: '2-digit', month: 'short', year: 'numeric', ...options };
  return dateFormatter(`d:${locale}:${JSON.stringify(opts)}`, locale, opts).format(date);
}

/** "12 Mar 2025, 14:05". */
export function formatDateTime(value, { locale, placeholder = '—', ...options } = {}) {
  const date = toDate(value);
  if (!date) return placeholder;
  const opts = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };
  return dateFormatter(`dt:${locale}:${JSON.stringify(opts)}`, locale, opts).format(date);
}

const RELATIVE_STEPS = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
];

const relativeFormatter = memoFormatter(
  (locale) => new Intl.RelativeTimeFormat(locale ?? DEFAULT_LOCALE, { numeric: 'auto' }),
);

/** "3 hours ago" / "in 2 days". Anything under a minute reads as "just now". */
export function formatRelative(value, { locale, now = Date.now(), placeholder = '—' } = {}) {
  const date = toDate(value);
  if (!date) return placeholder;
  const deltaSeconds = (date.getTime() - now) / 1000;
  const magnitude = Math.abs(deltaSeconds);
  if (magnitude < 45) return 'just now';

  const rtf = relativeFormatter(`r:${locale}`, locale);
  for (const [unit, seconds] of RELATIVE_STEPS) {
    if (magnitude >= seconds) {
      return rtf.format(Math.round(deltaSeconds / seconds), unit);
    }
  }
  return rtf.format(Math.round(deltaSeconds / 60), 'minute');
}

/**
 * Seconds to a compact duration: "45s", "12m 30s", "1h 05m".
 * `style: 'clock'` gives "01:12:30" for timers and elapsed-time columns.
 */
export function formatDuration(seconds, { style = 'compact', placeholder = '—' } = {}) {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) {
    return placeholder;
  }
  const total = Math.max(0, Math.round(Number(seconds)));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (style === 'clock') {
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return s > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${m}m`;
  return `${s}s`;
}

const numberFormatter = memoFormatter(
  (locale, options) => new Intl.NumberFormat(locale ?? DEFAULT_LOCALE, options),
);

/** Thousands-separated integer or fixed-decimal number. */
export function formatNumber(value, { locale, decimals, compact = false, placeholder = '—' } = {}) {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) return placeholder;
  const opts = {
    ...(decimals === undefined
      ? {}
      : { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
    ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
  };
  return numberFormatter(`n:${locale}:${JSON.stringify(opts)}`, locale, opts).format(n);
}

/**
 * Percentages arrive from the API already scaled 0-100, so the default treats
 * the input that way; pass `fromFraction` for a 0-1 ratio.
 */
export function formatPercent(
  value,
  { locale, decimals = 0, fromFraction = false, placeholder = '—' } = {},
) {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) return placeholder;
  const opts = {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  };
  return numberFormatter(`p:${locale}:${JSON.stringify(opts)}`, locale, opts).format(
    fromFraction ? n : n / 100,
  );
}

/** Up to two initials from a display name, for avatars and dense lists. */
export function initials(name, { max = 2 } = {}) {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, max)
    .map((part) => part[0].toUpperCase())
    .join('');
}
