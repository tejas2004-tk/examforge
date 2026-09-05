import { useCallback, useEffect, useRef, useState } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function focusableWithin(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * Keeps Tab and Shift+Tab inside `containerRef` while `active`, moves focus in
 * on open and restores it to the previously focused element on close. Without
 * the restore step, dismissing a dialog drops focus onto <body> and keyboard
 * users lose their place in the page behind it.
 */
export function useFocusTrap(containerRef, active, { initialFocusRef } = {}) {
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    restoreRef.current = document.activeElement;

    const container = containerRef.current;
    const focusFirst = () => {
      const target =
        initialFocusRef?.current ?? focusableWithin(container)[0] ?? container;
      target?.focus?.({ preventScroll: true });
    };
    // A frame of delay lets the portal mount before focus is moved.
    const raf = requestAnimationFrame(focusFirst);

    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return;
      const items = focusableWithin(containerRef.current);
      if (items.length === 0) {
        event.preventDefault();
        containerRef.current?.focus?.();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement;
      if (event.shiftKey && (activeEl === first || !containerRef.current?.contains(activeEl))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeEl === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown, true);
      const restore = restoreRef.current;
      if (restore && document.contains(restore)) restore.focus?.({ preventScroll: true });
    };
  }, [active, containerRef, initialFocusRef]);
}

/** Locks background scroll while `active`, compensating for the scrollbar. */
export function useScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const gap = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [active]);
}

export function useEscapeKey(active, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') handlerRef.current?.(event);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active]);
}

export function useClickOutside(ref, active, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active) return undefined;
    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) handlerRef.current?.(event);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [ref, active]);
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);

  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return undefined;
    const onChange = (event) => setMatches(event.matches);
    setMatches(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** State mirrored into localStorage, tolerant of storage being unavailable. */
export function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initialValue : JSON.parse(raw);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Persisting is best-effort; the in-memory value still drives the UI.
    }
  }, [key, value]);

  return [value, setValue];
}

export function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

/** True while the tab is foregrounded, so pollers can stand down when hidden. */
export function usePageVisible() {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');

  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  return visible;
}

/**
 * Roving focus for a list of options driven from a single input (command
 * palette, menus): arrow keys move a virtual cursor rather than DOM focus.
 */
export function useRovingIndex(length, { loop = true } = {}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex((current) => (length === 0 ? 0 : Math.min(current, length - 1)));
  }, [length]);

  const move = useCallback(
    (delta) => {
      setIndex((current) => {
        if (length === 0) return 0;
        const next = current + delta;
        if (loop) return (next + length) % length;
        return Math.min(Math.max(next, 0), length - 1);
      });
    },
    [length, loop],
  );

  return { index, setIndex, move };
}
