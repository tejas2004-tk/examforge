import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Badge, ErrorAlert, Spinner, statusTone } from '../../components/ui.jsx';

export function TeacherDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/tests'),
      api.get('/questions'),
      api.get('/results'),
      api.get('/courses'),
      api.get('/assignments'),
    ])
      .then(([tests, questions, results, courses, assignments]) =>
        setData({
          tests: tests.data.data.items,
          questions: questions.data.data.items,
          results: results.data.data.items,
          courses: courses.data.data.items,
          assignments: assignments.data.data.items,
        }),
      )
      .catch(setError);
  }, []);

  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Spinner />;

  const published = data.tests.filter((t) => t.status === 'PUBLISHED').length;
  const pending = data.results.filter((r) => r.status === 'SUBMITTED').length;
  const flagged = data.results.filter((r) => (r.suspiciousEventCount ?? 0) > 0).length;

  const stats = [
    { label: 'Courses', value: data.courses.length },
    { label: 'Questions', value: data.questions.length },
    { label: 'Tests', value: data.tests.length },
    { label: 'Published', value: published },
    { label: 'Assignments', value: data.assignments.length },
    { label: 'Submissions', value: data.results.length },
    { label: 'Needs grading', value: pending },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Teacher Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">Your courses, question banks, tests and grading queue.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <p className="text-3xl font-bold text-brand-600">{s.value}</p>
            <p className="mt-2 text-sm font-medium text-slate-600">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent submissions</h2>
            <Link to="/teacher/results" className="text-sm font-medium text-brand-600 hover:text-brand-700">All</Link>
          </div>
          {data.results.length === 0 && <p className="text-sm text-slate-500">No submissions yet.</p>}
          <ul className="divide-y divide-slate-100">
            {data.results.slice(0, 6).map((r) => (
              <li key={r.id}>
                <Link to={`/teacher/results/${r.id}`} className="flex items-center justify-between py-2.5 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{r.student?.fullName ?? r.student?.email}</p>
                    <p className="text-xs text-slate-500">{r.test.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.suspiciousEventCount > 0 && <Badge tone="amber">{r.suspiciousEventCount} flags</Badge>}
                    <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Quick actions</h2>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Link to="/teacher/tests" className="btn-secondary justify-start">Manage tests</Link>
            <Link to="/teacher/questions" className="btn-secondary justify-start">Create questions</Link>
            <Link to="/teacher/banks" className="btn-secondary justify-start">Build question banks</Link>
            <Link to="/teacher/assignments" className="btn-secondary justify-start">Manage assignments</Link>
            <Link to="/teacher/results" className="btn-secondary justify-start">Grade submissions</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
