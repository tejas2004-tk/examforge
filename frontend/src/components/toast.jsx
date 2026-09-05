import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { cx } from './ui.jsx';

const ToastContext = createContext(null);

const VARIANTS = {
  success: { icon: CircleCheck, ring: 'ring-positive/30', accent: 'text-positive' },
  error: { icon: CircleAlert, ring: 'ring-critical/30', accent: 'text-critical' },
  warning: { icon: TriangleAlert, ring: 'ring-caution/30', accent: 'text-caution' },
  info: { icon: Info, ring: 'ring-line-strong', accent: 'text-accent' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message, type = 'info', duration = 4000) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, type }]);
      if (duration > 0) {
        // Timers are tracked so a manual dismiss clears its pending timeout
        // instead of leaving it to fire against an already-removed id.
        timersRef.current.set(
          id,
          setTimeout(() => removeToast(id), duration),
        );
      }
      return id;
    },
    [removeToast],
  );

  // Without memoisation this object is a fresh reference on every provider
  // render, which re-renders every consumer of the context.
  const toast = useMemo(
    () => ({
      success: (msg, dur) => addToast(msg, 'success', dur),
      error: (msg, dur) => addToast(msg, 'error', dur),
      info: (msg, dur) => addToast(msg, 'info', dur),
      warning: (msg, dur) => addToast(msg, 'warning', dur),
      dismiss: removeToast,
    }),
    [addToast, removeToast],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const { icon: Icon, ring, accent } = VARIANTS[t.type] ?? VARIANTS.info;
          return (
            <div
              key={t.id}
              role="alert"
              className={cx(
                'animate-slide-in pointer-events-auto flex items-start gap-2.5 rounded-xl bg-surface-raised px-3.5 py-3',
                'text-sm text-ink shadow-overlay ring-1',
                ring,
              )}
            >
              <Icon className={cx('mt-px h-4 w-4 shrink-0', accent)} aria-hidden="true" />
              <span className="min-w-0 flex-1 break-words">{t.message}</span>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="-mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-canvas hover:text-ink"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
