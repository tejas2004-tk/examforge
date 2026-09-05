import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Spinner, ErrorAlert } from '../../components/ui.jsx';

export function StudentDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/tests/assigned'), api.get('/results/my'), api.get('/assignments')])
      .then(([tests, results, assignments]) => setData({
        tests: tests.data.data.items,
        results: results.data.data.items,
        assignments: assignments.data.data.items,
      }))
      .catch(setError);
  }, []);

  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Spinner />;

  const available = data.tests.filter((t) => t.canAttempt).length;
  const finished = data.results.length;
  const scored = data.results.filter((r) => r.score !== null);
  const avg = scored.length
    ? (scored.reduce((sum, r) => sum + (r.score ?? 0), 0) / scored.length).toFixed(1)
    : '—';
  const passed = data.results.filter((r) => r.passed).length;
  const pendingAssignments = data.assignments.filter((a) => a._count?.submissions === 0).length;

  const stats = [
    { label: 'Tests assigned', value: data.tests.length },
    { label: 'Available now', value: available },
    { label: 'Attempts taken', value: finished },
    { label: 'Passed', value: passed },
    { label: 'Avg score', value: avg },
    { label: 'Assignments', value: data.assignments.length },
    { label: 'Pending assignments', value: pendingAssignments },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Student Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">Your assigned tests, assignments and performance at a glance.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <p className="text-3xl font-bold text-brand-600">{s.value}</p>
            <p className="mt-2 text-sm font-medium text-slate-600">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Upcoming tests</h2>
            <Link to="/student/tests" className="text-sm font-medium text-brand-600 hover:text-brand-700">View all</Link>
          </div>
          {data.tests.length === 0 && <p className="text-sm text-slate-500">No tests assigned yet.</p>}
          <ul className="divide-y divide-slate-100">
            {data.tests.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{t.title}</p>
                  <p className="text-xs text-slate-500">
                    {t.course?.name ?? 'No course'} · {t.durationMinutes} min
                  </p>
                </div>
                {t.canAttempt ? (
                  <Link to={`/student/tests/${t.id}/exam`} className="btn-primary px-3 py-1.5">Start</Link>
                ) : (
                  <span className="text-xs font-medium text-slate-400">{t.attemptsLeft === 0 ? 'No attempts left' : 'Not open'}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Assignments</h2>
            <Link to="/student/assignments" className="text-sm font-medium text-brand-600 hover:text-brand-700">View all</Link>
          </div>
          {data.assignments.length === 0 && <p className="text-sm text-slate-500">No assignments yet.</p>}
          <ul className="divide-y divide-slate-100">
            {data.assignments.slice(0, 5).map((a) => (
              <li key={a.id} className="py-3">
                <p className="text-sm font-medium text-slate-900">{a.title}</p>
                <p className="text-xs text-slate-500">
                  {a.course?.name ?? 'No course'} · {a._count?.submissions > 0 ? 'Submitted' : 'Pending'}
                  {a.dueAt && ` · Due ${new Date(a.dueAt).toLocaleDateString()}`}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent results</h2>
            <Link to="/student/results" className="text-sm font-medium text-brand-600 hover:text-brand-700">View all</Link>
          </div>
          {data.results.length === 0 && <p className="text-sm text-slate-500">No results yet.</p>}
          <ul className="divide-y divide-slate-100">
            {data.results.slice(0, 5).map((r) => (
              <li key={r.id}>
                <Link to={`/student/results/${r.id}`} className="flex items-center justify-between py-3 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{r.test.title}</p>
                    <p className="text-xs text-slate-500">{new Date(r.submittedAt).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {r.score !== null ? `${r.score}/${r.test.totalMarks}` : 'Pending'}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
