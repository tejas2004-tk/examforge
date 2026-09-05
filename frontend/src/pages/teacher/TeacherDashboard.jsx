import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChartBar,
  ClipboardList,
  CodeXml,
  FileCheck,
  Library,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { api } from '../../api/client.js';
import {
  Badge,
  EmptyState,
  ErrorAlert,
  PageHeader,
  Panel,
  Spinner,
  StatTile,
  statusTone,
} from '../../components/ui.jsx';

const QUICK_ACTIONS = [
  { to: '/teacher/tests', label: 'Manage tests', icon: FileCheck },
  { to: '/teacher/questions', label: 'Create questions', icon: ClipboardList },
  { to: '/teacher/banks', label: 'Question banks', icon: Library },
  { to: '/teacher/coding-problems', label: 'Coding problems', icon: CodeXml },
  { to: '/teacher/results', label: 'Grade submissions', icon: ChartBar },
];

export function TeacherDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get('/tests'),
      api.get('/questions'),
      api.get('/results'),
      api.get('/courses'),
      api.get('/assignments'),
    ])
      .then(([tests, questions, results, courses, assignments]) => {
        if (cancelled) return;
        setData({
          tests: tests.data.data.items,
          questions: questions.data.data.items,
          results: results.data.data.items,
          courses: courses.data.data.items,
          assignments: assignments.data.data.items,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    return {
      published: data.tests.filter((t) => t.status === 'PUBLISHED').length,
      needsGrading: data.results.filter((r) => r.status === 'SUBMITTED').length,
      flagged: data.results.filter((r) => (r.suspiciousEventCount ?? 0) > 0).length,
    };
  }, [data]);

  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Spinner />;

  return (
    <div>
      <PageHeader
        eyebrow="Teacher"
        title="Dashboard"
        description="Your courses, question banks, tests and grading queue."
      />

      {/* Grading and integrity lead, because they are the items that need action
          today; inventory counts sit below as context. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Needs grading"
          value={stats.needsGrading}
          hint={`${data.results.length} submissions total`}
          tone={stats.needsGrading > 0 ? 'caution' : 'positive'}
          icon={ClipboardList}
        />
        <StatTile
          label="Flagged attempts"
          value={stats.flagged}
          hint="Suspicious proctoring events"
          tone={stats.flagged > 0 ? 'critical' : 'positive'}
          icon={TriangleAlert}
        />
        <StatTile
          label="Published tests"
          value={stats.published}
          hint={`${data.tests.length} authored`}
          icon={FileCheck}
        />
        <StatTile
          label="Courses"
          value={data.courses.length}
          hint={`${data.questions.length} questions · ${data.assignments.length} assignments`}
          icon={Users}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Recent submissions"
          action={
            <Link to="/teacher/results" className="link text-[0.8125rem]">
              View all
            </Link>
          }
          bodyClassName="p-2"
        >
          {data.results.length === 0 ? (
            <div className="p-3">
              <EmptyState
                title="No submissions yet"
                description="Attempts appear here as soon as students submit a published test."
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {data.results.slice(0, 7).map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/teacher/results/${r.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent-soft/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {r.student?.fullName ?? r.student?.email}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-subtle">{r.test.title}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {r.suspiciousEventCount > 0 && (
                        <Badge tone="critical">{r.suspiciousEventCount} flags</Badge>
                      )}
                      <Badge tone={statusTone(r.status)}>{r.status.replace(/_/g, ' ').toLowerCase()}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Quick actions" bodyClassName="p-3">
          <div className="grid gap-1.5">
            {QUICK_ACTIONS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] font-medium text-ink-muted transition-colors hover:bg-accent-soft hover:text-accent-ink"
              >
                <Icon className="h-4 w-4 shrink-0 text-ink-subtle group-hover:text-accent" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
