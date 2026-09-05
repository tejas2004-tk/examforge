import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { ErrorAlert, Spinner } from '../../components/ui.jsx';

export function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/admin/stats')
      .then((res) => setData(res.data.data))
      .catch(setError);
  }, []);

  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Spinner />;

  const stats = [
    { label: 'Total users', value: data.totalUsers, color: 'text-brand-600' },
    { label: 'Teachers', value: data.totalTeachers, color: 'text-brand-600' },
    { label: 'Students', value: data.totalStudents, color: 'text-emerald-600' },
    { label: 'Courses', value: data.totalCourses, color: 'text-amber-600' },
    { label: 'Tests', value: data.totalTests, color: 'text-brand-600' },
    { label: 'Questions', value: data.totalQuestions, color: 'text-amber-600' },
    { label: 'Attempts', value: data.totalAttempts, color: 'text-brand-600' },
    { label: 'Passed', value: data.passedAttempts, color: 'text-emerald-600' },
    { label: 'Assignments', value: data.totalAssignments, color: 'text-amber-600' },
    { label: 'Avg score', value: data.avgPercentage !== null ? `${data.avgPercentage.toFixed(1)}%` : '—', color: 'text-brand-600' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">Platform overview — users, courses, tests and submissions.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-2 text-sm font-medium text-slate-600">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Quick actions</h2>
          <div className="grid grid-cols-1 gap-2">
            <Link to="/admin/users" className="btn-secondary justify-start">Manage users</Link>
            <Link to="/admin/courses" className="btn-secondary justify-start">Manage courses</Link>
            <Link to="/admin/tests" className="btn-secondary justify-start">View all tests</Link>
            <Link to="/admin/assignments" className="btn-secondary justify-start">View assignments</Link>
            <Link to="/admin/results" className="btn-secondary justify-start">View submissions</Link>
            <Link to="/admin/audit" className="btn-secondary justify-start">Audit logs</Link>
          </div>
        </div>

        <div className="card">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Platform summary</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Published tests</dt>
              <dd className="font-semibold text-slate-900">{data.publishedTests}/{data.totalTests}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Evaluated attempts</dt>
              <dd className="font-semibold text-slate-900">{data.evaluatedAttempts}/{data.totalAttempts}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Pass rate</dt>
              <dd className="font-semibold text-slate-900">
                {data.evaluatedAttempts > 0 ? `${((data.passedAttempts / data.evaluatedAttempts) * 100).toFixed(1)}%` : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Assignment submissions</dt>
              <dd className="font-semibold text-slate-900">{data.totalSubmissions}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Average score</dt>
              <dd className="font-semibold text-slate-900">
                {data.avgScore !== null ? `${data.avgScore.toFixed(1)} marks` : '—'}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
