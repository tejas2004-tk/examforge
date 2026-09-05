import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Delays a fast-changing value so a search box does not fire a request per keystroke. */
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const coerce = (raw, fallback) => {
  if (raw === null) return fallback;
  if (typeof fallback === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }
  if (typeof fallback === 'boolean') return raw === 'true';
  return raw;
};

/**
 * Filter state kept in the query string so a filtered view can be linked, bookmarked
 * and restored after a reload. Values matching their default are dropped from the URL.
 * `defaults` must be a stable module-level object.
 */
export function useUrlState(defaults) {
  const [params, setParams] = useSearchParams();

  const state = useMemo(() => {
    const next = {};
    for (const key of Object.keys(defaults)) next[key] = coerce(params.get(key), defaults[key]);
    return next;
  }, [params, defaults]);

  const set = useCallback(
    (patch, { replace = true } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined || value === null || value === '' || value === defaults[key]) next.delete(key);
            else next.set(key, String(value));
          }
          // Any filter change invalidates the current page offset.
          if (!('page' in patch) && 'page' in defaults) next.delete('page');
          return next;
        },
        { replace },
      );
    },
    [setParams, defaults],
  );

  const reset = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams]);

  return [state, set, reset];
}

/** True while any key holds a non-default value, so a "clear filters" control can hide itself. */
export function hasFilters(state, defaults, ignore = ['page', 'limit']) {
  return Object.keys(defaults).some((key) => !ignore.includes(key) && state[key] !== defaults[key]);
}

/** Tracks a Set of selected row ids for bulk actions. */
export function useSelection(allIds) {
  const [selected, setSelected] = useState(() => new Set());

  // Rows that scrolled out of the current page must not stay silently selected.
  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(allIds);
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [allIds]);

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => (prev.size === allIds.length ? new Set() : new Set(allIds)));
  }, [allIds]);

  const clear = useCallback(() => setSelected(new Set()), []);

  return { selected, toggle, toggleAll, clear, count: selected.size, ids: [...selected] };
}

/** Latest value in a ref, for callbacks registered once but reading fresh state. */
export function useLatest(value) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/** Reports connectivity so an exam runner can tell the candidate why a save failed. */
export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}
