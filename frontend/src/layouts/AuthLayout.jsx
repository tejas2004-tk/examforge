import { Link, Outlet } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/theme.js';

/**
 * Two-column auth shell. The left panel is a factual orientation strip, not a
 * marketing slot: someone reaching this screen has already decided to sign in.
 */
const CAPABILITIES = [
  ['Authoring', 'Question banks, sectioned papers, per-candidate randomisation.'],
  ['Delivery', 'Timed attempts, autosave, proctoring signals, resume after disconnect.'],
  ['Grading', 'Automatic scoring, manual review queues, certificates.'],
];

export function AuthLayout() {
  const { theme, toggle } = useTheme();

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <aside className="panel-rule relative hidden bg-panel px-12 py-14 lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="relative flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent font-mono text-sm font-semibold text-accent-on">
            EF
          </span>
          <span className="text-[0.9375rem] font-semibold tracking-[-0.012em] text-panel-ink">
            ExamForge
          </span>
        </Link>

        <div className="relative max-w-md">
          <p className="font-mono text-eyebrow uppercase text-panel-ink/50">Assessment platform</p>
          <h2 className="mt-3 text-display-lg text-panel-ink">
            One system for the whole assessment cycle.
          </h2>
          <dl className="mt-10 space-y-6">
            {CAPABILITIES.map(([term, detail]) => (
              <div key={term} className="border-l border-panel-ink/20 pl-4">
                <dt className="font-mono text-eyebrow uppercase text-accent">{term}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-panel-ink/75">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative text-xs text-panel-ink/45">
          Accounts are issued by your institution. Contact your administrator if you cannot sign in.
        </p>
      </aside>

      <main className="relative flex items-center justify-center px-5 py-12 sm:px-8">
        <button
          type="button"
          onClick={toggle}
          className="btn btn-sm absolute right-4 top-4 px-1.5 text-ink-subtle hover:bg-surface-sunken hover:text-ink"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
        </button>

        <div className="w-full max-w-[23rem]">
          {/* Compact lockup for the mobile layout, where the panel is hidden. */}
          <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent font-mono text-sm font-semibold text-accent-on">
              EF
            </span>
            <span className="text-[0.9375rem] font-semibold tracking-[-0.012em] text-ink">ExamForge</span>
          </Link>

          <Outlet />
        </div>
      </main>
    </div>
  );
}
