import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Badge, ErrorAlert, Spinner, statusTone } from './ui.jsx';

const typeLabel = {
  SINGLE: 'Single choice',
  MULTIPLE: 'Multiple choice',
  TRUE_FALSE: 'True/False',
  FILL_BLANK: 'Fill in the blank',
  SUBJECTIVE: 'Subjective',
  CODING: 'Coding',
};

export function ResultDetail({ attemptId, onGrade }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [gradeValues, setGradeValues] = useState({});
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    api.get(`/results/${attemptId}`)
      .then((res) => setData(res.data.data))
      .catch(setError);
  }, [attemptId]);

  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Spinner />;

  const { attempt, test, student, questions } = data;

  const handleGrade = async (q) => {
    const marks = Number(gradeValues[q.questionId]);
    if (!Number.isFinite(marks) || marks < 0 || marks > q.marks) return;
    setSaving(q.questionId);
    try {
      await api.post(`/attempts/${attemptId}/grade`, { answerId: q.answerId, marks });
      const { data: fresh } = await api.get(`/results/${attemptId}`);
      setData(fresh.data);
      setSaving(null);
    } catch (err) {
      setSaving(null);
      setError(err);
    }
  };

  const scoreBar = attempt.percentage !== null ? `${Math.max(0, Math.min(100, attempt.percentage))}%` : null;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{test.title}</h1>
          <Badge tone={statusTone(attempt.status)}>{attempt.status}</Badge>
          {attempt.passed !== null && (
            attempt.passed ? <Badge tone="green">Passed</Badge> : <Badge tone="red">Failed</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {test.course?.name ?? 'No course'} · {questions.length} questions · Pass mark {test.passingMarks}
          {student && ` · ${student.fullName ?? student.email}`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-400">Score</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {attempt.score !== null ? `${attempt.score}/${test.totalMarks}` : '—'}
          </p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-400">Percentage</p>
          <p className="mt-1 text-3xl font-bold text-brand-600">{scoreBar ?? '—'}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-400">Time taken</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {attempt.timeTakenSeconds !== null ? `${Math.floor(attempt.timeTakenSeconds / 60)}m ${attempt.timeTakenSeconds % 60}s` : '—'}
          </p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-400">Submitted</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{new Date(attempt.submittedAt).toLocaleString()}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-400">Flags</p>
          <p className="mt-1 text-3xl font-bold text-amber-600">
            {Array.isArray(attempt.suspiciousEvents) ? attempt.suspiciousEvents.length : 0}
          </p>
        </div>
      </div>

      {Array.isArray(attempt.suspiciousEvents) && attempt.suspiciousEvents.length > 0 && (
        <div className="card border-amber-200 bg-amber-50">
          <p className="text-sm font-semibold text-amber-800">Suspicious activity detected</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {attempt.suspiciousEvents.map((e, i) => (
              <span key={i} className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {e.type}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {questions.map((q, idx) => {
          const graded = q.isCorrect !== null;
          return (
            <div key={q.questionId} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-900">
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {idx + 1}
                  </span>
                  {q.text}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone="blue">{typeLabel[q.type] ?? q.type}</Badge>
                  <span className="text-xs font-semibold text-slate-600">{q.marks} pts</span>
                  {graded ? (
                    <Badge tone={q.isCorrect ? 'green' : 'red'}>
                      {q.marksObtained}/{q.marks}
                    </Badge>
                  ) : (
                    <Badge tone="amber">Not graded</Badge>
                  )}
                </div>
              </div>

              {q.options?.length > 0 && (
                <div className="mt-4 space-y-2">
                  {q.options.map((opt) => {
                    const isRight = opt.isCorrect;
                    const isChosen = opt.selected;
                    const cls = isRight
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : isChosen
                        ? 'border-red-300 bg-red-50 text-red-900'
                        : 'border-slate-200 bg-white text-slate-700';
                    const mark = isRight ? 'Correct' : isChosen ? 'Your answer' : '';
                    return (
                      <div key={opt.id} className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm ${cls}`}>
                        <span>{opt.text}</span>
                        {mark && <span className="text-xs font-semibold">{mark}</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {(q.type === 'FILL_BLANK' || q.type === 'SUBJECTIVE' || q.type === 'CODING') && (
                <div className="mt-4">
                  <p className="label">Your answer</p>
                  {q.answerJson !== null && q.answerJson !== undefined ? (
                    <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-sm text-slate-700">
                      {typeof q.answerJson === 'string' ? q.answerJson : JSON.stringify(q.answerJson, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-sm text-slate-400">No answer</p>
                  )}
                </div>
              )}

              {q.explanation && (
                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <span className="font-semibold">Explanation: </span>{q.explanation}
                </div>
              )}

              {onGrade && q.requiresManualGrading && (
                <div className="mt-4 flex items-end gap-2 border-t border-slate-100 pt-3">
                  <div>
                    <label className="label">Marks (max {q.marks})</label>
                    <input
                      type="number"
                      min="0"
                      max={q.marks}
                      className="input w-32"
                      value={gradeValues[q.questionId] ?? (graded ? q.marksObtained : '')}
                      onChange={(e) => setGradeValues((v) => ({ ...v, [q.questionId]: e.target.value }))}
                    />
                  </div>
                  <button onClick={() => handleGrade(q)} disabled={saving === q.questionId} className="btn-primary">
                    {saving === q.questionId ? 'Saving…' : 'Save marks'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
