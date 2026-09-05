import { useEffect, useState } from 'react';

const STORAGE_KEY = 'examforge-theme';

/** Resolve the boot theme: explicit choice wins, otherwise follow the OS. */
export function resolveInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage can throw in private mode; fall through to the OS preference.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function useTheme() {
  const [theme, setTheme] = useState(resolveInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Persisting is best-effort; the UI still reflects the current choice.
    }
  }, [theme]);

  // Track the OS only while the user has not made an explicit choice.
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;
    const onChange = (event) => {
      let stored = null;
      try {
        stored = localStorage.getItem(STORAGE_KEY);
      } catch {
        stored = null;
      }
      if (!stored) setTheme(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return { theme, setTheme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) };
}
