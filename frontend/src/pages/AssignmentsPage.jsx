import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Badge, EmptyState, ErrorAlert, Field, Modal, PageHeader, Spinner } from '../components/ui.jsx';
import { useToast } from '../components/toast.jsx';

const emptyForm = { title: '', description: '', courseId: '', maxMarks: 10, dueAt: '' };

export function TeacherAssignmentsPage() {
  const [items, setItems] = useState(null);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const toast = useToast();

  const load = () => Promise.all([
    api.get('/assignments').then((r) => setItems(r.data.data.items)),
    api.get('/courses').then((r) => setCourses(r.data.data.items)),
  ]).catch(setError);

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(emptyForm); setFormError(null); setModal('create'); };
  const openEdit = (a) => {
    setForm({
      title: a.title,
      description: a.description ?? '',
      courseId: a.courseId ?? '',
      maxMarks: a.maxMarks,
      dueAt: a.dueAt ? new Date(a.dueAt).toISOString().slice(0, 16) : '',
    });
    setFormError(null);
    setModal(a.id);
  };

  const save = async () => {
    setBusy(true);
    setFormError(null);
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        courseId: form.courseId || undefined,
        maxMarks: Number(form.maxMarks),
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
      };
      if (modal === 'create') await api.post('/assignments', payload);
      else await api.put(`/assignments/${modal}`, payload);
      setModal(null);
      toast.success(modal === 'create' ? 'Assignment created' : 'Assignment updated');
      await load();
    } catch (err) {
      setFormError(err?.response?.data?.message ?? 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`Delete assignment "${a.title}"?`)) return;
    try {
      await api.delete(`/assignments/${a.id}`);
      toast.success('Assignment deleted');
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
        title="Assignments"
        description="Create homework and practice assignments for your students."
        actions={<button onClick={openCreate} className="btn-primary">New assignment</button>}
      />

      {items.length === 0 ? (
        <EmptyState title="No assignments yet" action={<button onClick={openCreate} className="btn-primary">Create your first assignment</button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((a) => (
            <div key={a.id} className="card flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-ink">{a.title}</h3>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(a)} className="rounded px-2 py-1 text-xs font-medium text-ink-muted hover:bg-canvas">Edit</button>
                  <button onClick={() => remove(a)} className="rounded px-2 py-1 text-xs font-medium text-critical-ink hover:bg-critical-soft">Delete</button>
                </div>
              </div>
              {a.course && <p className="mt-1 text-xs text-ink-muted">{a.course.name}</p>}
              <p className="mt-2 flex-1 text-sm text-ink-muted line-clamp-2">{a.description || 'No description'}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-subtle">Max marks</dt>
                  <dd className="font-medium text-ink">{a.maxMarks}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-subtle">Submissions</dt>
                  <dd className="font-medium text-ink">{a._count?.submissions ?? 0}</dd>
                </div>
              </dl>
              {a.dueAt && (
                <p className="mt-3 text-xs text-ink-muted">
                  Due: {new Date(a.dueAt).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={Boolean(modal)} onClose={() => setModal(null)} title={modal === 'create' ? 'New assignment' : 'Edit assignment'}>
        <div className="space-y-4">
          {formError && <ErrorAlert error={formError} />}
          <Field label="Title">
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Description">
            <textarea className="input min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Course (optional)">
              <select className="input" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
                <option value="">No course</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Max marks">
              <input type="number" min="0" className="input" value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: e.target.value })} />
            </Field>
          </div>
          <Field label="Due date (optional)">
            <input type="datetime-local" className="input" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={busy || !form.title} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function StudentAssignmentsPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [submitText, setSubmitText] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = () => api.get('/assignments').then((r) => setItems(r.data.data.items)).catch(setError);
  useEffect(() => { load(); }, []);

  const openAssignment = async (a) => {
    try {
      const { data } = await api.get(`/assignments/${a.id}`);
      setActiveAssignment(data.data.assignment);
      setSubmitText(data.data.assignment.mySubmission?.answerText ?? '');
    } catch (err) {
      setError(err);
    }
  };

  const submit = async () => {
    if (!activeAssignment) return;
    setBusy(true);
    try {
      await api.post(`/assignments/${activeAssignment.id}/submit`, {
        answerText: submitText || undefined,
      });
      toast.success('Assignment submitted');
      setActiveAssignment(null);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message ?? 'Failed to submit');
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorAlert error={error} />;
  if (!items) return <Spinner />;

  return (
    <div>
      <PageHeader title="My Assignments" description="View and submit your assignments." />

      {items.length === 0 ? (
        <EmptyState title="No assignments yet" description="Your teachers haven't posted any assignments." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((a) => (
            <div key={a.id} className="card flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-ink">{a.title}</h3>
                {a._count?.submissions > 0 ? (
                  <Badge tone="green">Submitted</Badge>
                ) : (
                  <Badge tone="amber">Pending</Badge>
                )}
              </div>
              {a.course && <p className="mt-1 text-xs text-ink-muted">{a.course.name}</p>}
              <p className="mt-2 flex-1 text-sm text-ink-muted line-clamp-2">{a.description || 'No description'}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-subtle">Max marks</dt>
                  <dd className="font-medium text-ink">{a.maxMarks}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-subtle">Created by</dt>
                  <dd className="font-medium text-ink">{a.createdBy?.fullName ?? 'Teacher'}</dd>
                </div>
              </dl>
              {a.dueAt && (
                <p className="mt-3 text-xs text-ink-muted">
                  Due: {new Date(a.dueAt).toLocaleDateString()}
                  {new Date(a.dueAt) < new Date() && <span className="ml-2 font-medium text-critical-ink">Overdue</span>}
                </p>
              )}
              <div className="mt-4 flex-1" />
              <button onClick={() => openAssignment(a)} className="btn-primary w-full">
                {a._count?.submissions > 0 ? 'View / Resubmit' : 'Open'}
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={Boolean(activeAssignment)} onClose={() => setActiveAssignment(null)} title={activeAssignment?.title} width="max-w-2xl">
        {activeAssignment && (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">{activeAssignment.description}</p>
            {activeAssignment.dueAt && (
              <p className="text-xs text-ink-muted">Due: {new Date(activeAssignment.dueAt).toLocaleString()}</p>
            )}

            {activeAssignment.mySubmission && (
              <div className="rounded-lg bg-positive-soft p-3 text-sm text-positive-ink">
                <p className="font-semibold">Previous submission</p>
                <p className="mt-1 text-xs text-positive-ink">
                  Submitted: {new Date(activeAssignment.mySubmission.submittedAt).toLocaleString()}
                  {activeAssignment.mySubmission.marks !== null && ` · Marks: ${activeAssignment.mySubmission.marks}/${activeAssignment.maxMarks}`}
                </p>
                {activeAssignment.mySubmission.feedback && (
                  <p className="mt-1 text-xs">Feedback: {activeAssignment.mySubmission.feedback}</p>
                )}
              </div>
            )}

            <Field label="Your answer">
              <textarea
                className="input min-h-[150px]"
                placeholder="Type your answer here…"
                value={submitText}
                onChange={(e) => setSubmitText(e.target.value)}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setActiveAssignment(null)} className="btn-secondary">Cancel</button>
              <button onClick={submit} disabled={busy || !submitText.trim()} className="btn-primary">
                {busy ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
