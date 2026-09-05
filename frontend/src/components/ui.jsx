import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, Inbox, LoaderCircle, X } from 'lucide-react';

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/* ---------------------------------------------------------------- headings */

export function PageHeader({ title, description, actions, eyebrow }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-display truncate text-ink">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionHeader({ title, action }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="eyebrow">{title}</h2>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------- panel */

export function Panel({ title, action, children, className, bodyClassName }) {
  return (
    <section className={cx('card flex flex-col', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="eyebrow">{title}</h2>
          {action}
        </div>
      )}
      <div className={cx('flex-1', bodyClassName ?? 'p-5')}>{children}</div>
    </section>
  );
}

/* --------------------------------------------------------------- stat tile */

const STAT_TONES = {
  neutral: 'text-ink',
  accent: 'text-accent',
  positive: 'text-positive',
  caution: 'text-caution',
  critical: 'text-critical',
};

export function StatTile({ label, value, hint, tone = 'neutral', icon: Icon }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[0.8125rem] font-medium text-ink-muted">{label}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />}
      </div>
      <p className={cx('tabular mt-1.5 text-[1.75rem] font-semibold leading-none tracking-tight', STAT_TONES[tone])}>
        {value}
      </p>
      {hint && <p className="mt-1.5 truncate text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------- modal */

export function Modal({ open, onClose, title, description, children, width = 'max-w-lg' }) {
  const panelRef = useRef(null);

  // Escape-to-close plus a background scroll lock. Both were missing before, so
  // the page behind the dialog scrolled while the dialog stayed pinned.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[rgb(var(--shadow))]/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          'animate-fade-up relative w-full rounded-2xl border border-line bg-surface-raised shadow-overlay',
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-title text-ink">{title}</h3>
            {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="btn btn-sm -mr-1 -mt-0.5 px-1.5 text-ink-subtle hover:bg-canvas hover:text-ink"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="scrollbar-slim max-h-[70vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ states */

export function Spinner({ label = 'Loading…', className }) {
  return (
    <div className={cx('flex flex-col items-center justify-center py-16 text-ink-subtle', className)} role="status">
      <LoaderCircle className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
      {label && <p className="mt-3 text-sm">{label}</p>}
    </div>
  );
}

export function EmptyState({ title, description, action, icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-canvas text-ink-subtle">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Normalises axios errors, plain Errors and bare strings into one message. */
export function errorMessage(error) {
  if (!error) return 'Something went wrong.';
  if (typeof error === 'string') return error;
  return (
    error?.response?.data?.message ??
    error?.response?.data?.error ??
    error?.message ??
    'Something went wrong.'
  );
}

export function ErrorAlert({ error, className }) {
  return (
    <div
      role="alert"
      className={cx(
        'flex items-start gap-2.5 rounded-lg border border-critical/25 bg-critical-soft px-3.5 py-2.5 text-sm text-critical-ink',
        className,
      )}
    >
      <CircleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{errorMessage(error)}</span>
    </div>
  );
}

/* ------------------------------------------------------------------- badge */

const BADGE_TONES = {
  neutral: 'bg-canvas text-ink-muted ring-line-strong',
  accent: 'bg-accent-soft text-accent-ink ring-accent/25',
  positive: 'bg-positive-soft text-positive-ink ring-positive/25',
  caution: 'bg-caution-soft text-caution-ink ring-caution/25',
  critical: 'bg-critical-soft text-critical-ink ring-critical/25',
};

export function Badge({ children, tone = 'neutral' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        BADGE_TONES[tone] ?? BADGE_TONES.neutral,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Domain status -> badge tone. The previous map pointed `violet` at amber
 * styles and carried duplicate `blue`/`brand` keys; tones are semantic now, and
 * an unknown status degrades to neutral rather than emitting undefined classes.
 */
const STATUS_TONES = {
  DRAFT: 'neutral',
  PUBLISHED: 'positive',
  CLOSED: 'critical',
  IN_PROGRESS: 'accent',
  SUBMITTED: 'caution',
  EVALUATED: 'positive',
  PASSED: 'positive',
  FAILED: 'critical',
  PENDING: 'caution',
};

export const statusTone = (status) => STATUS_TONES[status] ?? 'neutral';

/* -------------------------------------------------------------------- form */

export function Field({ label, error, hint, htmlFor, children }) {
  return (
    <div>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error && <p className="mt-1.5 text-xs text-critical">{error}</p>}
      {!error && hint && <p className="mt-1.5 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------- table */

export function Table({ head, children, className }) {
  return (
    <div className={cx('table-shell scrollbar-slim', className)}>
      <table className="table-base">
        {head && (
          <thead>
            <tr>
              {head.map((cell) => (
                <th key={typeof cell === 'string' ? cell : cell.key} scope="col">
                  {typeof cell === 'string' ? cell : cell.label}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
