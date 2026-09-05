import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { ErrorAlert, Spinner } from '../../components/ui.jsx';

const toArray = (v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : []);

export function ExamPage() {
  const { testId } = useParams();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(null);
  const [saveState, setSaveState] = useState('idle');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [finishState, setFinishState] = useState(null);

  const answersRef = useRef({});
  const attemptIdRef = useRef(null);
  const saveTimer = useRef(null);
  const lastEventSent = useRef({});

  useEffect(() => {
    api.post(`/tests/${testId}/start`)
      .then((res) => {
        const data = res.data.data;
        setAttempt(data.attempt);
        setQuestions(data.questions);
        attemptIdRef.current = data.attempt.id;
        const initial = {};
        for (const a of data.answers) initial[a.questionId] = { optionId: a.optionId, answerJson: a.answerJson };
        answersRef.current = initial;
        setAnswers(initial);
        setRemaining(data.remainingSeconds);
      })
      .catch((err) => {
        const msg = err?.response?.data?.message ?? 'Could not start the test.';
        setError(new Error(msg));
      });
  }, [testId]);

  const goToResult = useCallback((attemptId) => {
    navigate(`/student/results/${attemptId}`, { replace: true });
  }, [navigate]);

  const handleTimeUp = useCallback((attemptId) => {
    setFinishState({ type: 'timeup', attemptId });
    goToResult(attemptId);
  }, [goToResult]);

  const timeUpAttemptId = useCallback((err) => err?.response?.data?.details?.attemptId, []);

  const persist = useCallback(async () => {
    const attemptId = attemptIdRef.current;
    if (!attemptId) return;
    const entries = Object.entries(answersRef.current);
    setSaveState('saving');
    for (const [questionId, ans] of entries) {
      try {
        await api.put(`/attempts/${attemptId}/answers`, {
          questionId,
          optionId: ans?.optionId ?? undefined,
          answerJson: ans?.answerJson ?? undefined,
        });
      } catch (err) {
        if (err?.response?.status === 409) {
          handleTimeUp(timeUpAttemptId(err));
          return;
        }
      }
    }
    setSaveState('saved');
  }, [handleTimeUp, timeUpAttemptId]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('pending');
    saveTimer.current = setTimeout(() => persist(), 700);
  }, [persist]);

  const setAnswer = (questionId, patch) => {
    const next = { ...answersRef.current, [questionId]: { ...answersRef.current[questionId], ...patch } };
    answersRef.current = next;
    setAnswers(next);
    scheduleSave();
  };

  // Timer
  useEffect(() => {
    if (remaining === null) return;
    const deadline = Date.now() + remaining * 1000;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !submittingRef.current && attemptIdRef.current) {
        setInterval && clearInterval(interval);
        doSubmit('timeup');
      }
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining === null]);

  const submittingRef = useRef(false);

  const doSubmit = useCallback(async (reason = 'manual') => {
    const attemptId = attemptIdRef.current;
    if (!attemptId || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        await persist();
      }
      const res = await api.post(`/attempts/${attemptId}/submit`);
      const result = res.data.data;
      if (result?.result?.passed !== undefined || result?.result !== undefined) {
        goToResult(attemptId);
      } else {
        setFinishState({ type: reason === 'timeup' ? 'timeup' : 'submitted', attemptId });
        goToResult(attemptId);
      }
    } catch (err) {
      submittingRef.current = false;
      setSubmitting(false);
      if (err?.response?.status === 409) {
        handleTimeUp(timeUpAttemptId(err));
      } else {
        setError(err);
      }
    }
  }, [goToResult, handleTimeUp, persist, timeUpAttemptId]);

  const handleSubmitClick = () => {
    if (window.confirm('Submit your test? You cannot change answers afterwards.')) {
      doSubmit();
    }
  };

  // Anti-cheat / suspicious events
  useEffect(() => {
    if (!attempt) return;
    const send = (type, details = {}) => {
      const now = Date.now();
      if (lastEventSent.current[type] && now - lastEventSent.current[type] < 10000) return;
      lastEventSent.current[type] = now;
      api.post(`/attempts/${attemptIdRef.current}/events`, { type, details }).catch(() => {});
    };
    const onVisibility = () => { if (document.hidden) send('TAB_SWITCH'); };
    const onBlur = () => send('WINDOW_BLUR');
    const onFullscreen = () => { if (!document.fullscreenElement) send('FULLSCREEN_EXIT'); };
    const onCopy = () => send('COPY');
    const onPaste = () => send('PASTE');
    const onContext = () => send('CONTEXT_MENU');
    let lastResize = 0;
    const onResize = () => {
      const now = Date.now();
      if (now - lastResize < 5000) return;
      lastResize = now;
      send('WINDOW_RESIZE');
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContext);
    window.addEventListener('resize', onResize);
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContext);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [attempt]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl">
        <ErrorAlert error={error} />
        <Link to="/student/tests" className="btn-secondary mt-4">Back to tests</Link>
      </div>
    );
  }
  if (!attempt || remaining === null) return <Spinner label="Starting your test…" />;

  const answeredCount = Object.values(answers).filter((a) => a && (a.optionId !== undefined || (a.answerJson ?? '').toString().trim())).length;
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  const toggleOption = (q, option) => {
    const current = answers[q.id];
    if (q.type === 'MULTIPLE') {
      const selected = new Set(toArray(current?.answerJson?.optionIds));
      if (selected.has(option.id)) selected.delete(option.id);
      else selected.add(option.id);
      setAnswer(q.id, { optionId: undefined, answerJson: { optionIds: [...selected] } });
    } else {
      setAnswer(q.id, { optionId: option.id, answerJson: undefined });
    }
  };

  const isSelected = (q, optionId) => {
    const current = answers[q.id];
    if (q.type === 'MULTIPLE') return toArray(current?.answerJson?.optionIds).includes(optionId);
    return current?.optionId === optionId;
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="sticky top-0 z-10 -mx-8 mb-6 border-b border-slate-200 bg-slate-100/95 px-8 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-slate-900">{attempt.test.title}</p>
            <p className="text-xs text-slate-500">
              {questions.length} questions · {attempt.test.totalMarks} marks · Pass {attempt.test.passingMarks}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{answeredCount}/{questions.length} answered</span>
            <span className="text-xs text-slate-400">
              {saveState === 'saving' ? 'Saving…' : saveState === 'pending' ? 'Unsaved' : saveState === 'saved' ? 'Saved' : ''}
            </span>
            <span className={`rounded-lg px-3 py-1 font-mono text-sm font-bold tabular-nums ${remaining < 60 ? 'bg-red-100 text-red-700' : 'bg-white text-slate-900'}`}>
              {mm}:{ss}
            </span>
            <button onClick={handleSubmitClick} disabled={submitting} className="btn-primary px-3 py-1.5">
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {questions.map(({ orderIndex, question: q }) => (
          <div key={q.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-slate-900">
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                  {orderIndex + 1}
                </span>
                {q.text}
              </p>
              <div className="shrink-0 text-right">
                <p className="text-xs font-semibold text-slate-700">{q.marks} pts</p>
                {q.negativeMarks > 0 && <p className="text-xs text-red-500">-{q.negativeMarks} wrong</p>}
              </div>
            </div>

            {q.type === 'FILL_BLANK' && (
              <input
                className="input mt-4"
                placeholder="Type your answer…"
                value={answers[q.id]?.answerJson ?? ''}
                onChange={(e) => setAnswer(q.id, { optionId: undefined, answerJson: e.target.value })}
              />
            )}

            {(q.type === 'SUBJECTIVE' || q.type === 'CODING') && (
              <textarea
                className="input mt-4 min-h-[120px] font-mono"
                placeholder={q.type === 'CODING' ? 'Write your code here…' : 'Type your answer…'}
                value={answers[q.id]?.answerJson ?? ''}
                onChange={(e) => setAnswer(q.id, { optionId: undefined, answerJson: e.target.value })}
              />
            )}

            {q.options?.length > 0 && (
              <div className="mt-4 space-y-2">
                {q.options.map((opt) => {
                  const selected = isSelected(q, opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleOption(q, opt)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        selected ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`inline-flex h-4 w-4 items-center justify-center border ${q.type === 'MULTIPLE' ? 'rounded' : 'rounded-full'} ${selected ? 'border-brand-500 bg-brand-500' : 'border-slate-300'}`}>
                        {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      {opt.text}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button onClick={handleSubmitClick} disabled={submitting} className="btn-primary">
          {submitting ? 'Submitting…' : 'Submit test'}
        </button>
      </div>
    </div>
  );
}
