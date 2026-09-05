import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Badge, EmptyState, ErrorAlert, Field, Modal, PageHeader, Spinner } from '../../components/ui.jsx';
import { useToast } from '../../components/toast.jsx';

export function AdminAuditPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const toast = useToast();

  const load = () => {
    api.get(`/audit-logs?page=${page}&limit=20`)
      .then((res) => setData(res.data.data))
      .catch(setError);
  };

  useEffect(() => { load(); }, [page]);

  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Spinner />;

  const totalPages = Math.ceil(data.total / 20);

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="System audit trail of all important operations."
      />

      {data.items.length === 0 ? (
        <EmptyState title="No audit logs yet" description="Actions will be logged as users interact with the system." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-3 pr-4 font-medium">Action</th>
                <th className="pb-3 pr-4 font-medium">Entity</th>
                <th className="pb-3 pr-4 font-medium">Entity ID</th>
                <th className="pb-3 pr-4 font-medium">User</th>
                <th className="pb-3 pr-4 font-medium">IP</th>
                <th className="pb-3 pr-4 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((log) => (
                <tr key={log.id}>
                  <td className="py-3 pr-4"><Badge tone="blue">{log.action}</Badge></td>
                  <td className="py-3 pr-4 text-slate-600">{log.entity}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-500">{log.entityId?.slice(0, 12) ?? '—'}</td>
                  <td className="py-3 pr-4 text-slate-600">{log.user?.fullName ?? log.user?.email ?? 'System'}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-500">{log.ip ?? '—'}</td>
                  <td className="py-3 pr-4 text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Page {data.page} of {totalPages} ({data.total} total)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
