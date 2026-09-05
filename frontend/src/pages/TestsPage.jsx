import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BarChart3, Copy, Plus, Trash2, X } from 'lucide-react';
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
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  SkeletonTable,
  Table,
  Textarea,
  Toolbar,
} from '../components/ui.jsx';
import { useToast } from '../components/toast.jsx';
import { formatDate, formatDateTime, formatNumber } from '../lib/format.js';
import { Async } from './_shared/Async.jsx';
import { getData, pageMeta, retryUnlessDenied } from './_shared/request.js';
import { useDebounced, useUrlState } from './_shared/hooks.js';
import { DIFFICULTIES, EXAM_MODES, TEST_STATUSES, difficultyTone, humanise } from './_shared/domain.js';

const DEFAULTS = { page: 1, limit: 20, search: '', status: '' };

const statusTone = (status) =>
  ({ PUBLISHED: 'positive', DRAFT: 'caution', CLOSED: 'neutral' })[status] ?? 'neutral';

/** `datetime-local` produces a value without a zone; the API wants full ISO. */
const toIso = (value) => (value ? new Date(value).toISOString() : undefined);
const toLocalInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const testSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().max(5000).optional(),
    courseId: z.string().optional(),
    durationMinutes: z.coerce.number().int().min(1, 'At least one minute').max(1440),
    passingMarks: z.coerce.number().min(0),
    negativeMarks: z.coerce.number().min(0),
    maxAttempts: z.coerce.number().int().min(1).max(10),
    examMode: z.string().optional(),
    gracePeriodMinutes: z.coerce.number().int().min(0).max(60),
    shuffleQuestions: z.boolean(),
    randomOptionOrder: z.boolean(),
    showResultImmediately: z.boolean(),
    password: z.string().max(100).optional(),
    startAt: z.string().optional(),
    endAt: z.string().optional(),
    questionIds: z.array(z.string()).min(1, 'Select at least one question'),
  })
  .superRefine((data, ctx) => {
    if (data.startAt && data.endAt && new Date(data.endAt) <= new Date(data.startAt)) {
      ctx.addIssue({ code: 'custom', path: ['endAt'], message: 'The window must close after it opens' });
    }
  });

const blankTest = {
  title: '',
  description: '',
  courseId: '',
  durationMinutes: 60,
  passingMarks: 40,
  negativeMarks: 0,
  maxAttempts: 1,
  examMode: 'FINAL',
  gracePeriodMinutes: 0,
  shuffleQuestions: false,
  randomOptionOrder: false,
  showResultImmediately: true,
  password: '',
  startAt: '',
  endAt: '',
  questionIds: [],
};

export function TestsPage({ basePath = '/teacher/tests' }) {
  const [state, setState, resetFilters] = useUrlState(DEFAULTS);
  const [searchDraft, setSearchDraft] = useState(state.search);
  const debouncedSearch = useDebounced(searchDraft, 300);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorValues, setEditorValues] = useState(blankTest);
  const [confirm, setConfirm] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (debouncedSearch !== state.search) setState({ search: debouncedSearch });
  }, [debouncedSearch, state.search, setState]);

  const params = new URLSearchParams({ page: String(state.page), limit: String(state.limit) });
  if (state.search) params.set('search', state.search);
  if (state.status) params.set('status', state.status);

  const query = useQuery({
    queryKey: ['tests', params.toString()],
    queryFn: () => getData(`/tests?${params.toString()}`),
    retry: retryUnlessDenied,
    placeholderData: (previous) => previous,
  });

  const create = useMutation({
    mutationFn: (payload) => api.post('/tests', payload),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      setEditorOpen(false);
      const test = response.data?.data?.test;
      toast.success('Test created');
      if (test?.id) navigate(`${basePath}/${test.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/tests/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      setConfirm(null);
      toast.success('Test deleted');
    },
    onError: (error) => {
      toast.error(error.message);
      setConfirm(null);
    },
  });

  const duplicate = useMutation({
    mutationFn: async (id) => {
      const source = (await getData(`/tests/${id}`)).test;
      return api.post('/tests', {
        title: `${source.title} (copy)`,
        description: source.description ?? undefined,
        courseId: source.courseId ?? undefined,
        durationMinutes: source.durationMinutes,
        totalMarks: source.totalMarks,
        passingMarks: source.passingMarks,
        negativeMarks: source.negativeMarks,
        maxAttempts: source.maxAttempts,
        shuffleQuestions: source.shuffleQuestions,
        randomOptionOrder: source.randomOptionOrder,
        showResultImmediately: source.showResultImmediately,
        examMode: source.examMode ?? undefined,
        gracePeriodMinutes: source.gracePeriodMinutes,
        questionIds: source.questions.map((q) => q.id),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      toast.success('Duplicated as a draft');
    },
    onError: (error) => toast.error(error.message),
  });

  const meta = pageMeta(query.data, state.limit);
  const tests = query.data?.items ?? [];
  const filtersActive = Boolean(state.search || state.status);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Assessment"
        title="Tests"
        description="Draft, publish and close assessments. Only draft tests can be edited."
        actions={
          <Button
            icon={Plus}
            onClick={() => {
              setEditorValues(blankTest);
              setEditorOpen(true);
            }}
          >
            New test
          </Button>
        }
      />

      <Toolbar>
        <SearchInput
          aria-label="Search tests"
          placeholder="Search by title"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          className="sm:w-72"
        />
        <Select aria-label="Status" value={state.status} onChange={(e) => setState({ status: e.target.value })}>
          <option value="">All statuses</option>
          {TEST_STATUSES.map((status) => (
            <option key={status} value={status}>
              {humanise(status)}
            </option>
          ))}
        </Select>
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

      <Async query={query} skeleton={<SkeletonTable rows={8} cols={6} />}>
        {() =>
          tests.length === 0 ? (
            <EmptyState
              title={filtersActive ? 'No tests match these filters' : 'No tests yet'}
              description={
                filtersActive
                  ? 'Try another status or clear the search.'
                  : 'Build a test by picking questions, or generate one from a question bank.'
              }
              action={
                filtersActive ? (
                  <Button variant="secondary" onClick={resetFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setEditorValues(blankTest);
                      setEditorOpen(true);
                    }}
                  >
                    New test
                  </Button>
                )
              }
            />
          ) : (
            <>
              <Table
                head={[
                  { key: 'title', label: 'Test' },
                  { key: 'status', label: 'Status' },
                  { key: 'window', label: 'Window' },
                  { key: 'questions', label: 'Questions', align: 'right' },
                  { key: 'attempts', label: 'Attempts', align: 'right' },
                  { key: 'marks', label: 'Marks', align: 'right' },
                  { key: 'actions', label: '', align: 'right' },
                ]}
              >
                {tests.map((test) => (
                  <tr key={test.id}>
                    <td>
                      <Link className="link font-medium" to={`${basePath}/${test.id}`}>
                        {test.title}
                      </Link>
                      <p className="text-xs text-ink-muted">
                        {test.course ? `${test.course.code} · ` : ''}
                        {test.durationMinutes} min · {humanise(test.examMode ?? '')}
                      </p>
                    </td>
                    <td>
                      <Badge tone={statusTone(test.status)}>{humanise(test.status)}</Badge>
                    </td>
                    <td className="text-xs text-ink-muted">
                      {test.startAt || test.endAt ? (
                        <>
                          <span className="block">{test.startAt ? formatDateTime(test.startAt) : 'Open now'}</span>
                          <span className="block">{test.endAt ? `until ${formatDateTime(test.endAt)}` : 'no close date'}</span>
                        </>
                      ) : (
                        'Always open'
                      )}
                    </td>
                    <td className="tabular text-right">{formatNumber(test._count?.testQuestions ?? 0)}</td>
                    <td className="tabular text-right">{formatNumber(test._count?.attempts ?? 0)}</td>
                    <td className="tabular text-right">
                      {formatNumber(Number(test.totalMarks))}
                      <span className="text-ink-subtle"> / pass {formatNumber(Number(test.passingMarks))}</span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={BarChart3}
                          as={Link}
                          to={`/analytics/tests/${test.id}`}
                          aria-label={`Analytics for ${test.title}`}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Copy}
                          aria-label={`Duplicate ${test.title}`}
                          loading={duplicate.isPending && duplicate.variables === test.id}
                          onClick={() => duplicate.mutate(test.id)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          aria-label={`Delete ${test.title}`}
                          onClick={() => setConfirm(test)}
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

      {editorOpen && (
        <TestEditor
          initial={editorValues}
          saving={create.isPending}
          onClose={() => setEditorOpen(false)}
          onSubmit={(values) =>
            create.mutate({
              title: values.title.trim(),
              description: values.description?.trim() || undefined,
              courseId: values.courseId || undefined,
              durationMinutes: values.durationMinutes,
              passingMarks: values.passingMarks,
              negativeMarks: values.negativeMarks,
              maxAttempts: values.maxAttempts,
              examMode: values.examMode || undefined,
              gracePeriodMinutes: values.gracePeriodMinutes,
              shuffleQuestions: values.shuffleQuestions,
              randomOptionOrder: values.randomOptionOrder,
              showResultImmediately: values.showResultImmediately,
              password: values.password?.trim() || undefined,
              startAt: toIso(values.startAt),
              endAt: toIso(values.endAt),
              questionIds: values.questionIds,
            })
          }
        />
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => remove.mutate(confirm.id)}
        loading={remove.isPending}
        tone="danger"
        title={`Delete ${confirm?.title}?`}
        description="Attempts, assignments and results for this test are deleted with it. This cannot be undone."
        confirmLabel="Delete test"
      />
    </div>
  );
}

function TestEditor({ initial, saving, onSubmit, onClose }) {
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const debounced = useDebounced(search, 300);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(testSchema), defaultValues: initial });

  const questionIds = watch('questionIds') ?? [];

  const params = new URLSearchParams({ limit: '50' });
  if (debounced) params.set('search', debounced);
  if (difficulty) params.set('difficulty', difficulty);

  const questions = useQuery({
    queryKey: ['questions', 'test-picker', params.toString()],
    queryFn: () => getData(`/questions?${params.toString()}`),
    retry: retryUnlessDenied,
    placeholderData: (previous) => previous,
  });

  const courses = useQuery({
    queryKey: ['courses', 'picker'],
    queryFn: () => getData('/courses?limit=100'),
    retry: retryUnlessDenied,
    staleTime: 5 * 60_000,
  });

  const available = questions.data?.items ?? [];
  const selectedSet = new Set(questionIds);
  const selectedMarks = useMemo(
    () => available.filter((q) => selectedSet.has(q.id)).reduce((sum, q) => sum + Number(q.marks), 0),
    // Marks only reflect questions currently loaded; the server recomputes the true
    // total from every selected question when the test is created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [available, questionIds],
  );

  const toggle = (id) => {
    setValue('questionIds', selectedSet.has(id) ? questionIds.filter((q) => q !== id) : [...questionIds, id], {
      shouldValidate: true,
    });
  };

  return (
    <Drawer open onClose={onClose} title="New test" width="xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <section className="space-y-4">
          <Field label="Title" htmlFor="test-title" required error={errors.title?.message}>
            <Input id="test-title" autoFocus {...register('title')} aria-invalid={Boolean(errors.title)} />
          </Field>
          <Field label="Description" htmlFor="test-description" error={errors.description?.message}>
            <Textarea id="test-description" rows={2} {...register('description')} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Course" htmlFor="test-course" error={errors.courseId?.message}>
              <Select id="test-course" {...register('courseId')}>
                <option value="">Not linked to a course</option>
                {(courses.data?.items ?? []).map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} — {course.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Exam mode" htmlFor="test-mode" error={errors.examMode?.message}>
              <Select id="test-mode" {...register('examMode')}>
                {EXAM_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {humanise(mode)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Duration (minutes)" htmlFor="test-duration" required error={errors.durationMinutes?.message}>
              <Input id="test-duration" type="number" min="1" max="1440" {...register('durationMinutes')} />
            </Field>
            <Field label="Passing marks" htmlFor="test-pass" required error={errors.passingMarks?.message}>
              <Input id="test-pass" type="number" step="0.5" min="0" {...register('passingMarks')} />
            </Field>
            <Field
              label="Negative marks"
              htmlFor="test-negative"
              hint="Applied per wrong answer"
              error={errors.negativeMarks?.message}
            >
              <Input id="test-negative" type="number" step="0.5" min="0" {...register('negativeMarks')} />
            </Field>
            <Field label="Attempts allowed" htmlFor="test-attempts" error={errors.maxAttempts?.message}>
              <Input id="test-attempts" type="number" min="1" max="10" {...register('maxAttempts')} />
            </Field>
            <Field label="Opens at" htmlFor="test-start" hint="Local time" error={errors.startAt?.message}>
              <Input id="test-start" type="datetime-local" {...register('startAt')} />
            </Field>
            <Field label="Closes at" htmlFor="test-end" hint="Local time" error={errors.endAt?.message}>
              <Input id="test-end" type="datetime-local" {...register('endAt')} />
            </Field>
            <Field
              label="Grace period (minutes)"
              htmlFor="test-grace"
              hint="Late entry allowance"
              error={errors.gracePeriodMinutes?.message}
            >
              <Input id="test-grace" type="number" min="0" max="60" {...register('gracePeriodMinutes')} />
            </Field>
            <Field
              label="Access password"
              htmlFor="test-password"
              hint="Leave blank for no password"
              error={errors.password?.message}
            >
              <Input id="test-password" type="text" autoComplete="off" {...register('password')} />
            </Field>
          </div>

          <div className="space-y-2">
            <Checkbox id="test-shuffle" label="Shuffle question order per candidate" {...register('shuffleQuestions')} />
            <Checkbox id="test-random-options" label="Randomise option order" {...register('randomOptionOrder')} />
            <Checkbox
              id="test-show-result"
              label="Show the result to candidates immediately"
              description="Turn this off when subjective answers need grading first."
              {...register('showResultImmediately')}
            />
          </div>
        </section>

        <section className="rounded-md border border-line">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">Questions</h3>
              <p className="tabular text-xs text-ink-muted">
                {questionIds.length} selected · {formatNumber(selectedMarks)} marks on this page
              </p>
            </div>
            <div className="flex gap-2">
              <SearchInput
                aria-label="Search questions"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select aria-label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="">All difficulties</option>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {humanise(d)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {errors.questionIds?.message && (
            <p className="border-b border-line px-3 py-2 text-sm text-critical">{errors.questionIds.message}</p>
          )}

          <div className="scrollbar-slim max-h-80 overflow-y-auto px-3">
            {questions.isPending ? (
              <div className="py-3">
                <SkeletonTable rows={4} cols={2} />
              </div>
            ) : available.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">No questions match this search.</p>
            ) : (
              <ul className="divide-y divide-line">
                {available.map((question) => (
                  <li key={question.id} className="flex items-start gap-3 py-2.5">
                    <Checkbox
                      className="mt-0.5"
                      aria-label={`Include ${question.text.slice(0, 40)}`}
                      checked={selectedSet.has(question.id)}
                      onChange={() => toggle(question.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm text-ink">{question.text}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge tone={difficultyTone(question.difficulty)}>{humanise(question.difficulty)}</Badge>
                        <span className="tabular text-xs text-ink-muted">{question.marks} marks</span>
                        {question.topic && <span className="text-xs text-ink-subtle">{question.topic}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Create test
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

export { toLocalInput, toIso, statusTone };
