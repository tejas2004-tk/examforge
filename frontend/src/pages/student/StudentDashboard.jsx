import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, ClipboardList, FileCheck, TrendingUp } from 'lucide-react';
import { api } from '../../api/client.js';
import {
  Badge,
  EmptyState,
  ErrorAlert,
  PageHeader,
  Panel,
  Spinner,
  StatTile,
} from '../../components/ui.jsx';

const dateOnly = (value) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const dateTime = (value) =>
  new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function StudentDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get('/tests/assigned'), api.get('/results/my'), api.get('/assignments')])
      .then(([tests, results, assignments]) => {
        if (cancelled) return;
        setData({
          tests: tests.data.data.items,
          results: results.data.data.items,
          assignments: assignments.data.data.items,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    // Guard against setting state after unmount when the user navigates away
    // mid-flight.
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;

    const available = data.tests.filter((t) => t.canAttempt).length;
    const passed = data.results.filter((r) => r.passed).length;
    const pendingAssignments = data.assignments.filter((a) => a._count?.submissions === 0).length;

    // Average as a percentage of each test's own total. Averaging raw scores
    // (the previous behaviour) mixes a 10-mark quiz with a 100-mark paper and
    // produces a number that means nothing.
    const scored = data.results.filter((r) => r.score !== null && r.test?.totalMarks > 0);
    const avgPercent = scored.length
      ? Math.round(scored.reduce((sum, r) => sum + (r.score / r.test.totalMarks) * 100, 0) / scored.length)
      : null;

    return { available, passed, pendingAssignments, avgPercent, attempts: data.results.length };
  }, [data]);

  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Spinner />;

  return (
    <div>
      <PageHeader
        eyebrow="Student"
        title="Dashboard"
        description="Your assigned tests, assignments and performance at a glance."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Available now"
          value={stats.available}
          hint={`${data.tests.length} assigned in total`}
          tone={stats.available > 0 ? 'accent' : 'neutral'}
          icon={FileCheck}
        />
        <StatTile
          label="Attempts taken"
          value={stats.attempts}
          hint={`${stats.passed} passed`}
          icon={ClipboardList}
        />
        <StatTile
          label="Average score"
          value={stats.avgPercent === null ? '—' : `${stats.avgPercent}%`}
          hint={stats.avgPercent === null ? 'No graded attempts yet' : 'Across graded attempts'}
          tone={stats.avgPercent === null ? 'neutral' : stats.avgPercent >= 50 ? 'positive' : 'critical'}
          icon={TrendingUp}
        />
        <StatTile
          label="Assignments due"
          value={stats.pendingAssignments}
          hint={`${data.assignments.length} in total`}
          tone={stats.pendingAssignments > 0 ? 'caution' : 'positive'}
          icon={Award}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Upcoming tests"
          action={
            <Link to="/student/tests" className="link text-[0.8125rem]">
              View all
            </Link>
          }
          bodyClassName="p-2"
        >
          {data.tests.length === 0 ? (
            <div className="p-3">
              <EmptyState title="No tests assigned" description="New tests will appear here once a teacher assigns them." />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {data.tests.slice(0, 6).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{t.title}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-subtle">
                      {t.course?.name ?? 'No course'} · {t.durationMinutes} min
                    </p>
                  </div>
                  {t.canAttempt ? (
                    <Link to={`/student/tests/${t.id}/exam`} className="btn-primary btn-sm shrink-0">
                      Start
                    </Link>
                  ) : (
                    <Badge tone="neutral">{t.attemptsLeft === 0 ? 'No attempts left' : 'Not open'}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel
            title="Assignments"
            action={
              <Link to="/student/assignments" className="link text-[0.8125rem]">
                View all
              </Link>
            }
            bodyClassName="p-2"
          >
            {data.assignments.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-ink-subtle">No assignments yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.assignments.slice(0, 4).map((a) => {
                  const submitted = a._count?.submissions > 0;
                  return (
                    <li key={a.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{a.title}</p>
                        <p className="mt-0.5 truncate text-xs text-ink-subtle">
                          {a.course?.name ?? 'No course'}
                          {a.dueAt && ` · due ${dateOnly(a.dueAt)}`}
                        </p>
                      </div>
                      <Badge tone={submitted ? 'positive' : 'caution'}>
                        {submitted ? 'Submitted' : 'Pending'}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel
            title="Recent results"
            action={
              <Link to="/student/results" className="link text-[0.8125rem]">
                View all
              </Link>
            }
            bodyClassName="p-2"
          >
            {data.results.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-ink-subtle">No results yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.results.slice(0, 4).map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/student/results/${r.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent-soft/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{r.test.title}</p>
                        <p className="mt-0.5 text-xs text-ink-subtle">{dateTime(r.submittedAt)}</p>
                      </div>
                      <span className="tabular shrink-0 text-sm font-semibold text-ink">
                        {r.score !== null ? `${r.score}/${r.test.totalMarks}` : '—'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
