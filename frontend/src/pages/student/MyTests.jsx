import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Badge, EmptyState, ErrorAlert, PageHeader, Spinner, statusTone } from '../../components/ui.jsx';

export function MyTests() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/tests/assigned')
      .then((res) => setItems(res.data.data.items))
      .catch(setError);
  }, []);

  if (error) return <ErrorAlert error={error} />;
  if (!items) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="My Tests"
        description="Tests assigned to you. Start one when its window is open — in-progress attempts resume automatically."
      />
      {items.length === 0 ? (
        <EmptyState title="No tests assigned yet" description="Your teachers haven't assigned you any tests." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((t) => (
            <div key={t.id} className="card flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-ink">{t.title}</h3>
                <Badge tone={statusTone(t.canAttempt ? 'PUBLISHED' : t.ended ? 'CLOSED' : 'DRAFT')}>
                  {t.canAttempt ? 'Open' : t.ended ? 'Closed' : 'Not started'}
                </Badge>
              </div>
              {t.course && <p className="mt-1 text-xs text-ink-muted">{t.course.name}</p>}
              <p className="mt-2 text-sm text-ink-muted">{t.description}</p>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-subtle">Duration</dt>
                  <dd className="font-medium text-ink">{t.durationMinutes} min</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-subtle">Questions</dt>
                  <dd className="font-medium text-ink">{t.questionCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-subtle">Total marks</dt>
                  <dd className="font-medium text-ink">{t.totalMarks}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-subtle">Attempts</dt>
                  <dd className="font-medium text-ink">{t.attemptsUsed}/{t.maxAttempts}</dd>
                </div>
              </dl>

              {t.startAt && (
                <p className="mt-3 text-xs text-ink-muted">Opens {new Date(t.startAt).toLocaleString()}</p>
              )}
              {t.endAt && (
                <p className="text-xs text-ink-muted">Closes {new Date(t.endAt).toLocaleString()}</p>
              )}

              <div className="mt-4 flex-1" />
              {t.bestScore !== null && (
                <p className="mb-3 text-sm">
                  <span className="text-ink-muted">Best score: </span>
                  <span className="font-semibold text-ink">{t.bestScore}/{t.totalMarks}</span>
                </p>
              )}
              {t.canAttempt ? (
                <Link to={`/student/tests/${t.id}/exam`} className="btn-primary w-full">
                  {t.attemptsUsed > 0 ? 'Retake' : 'Start test'}
                </Link>
              ) : (
                <button disabled className="btn-secondary w-full">
                  {t.attemptsLeft === 0 ? 'No attempts left' : 'Not available'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
