import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, EmptyState, ErrorAlert, Field, Modal, PageHeader, Spinner } from '../components/ui.jsx';

const difficulties = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'];

export function QuestionBanksPage() {
  const [items, setItems] = useState(null);
  const [courses, setCourses] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [bankForm, setBankForm] = useState({ name: '', courseId: '' });
  const [activeBank, setActiveBank] = useState(null);
  const [genOpen, setGenOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  const navigate = useNavigate();

  const load = () => Promise.all([
    api.get('/question-banks').then((r) => setItems(r.data.data.items)),
    api.get('/courses').then((r) => setCourses(r.data.data.items)),
    api.get('/questions').then((r) => setQuestions(r.data.data.items)),
  ]).catch(setError);

  useEffect(() => { load(); }, []);

  const createBank = async () => {
    setBusy(true);
    setFormError(null);
    try {
      await api.post('/question-banks', bankForm);
      setCreateOpen(false);
      setBankForm({ name: '', courseId: '' });
      await load();
    } catch (err) {
      setFormError(err?.response?.data?.message ?? 'Failed to create bank');
    } finally {
      setBusy(false);
    }
  };

  const openBank = async (bank) => {
    try {
      const { data } = await api.get(`/question-banks/${bank.id}`);
      setActiveBank(data.data.bank);
    } catch (err) {
      setError(err);
    }
  };

  const addQuestion = async (questionId) => {
    if (!questionId) return;
    try {
      await api.post(`/question-banks/${activeBank.id}/questions`, { questionId });
      await openBank(activeBank);
    } catch (err) {
      setError(err);
    }
  };

  const removeQuestion = async (questionId) => {
    try {
      await api.delete(`/question-banks/${activeBank.id}/questions/${questionId}`);
      await openBank(activeBank);
    } catch (err) {
      setError(err);
    }
  };

  const deleteBank = async (bank) => {
    if (!window.confirm(`Delete bank "${bank.name}"?`)) return;
    try {
      await api.delete(`/question-banks/${bank.id}`);
      if (activeBank?.id === bank.id) setActiveBank(null);
      await load();
    } catch (err) {
      setError(err);
    }
  };

  const bankQuestionIds = activeBank?.questions?.map((q) => q.id) ?? [];
  const availableQuestions = questions.filter((q) => !bankQuestionIds.includes(q.id));

  return (
    <div>
      <PageHeader
        title="Question Banks"
        description="Organise questions into banks, then generate randomised tests from them."
        actions={<button onClick={() => { setBankForm({ name: '', courseId: '' }); setFormError(null); setCreateOpen(true); }} className="btn-primary">New bank</button>}
      />

      {error && <ErrorAlert error={error} />}
      {!items && <Spinner />}

      {items && items.length === 0 ? (
        <EmptyState title="No question banks yet" description="Create a bank to group your questions." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items?.map((b) => (
            <div key={b.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{b.name}</h3>
                  <p className="text-xs text-slate-500">{b.course?.name ?? 'No course'}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openBank(b)} className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">Open</button>
                  <button onClick={() => deleteBank(b)} className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600">{b.questions?.length ?? 0} questions</p>
            </div>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New question bank">
        <div className="space-y-4">
          {formError && <ErrorAlert error={formError} />}
          <Field label="Name">
            <input className="input" value={bankForm.name} onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })} />
          </Field>
          <Field label="Course (optional)">
            <select className="input" value={bankForm.courseId} onChange={(e) => setBankForm({ ...bankForm, courseId: e.target.value })}>
              <option value="">No course</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={createBank} disabled={busy || !bankForm.name} className="btn-primary">{busy ? 'Saving…' : 'Create'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(activeBank)} onClose={() => setActiveBank(null)} title={activeBank?.name} width="max-w-2xl">
        {activeBank && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{activeBank.questions?.length ?? 0} questions in bank</p>
              <button onClick={() => setGenOpen(true)} className="btn-primary">Generate test from bank</button>
            </div>

            <div>
              <label className="label">Add question</label>
              <select className="input" value="" onChange={(e) => addQuestion(e.target.value)}>
                <option value="">Select a question…</option>
                {availableQuestions.map((q) => (
                  <option key={q.id} value={q.id}>{q.text.slice(0, 80)} ({q.type})</option>
                ))}
              </select>
            </div>

            <ul className="divide-y divide-slate-100">
              {activeBank.questions?.map((q) => (
                <li key={q.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{q.text}</p>
                    <p className="text-xs text-slate-500">{q.type} · {q.difficulty} · {q.marks} pts</p>
                  </div>
                  <button onClick={() => removeQuestion(q.id)} className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Remove</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>

      <GenerateTestModal
        open={genOpen}
        bank={activeBank}
        courses={courses}
        onClose={() => setGenOpen(false)}
        onCreated={(test) => navigate(`/teacher/tests/${test.id}`)}
      />
    </div>
  );
}

function GenerateTestModal({ open, bank, courses, onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '',
    courseId: '',
    durationMinutes: 30,
    passingMarks: 0,
    negativeMarks: 0,
    maxAttempts: 1,
    shuffleQuestions: true,
    config: { EASY: '', MEDIUM: '', HARD: '', EXPERT: '' },
  });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm({
        title: bank ? `Random test — ${bank.name}` : '',
        courseId: bank?.courseId ?? '',
        durationMinutes: 30,
        passingMarks: 0,
        negativeMarks: 0,
        maxAttempts: 1,
        shuffleQuestions: true,
        config: { EASY: '', MEDIUM: '', HARD: '', EXPERT: '' },
      });
      setFormError(null);
    }
  }, [open, bank]);

  const generate = async () => {
    const config = difficulties
      .map((d) => ({ difficulty: d, count: Number(form.config[d] || 0) }))
      .filter((c) => c.count > 0);
    if (config.length === 0) { setFormError('Select at least one difficulty count'); return; }
    setBusy(true);
    setFormError(null);
    try {
      const { data } = await api.post(`/question-banks/${bank.id}/generate-test`, {
        title: form.title,
        courseId: form.courseId || undefined,
        durationMinutes: Number(form.durationMinutes),
        passingMarks: Number(form.passingMarks),
        negativeMarks: Number(form.negativeMarks),
        maxAttempts: Number(form.maxAttempts),
        shuffleQuestions: form.shuffleQuestions,
        config,
      });
      onClose();
      onCreated(data.data.test);
    } catch (err) {
      setFormError(err?.response?.data?.message ?? 'Failed to generate test');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Generate test from bank" width="max-w-xl">
      <div className="space-y-4">
        {formError && <ErrorAlert error={formError} />}
        <Field label="Test title">
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
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
          <Field label="Negative marks">
            <input type="number" min="0" className="input" value={form.negativeMarks} onChange={(e) => setForm({ ...form, negativeMarks: e.target.value })} />
          </Field>
        </div>

        <div>
          <label className="label">Questions per difficulty (how many to pick at random)</label>
          <div className="grid grid-cols-4 gap-3">
            {difficulties.map((d) => (
              <div key={d}>
                <input
                  type="number"
                  min="0"
                  className="input"
                  placeholder={d}
                  value={form.config[d]}
                  onChange={(e) => setForm({ ...form, config: { ...form.config, [d]: e.target.value } })}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.shuffleQuestions} onChange={(e) => setForm({ ...form, shuffleQuestions: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
            Shuffle question order
          </label>
          <label className="label mb-0">Max attempts</label>
          <input type="number" min="1" max="10" className="input w-24" value={form.maxAttempts} onChange={(e) => setForm({ ...form, maxAttempts: e.target.value })} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={generate} disabled={busy || !form.title} className="btn-primary">{busy ? 'Generating…' : 'Generate'}</button>
        </div>
      </div>
    </Modal>
  );
}
