import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Badge, EmptyState, ErrorAlert, Field, Modal, PageHeader, Spinner } from '../components/ui.jsx';

const roles = ['ADMIN', 'TEACHER', 'STUDENT'];
const roleTone = {
  ADMIN: 'violet',
  TEACHER: 'blue',
  STUDENT: 'green',
};

const emptyForm = { email: '', username: '', fullName: '', password: '', role: 'STUDENT' };

export function UsersPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = () => api.get('/users').then((res) => setItems(res.data.data.items)).catch(setError);
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(emptyForm); setFormError(null); setModal('create'); };
  const openEdit = (u) => {
    setForm({ email: u.email, username: u.username, fullName: u.fullName ?? '', password: '', role: u.role });
    setFormError(null);
    setModal(u.id);
  };

  const save = async () => {
    setBusy(true);
    setFormError(null);
    try {
      if (modal === 'create') {
        await api.post('/users', {
          email: form.email,
          username: form.username,
          fullName: form.fullName || undefined,
          password: form.password,
          role: form.role,
        });
      } else {
        await api.patch(`/users/${modal}`, { role: form.role, fullName: form.fullName || undefined });
      }
      setModal(null);
      await load();
    } catch (err) {
      setFormError(err?.response?.data?.message ?? 'Failed to save user');
    } finally {
      setBusy(false);
    }
  };

  const toggleBlock = async (u) => {
    try {
      await api.patch(`/users/${u.id}`, { isBlocked: !u.isBlocked });
      await load();
    } catch (err) {
      setError(err);
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Delete user ${u.email}? This also removes their tests and attempts.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      await load();
    } catch (err) {
      setError(err);
    }
  };

  if (error) return <ErrorAlert error={error} />;
  if (!items) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Users"
        description="Only administrators can create staff credentials and manage access."
        actions={<button onClick={openCreate} className="btn-primary">Create account</button>}
      />

      {items.length === 0 ? (
        <EmptyState title="No users" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-3 pr-4 font-medium">User</th>
                <th className="pb-3 pr-4 font-medium">Role</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Last login</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 pr-4">
                    <p className="font-medium text-slate-900">{u.fullName ?? u.username}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="py-3 pr-4"><Badge tone={roleTone[u.role]}>{u.role}</Badge></td>
                  <td className="py-3 pr-4">
                    {u.isBlocked ? <Badge tone="red">Blocked</Badge> : u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="amber">Inactive</Badge>}
                  </td>
                  <td className="py-3 pr-4 text-slate-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}</td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(u)} className="mr-2 rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">Edit</button>
                    <button onClick={() => toggleBlock(u)} className="mr-2 rounded px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50">
                      {u.isBlocked ? 'Unblock' : 'Block'}
                    </button>
                    <button onClick={() => remove(u)} className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(modal)} onClose={() => setModal(null)} title={modal === 'create' ? 'Create account' : 'Edit user'}>
        <div className="space-y-4">
          {formError && <ErrorAlert error={formError} />}
          {modal === 'create' && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">These credentials are issued by an administrator. Public registration is limited to student accounts.</p>}
          <Field label="Email">
            <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={modal !== 'create'} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Username">
              <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} disabled={modal !== 'create'} />
            </Field>
            <Field label="Full name">
              <input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </Field>
          </div>
          {modal === 'create' && (
            <Field label="Password">
              <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
          )}
          <Field label="Role">
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
