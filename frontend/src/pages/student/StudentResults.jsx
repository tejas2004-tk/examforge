import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Badge, EmptyState, ErrorAlert, PageHeader, Spinner, statusTone } from '../../components/ui.jsx';

export function StudentResults() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/results/my')
      .then((res) => setItems(res.data.data.items))
      .catch(setError);
  }, []);

  if (error) return <ErrorAlert error={error} />;
  if (!items) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="My Results"
        description="All your submitted attempts with scores. Auto-graded questions show results immediately; subjective and coding questions show once a teacher grades them."
      />
      {items.length === 0 ? (
        <EmptyState title="No results yet" description="Submit an attempt to see your results here." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-subtle">
                <th className="pb-3 pr-4 font-medium">Test</th>
                <th className="pb-3 pr-4 font-medium">Course</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Score</th>
                <th className="pb-3 pr-4 font-medium">%</th>
                <th className="pb-3 pr-4 font-medium">Result</th>
                <th className="pb-3 pr-4 font-medium">Submitted</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="py-3 pr-4 font-medium text-ink">{r.test.title}</td>
                  <td className="py-3 pr-4 text-ink-muted">{r.test.course?.name ?? '—'}</td>
                  <td className="py-3 pr-4"><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
                  <td className="py-3 pr-4 font-semibold text-ink">
                    {r.score !== null ? `${r.score}/${r.test.totalMarks}` : '—'}
                  </td>
                  <td className="py-3 pr-4 text-ink-muted">{r.percentage !== null ? `${r.percentage}%` : '—'}</td>
                  <td className="py-3 pr-4">
                    {r.passed === null ? '—' : r.passed ? <Badge tone="green">Passed</Badge> : <Badge tone="red">Failed</Badge>}
                  </td>
                  <td className="py-3 pr-4 text-ink-muted">{new Date(r.submittedAt).toLocaleDateString()}</td>
                  <td className="py-3 text-right">
                    <Link to={`/student/results/${r.id}`} className="text-sm font-medium text-accent hover:text-accent">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
