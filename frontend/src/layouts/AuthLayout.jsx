import { Outlet } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/theme.js';

const HIGHLIGHTS = [
  ['Authoring', 'Question banks, sections and randomised papers.'],
  ['Delivery', 'Timed attempts with proctoring signals and autosave.'],
  ['Grading', 'Automatic scoring, manual review and certification.'],
];

export function AuthLayout() {
  const { theme, toggle } = useTheme();

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel. Hidden below lg so small screens get the form alone. */}
      <aside className="relative hidden overflow-hidden bg-panel px-12 py-14 lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgb(var(--panel-ink)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--panel-ink)) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent/25 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
            EF
          </span>
          <span className="text-[0.9375rem] font-semibold tracking-tight text-panel-ink">ExamForge</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-display-lg text-panel-ink">
            Run the whole assessment cycle in one place.
          </h2>
          <dl className="mt-9 space-y-6">
            {HIGHLIGHTS.map(([term, detail]) => (
              <div key={term} className="border-l-2 border-accent/60 pl-4">
                <dt className="text-eyebrow uppercase text-accent">{term}</dt>
                <dd className="mt-1 text-[0.9375rem] leading-relaxed text-panel-ink/70">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative text-xs text-panel-ink/40">
          Courses · Question banks · Proctored exams · Certification
        </p>
      </aside>

      <main className="relative flex items-center justify-center px-5 py-12 sm:px-8">
        <button
          onClick={toggle}
          className="btn btn-sm absolute right-5 top-5 px-1.5 text-ink-subtle hover:bg-surface hover:text-ink"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div className="w-full max-w-[24rem]">
          {/* Compact brand lockup for the mobile layout, where the panel is hidden. */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
              EF
            </span>
            <span className="text-[0.9375rem] font-semibold tracking-tight text-ink">ExamForge</span>
          </div>

          <Outlet />
        </div>
      </main>
    </div>
  );
}
