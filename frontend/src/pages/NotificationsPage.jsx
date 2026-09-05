import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, EmptyState, ErrorAlert, PageHeader, Spinner, statusTone } from '../components/ui.jsx';
import { useToast } from '../components/toast.jsx';

export function NotificationsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const toast = useToast();

  const load = () => {
    const params = filter === 'unread' ? '?unreadOnly=true' : '';
    api.get(`/notifications${params}`)
      .then((res) => setData(res.data.data))
      .catch(setError);
  };

  useEffect(() => { load(); }, [filter]);

  const markRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      load();
    } catch (err) {
      toast.error('Failed to mark as read');
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      toast.success('All notifications marked as read');
      load();
    } catch (err) {
      toast.error('Failed to mark all as read');
    }
  };

  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Spinner />;

  const typeTone = {
    TEST_ASSIGNED: 'blue',
    TEST_REMINDER: 'amber',
    ASSIGNMENT_ASSIGNED: 'violet',
    ASSIGNMENT_DEADLINE: 'red',
    RESULT_PUBLISHED: 'green',
    TEACHER_FEEDBACK: 'green',
    SYSTEM: 'slate',
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={`You have ${data.unreadCount} unread notification${data.unreadCount === 1 ? '' : 's'}.`}
        actions={
          data.unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-secondary">Mark all as read</button>
          )
        }
      />

      <div className="mb-4 flex gap-2">
        {['all', 'unread'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              filter === f ? 'bg-brand-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {f === 'all' ? 'All' : 'Unread'}
          </button>
        ))}
      </div>

      {data.items.length === 0 ? (
        <EmptyState title="No notifications" description="You're all caught up!" />
      ) : (
        <div className="space-y-2">
          {data.items.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-4 rounded-xl border p-4 ${
                n.isRead ? 'border-slate-200 bg-white' : 'border-brand-200 bg-brand-50'
              }`}
            >
              <div className="shrink-0 pt-0.5">
                <Badge tone={typeTone[n.type] || 'slate'}>{n.type?.replace(/_/g, ' ')}</Badge>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">{n.title}</p>
                {n.message && <p className="mt-1 text-sm text-slate-600">{n.message}</p>}
                <p className="mt-1 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              {!n.isRead && (
                <button
                  onClick={() => markRead(n.id)}
                  className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
