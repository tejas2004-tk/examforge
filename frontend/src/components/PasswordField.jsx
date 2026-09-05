import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cx } from './ui.jsx';

/** Text input with a visibility toggle, otherwise a plain forwarded input. */
export const PasswordInput = forwardRef(function PasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cx('input pr-9', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink-muted"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
});

const RULES = [
  { id: 'length', label: 'At least 10 characters', test: (v) => v.length >= 10 },
  { id: 'case', label: 'Upper and lower case', test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { id: 'digit', label: 'A number', test: (v) => /\d/.test(v) },
  { id: 'symbol', label: 'A symbol', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

const LEVELS = [
  { label: 'Too weak', tone: 'bg-critical', text: 'text-critical-ink' },
  { label: 'Weak', tone: 'bg-critical', text: 'text-critical-ink' },
  { label: 'Fair', tone: 'bg-caution', text: 'text-caution-ink' },
  { label: 'Good', tone: 'bg-info', text: 'text-info-ink' },
  { label: 'Strong', tone: 'bg-positive', text: 'text-positive-ink' },
];

export function passwordScore(value = '') {
  return RULES.reduce((score, rule) => score + (rule.test(value) ? 1 : 0), 0);
}

/**
 * Rule-based meter rather than an entropy estimate: a bar that only says
 * "weak" gives the user nothing to act on, while the unmet rules do.
 */
export function PasswordStrength({ value = '', className }) {
  const score = passwordScore(value);
  const level = LEVELS[score];

  return (
    <div className={cx('mt-2', className)}>
      <div className="flex items-center gap-2">
        <div className="flex h-1 flex-1 gap-1" aria-hidden="true">
          {RULES.map((rule, index) => (
            <span
              key={rule.id}
              className={cx(
                'h-full flex-1 rounded-full transition-colors',
                index < score ? level.tone : 'bg-surface-sunken',
              )}
            />
          ))}
        </div>
        <span className={cx('text-xs font-medium', value ? level.text : 'text-ink-subtle')}>
          {value ? level.label : 'Not set'}
        </span>
      </div>

      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5" aria-live="polite">
        {RULES.map((rule) => {
          const met = rule.test(value);
          return (
            <li
              key={rule.id}
              className={cx('text-xs', met ? 'text-positive-ink' : 'text-ink-subtle')}
            >
              <span aria-hidden="true">{met ? '✓' : '·'}</span> {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
