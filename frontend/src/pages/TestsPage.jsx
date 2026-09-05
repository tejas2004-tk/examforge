import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, EmptyState, ErrorAlert, Field, Modal, PageHeader, Spinner, statusTone } from '../components/ui.jsx';

const emptyTest = {
  title: '',
  courseId: '',
  description: '',
  durationMinutes: 30,
  passingMarks: 0,
  negativeMarks: 0,
  maxAttempts: 1,
  shuffleQuestions: false,
  randomOptionOrder: false,
  showResultImmediately: true,
  startAt: '',
  endAt: '',
  questionIds: [],
};

export function TestsPage({ basePath = '/teacher/tests' }) {
  const [items, setItems] = useState(null);
  const [courses, setCourses] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyTest);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = () => Promise.all([
    api.get('/tests').then((r) => setItems(r.data.data.items)),
    api.get('/courses').then((r) => setCourses(r.data.data.items)),
    api.get('/questions').then((r) => setQuestions(r.data.data.items)),
  ]).catch(setError);

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(emptyTest); setFormError(null); setCreateOpen(true); };

  const toggleQuestion = (id) => {
    const has = form.questionIds.includes(id);
    setForm({ ...form, questionIds: has ? form.questionIds.filter((q) => q !== id) : [...form.questionIds, id] });
  };

  const create = async () => {
    if (!form.title || form.questionIds.length === 0) {
      setFormError('Add a title and at least one question');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const payload = {
        ...form,
        courseId: form.courseId || undefined,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
        durationMinutes: Number(form.durationMinutes),
        passingMarks: Number(form.passingMarks),
        negativeMarks: Number(form.negativeMarks),
        maxAttempts: Number(form.maxAttempts),
      };
      const { data } = await api.post('/tests', payload);
      setCreateOpen(false);
      await load();
      window.location.href = `${basePath}/${data.data.test.id}`;
    } catch (err) {
      setFormError(err?.response?.data?.message ?? 'Failed to create test');
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorAlert error={error} />;
  if (!items) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Tests"
        description="Build tests from your questions, publish them, and assign to students."
        actions={<button onClick={openCreate} className="btn-primary">New test</button>}
      />

      {items.length === 0 ? (
        <EmptyState title="No tests yet" action={<button onClick={openCreate} className="btn-primary">Create your first test</button>} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-subtle">
                <th className="pb-3 pr-4 font-medium">Title</th>
                <th className="pb-3 pr-4 font-medium">Course</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Duration</th>
                <th className="pb-3 pr-4 font-medium">Questions</th>
                <th className="pb-3 pr-4 font-medium">Marks</th>
                <th className="pb-3 pr-4 font-medium">Attempts</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((t) => (
                <tr key={t.id}>
                  <td className="max-w-[280px] py-3 pr-4">
                    <p className="truncate font-medium text-ink">{t.title}</p>
                  </td>
                  <td className="py-3 pr-4 text-ink-muted">{t.course?.name ?? '—'}</td>
                  <td className="py-3 pr-4"><Badge tone={statusTone(t.status)}>{t.status}</Badge></td>
                  <td className="py-3 pr-4 text-ink-muted">{t.durationMinutes} min</td>
                  <td className="py-3 pr-4 text-ink-muted">{t._count.testQuestions}</td>
                  <td className="py-3 pr-4 font-semibold text-ink">{Number(t.totalMarks)}</td>
                  <td className="py-3 pr-4 text-ink-muted">{t.maxAttempts}</td>
                  <td className="py-3 text-right">
                    <Link to={`${basePath}/${t.id}`} className="text-sm font-medium text-accent hover:text-accent">
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New test" width="max-w-2xl">
        <div className="space-y-4">
          {formError && <ErrorAlert error={formError} />}
          <Field label="Title">
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Description">
            <textarea className="input min-h-[60px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Course (optional)">
              <select className="input" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
                <option value="">No course</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Duration (minutes)">
              <input type="number" min="1" className="input" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            </Field>
            <Field label="Passing marks">
              <input type="number" min="0" className="input" value={form.passingMarks} onChange={(e) => setForm({ ...form, passingMarks: e.target.value })} />
            </Field>
            <Field label="Negative marks (per wrong answer)">
              <input type="number" min="0" className="input" value={form.negativeMarks} onChange={(e) => setForm({ ...form, negativeMarks: e.target.value })} />
            </Field>
            <Field label="Max attempts">
              <input type="number" min="1" max="10" className="input" value={form.maxAttempts} onChange={(e) => setForm({ ...form, maxAttempts: e.target.value })} />
            </Field>
            <Field label="Opens at (optional)">
              <input type="datetime-local" className="input" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
            </Field>
            <Field label="Closes at (optional)">
              <input type="datetime-local" className="input" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
            </Field>
          </div>

          <div>
            <label className="label">Questions ({form.questionIds.length} selected)</label>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
              {questions.length === 0 && <p className="px-2 py-1 text-sm text-ink-subtle">No questions available — create some first.</p>}
              {questions.map((q) => (
                <label key={q.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-canvas">
                  <input
                    type="checkbox"
                    checked={form.questionIds.includes(q.id)}
                    onChange={() => toggleQuestion(q.id)}
                    className="h-4 w-4 rounded border-line-strong text-accent"
                  />
                  <span className="truncate">{q.text}</span>
                  <span className="ml-auto shrink-0 text-xs text-ink-subtle">{q.type} · {q.marks} pts</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={form.shuffleQuestions} onChange={(e) => setForm({ ...form, shuffleQuestions: e.target.checked })} className="h-4 w-4 rounded border-line-strong text-accent" />
              Shuffle order
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={form.randomOptionOrder} onChange={(e) => setForm({ ...form, randomOptionOrder: e.target.checked })} className="h-4 w-4 rounded border-line-strong text-accent" />
              Random option order
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={form.showResultImmediately} onChange={(e) => setForm({ ...form, showResultImmediately: e.target.checked })} className="h-4 w-4 rounded border-line-strong text-accent" />
              Show result immediately
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={create} disabled={busy} className="btn-primary">{busy ? 'Creating…' : 'Create'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
