import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  Fingerprint,
  GraduationCap,
  Layers,
  ListChecks,
  Moon,
  ScrollText,
  Shuffle,
  Sun,
  Timer,
  Video,
} from 'lucide-react';
import { cx } from '../components/ui.jsx';
import { useTheme } from '../lib/theme.js';

/* ------------------------------------------------------------------- data */

const CYCLE = [
  {
    title: 'Author',
    icon: ListChecks,
    body: 'Write questions once and reuse them. Seven question types are supported: single choice, multiple choice, true/false, fill in the blank, matching, subjective and coding. Every question carries a difficulty, a Bloom level, a topic and tags, and each edit is kept as a version so a paper can be traced back to what was actually asked.',
  },
  {
    title: 'Assemble',
    icon: Layers,
    body: 'Group questions into banks, then pull them into a test by hand or through a question pool that draws N questions at random from a filtered set. Tests are built from sections, each with its own marks and ordering, and a paper can shuffle its questions and its option order per candidate.',
  },
  {
    title: 'Deliver',
    icon: Timer,
    body: 'Attempts are timed on the server, not in the browser. Answers autosave as the candidate works, so a dropped connection or a closed tab resumes where it left off. A test can carry a start and end window, a grace period, an attempt limit and an access password.',
  },
  {
    title: 'Grade',
    icon: ClipboardCheck,
    body: 'Objective questions score automatically, including negative marking where configured. Coding submissions run against stored test cases. Subjective answers land in a review queue where a teacher awards marks and leaves feedback, and the attempt moves from submitted to evaluated.',
  },
  {
    title: 'Report',
    icon: ScrollText,
    body: 'Results are broken down by question, section and cohort, with difficulty and discrimination indices computed per question so a bad item can be found and retired. Passing candidates can be issued certificates, and leaderboards rank a batch on completed assessments.',
  },
];

const CAPABILITIES = [
  ['Question types', 'Single, multiple, true/false, fill-blank, matching, subjective, coding', 'full'],
  ['Question banks', 'Shared banks, tags, topics, difficulty, Bloom level, version history', 'full'],
  ['Randomisation', 'Per-candidate question order, option order, and pooled random draws', 'full'],
  ['Sectioned papers', 'Sections with independent marks, ordering and instructions', 'full'],
  ['Timing controls', 'Server-side clock, start/end window, grace period, attempt limits', 'full'],
  ['Negative marking', 'Per-test penalty applied to incorrect objective answers', 'full'],
  ['Autosave and resume', 'Answers persisted continuously; attempts resume after disconnect', 'full'],
  ['Coding assessment', 'In-browser editor, stored test cases, per-case pass/fail on submission', 'full'],
  ['Auto-grading', 'Objective and coding questions scored without manual intervention', 'full'],
  ['Manual review', 'Queue for subjective answers with per-question marks and feedback', 'full'],
  ['Proctoring signals', 'Session events with severity and a running suspicion score', 'partial'],
  ['Snapshot capture', 'Screen and camera frames stored against a proctoring session', 'partial'],
  ['Courses and lessons', 'Modules, lessons, resources, enrolment and per-lesson progress', 'full'],
  ['Assignments', 'Briefs, due dates, file submissions and grading', 'full'],
  ['Certificates', 'Issued on completion, verifiable by certificate identifier', 'full'],
  ['Analytics', 'Cohort trends, score distribution, per-question difficulty and discrimination', 'full'],
  ['Audit logging', 'Actor, action, target and timestamp for administrative changes', 'full'],
  ['Two-factor authentication', 'Time-based one-time codes on top of the password', 'full'],
  ['Institutional SSO', 'SAML and OIDC federation with an identity provider', 'none'],
  ['LTI integration', 'Launching from an external learning management system', 'none'],
];

const STATUS_META = {
  full: { label: 'Available', className: 'bg-positive-soft text-positive-ink ring-positive/30' },
  partial: { label: 'Limited', className: 'bg-caution-soft text-caution-ink ring-caution/30' },
  none: { label: 'Not yet', className: 'bg-surface-sunken text-ink-subtle ring-line-strong' },
};

const ROLES = [
  {
    name: 'Administrator',
    icon: Building2,
    summary: 'Runs the institution-wide configuration.',
    points: [
      'Create departments, academic years, semesters and batches',
      'Issue and revoke teacher, proctor and administrator accounts',
      'Review every test, result and attempt across the organisation',
      'Read the audit log of who changed what, and when',
    ],
  },
  {
    name: 'Teacher',
    icon: GraduationCap,
    summary: 'Owns the material and the marking.',
    points: [
      'Build question banks and assemble tests from them',
      'Assign tests and coursework to class batches',
      'Work the manual review queue for subjective answers',
      'Read per-question analytics to retire weak items',
    ],
  },
  {
    name: 'Student',
    icon: ClipboardCheck,
    summary: 'Sits assessments and tracks progress.',
    points: [
      'Enrol in courses and work through lessons and resources',
      'Sit timed attempts with autosave and resume',
      'Review scored answers once results are released',
      'Collect certificates for completed assessments',
    ],
  },
  {
    name: 'Proctor',
    icon: Video,
    summary: 'Watches sittings in progress.',
    points: [
      'See every attempt currently in progress',
      'Read the event stream and suspicion score per candidate',
      'Annotate a session with notes for later review',
    ],
  },
];

const SECURITY = [
  {
    title: 'Session handling',
    icon: Fingerprint,
    body: 'Sign-in issues a short-lived JWT access token held in memory and a refresh token in an HTTP-only cookie. Concurrent requests share a single refresh, and a password change or an explicit sign-out invalidates the stored refresh tokens so other devices drop out.',
  },
  {
    title: 'Two-factor authentication',
    icon: Timer,
    body: 'Accounts can require a time-based one-time code in addition to the password. The sign-in call answers with a distinct status when a code is needed, so the second factor is a separate step rather than a silent failure. Failed attempts are rate limited per address.',
  },
  {
    title: 'Proctoring signals',
    icon: Video,
    body: 'A proctoring session records typed events with a severity and an accumulating suspicion score, plus optional screen or camera snapshots. These are signals for a human to judge, not automatic verdicts: nothing is failed or flagged by the system on its own.',
  },
  {
    title: 'Audit logging',
    icon: ScrollText,
    body: 'Administrative changes are written to an append-only audit log holding the actor, the action, the target record, the source address and the time. Sign-in attempts are recorded separately with their outcome, so a disputed result has a trail behind it.',
  },
];

const FAQ = [
  {
    q: 'What happens if a candidate loses their connection mid-exam?',
    a: 'Answers autosave to the server as they are entered, and the attempt clock runs server-side. Reopening the exam restores the saved answers and the remaining time, with a grace period if the test defines one.',
  },
  {
    q: 'Can two candidates get different papers from the same test?',
    a: 'Yes. A test can shuffle question order and option order per candidate, and question pools draw a set number of questions at random from a filtered pool, so two sittings of the same test can share a blueprint without sharing an identical paper.',
  },
  {
    q: 'How are coding questions marked?',
    a: 'Each coding problem carries stored test cases. A submission runs against them and the per-case outcome is recorded with the submission, so partial credit reflects how many cases passed rather than an all-or-nothing result.',
  },
  {
    q: 'Does the platform decide whether someone cheated?',
    a: 'No. Proctoring produces events and a suspicion score for a human reviewer. No attempt is voided, failed or flagged automatically on the basis of those signals.',
  },
  {
    q: 'Who can see a result before it is released?',
    a: 'A test chooses whether the score is shown immediately on submission. Until a result is released, the attempt is visible to the teacher who owns the test and to administrators; the candidate sees only that the attempt was submitted.',
  },
  {
    q: 'How do accounts get created?',
    a: 'Students can register themselves and verify by email. Teacher, proctor and administrator accounts are created by an administrator, because those roles carry access to other people’s work.',
  },
];

/* -------------------------------------------------------------- fragments */

function SectionLabel({ children }) {
  return <p className="eyebrow mb-3">{children}</p>;
}

/* ------------------------------------------------------------------- page */

export function LandingPage() {
  const { theme, toggle } = useTheme();
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-on"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-5">
          <Link to="/" className="flex items-center gap-2.5" aria-label="ExamForge home">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent font-mono text-[0.75rem] font-semibold text-accent-on">
              EF
            </span>
            <span className="text-[0.9375rem] font-semibold tracking-[-0.012em] text-ink">ExamForge</span>
          </Link>

          <nav className="ml-6 hidden items-center gap-5 md:flex" aria-label="Sections">
            {[
              ['#cycle', 'How it works'],
              ['#capabilities', 'Capabilities'],
              ['#roles', 'Roles'],
              ['#security', 'Security'],
              ['#faq', 'FAQ'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-sm text-[0.8125rem] font-medium text-ink-muted transition-colors hover:text-ink"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              className="btn btn-sm px-1.5 text-ink-subtle hover:bg-surface-sunken hover:text-ink"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            </button>
            <Link to="/login" className="btn-ghost btn-sm">
              Sign in
            </Link>
            <Link to="/register" className="btn-primary btn-sm">
              Create student account
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        {/* ------------------------------------------------------------ hero */}
        <section className="border-b border-line">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
            <div className="max-w-xl">
              <SectionLabel>Assessment platform for institutions</SectionLabel>
              <h1 className="text-display-lg text-ink sm:text-display-xl">
                Question banks, proctored exams and grading on one system.
              </h1>
              <p className="mt-5 text-[0.9375rem] leading-relaxed text-ink-muted">
                ExamForge holds the whole assessment cycle in one place: authoring and versioning
                questions, assembling sectioned papers, delivering timed attempts with a server-side
                clock, grading objective and coding answers automatically, routing subjective answers
                to a human reviewer, and reporting on the result at question, section and cohort level.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/login" className="btn-primary btn-lg">
                  Sign in
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link to="/register" className="btn-secondary btn-lg">
                  Register as a student
                </Link>
              </div>

              <p className="mt-4 text-xs text-ink-subtle">
                Staff accounts are issued by your institution&rsquo;s administrator.
              </p>
            </div>

            {/* A configuration panel rather than a decorative illustration: these
                are the actual controls an author sets on a test. */}
            <div className="lg:pl-4">
              <figure className="card overflow-hidden">
                <figcaption className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
                  <span className="text-[0.8125rem] font-semibold text-ink">Test configuration</span>
                  <span className="rounded-sm bg-surface-sunken px-1.5 py-0.5 font-mono text-eyebrow uppercase text-ink-subtle ring-1 ring-inset ring-line-strong">
                    Sample view
                  </span>
                </figcaption>
                <dl className="divide-y divide-line text-[0.8125rem]">
                  {[
                    ['Duration', '120 minutes, server-timed'],
                    ['Sections', '3 (Concepts, Applied, Programming)'],
                    ['Question source', 'Pool draw: 20 of 74 tagged items'],
                    ['Per-candidate order', 'Questions shuffled, options shuffled'],
                    ['Negative marking', '0.25 marks per incorrect objective answer'],
                    ['Attempts', '1, with a 5 minute grace period'],
                    ['Result release', 'Held until manual review completes'],
                    ['Proctoring', 'Events recorded, reviewed by a proctor'],
                  ].map(([term, value]) => (
                    <div key={term} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                      <dt className="shrink-0 text-ink-subtle">{term}</dt>
                      <dd className="tabular text-right font-medium text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              </figure>

              <div className="mt-3 flex items-start gap-2 rounded-md border border-line bg-surface px-3 py-2.5 text-xs text-ink-muted">
                <Shuffle className="mt-px h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
                <span>
                  Every one of these settings is per-test. Two papers built from the same bank can
                  differ in timing, penalty, randomisation and release policy.
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------- cycle */}
        <section id="cycle" className="border-b border-line scroll-mt-16">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="max-w-2xl text-display text-ink">
              Five stages, one record of what was asked and what was answered.
            </h2>

            <ol className="mt-10 divide-y divide-line border-y border-line">
              {CYCLE.map((stage, index) => {
                const Icon = stage.icon;
                return (
                  <li key={stage.title} className="grid gap-x-8 gap-y-3 py-7 md:grid-cols-[14rem_1fr]">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink-subtle">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <span className="font-mono text-eyebrow uppercase text-ink-subtle">
                          Stage {String(index + 1).padStart(2, '0')}
                        </span>
                        <h3 className="text-title text-ink">{stage.title}</h3>
                      </div>
                    </div>
                    <p className="max-w-3xl text-sm leading-relaxed text-ink-muted">{stage.body}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* ---------------------------------------------------- capabilities */}
        <section id="capabilities" className="border-b border-line bg-surface-sunken/60 scroll-mt-16">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
            <SectionLabel>Capabilities</SectionLabel>
            <h2 className="max-w-2xl text-display text-ink">What is built, what is partial, what is not there.</h2>
            <p className="mt-3 max-w-2xl text-sm text-ink-muted">
              Two entries below are marked as not yet available. They are listed because they are the
              questions procurement asks first, and an honest table is more useful than a short one.
            </p>

            <div className="table-shell scrollbar-slim mt-8 rounded-lg border border-line bg-surface">
              <table className="table-base">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '22%' }}>
                      Capability
                    </th>
                    <th scope="col">What it covers</th>
                    <th scope="col" style={{ width: '8rem' }}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CAPABILITIES.map(([name, detail, status]) => {
                    const meta = STATUS_META[status];
                    return (
                      <tr key={name}>
                        <th scope="row" className="whitespace-nowrap px-4 py-2.5 text-left align-top text-[0.8125rem] font-medium text-ink">
                          {name}
                        </th>
                        <td className="align-top">{detail}</td>
                        <td className="align-top">
                          <span
                            className={cx(
                              'inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset',
                              meta.className,
                            )}
                          >
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------- roles */}
        <section id="roles" className="border-b border-line scroll-mt-16">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
            <SectionLabel>Roles</SectionLabel>
            <h2 className="max-w-2xl text-display text-ink">
              Four roles, each with its own view of the same data.
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-ink-muted">
              Access is enforced on the server per route and per record, not by hiding menu items. A
              teacher reaching another teacher&rsquo;s test is refused by the API, whatever the client asks for.
            </p>

            <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
              {ROLES.map((role) => {
                const Icon = role.icon;
                return (
                  <article key={role.name} className="bg-surface p-6">
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                      <h3 className="text-title text-ink">{role.name}</h3>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">{role.summary}</p>
                    <ul className="mt-4 space-y-2">
                      {role.points.map((point) => (
                        <li key={point} className="flex gap-2.5 text-[0.8125rem] text-ink-muted">
                          <span className="mt-[0.4rem] h-1 w-1 shrink-0 rounded-full bg-ink-subtle" aria-hidden="true" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>

            <p className="mt-6 text-sm text-ink-muted">
              Already have an account?{' '}
              <Link to="/login" className="link">
                Sign in and you will land on the workspace for your role
              </Link>
              .
            </p>
          </div>
        </section>

        {/* -------------------------------------------------------- security */}
        <section id="security" className="border-b border-line bg-panel panel-rule scroll-mt-16">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
            <p className="font-mono text-eyebrow uppercase text-panel-ink/50">Security and accountability</p>
            <h2 className="mt-3 max-w-2xl text-display text-panel-ink">
              What actually protects an attempt, described plainly.
            </h2>

            <div className="mt-10 grid gap-10 md:grid-cols-2">
              {SECURITY.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="border-l border-panel-ink/20 pl-5">
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                      <h3 className="text-[0.9375rem] font-semibold text-panel-ink">{item.title}</h3>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-panel-ink/75">{item.body}</p>
                  </div>
                );
              })}
            </div>

            <p className="mt-10 max-w-3xl border-t border-panel-ink/15 pt-6 text-sm text-panel-ink/60">
              ExamForge does not claim a certification it does not hold. Data residency, retention
              periods and any formal accreditation depend on where your institution deploys it, and
              are set in your own infrastructure rather than by this application.
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------------- faq */}
        <section id="faq" className="border-b border-line scroll-mt-16">
          <div className="mx-auto max-w-3xl px-5 py-16 lg:py-20">
            <SectionLabel>Questions</SectionLabel>
            <h2 className="text-display text-ink">Frequently asked</h2>

            <dl className="mt-8 divide-y divide-line border-y border-line">
              {FAQ.map((item, index) => {
                const open = openFaq === index;
                return (
                  <div key={item.q}>
                    <dt>
                      <button
                        type="button"
                        onClick={() => setOpenFaq(open ? -1 : index)}
                        aria-expanded={open}
                        aria-controls={`faq-${index}`}
                        className="flex w-full items-start justify-between gap-4 py-4 text-left"
                      >
                        <span className="text-[0.9375rem] font-medium text-ink">{item.q}</span>
                        <span
                          aria-hidden="true"
                          className={cx(
                            'mt-1 shrink-0 font-mono text-sm text-ink-subtle transition-transform',
                            open && 'rotate-45',
                          )}
                        >
                          +
                        </span>
                      </button>
                    </dt>
                    <dd id={`faq-${index}`} hidden={!open} className="pb-5 pr-8 text-sm leading-relaxed text-ink-muted">
                      {item.a}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </section>

        {/* ------------------------------------------------------------ next */}
        <section className="border-b border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-12">
            <div className="max-w-xl">
              <h2 className="text-title text-ink">Ready to sign in?</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Students can register directly. If you are staff and cannot sign in, your
                administrator holds the account.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/login" className="btn-primary btn-lg">
                Sign in
              </Link>
              <Link to="/register" className="btn-secondary btn-lg">
                Register as a student
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-accent font-mono text-[0.625rem] font-semibold text-accent-on">
                EF
              </span>
              <span className="text-sm font-semibold text-ink">ExamForge</span>
            </div>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-ink-subtle">
              Assessment and coursework platform for institutions. Deployed and operated by the
              institution that runs it.
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-[0.8125rem] sm:grid-cols-3" aria-label="Footer">
            {[
              ['Platform', [['#cycle', 'How it works'], ['#capabilities', 'Capabilities'], ['#roles', 'Roles']]],
              ['Trust', [['#security', 'Security'], ['#faq', 'FAQ']]],
              ['Account', [['/login', 'Sign in'], ['/register', 'Register'], ['/forgot-password', 'Reset password']]],
            ].map(([heading, links]) => (
              <div key={heading}>
                <p className="eyebrow mb-2">{heading}</p>
                <ul className="space-y-1.5">
                  {links.map(([href, label]) =>
                    href.startsWith('#') ? (
                      <li key={href}>
                        <a href={href} className="text-ink-muted hover:text-ink">
                          {label}
                        </a>
                      </li>
                    ) : (
                      <li key={href}>
                        <Link to={href} className="text-ink-muted hover:text-ink">
                          {label}
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <p className="mt-10 border-t border-line pt-5 text-xs text-ink-subtle">
          ExamForge — course management, question banks, proctored exams, auto-grading and
          certification.
        </p>
      </footer>
    </div>
  );
}
