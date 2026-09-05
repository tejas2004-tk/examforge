import { useCallback, useEffect, useState } from 'react';

const THEME_KEY = 'examforge-theme';
const DENSITY_KEY = 'examforge-density';

function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    // Storage throws in private mode; callers fall back to a default.
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Persisting is best-effort; the UI still reflects the current choice.
  }
}

/** Resolve the boot theme: explicit choice wins, otherwise follow the OS. */
export function resolveInitialTheme() {
  const stored = readStored(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveInitialDensity() {
  return readStored(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable';
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function applyDensity(density) {
  document.documentElement.setAttribute('data-density', density);
}

export function useTheme() {
  const [theme, setTheme] = useState(resolveInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    writeStored(THEME_KEY, theme);
  }, [theme]);

  // Track the OS only while the user has not made an explicit choice.
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;
    const onChange = (event) => {
      if (!readStored(THEME_KEY)) setTheme(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  return { theme, setTheme, toggle };
}

export function useDensity() {
  const [density, setDensity] = useState(resolveInitialDensity);

  useEffect(() => {
    applyDensity(density);
    writeStored(DENSITY_KEY, density);
  }, [density]);

  const toggle = useCallback(
    () => setDensity((d) => (d === 'compact' ? 'comfortable' : 'compact')),
    [],
  );

  return { density, setDensity, toggle };
}
