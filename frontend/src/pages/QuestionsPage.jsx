import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Badge, EmptyState, ErrorAlert, Field, Modal, PageHeader, Spinner } from '../components/ui.jsx';

const types = ['SINGLE', 'MULTIPLE', 'TRUE_FALSE', 'FILL_BLANK', 'SUBJECTIVE', 'CODING'];
const difficulties = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'];
const optionTypes = ['SINGLE', 'MULTIPLE', 'TRUE_FALSE'];
const textTypes = ['FILL_BLANK', 'SUBJECTIVE', 'CODING'];

const emptyQuestion = {
  text: '',
  type: 'SINGLE',
  difficulty: 'MEDIUM',
  marks: 1,
  negativeMarks: 0,
  explanation: '',
  correctAnswer: '',
  options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }],
};

export function QuestionsPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyQuestion);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = () => api.get('/questions').then((res) => setItems(res.data.data.items)).catch(setError);
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(emptyQuestion); setFormError(null); setModal('create'); };
  const openEdit = (q) => {
    setForm({
      text: q.text,
      type: q.type,
      difficulty: q.difficulty,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      explanation: q.explanation ?? '',
      correctAnswer: Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : (q.correctAnswer ?? ''),
      options: q.options?.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) ?? [{ text: '', isCorrect: false }, { text: '', isCorrect: false }],
    });
    setFormError(null);
    setModal(q.id);
  };

  const valid = () => {
    if (!form.text.trim()) return 'Question text is required';
    if (optionTypes.includes(form.type)) {
      if (form.options.length < 2 || form.options.some((o) => !o.text.trim())) return 'Add at least two options with text';
      const correct = form.options.filter((o) => o.isCorrect).length;
      if (form.type !== 'MULTIPLE' && correct !== 1) return 'Exactly one correct option is required';
      if (form.type === 'MULTIPLE' && correct < 1) return 'At least one correct option is required';
    }
    if (form.type === 'FILL_BLANK' && !form.correctAnswer.trim()) return 'A correct answer is required';
    return null;
  };

  const save = async () => {
    const problem = valid();
    if (problem) { setFormError(problem); return; }
    setBusy(true);
    setFormError(null);
    try {
      const payload = {
        text: form.text,
        type: form.type,
        difficulty: form.difficulty,
        marks: Number(form.marks),
        negativeMarks: Number(form.negativeMarks),
        explanation: form.explanation || undefined,
      };
      if (optionTypes.includes(form.type)) {
        payload.options = form.options.map((o, i) => ({ text: o.text.trim(), isCorrect: o.isCorrect, orderIndex: i }));
      }
      if (form.type === 'FILL_BLANK') {
        payload.correctAnswer = form.correctAnswer.trim();
      }
      if (modal === 'create') await api.post('/questions', payload);
      else await api.put(`/questions/${modal}`, payload);
      setModal(null);
      await load();
    } catch (err) {
      setFormError(err?.response?.data?.message ?? 'Failed to save question');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (q) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await api.delete(`/questions/${q.id}`);
      await load();
    } catch (err) {
      setError(err);
    }
  };

  const updateOption = (i, patch) => {
    const options = form.options.map((o, idx) => (idx === i ? { ...o, ...patch } : o));
    if (form.type !== 'MULTIPLE' && patch.isCorrect) {
      for (const o of options) o.isCorrect = false;
      options[i].isCorrect = true;
    }
    setForm({ ...form, options });
  };

  const changeType = (type) => {
    const opts = textTypes.includes(type) || type === 'SINGLE' ? [] : form.options;
    setForm({ ...form, type, options: opts.length >= 2 ? opts : emptyQuestion.options });
  };

  if (error) return <ErrorAlert error={error} />;
  if (!items) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Questions"
        description="Reusable questions for your tests. Pick a type — option-based questions are auto-graded."
        actions={<button onClick={openCreate} className="btn-primary">New question</button>}
      />

      {items.length === 0 ? (
        <EmptyState title="No questions yet" action={<button onClick={openCreate} className="btn-primary">Create your first question</button>} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-3 pr-4 font-medium">Question</th>
                <th className="pb-3 pr-4 font-medium">Type</th>
                <th className="pb-3 pr-4 font-medium">Difficulty</th>
                <th className="pb-3 pr-4 font-medium">Marks</th>
                <th className="pb-3 pr-4 font-medium">Answer</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((q) => (
                <tr key={q.id}>
                  <td className="max-w-[320px] py-3 pr-4">
                    <p className="truncate font-medium text-slate-900">{q.text}</p>
                  </td>
                  <td className="py-3 pr-4"><Badge tone="blue">{q.type}</Badge></td>
                  <td className="py-3 pr-4 text-slate-600">{q.difficulty}</td>
                  <td className="py-3 pr-4 font-semibold text-slate-900">{q.marks}</td>
                  <td className="py-3 pr-4 text-xs text-slate-500">
                    {optionTypes.includes(q.type) ? `${q.options?.filter((o) => o.isCorrect).length ?? 0} correct` : (q.type === 'FILL_BLANK' ? String(q.correctAnswer ?? '') : 'Manual')}
                  </td>
                  <td className="py-3 text-right">
                    <button onClick={() => openEdit(q)} className="mr-2 rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">Edit</button>
                    <button onClick={() => remove(q)} className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(modal)} onClose={() => setModal(null)} title={modal === 'create' ? 'New question' : 'Edit question'} width="max-w-2xl">
        <div className="space-y-4">
          {formError && <ErrorAlert error={formError} />}

          <Field label="Question text">
            <textarea className="input min-h-[70px]" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
          </Field>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Type">
              <select className="input" value={form.type} onChange={(e) => changeType(e.target.value)}>
                {types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Difficulty">
              <select className="input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                {difficulties.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Marks">
              <input type="number" min="0" step="0.5" className="input" value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} />
            </Field>
            <Field label="Negative">
              <input type="number" min="0" step="0.5" className="input" value={form.negativeMarks} onChange={(e) => setForm({ ...form, negativeMarks: e.target.value })} />
            </Field>
          </div>

          {optionTypes.includes(form.type) && (
            <div>
              <label className="label">Options {form.type === 'MULTIPLE' ? '(tick all correct)' : '(tick the correct one)'}</label>
              <div className="space-y-2">
                {form.options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={o.isCorrect}
                      onChange={(e) => updateOption(i, { isCorrect: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <input
                      className="input"
                      value={o.text}
                      onChange={(e) => updateOption(i, { text: e.target.value })}
                      placeholder={`Option ${i + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, options: form.options.filter((_, idx) => idx !== i) })}
                      className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, options: [...form.options, { text: '', isCorrect: false }] })}
                className="mt-2 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                + Add option
              </button>
            </div>
          )}

          {form.type === 'FILL_BLANK' && (
            <Field label="Correct answer (comma-separate for multiple accepted)">
              <input className="input" value={form.correctAnswer} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })} />
            </Field>
          )}

          <Field label="Explanation (optional)">
            <textarea className="input min-h-[60px]" value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
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
