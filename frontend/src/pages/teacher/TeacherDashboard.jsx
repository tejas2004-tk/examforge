import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ClipboardList, FileQuestion, FolderPlus, Plus, Users } from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  ErrorAlert,
  PageHeader,
  Panel,
  StatTile,
  Table,
} from '../../components/ui.jsx';
import { formatDate, formatNumber, formatPercent, formatRelative } from '../../lib/format.js';
import { StatSkeleton } from '../_shared/Async.jsx';
import { getData, getDataOptional, retryUnlessDenied } from '../_shared/request.js';
import { axisProps, tooltipProps, useChartColors } from '../_shared/chart.js';
import { humanise } from '../_shared/domain.js';

export function TeacherDashboard() {
  const colors = useChartColors();

  const [tests, questions, results, courses, assignments] = useQueries({
    queries: [
      { queryKey: ['tests', { limit: 100 }], queryFn: () => getData('/tests?limit=100'), retry: retryUnlessDenied },
      { queryKey: ['questions', { limit: 1 }], queryFn: () => getData('/questions?limit=1'), retry: retryUnlessDenied },
      { queryKey: ['results', { limit: 50 }], queryFn: () => getData('/results?limit=50'), retry: retryUnlessDenied },
      { queryKey: ['courses', { limit: 100 }], queryFn: () => getData('/courses?limit=100'), retry: retryUnlessDenied },
      { queryKey: ['assignments', { limit: 50 }], queryFn: () => getData('/assignments?limit=50'), retry: retryUnlessDenied },
    ],
  });

  const overview = useQuery({
    queryKey: ['analytics', 'overview', '30d'],
    queryFn: () => getDataOptional('/analytics/overview?range=30d'),
    retry: retryUnlessDenied,
    staleTime: 60_000,
  });

  const loading = [tests, questions, results, courses, assignments].some((q) => q.isPending);
  const failed = [tests, questions, results, courses, assignments].find((q) => q.isError);

  if (failed) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Teaching" title="Dashboard" />
        <ErrorAlert
          error={failed.error}
          onRetry={() => [tests, questions, results, courses, assignments].forEach((q) => q.refetch())}
        />
      </div>
    );
  }

  const testItems = tests.data?.items ?? [];
  const resultItems = results.data?.items ?? [];
  const assignmentItems = assignments.data?.items ?? [];

  const published = testItems.filter((t) => t.status === 'PUBLISHED');
  const drafts = testItems.filter((t) => t.status === 'DRAFT');
  const scored = resultItems.filter((r) => r.percentage !== null);
  const avgPercentage = scored.length
    ? scored.reduce((sum, r) => sum + Number(r.percentage), 0) / scored.length
    : null;
  const awaitingGrading = resultItems.filter((r) => r.status === 'SUBMITTED').length;

  // Test volume comes straight off the list payload, so the ranking survives even
  // when the analytics service is unavailable.
  const byAttempts = testItems
    .map((t) => ({ id: t.id, title: t.title, attempts: t._count?.attempts ?? 0, questions: t._count?.testQuestions ?? 0 }))
    .filter((t) => t.attempts > 0)
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 8);

  const dueSoon = assignmentItems
    .filter((a) => a.dueAt && new Date(a.dueAt) > new Date())
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Teaching"
        title="Dashboard"
        description="Your tests, question stock and the submissions waiting on you."
        actions={
          <div className="flex gap-2">
            <Button as={Link} to="/teacher/questions" variant="secondary" icon={FolderPlus}>
              Add questions
            </Button>
            <Button as={Link} to="/teacher/tests" icon={Plus}>
              New test
            </Button>
          </div>
        }
      />

      {loading ? (
        <StatSkeleton count={4} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Published tests"
            value={formatNumber(published.length)}
            hint={`${formatNumber(drafts.length)} in draft`}
            icon={ClipboardList}
          />
          <StatTile
            label="Questions authored"
            value={formatNumber(questions.data?.meta?.total ?? 0)}
            hint={`Across ${formatNumber(courses.data?.meta?.total ?? 0)} courses`}
            icon={FileQuestion}
          />
          <StatTile
            label="Submissions"
            value={formatNumber(results.data?.meta?.total ?? 0)}
            hint={awaitingGrading > 0 ? `${formatNumber(awaitingGrading)} awaiting grading` : 'All graded'}
            tone={awaitingGrading > 0 ? 'caution' : 'neutral'}
            icon={Users}
          />
          <StatTile
            label="Average score"
            value={avgPercentage === null ? 'No data' : formatPercent(avgPercentage)}
            hint={`${formatNumber(scored.length)} scored attempts`}
            tone={avgPercentage !== null && avgPercentage >= 60 ? 'positive' : 'neutral'}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel
          title="Attempts over the last 30 days"
          action={
            <Link className="link text-sm" to="/analytics">
              Full analytics
            </Link>
          }
        >
          {overview.isPending ? (
            <div className="h-56 animate-pulse rounded-md bg-surface-sunken" />
          ) : overview.data?.series?.length ? (
            <div className="h-56" role="img" aria-label="Attempts per day over the last 30 days">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={overview.data.series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <defs>
                    <linearGradient id="teacher-attempts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.accent} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={colors.accent} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={colors.line} vertical={false} />
                  <XAxis dataKey="date" {...axisProps(colors)} />
                  <YAxis {...axisProps(colors)} width={40} allowDecimals={false} />
                  <Tooltip {...tooltipProps(colors)} />
                  <Area
                    type="monotone"
                    dataKey="attempts"
                    name="Attempts"
                    stroke={colors.accent}
                    strokeWidth={2}
                    fill="url(#teacher-attempts)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : byAttempts.length > 0 ? (
            <div className="h-56" role="img" aria-label="Attempts per test">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byAttempts} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke={colors.line} horizontal={false} />
                  <XAxis type="number" {...axisProps(colors)} allowDecimals={false} />
                  <YAxis type="category" dataKey="title" width={140} {...axisProps(colors)} />
                  <Tooltip {...tooltipProps(colors)} />
                  <Bar dataKey="attempts" name="Attempts" fill={colors.accent} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title="No attempts recorded"
              description="Publish a test and assign it to a class to start collecting data."
              action={
                <Button as={Link} to="/teacher/tests">
                  Go to tests
                </Button>
              }
            />
          )}
        </Panel>

        <Panel title="Assignments due soon">
          {dueSoon.length === 0 ? (
            <EmptyState
              title="Nothing due"
              description="Assignments with a future deadline appear here."
              action={
                <Button as={Link} to="/teacher/assignments" variant="secondary">
                  Assignments
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {dueSoon.map((assignment) => (
                <li key={assignment.id} className="py-2.5">
                  <p className="truncate text-sm font-medium text-ink">{assignment.title}</p>
                  <p className="text-xs text-ink-muted">
                    Due {formatRelative(assignment.dueAt)} · {formatNumber(assignment._count?.submissions ?? 0)} submitted
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Latest submissions"
          action={
            <Link className="link text-sm" to="/teacher/results">
              All submissions
            </Link>
          }
        >
          {resultItems.length === 0 ? (
            <EmptyState title="No submissions yet" description="Attempts appear as soon as candidates submit." />
          ) : (
            <Table
              dense
              head={[
                { key: 'student', label: 'Candidate' },
                { key: 'test', label: 'Test' },
                { key: 'score', label: 'Score', align: 'right' },
                { key: 'when', label: 'Submitted' },
              ]}
            >
              {resultItems.slice(0, 8).map((result) => (
                <tr key={result.id}>
                  <td>
                    <Link className="link" to={`/teacher/results/${result.id}`}>
                      {result.student?.fullName ?? result.student?.email ?? 'Unknown'}
                    </Link>
                  </td>
                  <td className="max-w-[14rem] truncate text-ink-muted">{result.test.title}</td>
                  <td className="tabular text-right">
                    {result.percentage === null ? (
                      <Badge tone="caution">Awaiting grading</Badge>
                    ) : (
                      formatPercent(result.percentage)
                    )}
                  </td>
                  <td className="text-ink-muted">{formatDate(result.submittedAt)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>

        <Panel
          title="Your tests"
          action={
            <Link className="link text-sm" to="/teacher/tests">
              Manage
            </Link>
          }
        >
          {testItems.length === 0 ? (
            <EmptyState
              title="No tests yet"
              description="Build a test from your question bank or author questions one at a time."
              action={
                <Button as={Link} to="/teacher/tests">
                  Create a test
                </Button>
              }
            />
          ) : (
            <Table
              dense
              head={[
                { key: 'title', label: 'Test' },
                { key: 'status', label: 'Status' },
                { key: 'questions', label: 'Questions', align: 'right' },
                { key: 'attempts', label: 'Attempts', align: 'right' },
              ]}
            >
              {testItems.slice(0, 8).map((test) => (
                <tr key={test.id}>
                  <td>
                    <Link className="link" to={`/teacher/tests/${test.id}`}>
                      {test.title}
                    </Link>
                  </td>
                  <td>
                    <Badge
                      tone={test.status === 'PUBLISHED' ? 'positive' : test.status === 'CLOSED' ? 'neutral' : 'caution'}
                    >
                      {humanise(test.status)}
                    </Badge>
                  </td>
                  <td className="tabular text-right">{formatNumber(test._count?.testQuestions ?? 0)}</td>
                  <td className="tabular text-right">{formatNumber(test._count?.attempts ?? 0)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      </div>
    </div>
  );
}
