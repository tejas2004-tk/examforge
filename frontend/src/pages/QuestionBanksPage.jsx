import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Layers, Plus, Trash2, Wand2, X } from 'lucide-react';
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
  Skeleton,
  SkeletonTable,
  Table,
  Textarea,
  Toolbar,
} from '../components/ui.jsx';
import { useToast } from '../components/toast.jsx';
import { formatDate, formatNumber } from '../lib/format.js';
import { Async } from './_shared/Async.jsx';
import { getData, pageMeta, retryUnlessDenied } from './_shared/request.js';
import { useDebounced, useSelection, useUrlState } from './_shared/hooks.js';
import { DIFFICULTIES, QUESTION_TYPES, difficultyTone, humanise, questionTypeLabel } from './_shared/domain.js';

const DEFAULTS = { page: 1, limit: 20, search: '', bank: '' };

const bankSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  courseId: z.string().optional(),
});

const blueprintSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional(),
  courseId: z.string().optional(),
  durationMinutes: z.coerce.number().int().min(1, 'At least one minute').max(1440),
  passingMarks: z.coerce.number().min(0),
  negativeMarks: z.coerce.number().min(0),
  maxAttempts: z.coerce.number().int().min(1).max(10),
  shuffleQuestions: z.boolean(),
  config: z
    .array(z.object({ difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXPERT']), count: z.coerce.number().int().min(1).max(100) }))
    .min(1, 'Add at least one difficulty band'),
});

export function QuestionBanksPage() {
  const [state, setState, resetFilters] = useUrlState(DEFAULTS);
  const [searchDraft, setSearchDraft] = useState(state.search);
  const debouncedSearch = useDebounced(searchDraft, 300);
  const [creating, setCreating] = useState(false);
  const [blueprintFor, setBlueprintFor] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (debouncedSearch !== state.search) setState({ search: debouncedSearch });
  }, [debouncedSearch, state.search, setState]);

  const params = new URLSearchParams({ page: String(state.page), limit: String(state.limit) });
  if (state.search) params.set('search', state.search);

  const query = useQuery({
    queryKey: ['question-banks', params.toString()],
    queryFn: () => getData(`/question-banks?${params.toString()}`),
    retry: retryUnlessDenied,
    placeholderData: (previous) => previous,
  });

  const courses = useQuery({
    queryKey: ['courses', 'picker'],
    queryFn: () => getData('/courses?limit=100'),
    retry: retryUnlessDenied,
    staleTime: 5 * 60_000,
  });

  const create = useMutation({
    mutationFn: (payload) => api.post('/question-banks', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-banks'] });
      setCreating(false);
      toast.success('Bank created');
    },
    onError: (error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/question-banks/${id}`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['question-banks'] });
      if (state.bank === id) setState({ bank: '' });
      setConfirm(null);
      toast.success('Bank deleted');
    },
    onError: (error) => {
      toast.error(error.message);
      setConfirm(null);
    },
  });

  const meta = pageMeta(query.data, state.limit);
  const banks = query.data?.items ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Assessment"
        title="Question banks"
        description="Group items so a test can be generated to a difficulty blueprint instead of picked by hand."
        actions={
          <Button icon={Plus} onClick={() => setCreating(true)}>
            New bank
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Toolbar>
            <SearchInput
              aria-label="Search banks"
              placeholder="Search banks"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              className="flex-1"
            />
            {state.search && (
              <Button
                variant="ghost"
                icon={X}
                aria-label="Clear search"
                onClick={() => {
                  setSearchDraft('');
                  resetFilters();
                }}
              />
            )}
          </Toolbar>

          <Async query={query} skeleton={<SkeletonTable rows={5} cols={2} />}>
            {() =>
              banks.length === 0 ? (
                <EmptyState
                  icon={Layers}
                  title={state.search ? 'No banks match that search' : 'No banks yet'}
                  description="A bank collects related questions so you can generate a test from a blueprint."
                  action={<Button onClick={() => setCreating(true)}>New bank</Button>}
                />
              ) : (
                <>
                  <ul className="card divide-y divide-line">
                    {banks.map((bank) => (
                      <li key={bank.id}>
                        <div
                          className={
                            state.bank === bank.id
                              ? 'flex items-center gap-2 border-l-2 border-accent bg-accent-soft px-3 py-2.5'
                              : 'flex items-center gap-2 border-l-2 border-transparent px-3 py-2.5'
                          }
                        >
                          <button
                            type="button"
                            onClick={() => setState({ bank: bank.id })}
                            aria-current={state.bank === bank.id ? 'true' : undefined}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-sm font-medium text-ink">{bank.name}</p>
                            <p className="tabular text-xs text-ink-muted">
                              {formatNumber(bank._count?.questions ?? 0)} questions · created {formatDate(bank.createdAt)}
                            </p>
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Wand2}
                            aria-label={`Generate a test from ${bank.name}`}
                            onClick={() => setBlueprintFor(bank)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            aria-label={`Delete ${bank.name}`}
                            onClick={() => setConfirm(bank)}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Pagination
                    page={meta.page}
                    pageCount={meta.pageCount}
                    total={meta.total}
                    pageSize={meta.pageSize}
                    onPageChange={(page) => setState({ page })}
                  />
                </>
              )
            }
          </Async>
        </div>

        {state.bank ? (
          <BankContents bankId={state.bank} />
        ) : (
          <EmptyState
            icon={Layers}
            title="Select a bank"
            description="Pick a bank on the left to add or remove questions and to generate a test."
          />
        )}
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New question bank"
        description="Banks are private to you and can be tied to a course."
      >
        <BankForm
          courses={courses.data?.items ?? []}
          saving={create.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={(values) =>
            create.mutate({ name: values.name.trim(), courseId: values.courseId || undefined })
          }
        />
      </Modal>

      {blueprintFor && (
        <BlueprintDrawer
          bank={blueprintFor}
          courses={courses.data?.items ?? []}
          onClose={() => setBlueprintFor(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => remove.mutate(confirm.id)}
        loading={remove.isPending}
        tone="danger"
        title={`Delete ${confirm?.name}?`}
        description="The questions themselves stay in your library; only the grouping is removed."
        confirmLabel="Delete bank"
      />
    </div>
  );
}

function BankForm({ courses, saving, onSubmit, onCancel }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(bankSchema), defaultValues: { name: '', courseId: '' } });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label="Name" htmlFor="bank-name" required error={errors.name?.message}>
        <Input id="bank-name" autoFocus {...register('name')} aria-invalid={Boolean(errors.name)} />
      </Field>
      <Field label="Course" htmlFor="bank-course" hint="Optional" error={errors.courseId?.message}>
        <Select id="bank-course" {...register('courseId')}>
          <option value="">Not linked to a course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code} — {course.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Create bank
        </Button>
      </div>
    </form>
  );
}

function BankContents({ bankId }) {
  const [picking, setPicking] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const query = useQuery({
    queryKey: ['question-banks', bankId],
    queryFn: () => getData(`/question-banks/${bankId}`),
    retry: retryUnlessDenied,
  });

  const bank = query.data?.bank ?? query.data;
  const questions = useMemo(
    () => (bank?.questions ?? []).map((membership) => membership.question).filter(Boolean),
    [bank],
  );
  const ids = useMemo(() => questions.map((q) => q.id), [questions]);
  const selection = useSelection(ids);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['question-banks', bankId] });
    queryClient.invalidateQueries({ queryKey: ['question-banks'] });
  };

  const removeQuestions = useMutation({
    mutationFn: (questionIds) =>
      Promise.all(questionIds.map((id) => api.delete(`/question-banks/${bankId}/questions/${id}`))),
    onSuccess: (_data, questionIds) => {
      invalidate();
      selection.clear();
      toast.success(questionIds.length === 1 ? 'Question removed' : `${questionIds.length} questions removed`);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <Panel
        title={bank?.name ?? 'Bank'}
        description={`${formatNumber(questions.length)} questions`}
        action={
          <div className="flex gap-2">
            {selection.count > 0 && (
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                loading={removeQuestions.isPending}
                onClick={() => removeQuestions.mutate(selection.ids)}
              >
                Remove {selection.count}
              </Button>
            )}
            <Button size="sm" icon={Plus} onClick={() => setPicking(true)}>
              Add questions
            </Button>
          </div>
        }
        padding="none"
      >
        <Async query={query} skeleton={<SkeletonTable rows={6} cols={4} />}>
          {() =>
            questions.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="This bank is empty"
                  description="Add questions from your library, then generate a test to a difficulty blueprint."
                  action={<Button onClick={() => setPicking(true)}>Add questions</Button>}
                />
              </div>
            ) : (
              <Table
                className="rounded-none border-0"
                head={[
                  {
                    key: 'select',
                    label: (
                      <Checkbox
                        aria-label="Select every question in this bank"
                        checked={selection.count > 0 && selection.count === questions.length}
                        onChange={selection.toggleAll}
                      />
                    ),
                    width: '2.5rem',
                  },
                  { key: 'text', label: 'Question' },
                  { key: 'type', label: 'Type' },
                  { key: 'difficulty', label: 'Difficulty' },
                  { key: 'marks', label: 'Marks', align: 'right' },
                  { key: 'actions', label: '', align: 'right' },
                ]}
              >
                {questions.map((question) => (
                  <tr key={question.id}>
                    <td>
                      <Checkbox
                        aria-label={`Select ${question.text.slice(0, 40)}`}
                        checked={selection.selected.has(question.id)}
                        onChange={() => selection.toggle(question.id)}
                      />
                    </td>
                    <td className="max-w-md">
                      <span className="line-clamp-2 text-ink">{question.text}</span>
                    </td>
                    <td className="text-ink-muted">{questionTypeLabel(question.type)}</td>
                    <td>
                      <Badge tone={difficultyTone(question.difficulty)}>{humanise(question.difficulty)}</Badge>
                    </td>
                    <td className="tabular text-right">{formatNumber(Number(question.marks))}</td>
                    <td className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        aria-label="Remove from bank"
                        onClick={() => removeQuestions.mutate([question.id])}
                      />
                    </td>
                  </tr>
                ))}
              </Table>
            )
          }
        </Async>
      </Panel>

      {picking && (
        <QuestionPicker
          bankId={bankId}
          existing={new Set(ids)}
          onClose={() => setPicking(false)}
          onAdded={invalidate}
        />
      )}
    </>
  );
}

function QuestionPicker({ bankId, existing, onClose, onAdded }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const debounced = useDebounced(search, 300);
  const toast = useToast();

  const params = new URLSearchParams({ limit: '50' });
  if (debounced) params.set('search', debounced);
  if (type) params.set('type', type);
  if (difficulty) params.set('difficulty', difficulty);

  const query = useQuery({
    queryKey: ['questions', 'picker', params.toString()],
    queryFn: () => getData(`/questions?${params.toString()}`),
    retry: retryUnlessDenied,
    placeholderData: (previous) => previous,
  });

  const candidates = (query.data?.items ?? []).filter((q) => !existing.has(q.id));
  const ids = useMemo(() => candidates.map((q) => q.id), [candidates]);
  const selection = useSelection(ids);

  const add = useMutation({
    mutationFn: (questionIds) =>
      Promise.all(questionIds.map((questionId) => api.post(`/question-banks/${bankId}/questions`, { questionId }))),
    onSuccess: (_data, questionIds) => {
      onAdded();
      selection.clear();
      toast.success(`${questionIds.length} added`);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Drawer
      open
      onClose={onClose}
      title="Add questions"
      description="Only questions not already in the bank are listed."
      width="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-ink-muted">{selection.count} selected</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              disabled={selection.count === 0}
              loading={add.isPending}
              onClick={() => add.mutate(selection.ids)}
            >
              Add to bank
            </Button>
          </div>
        </div>
      }
    >
      <Toolbar className="mb-3">
        <SearchInput
          aria-label="Search questions"
          placeholder="Search question text or topic"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {QUESTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="">All difficulties</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {humanise(d)}
            </option>
          ))}
        </Select>
      </Toolbar>

      <Async query={query} skeleton={<Skeleton className="h-64" />}>
        {() =>
          candidates.length === 0 ? (
            <EmptyState title="Nothing left to add" description="Every matching question is already in this bank." />
          ) : (
            <ul className="divide-y divide-line">
              {candidates.map((question) => (
                <li key={question.id} className="flex items-start gap-3 py-2.5">
                  <Checkbox
                    className="mt-0.5"
                    aria-label={`Select ${question.text.slice(0, 40)}`}
                    checked={selection.selected.has(question.id)}
                    onChange={() => selection.toggle(question.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm text-ink">{question.text}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge tone={difficultyTone(question.difficulty)}>{humanise(question.difficulty)}</Badge>
                      <span className="text-xs text-ink-muted">{questionTypeLabel(question.type)}</span>
                      <span className="tabular text-xs text-ink-muted">{question.marks} marks</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </Async>
    </Drawer>
  );
}

function BlueprintDrawer({ bank, courses, onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(blueprintSchema),
    defaultValues: {
      title: `${bank.name} test`,
      description: '',
      courseId: bank.courseId ?? '',
      durationMinutes: 60,
      passingMarks: 40,
      negativeMarks: 0,
      maxAttempts: 1,
      shuffleQuestions: true,
      config: [{ difficulty: 'MEDIUM', count: 10 }],
    },
  });

  const config = useFieldArray({ control, name: 'config' });

  const generate = useMutation({
    mutationFn: (values) =>
      api.post(`/question-banks/${bank.id}/generate-test`, {
        ...values,
        courseId: values.courseId || undefined,
        description: values.description?.trim() || undefined,
      }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      const test = response.data?.data?.test;
      toast.success('Test generated');
      onClose();
      if (test?.id) navigate(`/teacher/tests/${test.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Drawer
      open
      onClose={onClose}
      title="Generate a test"
      description={`Draws questions at random from ${bank.name} to match the blueprint below.`}
      width="lg"
    >
      <form onSubmit={handleSubmit((values) => generate.mutate(values))} className="space-y-4" noValidate>
        <Field label="Title" htmlFor="bp-title" required error={errors.title?.message}>
          <Input id="bp-title" {...register('title')} />
        </Field>
        <Field label="Description" htmlFor="bp-description" error={errors.description?.message}>
          <Textarea id="bp-description" rows={2} {...register('description')} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Course" htmlFor="bp-course" error={errors.courseId?.message}>
            <Select id="bp-course" {...register('courseId')}>
              <option value="">Not linked to a course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} — {course.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Duration (minutes)" htmlFor="bp-duration" required error={errors.durationMinutes?.message}>
            <Input id="bp-duration" type="number" min="1" {...register('durationMinutes')} />
          </Field>
          <Field label="Passing marks" htmlFor="bp-pass" required error={errors.passingMarks?.message}>
            <Input id="bp-pass" type="number" step="0.5" min="0" {...register('passingMarks')} />
          </Field>
          <Field label="Negative marks" htmlFor="bp-negative" error={errors.negativeMarks?.message}>
            <Input id="bp-negative" type="number" step="0.5" min="0" {...register('negativeMarks')} />
          </Field>
          <Field label="Attempts allowed" htmlFor="bp-attempts" error={errors.maxAttempts?.message}>
            <Input id="bp-attempts" type="number" min="1" max="10" {...register('maxAttempts')} />
          </Field>
        </div>

        <Checkbox
          id="bp-shuffle"
          label="Shuffle question order per candidate"
          {...register('shuffleQuestions')}
        />

        <fieldset className="rounded-md border border-line p-3">
          <legend className="eyebrow px-1">Blueprint</legend>
          {errors.config?.message && <p className="mb-2 text-sm text-critical">{errors.config.message}</p>}
          <ul className="space-y-2">
            {config.fields.map((field, index) => (
              <li key={field.id} className="grid grid-cols-[1fr_7rem_auto] items-center gap-2">
                <Select aria-label={`Band ${index + 1} difficulty`} {...register(`config.${index}.difficulty`)}>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {humanise(d)}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  aria-label={`Band ${index + 1} question count`}
                  {...register(`config.${index}.count`)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  aria-label={`Remove band ${index + 1}`}
                  disabled={config.fields.length <= 1}
                  onClick={() => config.remove(index)}
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
            onClick={() => config.append({ difficulty: 'EASY', count: 5 })}
          >
            Add band
          </Button>
        </fieldset>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={generate.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={generate.isPending}>
            Generate test
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
