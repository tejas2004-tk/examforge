import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { cx } from './ui.jsx';

const ToastContext = createContext(null);

const TONES = {
  neutral: { icon: Info, accent: 'text-ink-subtle', rail: 'bg-line-strong' },
  info: { icon: Info, accent: 'text-info', rail: 'bg-info' },
  success: { icon: CircleCheck, accent: 'text-positive', rail: 'bg-positive' },
  caution: { icon: TriangleAlert, accent: 'text-caution', rail: 'bg-caution' },
  error: { icon: CircleAlert, accent: 'text-critical', rail: 'bg-critical' },
};

const DEFAULT_DURATION = 5000;
const MAX_VISIBLE = 4;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const timersRef = useRef(new Map());
  const pausedRef = useRef(false);

  const clearTimer = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer.handle);
      timersRef.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id) => {
      clearTimer(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [clearTimer],
  );

  const schedule = useCallback(
    (id, remaining) => {
      if (remaining <= 0) return;
      timersRef.current.set(id, {
        remaining,
        startedAt: Date.now(),
        handle: setTimeout(() => dismiss(id), remaining),
      });
    },
    [dismiss],
  );

  // Hovering the stack freezes every countdown: a toast carrying an action is
  // useless if it disappears while the pointer is travelling towards it.
  const pauseAll = useCallback(() => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    timersRef.current.forEach((timer, id) => {
      clearTimeout(timer.handle);
      timersRef.current.set(id, {
        ...timer,
        remaining: Math.max(0, timer.remaining - (Date.now() - timer.startedAt)),
      });
    });
  }, []);

  const resumeAll = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    const entries = Array.from(timersRef.current.entries());
    entries.forEach(([id, timer]) => schedule(id, timer.remaining));
  }, [schedule]);

  const toast = useCallback(
    (options) => {
      const config = typeof options === 'string' ? { title: options } : options ?? {};
      const { title, description, tone = 'neutral', duration = DEFAULT_DURATION, action } = config;
      idRef.current += 1;
      const id = idRef.current;

      setToasts((prev) => {
        const next = [...prev, { id, title, description, tone, action }];
        // Oldest toasts are dropped rather than stacked indefinitely; a column
        // taller than the viewport hides the newest message.
        const overflow = next.length - MAX_VISIBLE;
        if (overflow > 0) next.splice(0, overflow).forEach((t) => clearTimer(t.id));
        return next;
      });

      if (duration > 0 && !pausedRef.current) schedule(id, duration);
      else if (duration > 0) timersRef.current.set(id, { remaining: duration, startedAt: Date.now(), handle: null });

      return id;
    },
    [clearTimer, schedule],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((timer) => clearTimeout(timer.handle));
  }, []);

  const value = useMemo(
    () => ({
      toast,
      success: (title, options) => toast({ ...normalise(options), title, tone: 'success' }),
      error: (title, options) =>
        toast({ duration: 8000, ...normalise(options), title, tone: 'error' }),
      info: (title, options) => toast({ ...normalise(options), title, tone: 'info' }),
      dismiss,
    }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(23rem,calc(100vw-2rem))] flex-col-reverse gap-2"
          role="region"
          aria-label="Notifications"
          onMouseEnter={pauseAll}
          onMouseLeave={resumeAll}
          onFocusCapture={pauseAll}
          onBlurCapture={resumeAll}
        >
          {/* Errors interrupt; everything else waits for a pause in speech. */}
          <div aria-live="assertive" aria-atomic="false" className="contents">
            {toasts
              .filter((t) => t.tone === 'error')
              .map((t) => (
                <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
              ))}
          </div>
          <div aria-live="polite" aria-atomic="false" className="contents">
            {toasts
              .filter((t) => t.tone !== 'error')
              .map((t) => (
                <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
              ))}
          </div>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

function normalise(options) {
  if (!options) return {};
  return typeof options === 'string' ? { description: options } : options;
}

function ToastCard({ toast, onDismiss }) {
  const { icon: Icon, accent, rail } = TONES[toast.tone] ?? TONES.neutral;

  return (
    <div
      className={cx(
        'animate-slide-in pointer-events-auto relative flex items-start gap-2.5 overflow-hidden',
        'rounded-lg border border-line bg-surface-raised py-2.5 pl-3.5 pr-2.5 shadow-overlay',
      )}
    >
      <span className={cx('absolute inset-y-0 left-0 w-0.5', rail)} aria-hidden="true" />
      <Icon className={cx('mt-px h-4 w-4 shrink-0', accent)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="break-words text-[0.8125rem] font-medium text-ink">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 break-words text-xs text-ink-muted">{toast.description}</p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action.onClick?.();
              onDismiss(toast.id);
            }}
            className="mt-1.5 rounded-sm text-xs font-semibold text-accent underline-offset-[3px] hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="-mr-0.5 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
