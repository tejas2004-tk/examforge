import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Copy, Eye, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '../api/client.js';
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Panel,
  SearchInput,
  Select,
  SkeletonTable,
  Table,
  Textarea,
  Toolbar,
  cx,
} from '../components/ui.jsx';
import { useToast } from '../components/toast.jsx';
import { formatDate, formatNumber } from '../lib/format.js';
import { Async } from './_shared/Async.jsx';
import { getData, retryUnlessDenied, pageMeta } from './_shared/request.js';
import { hasFilters, useDebounced, useSelection, useUrlState } from './_shared/hooks.js';
import {
  BLOOM_LEVELS,
  DIFFICULTIES,
  OPTION_TYPES,
  QUESTION_TYPES,
  difficultyTone,
  humanise,
  questionTypeLabel,
} from './_shared/domain.js';

const DEFAULTS = { page: 1, limit: 20, search: '', type: '', difficulty: '', topic: '', bloomLevel: '' };

const optionSchema = z.object({
  text: z.string().min(1, 'Option text is required').max(1000),
  isCorrect: z.boolean(),
});

const questionSchema = z
  .object({
    text: z.string().min(1, 'Question text is required').max(5000),
    type: z.enum(['SINGLE', 'MULTIPLE', 'TRUE_FALSE', 'FILL_BLANK', 'MATCH', 'CODING', 'SUBJECTIVE']),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXPERT']),
    bloomLevel: z.string().optional(),
    marks: z.coerce.number().min(0, 'Marks cannot be negative').max(1000),
    negativeMarks: z.coerce.number().min(0).max(1000),
    estimatedTime: z.union([z.coerce.number().int().min(0).max(7200), z.literal('')]).optional(),
    topic: z.string().max(200).optional(),
    subtopic: z.string().max(200).optional(),
    reference: z.string().max(1000).optional(),
    explanation: z.string().max(5000).optional(),
    tags: z.string().max(500).optional(),
    options: z.array(optionSchema).optional(),
    fillAnswers: z.string().max(1000).optional(),
    matchPairs: z.array(z.object({ left: z.string(), right: z.string() })).optional(),
  })
  .superRefine((data, ctx) => {
    if (OPTION_TYPES.includes(data.type)) {
      const options = data.options ?? [];
      if (options.length < 2) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: 'Add at least two options' });
        return;
      }
      const correct = options.filter((o) => o.isCorrect).length;
      if (data.type === 'MULTIPLE' && correct < 1) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: 'Mark at least one option correct' });
      }
      if (data.type !== 'MULTIPLE' && correct !== 1) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: 'Mark exactly one option correct' });
      }
    }
    if (data.type === 'FILL_BLANK' && !data.fillAnswers?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['fillAnswers'], message: 'Give at least one accepted answer' });
    }
    if (data.type === 'MATCH') {
      const pairs = (data.matchPairs ?? []).filter((p) => p.left.trim() && p.right.trim());
      if (pairs.length < 2) {
        ctx.addIssue({ code: 'custom', path: ['matchPairs'], message: 'Add at least two complete pairs' });
      }
    }
  });

const emptyForm = {
  text: '',
  type: 'SINGLE',
  difficulty: 'MEDIUM',
  bloomLevel: '',
  marks: 1,
  negativeMarks: 0,
  estimatedTime: '',
  topic: '',
  subtopic: '',
  reference: '',
  explanation: '',
  tags: '',
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
  ],
  fillAnswers: '',
  matchPairs: [
    { left: '', right: '' },
    { left: '', right: '' },
  ],
};

const toFormValues = (question) => {
  const correct = question.correctAnswer;
  return {
    ...emptyForm,
    text: question.text ?? '',
    type: question.type,
    difficulty: question.difficulty,
    bloomLevel: question.bloomLevel ?? '',
    marks: question.marks ?? 1,
    negativeMarks: question.negativeMarks ?? 0,
    estimatedTime: question.estimatedTime ?? '',
    topic: question.topic ?? '',
    subtopic: question.subtopic ?? '',
    reference: question.reference ?? '',
    explanation: question.explanation ?? '',
    tags: (question.tags ?? []).join(', '),
    options: question.options?.length
      ? question.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect }))
      : emptyForm.options,
    fillAnswers: Array.isArray(correct) ? correct.join(', ') : typeof correct === 'string' ? correct : '',
    matchPairs:
      correct && typeof correct === 'object' && !Array.isArray(correct)
        ? Object.entries(correct).map(([left, right]) => ({ left, right: String(right) }))
        : emptyForm.matchPairs,
  };
};

const toPayload = (values) => {
  const payload = {
    text: values.text.trim(),
    type: values.type,
    difficulty: values.difficulty,
    marks: Number(values.marks),
    negativeMarks: Number(values.negativeMarks),
  };
  if (values.bloomLevel) payload.bloomLevel = values.bloomLevel;
  if (values.explanation?.trim()) payload.explanation = values.explanation.trim();
  if (values.reference?.trim()) payload.reference = values.reference.trim();
  if (values.topic?.trim()) payload.topic = values.topic.trim();
  if (values.subtopic?.trim()) payload.subtopic = values.subtopic.trim();
  if (values.estimatedTime !== '' && values.estimatedTime !== undefined) {
    payload.estimatedTime = Number(values.estimatedTime);
  }
  const tags = (values.tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  if (tags.length) payload.tags = tags;

  if (OPTION_TYPES.includes(values.type)) {
    payload.options = values.options.map((o) => ({ text: o.text.trim(), isCorrect: Boolean(o.isCorrect) }));
  }
  if (values.type === 'FILL_BLANK') {
    payload.correctAnswer = values.fillAnswers
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
  }
  if (values.type === 'MATCH') {
    payload.correctAnswer = Object.fromEntries(
      values.matchPairs.filter((p) => p.left.trim() && p.right.trim()).map((p) => [p.left.trim(), p.right.trim()]),
    );
  }
  return payload;
};

export function QuestionsPage() {
  const [state, setState, resetFilters] = useUrlState(DEFAULTS);
  const [searchDraft, setSearchDraft] = useState(state.search);
  const debouncedSearch = useDebounced(searchDraft, 300);
  const [editing, setEditing] = useState(null);
  const [previewing, setPreviewing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [bankTarget, setBankTarget] = useState('');
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (debouncedSearch !== state.search) setState({ search: debouncedSearch });
  }, [debouncedSearch, state.search, setState]);

  const params = new URLSearchParams();
  params.set('page', String(state.page));
  params.set('limit', String(state.limit));
  for (const key of ['search', 'type', 'difficulty', 'topic', 'bloomLevel']) {
    if (state[key]) params.set(key, state[key]);
  }

  const query = useQuery({
    queryKey: ['questions', params.toString()],
    queryFn: () => getData(`/questions?${params.toString()}`),
    retry: retryUnlessDenied,
    placeholderData: (previous) => previous,
  });

  const banks = useQuery({
    queryKey: ['question-banks', 'picker'],
    queryFn: () => getData('/question-banks?limit=100'),
    retry: retryUnlessDenied,
    staleTime: 5 * 60_000,
  });

  const items = query.data?.items ?? [];
  // The list endpoint accepts a Bloom filter but does not apply it, so narrow the
  // fetched page here to keep the control honest.
  const rows = useMemo(
    () => (state.bloomLevel ? items.filter((q) => q.bloomLevel === state.bloomLevel) : items),
    [items, state.bloomLevel],
  );
  const ids = useMemo(() => rows.map((q) => q.id), [rows]);
  const selection = useSelection(ids);
  const meta = pageMeta(query.data, state.limit);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['questions'] });

  const save = useMutation({
    mutationFn: ({ id, payload }) => (id ? api.put(`/questions/${id}`, payload) : api.post('/questions', payload)),
    onSuccess: (_data, variables) => {
      invalidate();
      setEditing(null);
      toast.success(variables.id ? 'Question updated' : 'Question created');
    },
    onError: (error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => api.delete(`/questions/${id}`))),
    onSuccess: (_data, ids) => {
      invalidate();
      selection.clear();
      setConfirm(null);
      toast.success(ids.length === 1 ? 'Question deleted' : `${ids.length} questions deleted`);
    },
    onError: (error) => {
      toast.error(error.message);
      setConfirm(null);
    },
  });

  const addToBank = useMutation({
    mutationFn: ({ bankId, ids }) =>
      Promise.all(ids.map((questionId) => api.post(`/question-banks/${bankId}/questions`, { questionId }))),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['question-banks'] });
      selection.clear();
      setBankTarget('');
      toast.success(`${variables.ids.length} added to the bank`);
    },
    onError: (error) => toast.error(error.message),
  });

  const filtersActive = hasFilters(state, DEFAULTS);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Assessment"
        title="Questions"
        description="Every item you have authored. Filter, edit in place, duplicate a variant or push a selection into a bank."
        actions={
          <Button icon={Plus} onClick={() => setEditing({ mode: 'create', values: emptyForm })}>
            New question
          </Button>
        }
      />

      <Toolbar>
        <SearchInput
          aria-label="Search questions"
          placeholder="Search question text or topic"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          className="sm:w-72"
        />
        <Select aria-label="Type" value={state.type} onChange={(e) => setState({ type: e.target.value })}>
          <option value="">All types</option>
          {QUESTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Difficulty"
          value={state.difficulty}
          onChange={(e) => setState({ difficulty: e.target.value })}
        >
          <option value="">All difficulties</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {humanise(d)}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Bloom level"
          value={state.bloomLevel}
          onChange={(e) => setState({ bloomLevel: e.target.value })}
        >
          <option value="">All Bloom levels</option>
          {BLOOM_LEVELS.map((b) => (
            <option key={b} value={b}>
              {humanise(b)}
            </option>
          ))}
        </Select>
        <Input
          aria-label="Topic"
          placeholder="Topic"
          value={state.topic}
          onChange={(e) => setState({ topic: e.target.value })}
          className="sm:w-40"
        />
        {filtersActive && (
          <Button
            variant="ghost"
            icon={X}
            onClick={() => {
              setSearchDraft('');
              resetFilters();
            }}
          >
            Clear
          </Button>
        )}
      </Toolbar>

      {selection.count > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-accent bg-accent-soft px-3 py-2">
          <p className="text-sm text-accent-ink">
            {selection.count} selected
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select
              aria-label="Add selection to bank"
              value={bankTarget}
              onChange={(e) => setBankTarget(e.target.value)}
            >
              <option value="">Add to bank…</option>
              {(banks.data?.items ?? []).map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant="secondary"
              disabled={!bankTarget}
              loading={addToBank.isPending}
              onClick={() => addToBank.mutate({ bankId: bankTarget, ids: selection.ids })}
            >
              Add
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={Trash2}
              onClick={() => setConfirm({ ids: selection.ids })}
            >
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={selection.clear}>
              Clear selection
            </Button>
          </div>
        </div>
      )}

      <Async query={query} skeleton={<SkeletonTable rows={8} cols={6} />}>
        {() =>
          rows.length === 0 ? (
            <EmptyState
              title={filtersActive ? 'No questions match these filters' : 'No questions yet'}
              description={
                filtersActive
                  ? 'Loosen a filter or clear them all.'
                  : 'Author your first item, then group items into banks to generate tests.'
              }
              action={
                filtersActive ? (
                  <Button variant="secondary" onClick={resetFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Button onClick={() => setEditing({ mode: 'create', values: emptyForm })}>New question</Button>
                )
              }
            />
          ) : (
            <>
              <Table
                head={[
                  {
                    key: 'select',
                    label: (
                      <Checkbox
                        aria-label="Select all questions on this page"
                        checked={selection.count > 0 && selection.count === rows.length}
                        onChange={selection.toggleAll}
                      />
                    ),
                    width: '2.5rem',
                  },
                  { key: 'text', label: 'Question' },
                  { key: 'type', label: 'Type' },
                  { key: 'difficulty', label: 'Difficulty' },
                  { key: 'marks', label: 'Marks', align: 'right' },
                  { key: 'accuracy', label: 'Accuracy', align: 'right' },
                  { key: 'created', label: 'Created' },
                  { key: 'actions', label: '', align: 'right' },
                ]}
              >
                {rows.map((question) => (
                  <tr key={question.id} className={cx(selection.selected.has(question.id) && 'bg-accent-soft')}>
                    <td>
                      <Checkbox
                        aria-label={`Select question ${question.text.slice(0, 40)}`}
                        checked={selection.selected.has(question.id)}
                        onChange={() => selection.toggle(question.id)}
                      />
                    </td>
                    <td className="max-w-md">
                      <button
                        type="button"
                        className="link line-clamp-2 text-left"
                        onClick={() => setPreviewing(question)}
                      >
                        {question.text}
                      </button>
                      {question.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {question.tags.slice(0, 4).map((tag) => (
                            <Badge key={tag} tone="neutral">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="text-ink-muted">{questionTypeLabel(question.type)}</td>
                    <td>
                      <Badge tone={difficultyTone(question.difficulty)}>{humanise(question.difficulty)}</Badge>
                    </td>
                    <td className="tabular text-right">{formatNumber(question.marks)}</td>
                    <td className="tabular text-right text-ink-muted">
                      {question.analytics?.attemptCount
                        ? `${Math.round(question.analytics.accuracy * 100) / 100}%`
                        : '—'}
                    </td>
                    <td className="text-ink-muted">{formatDate(question.createdAt)}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Eye}
                          aria-label="Preview question"
                          onClick={() => setPreviewing(question)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Pencil}
                          aria-label="Edit question"
                          onClick={() => setEditing({ mode: 'edit', id: question.id, values: toFormValues(question) })}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Copy}
                          aria-label="Duplicate question"
                          onClick={() =>
                            setEditing({
                              mode: 'create',
                              values: { ...toFormValues(question), text: `${question.text} (copy)` },
                            })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          aria-label="Delete question"
                          onClick={() => setConfirm({ ids: [question.id], text: question.text })}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>

              <Pagination
                page={meta.page}
                pageCount={meta.pageCount}
                total={meta.total}
                pageSize={meta.pageSize}
                onPageChange={(page) => setState({ page })}
                onPageSizeChange={(limit) => setState({ limit, page: 1 })}
              />
            </>
          )
        }
      </Async>

      {editing && (
        <QuestionEditor
          key={editing.mode + (editing.id ?? 'new')}
          initial={editing.values}
          mode={editing.mode}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(values) => save.mutate({ id: editing.id, payload: toPayload(values) })}
        />
      )}

      <Modal
        open={Boolean(previewing)}
        onClose={() => setPreviewing(null)}
        title="Candidate preview"
        description="How this item renders inside the exam runner."
        width="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPreviewing(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setEditing({ mode: 'edit', id: previewing.id, values: toFormValues(previewing) });
                setPreviewing(null);
              }}
            >
              Edit
            </Button>
          </>
        }
      >
        {previewing && <QuestionPreview question={previewing} />}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => remove.mutate(confirm.ids)}
        loading={remove.isPending}
        tone="danger"
        title={confirm?.ids.length === 1 ? 'Delete this question?' : `Delete ${confirm?.ids.length} questions?`}
        description="Questions already used in a test keep their recorded answers, but they can no longer be added to new tests."
        confirmLabel="Delete"
      />
    </div>
  );
}

function QuestionEditor({ initial, mode, saving, onSubmit, onClose }) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(questionSchema), defaultValues: initial });

  const type = watch('type');
  const options = useFieldArray({ control, name: 'options' });
  const pairs = useFieldArray({ control, name: 'matchPairs' });
  const watchedOptions = watch('options') ?? [];

  // True/false is a fixed two-option item; forcing the pair avoids authors typing
  // their own labels and then failing the server's exactly-one-correct rule.
  useEffect(() => {
    if (type !== 'TRUE_FALSE') return;
    setValue('options', [
      { text: 'True', isCorrect: watchedOptions[0]?.isCorrect ?? true },
      { text: 'False', isCorrect: watchedOptions[1]?.isCorrect ?? false },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, setValue]);

  const setSingleCorrect = (index) => {
    setValue(
      'options',
      watchedOptions.map((option, i) => ({ ...option, isCorrect: i === index })),
      { shouldValidate: true },
    );
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={mode === 'edit' ? 'Edit question' : 'New question'}
      width="max-w-2xl"
    >
      <form id="question-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Question text" htmlFor="q-text" required error={errors.text?.message}>
          <Textarea id="q-text" rows={4} {...register('text')} aria-invalid={Boolean(errors.text)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" htmlFor="q-type" required error={errors.type?.message}>
            <Select id="q-type" {...register('type')}>
              {QUESTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Difficulty" htmlFor="q-difficulty" required error={errors.difficulty?.message}>
            <Select id="q-difficulty" {...register('difficulty')}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {humanise(d)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Marks" htmlFor="q-marks" required error={errors.marks?.message}>
            <Input id="q-marks" type="number" step="0.5" min="0" {...register('marks')} />
          </Field>
          <Field
            label="Negative marks"
            htmlFor="q-negative"
            hint="Deducted for a wrong answer"
            error={errors.negativeMarks?.message}
          >
            <Input id="q-negative" type="number" step="0.5" min="0" {...register('negativeMarks')} />
          </Field>
          <Field label="Bloom level" htmlFor="q-bloom" error={errors.bloomLevel?.message}>
            <Select id="q-bloom" {...register('bloomLevel')}>
              <option value="">Not set</option>
              {BLOOM_LEVELS.map((b) => (
                <option key={b} value={b}>
                  {humanise(b)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Estimated time"
            htmlFor="q-time"
            hint="Seconds a candidate should need"
            error={errors.estimatedTime?.message}
          >
            <Input id="q-time" type="number" min="0" {...register('estimatedTime')} />
          </Field>
          <Field label="Topic" htmlFor="q-topic" error={errors.topic?.message}>
            <Input id="q-topic" {...register('topic')} />
          </Field>
          <Field label="Subtopic" htmlFor="q-subtopic" error={errors.subtopic?.message}>
            <Input id="q-subtopic" {...register('subtopic')} />
          </Field>
        </div>

        {OPTION_TYPES.includes(type) && (
          <fieldset className="rounded-md border border-line p-3">
            <legend className="eyebrow px-1">Options</legend>
            {errors.options?.message && <p className="mb-2 text-sm text-critical">{errors.options.message}</p>}
            <ul className="space-y-2">
              {options.fields.map((field, index) => (
                <li key={field.id} className="flex items-start gap-2">
                  {type === 'MULTIPLE' ? (
                    <Checkbox
                      className="mt-2.5"
                      aria-label={`Option ${index + 1} is correct`}
                      {...register(`options.${index}.isCorrect`)}
                    />
                  ) : (
                    <input
                      type="radio"
                      className="mt-2.5 h-4 w-4 accent-accent"
                      name="correct-option"
                      aria-label={`Option ${index + 1} is correct`}
                      checked={Boolean(watchedOptions[index]?.isCorrect)}
                      onChange={() => setSingleCorrect(index)}
                    />
                  )}
                  <div className="flex-1">
                    <Input
                      aria-label={`Option ${index + 1} text`}
                      readOnly={type === 'TRUE_FALSE'}
                      {...register(`options.${index}.text`)}
                    />
                    {errors.options?.[index]?.text && (
                      <p className="mt-1 text-sm text-critical">{errors.options[index].text.message}</p>
                    )}
                  </div>
                  {type !== 'TRUE_FALSE' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      aria-label={`Remove option ${index + 1}`}
                      disabled={options.fields.length <= 2}
                      onClick={() => options.remove(index)}
                    />
                  )}
                </li>
              ))}
            </ul>
            {type !== 'TRUE_FALSE' && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={Plus}
                className="mt-2"
                disabled={options.fields.length >= 10}
                onClick={() => options.append({ text: '', isCorrect: false })}
              >
                Add option
              </Button>
            )}
          </fieldset>
        )}

        {type === 'FILL_BLANK' && (
          <Field
            label="Accepted answers"
            htmlFor="q-fill"
            required
            hint="Comma separated. Matching ignores case and extra whitespace."
            error={errors.fillAnswers?.message}
          >
            <Input id="q-fill" {...register('fillAnswers')} />
          </Field>
        )}

        {type === 'MATCH' && (
          <fieldset className="rounded-md border border-line p-3">
            <legend className="eyebrow px-1">Pairs</legend>
            {errors.matchPairs?.message && <p className="mb-2 text-sm text-critical">{errors.matchPairs.message}</p>}
            <ul className="space-y-2">
              {pairs.fields.map((field, index) => (
                <li key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input aria-label={`Pair ${index + 1} prompt`} placeholder="Prompt" {...register(`matchPairs.${index}.left`)} />
                  <Input aria-label={`Pair ${index + 1} match`} placeholder="Match" {...register(`matchPairs.${index}.right`)} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    aria-label={`Remove pair ${index + 1}`}
                    disabled={pairs.fields.length <= 2}
                    onClick={() => pairs.remove(index)}
                  />
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={Plus}
              className="mt-2"
              onClick={() => pairs.append({ left: '', right: '' })}
            >
              Add pair
            </Button>
          </fieldset>
        )}

        {(type === 'CODING' || type === 'SUBJECTIVE') && (
          <p className="rounded-md border border-info bg-info-soft p-3 text-sm text-info-ink">
            {type === 'CODING'
              ? 'Coding answers are graded by a teacher unless the item is linked to a coding problem.'
              : 'Subjective answers are graded by a teacher from the submission review screen.'}
          </p>
        )}

        <Field label="Explanation" htmlFor="q-explanation" hint="Shown to candidates on the result screen" error={errors.explanation?.message}>
          <Textarea id="q-explanation" rows={3} {...register('explanation')} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tags" htmlFor="q-tags" hint="Comma separated" error={errors.tags?.message}>
            <Input id="q-tags" {...register('tags')} />
          </Field>
          <Field label="Reference" htmlFor="q-reference" hint="Source, chapter or ticket" error={errors.reference?.message}>
            <Input id="q-reference" {...register('reference')} />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {mode === 'edit' ? 'Save changes' : 'Create question'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

function QuestionPreview({ question }) {
  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{questionTypeLabel(question.type)}</Badge>
        <Badge tone={difficultyTone(question.difficulty)}>{humanise(question.difficulty)}</Badge>
        {question.bloomLevel && <Badge tone="info">{humanise(question.bloomLevel)}</Badge>}
        <span className="tabular text-sm text-ink-muted">
          {question.marks} marks{question.negativeMarks > 0 ? ` · -${question.negativeMarks} if wrong` : ''}
        </span>
      </div>

      <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-ink">{question.text}</p>

      {question.options?.length > 0 && (
        <ul className="space-y-2">
          {question.options.map((option) => (
            <li
              key={option.id ?? option.text}
              className={cx(
                'rounded-md border px-3 py-2 text-sm',
                option.isCorrect ? 'border-positive bg-positive-soft text-positive-ink' : 'border-line text-ink',
              )}
            >
              {option.text}
              {option.isCorrect && <span className="ml-2 text-xs">Correct</span>}
            </li>
          ))}
        </ul>
      )}

      {question.type === 'FILL_BLANK' && (
        <p className="text-sm text-ink-muted">
          Accepted:{' '}
          <span className="text-ink">
            {Array.isArray(question.correctAnswer) ? question.correctAnswer.join(', ') : String(question.correctAnswer ?? '—')}
          </span>
        </p>
      )}

      {question.type === 'MATCH' && question.correctAnswer && typeof question.correctAnswer === 'object' && (
        <dl className="divide-y divide-line text-sm">
          {Object.entries(question.correctAnswer).map(([left, right]) => (
            <div key={left} className="flex justify-between gap-4 py-1.5">
              <dt className="text-ink">{left}</dt>
              <dd className="text-ink-muted">{String(right)}</dd>
            </div>
          ))}
        </dl>
      )}

      {question.explanation && (
        <Panel title="Explanation" padding="sm">
          <p className="whitespace-pre-wrap text-sm text-ink-muted">{question.explanation}</p>
        </Panel>
      )}
    </article>
  );
}
