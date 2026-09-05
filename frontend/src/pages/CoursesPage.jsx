import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { EmptyState, ErrorAlert, Field, Modal, PageHeader, Spinner } from '../components/ui.jsx';

const emptyForm = { name: '', code: '', description: '' };

export function CoursesPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = () => api.get('/courses').then((res) => setItems(res.data.data.items)).catch(setError);

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(emptyForm); setFormError(null); setModal('create'); };
  const openEdit = (course) => {
    setForm({ name: course.name, code: course.code, description: course.description ?? '' });
    setFormError(null);
    setModal(course.id);
  };

  const save = async () => {
    setBusy(true);
    setFormError(null);
    try {
      if (modal === 'create') await api.post('/courses', form);
      else await api.put(`/courses/${modal}`, form);
      setModal(null);
      await load();
    } catch (err) {
      setFormError(err?.response?.data?.message ?? 'Failed to save course');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (course) => {
    if (!window.confirm(`Delete course "${course.name}"?`)) return;
    try {
      await api.delete(`/courses/${course.id}`);
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
        title="Courses"
        description="Courses group tests and question banks together."
        actions={<button onClick={openCreate} className="btn-primary">New course</button>}
      />

      {items.length === 0 ? (
        <EmptyState title="No courses yet" action={<button onClick={openCreate} className="btn-primary">Create your first course</button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => (
            <div key={c.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{c.name}</h3>
                  <p className="text-xs font-medium text-brand-600">{c.code}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">Edit</button>
                  <button onClick={() => remove(c)} className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-600">{c.description || 'No description'}</p>
              <p className="mt-3 text-xs text-slate-400">
                {c._count?.tests ?? 0} tests · {c._count?.classBatches ?? 0} classes
              </p>
            </div>
          ))}
        </div>
      )}

      <Modal open={Boolean(modal)} onClose={() => setModal(null)} title={modal === 'create' ? 'New course' : 'Edit course'}>
        <div className="space-y-4">
          {formError && <ErrorAlert error={formError} />}
          <Field label="Name">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Introduction to Algorithms" />
          </Field>
          <Field label="Code">
            <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CS101" />
          </Field>
          <Field label="Description">
            <textarea className="input min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={busy || !form.name || !form.code} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
