import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Flag,
  Keyboard,
  Maximize2,
  Minimize2,
  RefreshCw,
  Save,
} from 'lucide-react';
import { api } from '../../api/client.js';
import {
  Badge,
  Button,
  ConfirmDialog,
  ErrorAlert,
  Modal,
  ProgressBar,
  Spinner,
  Textarea,
  Input,
  cx,
} from '../../components/ui.jsx';
import { formatDuration } from '../../lib/format.js';
import { useOnline } from '../_shared/hooks.js';
import { details as errorDetails, status as errorStatus } from '../_shared/request.js';
import { questionTypeLabel } from '../_shared/domain.js';

const FLAG_KEY = (attemptId) => `examforge.flags.${attemptId}`;
const WARN_SECONDS = 300;
const CRITICAL_SECONDS = 60;
const AUTOSAVE_DELAY = 800;
const HEARTBEAT_MS = 20000;
const EVENT_THROTTLE_MS = 10000;

const readFlags = (attemptId) => {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(FLAG_KEY(attemptId)) ?? '[]'));
  } catch {
    return new Set();
  }
};

const writeFlags = (attemptId, flags) => {
  try {
    sessionStorage.setItem(FLAG_KEY(attemptId), JSON.stringify([...flags]));
  } catch {
    // Session storage is unavailable in some locked-down kiosk profiles; flags are
    // a convenience, so losing them must not break the attempt.
  }
};

const isAnswered = (answer) => {
  if (!answer) return false;
  if (answer.optionId) return true;
  const json = answer.answerJson;
  if (typeof json === 'string') return json.trim().length > 0;
  if (Array.isArray(json)) return json.length > 0;
  if (json && typeof json === 'object') {
    if (Array.isArray(json.optionIds)) return json.optionIds.length > 0;
    if (json.pairs) return Object.values(json.pairs).some((v) => String(v ?? '').trim());
  }
  return false;
};

const selectedOptionIds = (answer) => {
  const ids = answer?.answerJson?.optionIds;
  return Array.isArray(ids) ? ids : [];
};

export function ExamPage() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const startedRef = useRef(false);

  const start = useCallback(() => {
    setError(null);
    api
      .post(`/tests/${testId}/start`)
      .then((res) => setSession(res.data.data))
      .catch(setError);
  }, [testId]);

  useEffect(() => {
    // React 18 StrictMode double-invokes effects; a second start call would create
    // a second attempt row for tests that allow more than one attempt.
    if (startedRef.current) return;
    startedRef.current = true;
    start();
  }, [start]);

  if (error) {
    const detailAttempt = errorDetails(error)?.attemptId;
    return (
      <div className="mx-auto max-w-xl space-y-4 py-10">
        <ErrorAlert error={error} onRetry={detailAttempt ? undefined : start} />
        <div className="flex gap-2">
          <Button as={Link} to="/student/tests" variant="secondary">
            Back to my tests
          </Button>
          {detailAttempt && (
            <Button as={Link} to={`/student/results/${detailAttempt}`}>
              View submitted attempt
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!session) return <Spinner label="Preparing your attempt" />;

  return <ExamRunner key={session.attempt.id} session={session} navigate={navigate} />;
}

function ExamRunner({ session, navigate }) {
  const attempt = session.attempt;
  const attemptId = attempt.id;
  const questions = useMemo(
    () => session.questions.map((q) => ({ ...q.question, orderIndex: q.orderIndex })),
    [session.questions],
  );

  const [answers, setAnswers] = useState(() => {
    const initial = {};
    for (const a of session.answers) initial[a.questionId] = { optionId: a.optionId, answerJson: a.answerJson };
    return initial;
  });
  const [index, setIndex] = useState(0);
  const [flags, setFlags] = useState(() => readFlags(attemptId));
  const [visited, setVisited] = useState(() => new Set([questions[0]?.id].filter(Boolean)));
  const [saveState, setSaveState] = useState('saved');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [fullscreen, setFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const [remaining, setRemaining] = useState(() => attempt.remainingSeconds ?? 0);
  const online = useOnline();

  const rootRef = useRef(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const dirtyRef = useRef(new Map());
  const saveTimer = useRef(null);
  const submittingRef = useRef(false);
  const lastEvent = useRef({});
  const questionEnteredAt = useRef(Date.now());

  const current = questions[index];
  const total = questions.length;

  // Sections are grouped by the section the server attaches to each question; tests
  // without sections collapse to one implicit group so the palette stays uniform.
  const sections = useMemo(() => {
    const groups = new Map();
    questions.forEach((q, i) => {
      const key = q.sectionId ?? '__all';
      if (!groups.has(key)) {
        groups.set(key, { id: key, title: q.sectionTitle ?? 'All questions', indexes: [] });
      }
      groups.get(key).indexes.push(i);
    });
    return [...groups.values()];
  }, [questions]);

  const currentSectionId = current?.sectionId ?? '__all';

  /* ---------------------------------------------------------------- autosave */

  const flush = useCallback(async () => {
    if (dirtyRef.current.size === 0) return true;
    const batch = [...dirtyRef.current.entries()];
    setSaveState('saving');
    let failed = false;
    for (const [questionId, payload] of batch) {
      try {
        await api.put(`/attempts/${attemptId}/answers`, { questionId, ...payload });
        // Only drop the entry if it has not changed again while the request was in flight.
        if (dirtyRef.current.get(questionId) === payload) dirtyRef.current.delete(questionId);
      } catch (err) {
        if (errorStatus(err) === 409) {
          navigate(`/student/results/${errorDetails(err)?.attemptId ?? attemptId}`, { replace: true });
          return false;
        }
        failed = true;
      }
    }
    setSaveState(failed ? 'failed' : 'saved');
    return !failed;
  }, [attemptId, navigate]);

  const queueSave = useCallback(
    (questionId, answer) => {
      const payload = {
        optionId: answer.optionId ?? undefined,
        answerJson: answer.answerJson ?? undefined,
        timeSpentSeconds: Math.max(0, Math.round((Date.now() - questionEnteredAt.current) / 1000)),
      };
      dirtyRef.current.set(questionId, payload);
      setSaveState('pending');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, AUTOSAVE_DELAY);
    },
    [flush],
  );

  const setAnswer = useCallback(
    (questionId, patch) => {
      setAnswers((prev) => {
        const next = { ...prev, [questionId]: { ...prev[questionId], ...patch } };
        queueSave(questionId, next[questionId]);
        return next;
      });
    },
    [queueSave],
  );

  // A periodic flush covers answers left dirty while the tab sat in the background.
  useEffect(() => {
    const id = setInterval(() => {
      if (dirtyRef.current.size > 0) flush();
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [flush]);

  // Retry as soon as connectivity returns rather than waiting for the next heartbeat.
  useEffect(() => {
    if (online && saveState === 'failed' && dirtyRef.current.size > 0) flush();
  }, [online, saveState, flush]);

  useEffect(() => {
    const onHide = () => {
      if (dirtyRef.current.size > 0) flush();
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [flush]);

  /* ------------------------------------------------------------------ submit */

  const doSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await flush();
    try {
      await api.post(`/attempts/${attemptId}/submit`);
      navigate(`/student/results/${attemptId}`, { replace: true });
    } catch (err) {
      if (errorStatus(err) === 409) {
        navigate(`/student/results/${errorDetails(err)?.attemptId ?? attemptId}`, { replace: true });
        return;
      }
      submittingRef.current = false;
      setSubmitting(false);
      setSubmitError(err);
    }
  }, [attemptId, flush, navigate]);

  /* ----------------------------------------------------------------- countdown */

  useEffect(() => {
    // Trust the server clock: the deadline plus the observed skew survives a client
    // whose local time is wrong or is changed mid-attempt.
    const deadline = new Date(attempt.deadline).getTime();
    const skew = new Date(attempt.serverNow).getTime() - Date.now();
    const tick = () => {
      const left = Math.max(0, Math.round((deadline - (Date.now() + skew)) / 1000));
      setRemaining(left);
      if (left === 0) doSubmit();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [attempt.deadline, attempt.serverNow, doSubmit]);

  /* --------------------------------------------------------------- proctoring */

  useEffect(() => {
    const send = (type, details = {}) => {
      const now = Date.now();
      if (lastEvent.current[type] && now - lastEvent.current[type] < EVENT_THROTTLE_MS) return;
      lastEvent.current[type] = now;
      api.post(`/attempts/${attemptId}/events`, { type, details }).catch(() => {
        // Proctoring telemetry is best-effort; a dropped signal must not interrupt the exam.
      });
    };

    const onVisibility = () => {
      if (document.hidden) send('TAB_SWITCH');
    };
    const onBlur = () => send('WINDOW_BLUR');
    const onFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setFullscreen(active);
      if (!active) send('FULLSCREEN_EXIT');
    };
    const onCopy = () => send('COPY');
    const onPaste = () => send('PASTE');
    const onContext = (e) => {
      e.preventDefault();
      send('CONTEXT_MENU');
    };
    const onResize = () => send('WINDOW_RESIZE', { width: window.innerWidth, height: window.innerHeight });
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContext);
    window.addEventListener('resize', onResize);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContext);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [attemptId]);

  /* ---------------------------------------------------------------- navigation */

  const goTo = useCallback(
    (nextIndex) => {
      if (nextIndex < 0 || nextIndex >= total) return;
      questionEnteredAt.current = Date.now();
      setIndex(nextIndex);
      const id = questions[nextIndex]?.id;
      if (id) setVisited((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    },
    [questions, total],
  );

  const toggleFlag = useCallback(
    (questionId) => {
      setFlags((prev) => {
        const next = new Set(prev);
        if (next.has(questionId)) next.delete(questionId);
        else next.add(questionId);
        writeFlags(attemptId, next);
        return next;
      });
    },
    [attemptId],
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else rootRef.current?.requestFullscreen?.().catch(() => setFullscreen(false));
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const q = questions[index];
      if (!q) return;

      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'n') {
        e.preventDefault();
        goTo(index + 1);
      } else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'p') {
        e.preventDefault();
        goTo(index - 1);
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFlag(q.id);
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setAnswer(q.id, { optionId: undefined, answerJson: undefined });
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setReviewOpen(true);
      } else if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if (/^[1-9]$/.test(e.key) && q.options?.length) {
        const option = q.options[Number(e.key) - 1];
        if (!option) return;
        e.preventDefault();
        if (q.type === 'MULTIPLE') {
          const chosen = new Set(selectedOptionIds(answersRef.current[q.id]));
          if (chosen.has(option.id)) chosen.delete(option.id);
          else chosen.add(option.id);
          setAnswer(q.id, { optionId: undefined, answerJson: { optionIds: [...chosen] } });
        } else {
          setAnswer(q.id, { optionId: option.id, answerJson: undefined });
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [index, questions, goTo, toggleFlag, setAnswer]);

  /* -------------------------------------------------------------------- render */

  const answeredIds = useMemo(
    () => new Set(questions.filter((q) => isAnswered(answers[q.id])).map((q) => q.id)),
    [questions, answers],
  );
  const unanswered = questions.filter((q) => !answeredIds.has(q.id));
  const flagged = questions.filter((q) => flags.has(q.id));

  const timeTone = remaining <= CRITICAL_SECONDS ? 'critical' : remaining <= WARN_SECONDS ? 'caution' : 'neutral';

  return (
    <div ref={rootRef} className="bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{attempt.test.title}</p>
            <p className="text-xs text-ink-muted">
              {total} questions · {attempt.test.totalMarks} marks · pass mark {attempt.test.passingMarks}
              {attempt.test.negativeMarks > 0 ? ` · -${attempt.test.negativeMarks} per wrong answer` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <SaveIndicator state={saveState} online={online} onRetry={flush} />
            <div
              className={cx(
                'tabular rounded-md border px-2.5 py-1 text-sm font-semibold',
                timeTone === 'critical' && 'border-critical bg-critical-soft text-critical-ink',
                timeTone === 'caution' && 'border-caution bg-caution-soft text-caution-ink',
                timeTone === 'neutral' && 'border-line bg-surface-sunken text-ink',
              )}
              role="timer"
              aria-live={remaining <= CRITICAL_SECONDS ? 'assertive' : 'off'}
              aria-label={`Time remaining ${formatDuration(remaining)}`}
            >
              {formatDuration(remaining)}
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={Keyboard}
              onClick={() => setShortcutsOpen(true)}
              aria-label="Keyboard shortcuts"
            />
            <Button
              variant="ghost"
              size="sm"
              icon={fullscreen ? Minimize2 : Maximize2}
              onClick={toggleFullscreen}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            />
            <Button size="sm" onClick={() => setReviewOpen(true)}>
              Review and submit
            </Button>
          </div>
        </div>
        <ProgressBar
          value={answeredIds.size}
          max={total}
          tone="accent"
          label={`${answeredIds.size} of ${total} answered`}
        />
      </header>

      {remaining <= WARN_SECONDS && remaining > 0 && (
        <div
          role="status"
          className={cx(
            'flex items-center gap-2 border-b px-4 py-2 text-sm',
            remaining <= CRITICAL_SECONDS
              ? 'border-critical bg-critical-soft text-critical-ink'
              : 'border-caution bg-caution-soft text-caution-ink',
          )}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {remaining <= CRITICAL_SECONDS
              ? 'Under a minute left. The attempt submits automatically at zero.'
              : 'Five minutes left. Unanswered questions score zero.'}
          </span>
        </div>
      )}

      {!online && (
        <div
          role="status"
          className="flex items-center gap-2 border-b border-caution bg-caution-soft px-4 py-2 text-sm text-caution-ink"
        >
          <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>You are offline. Answers are held locally and sent as soon as the connection returns.</span>
        </div>
      )}

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <main>
          {current ? (
            <article className="card card-pad">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <span className="eyebrow">Question {index + 1} of {total}</span>
                  <Badge tone="neutral">{questionTypeLabel(current.type)}</Badge>
                  {flags.has(current.id) && <Badge tone="caution" dot>Flagged</Badge>}
                </div>
                <p className="tabular text-sm text-ink-muted">
                  {current.marks} marks
                  {current.negativeMarks > 0 ? ` · -${current.negativeMarks} if wrong` : ''}
                </p>
              </div>

              <p className="whitespace-pre-wrap py-4 text-[0.95rem] leading-relaxed text-ink">{current.text}</p>

              <AnswerInput
                question={current}
                answer={answers[current.id]}
                onChange={(patch) => setAnswer(current.id, patch)}
              />

              <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                <div className="flex gap-2">
                  <Button variant="secondary" icon={ChevronLeft} onClick={() => goTo(index - 1)} disabled={index === 0}>
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    iconRight={ChevronRight}
                    onClick={() => goTo(index + 1)}
                    disabled={index === total - 1}
                  >
                    Next
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setAnswer(current.id, { optionId: undefined, answerJson: undefined })}
                    disabled={!isAnswered(answers[current.id])}
                  >
                    Clear response
                  </Button>
                  <Button
                    variant={flags.has(current.id) ? 'primary' : 'secondary'}
                    icon={Flag}
                    onClick={() => toggleFlag(current.id)}
                    aria-pressed={flags.has(current.id)}
                  >
                    {flags.has(current.id) ? 'Unflag' : 'Flag for review'}
                  </Button>
                </div>
              </div>
            </article>
          ) : (
            <div className="card card-pad text-sm text-ink-muted">This test has no questions.</div>
          )}
        </main>

        <aside className="lg:sticky lg:top-[5.5rem] lg:self-start">
          <div className="card card-pad">
            {sections.length > 1 && (
              <nav aria-label="Sections" className="mb-3 flex flex-wrap gap-1.5 border-b border-line pb-3">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => goTo(section.indexes[0])}
                    aria-current={section.id === currentSectionId ? 'true' : undefined}
                    className={cx(
                      'rounded-md border px-2 py-1 text-xs',
                      section.id === currentSectionId
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line text-ink-muted hover:bg-surface-sunken',
                    )}
                  >
                    {section.title}
                    <span className="tabular ml-1 text-ink-subtle">{section.indexes.length}</span>
                  </button>
                ))}
              </nav>
            )}

            <p className="eyebrow mb-2">Question palette</p>
            <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Jump to question">
              {questions.map((q, i) => {
                const answered = answeredIds.has(q.id);
                const isFlagged = flags.has(q.id);
                const seen = visited.has(q.id);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={i === index ? 'true' : undefined}
                    aria-label={`Question ${i + 1}${answered ? ', answered' : seen ? ', seen' : ', not seen'}${isFlagged ? ', flagged' : ''}`}
                    className={cx(
                      'tabular relative h-8 rounded-md border text-xs font-medium',
                      i === index && 'ring-2 ring-accent ring-offset-1 ring-offset-surface',
                      answered
                        ? 'border-positive bg-positive-soft text-positive-ink'
                        : seen
                          ? 'border-line-strong bg-surface-sunken text-ink'
                          : 'border-line bg-surface text-ink-subtle',
                    )}
                  >
                    {i + 1}
                    {isFlagged && (
                      <span
                        className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-caution"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-xs">
              <PaletteLegend swatch="border-positive bg-positive-soft" label="Answered" value={answeredIds.size} />
              <PaletteLegend swatch="border-line-strong bg-surface-sunken" label="Seen, unanswered" value={questions.filter((q) => visited.has(q.id) && !answeredIds.has(q.id)).length} />
              <PaletteLegend swatch="border-line bg-surface" label="Not seen" value={questions.filter((q) => !visited.has(q.id)).length} />
              <PaletteLegend swatch="border-caution bg-caution-soft" label="Flagged" value={flagged.length} />
            </dl>

            <Button className="mt-4 w-full" onClick={() => setReviewOpen(true)}>
              Review and submit
            </Button>
          </div>
        </aside>
      </div>

      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Review before submitting"
        description={`${answeredIds.size} of ${total} answered · ${formatDuration(remaining)} remaining`}
        width="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewOpen(false)}>
              Keep working
            </Button>
            <Button
              onClick={() => {
                setReviewOpen(false);
                setConfirmSubmit(true);
              }}
              loading={submitting}
            >
              Submit attempt
            </Button>
          </>
        }
      >
        {submitError && <ErrorAlert error={submitError} className="mb-4" />}
        {saveState === 'failed' && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-caution bg-caution-soft p-3 text-sm text-caution-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p>Some answers have not reached the server.</p>
              <Button variant="secondary" size="sm" className="mt-2" icon={RefreshCw} onClick={flush}>
                Retry now
              </Button>
            </div>
          </div>
        )}

        <ReviewList
          title="Unanswered"
          tone="critical"
          questions={unanswered}
          questions_all={questions}
          onJump={(i) => {
            setReviewOpen(false);
            goTo(i);
          }}
          emptyLabel="Every question has an answer."
        />
        <ReviewList
          title="Flagged for review"
          tone="caution"
          questions={flagged}
          questions_all={questions}
          onJump={(i) => {
            setReviewOpen(false);
            goTo(i);
          }}
          emptyLabel="Nothing flagged."
          className="mt-5"
        />
      </Modal>

      <ConfirmDialog
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        onConfirm={doSubmit}
        loading={submitting}
        tone="primary"
        title="Submit this attempt?"
        description={
          unanswered.length > 0
            ? `${unanswered.length} question${unanswered.length === 1 ? '' : 's'} will be scored as unanswered. You cannot reopen the attempt after submitting.`
            : 'You cannot reopen the attempt after submitting.'
        }
        confirmLabel="Submit attempt"
      />

      <Modal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        title="Keyboard shortcuts"
        width="max-w-md"
        footer={<Button variant="secondary" onClick={() => setShortcutsOpen(false)}>Close</Button>}
      >
        <dl className="divide-y divide-line text-sm">
          {[
            ['1 – 9', 'Select the nth option'],
            ['N or Right arrow', 'Next question'],
            ['P or Left arrow', 'Previous question'],
            ['F', 'Flag or unflag the question'],
            ['C', 'Clear the response'],
            ['R', 'Open the review screen'],
            ['?', 'Show this list'],
          ].map(([keys, description]) => (
            <div key={keys} className="flex items-center justify-between gap-4 py-2">
              <dt className="font-mono text-xs text-ink">{keys}</dt>
              <dd className="text-ink-muted">{description}</dd>
            </div>
          ))}
        </dl>
      </Modal>
    </div>
  );
}

function PaletteLegend({ swatch, label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex items-center gap-2 text-ink-muted">
        <span className={cx('h-3 w-3 rounded-sm border', swatch)} aria-hidden="true" />
        {label}
      </dt>
      <dd className="tabular text-ink">{value}</dd>
    </div>
  );
}

function ReviewList({ title, tone, questions, questions_all, onJump, emptyLabel, className }) {
  return (
    <section className={className}>
      <h3 className="eyebrow mb-2">
        {title} <span className="tabular">({questions.length})</span>
      </h3>
      {questions.length === 0 ? (
        <p className="text-sm text-ink-muted">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {questions.map((q) => {
            const i = questions_all.indexOf(q);
            return (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => onJump(i)}
                  className={cx(
                    'tabular rounded-md border px-2 py-1 text-xs',
                    tone === 'critical'
                      ? 'border-critical bg-critical-soft text-critical-ink'
                      : 'border-caution bg-caution-soft text-caution-ink',
                  )}
                >
                  Question {i + 1}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function SaveIndicator({ state, online, onRetry }) {
  if (state === 'failed') {
    return (
      <Button variant="ghost" size="sm" icon={RefreshCw} onClick={onRetry} className="text-critical">
        {online ? 'Save failed — retry' : 'Waiting for network'}
      </Button>
    );
  }
  const label =
    state === 'saving' ? 'Saving' : state === 'pending' ? 'Unsaved changes' : 'All answers saved';
  const Icon = state === 'saved' ? Check : Save;
  return (
    <span
      className={cx('flex items-center gap-1.5 text-xs', state === 'saved' ? 'text-positive-ink' : 'text-ink-muted')}
      role="status"
      aria-live="polite"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

function AnswerInput({ question, answer, onChange }) {
  if (question.type === 'FILL_BLANK') {
    return (
      <Input
        aria-label="Your answer"
        placeholder="Type your answer"
        value={typeof answer?.answerJson === 'string' ? answer.answerJson : ''}
        onChange={(e) => onChange({ optionId: undefined, answerJson: e.target.value })}
      />
    );
  }

  if (question.type === 'SUBJECTIVE' || question.type === 'CODING') {
    return (
      <Textarea
        aria-label="Your answer"
        rows={question.type === 'CODING' ? 14 : 8}
        className={question.type === 'CODING' ? 'font-mono text-[0.8rem]' : undefined}
        placeholder={question.type === 'CODING' ? 'Write your solution' : 'Write your answer'}
        value={typeof answer?.answerJson === 'string' ? answer.answerJson : ''}
        onChange={(e) => onChange({ optionId: undefined, answerJson: e.target.value })}
      />
    );
  }

  if (question.type === 'MATCH') {
    const pairs = answer?.answerJson?.pairs ?? {};
    if (!question.options?.length) {
      return (
        <p className="rounded-md border border-caution bg-caution-soft p-3 text-sm text-caution-ink">
          This match question carries no prompts. Report it to your instructor.
        </p>
      );
    }
    return (
      <ul className="space-y-2">
        {question.options.map((option) => (
          <li key={option.id} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr]">
            <span className="text-sm text-ink">{option.text}</span>
            <Input
              aria-label={`Match for ${option.text}`}
              value={pairs[option.text] ?? ''}
              onChange={(e) =>
                onChange({
                  optionId: undefined,
                  answerJson: { pairs: { ...pairs, [option.text]: e.target.value } },
                })
              }
            />
          </li>
        ))}
      </ul>
    );
  }

  const multiple = question.type === 'MULTIPLE';
  const chosen = multiple ? new Set(selectedOptionIds(answer)) : new Set([answer?.optionId].filter(Boolean));

  return (
    <ul className="space-y-2" role={multiple ? 'group' : 'radiogroup'} aria-label="Options">
      {(question.options ?? []).map((option, i) => {
        const selected = chosen.has(option.id);
        return (
          <li key={option.id}>
            <button
              type="button"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={selected}
              onClick={() => {
                if (multiple) {
                  const next = new Set(chosen);
                  if (next.has(option.id)) next.delete(option.id);
                  else next.add(option.id);
                  onChange({ optionId: undefined, answerJson: { optionIds: [...next] } });
                } else {
                  onChange({ optionId: option.id, answerJson: undefined });
                }
              }}
              className={cx(
                'flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left text-sm',
                selected
                  ? 'border-accent bg-accent-soft text-accent-ink'
                  : 'border-line bg-surface text-ink hover:bg-surface-sunken',
              )}
            >
              <span
                className={cx(
                  'tabular mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-[0.65rem] font-semibold',
                  multiple ? 'rounded-sm' : 'rounded-full',
                  selected ? 'border-accent bg-accent text-surface' : 'border-line-strong text-ink-subtle',
                )}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span className="whitespace-pre-wrap">{option.text}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
