import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Badge, EmptyState, ErrorAlert, PageHeader, Spinner } from '../../components/ui.jsx';

const statusTone = (status) => ({
  ACTIVE: 'green',
  ENDED: 'slate',
  FLAGGED: 'red',
}[status] ?? 'slate');

export function ProctoringDashboard() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);

  const load = () =>
    api.get('/proctoring/sessions/active')
      .then((r) => setSessions(r.data.data.sessions))
      .catch(setError);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const endSession = async (s) => {
    if (!window.confirm('End this proctoring session?')) return;
    try {
      await api.post(`/proctoring/sessions/${s.id}/end`);
      await load();
    } catch (err) {
      setError(err);
    }
  };

  const alertStudent = async (s) => {
    try {
      await api.post(`/proctoring/sessions/${s.id}/alert`);
      await load();
    } catch (err) {
      setError(err);
    }
  };

  if (error) return <ErrorAlert error={error} />;
  if (!sessions) return <Spinner label="Loading proctoring sessions…" />;

  const highReported = sessions.filter((s) => s.eventCount > 0);
  const flagged = sessions.filter((s) => s.suspicionScore >= 40);

  return (
    <div>
      <PageHeader
        title="Proctoring Dashboard"
        description="Monitor active exam sessions for suspicious activity in real time."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active Sessions" value={sessions.length} />
        <StatCard label="Flagged for Review" value={flagged.length} tone="red" />
        <StatCard label="Sessions with Events" value={highReported.length} tone="amber" />
      </div>

      {sessions.length === 0 && (
        <EmptyState title="No active proctoring sessions" description="Sessions appear here when students begin a proctored exam." />
      )}

      <div className="space-y-3">
        {sessions.map((s) => (
          <div key={s.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{s.student?.fullName || s.studentId}</p>
                <p className="text-sm text-ink-muted">
                  {s.test?.title || 'Unknown test'} · Started {new Date(s.startedAt).toLocaleTimeString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                <Badge tone={s.suspicionScore >= 40 ? 'red' : s.suspicionScore > 0 ? 'amber' : 'green'}>
                  Suspicion: {Math.round(s.suspicionScore)}%
                </Badge>
              </div>
            </div>

            {s.lastEvent && (
              <div className="mt-3 rounded-lg bg-canvas p-3 text-sm text-ink-muted">
                <span className="font-medium text-ink">Last event: </span>
                {s.lastEvent.type}
                <span className="text-ink-subtle"> — {new Date(s.lastEvent.createdAt).toLocaleTimeString()}</span>
                {s.lastEvent.details && <span className="block text-xs text-ink-muted">{JSON.stringify(s.lastEvent.details)}</span>}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => alertStudent(s)} className="btn btn-ghost">Alert Student</button>
              <button onClick={() => endSession(s)} className="btn btn-danger">End Session</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'text-ink',
    red: 'text-critical-ink',
    amber: 'text-caution-ink',
  };
  return (
    <div className="card p-5">
      <p className={`text-3xl font-bold ${tones[tone]}`}>{value}</p>
      <p className="mt-1 text-sm text-ink-muted">{label}</p>
    </div>
  );
}