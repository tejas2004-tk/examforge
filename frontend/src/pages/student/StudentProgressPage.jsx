import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plug } from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Panel,
  ProgressBar,
  StatTile,
  Table,
} from '../../components/ui.jsx';
import { formatDate, formatNumber, formatPercent } from '../../lib/format.js';
import { Async, ChartSkeleton, StatSkeleton } from '../_shared/Async.jsx';
import { getDataOptional, retryUnlessDenied } from '../_shared/request.js';
import { axisProps, tooltipProps, useChartColors } from '../_shared/chart.js';

export function StudentProgressPage() {
  const colors = useChartColors();

  const query = useQuery({
    queryKey: ['analytics', 'me'],
    queryFn: () => getDataOptional('/analytics/me'),
    retry: retryUnlessDenied,
    staleTime: 60_000,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Learning"
        title="My progress"
        description="How your scores and course completion have moved over time."
        actions={
          <Button as={Link} to="/student/results" variant="secondary">
            All results
          </Button>
        }
      />

      <Async
        query={query}
        skeleton={
          <div className="space-y-4">
            <StatSkeleton count={4} />
            <ChartSkeleton />
          </div>
        }
      >
        {(data) => {
          if (!data) {
            return (
              <EmptyState
                icon={Plug}
                title="Progress data is not available on this server"
                description="The /api/analytics/me endpoint did not respond. Your results are still available under My results."
              />
            );
          }

          const kpis = data.kpis ?? {};
          const series = data.series ?? [];
          const byCourse = data.byCourse ?? [];
          const recent = data.recentResults ?? [];

          return (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Attempts" value={formatNumber(kpis.attempts ?? 0)} hint="Tests submitted" />
                <StatTile
                  label="Average score"
                  value={formatPercent(kpis.avgScore ?? 0)}
                  hint="Across evaluated attempts"
                />
                <StatTile
                  label="Pass rate"
                  value={formatPercent(kpis.passRate ?? 0)}
                  tone={(kpis.passRate ?? 0) >= 60 ? 'positive' : 'caution'}
                />
                <StatTile
                  label="Study streak"
                  value={`${formatNumber(kpis.streakDays ?? 0)} days`}
                  hint={`${formatNumber(kpis.lessonsCompleted ?? 0)} lessons completed`}
                />
              </div>

              <Panel title="Score trend" description="Average percentage per day you sat a test.">
                {series.length === 0 ? (
                  <EmptyState title="No attempts yet" description="Take a test and your trend appears here." />
                ) : (
                  <div className="h-64" role="img" aria-label="Average score per day">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                        <CartesianGrid stroke={colors.line} vertical={false} />
                        <XAxis dataKey="date" {...axisProps(colors)} />
                        <YAxis {...axisProps(colors)} width={44} domain={[0, 100]} />
                        <Tooltip {...tooltipProps(colors)} />
                        <Line
                          type="monotone"
                          dataKey="avgScore"
                          name="Average score"
                          stroke={colors.accent}
                          strokeWidth={2}
                          dot={{ r: 3, fill: colors.accent, strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Panel>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Course progress" description="Lessons completed against total.">
                  {byCourse.length === 0 ? (
                    <EmptyState
                      title="Not enrolled in a course yet"
                      description="Enrol from the catalogue to start tracking progress."
                      action={
                        <Button as={Link} to="/courses">
                          Browse courses
                        </Button>
                      }
                    />
                  ) : (
                    <ul className="divide-y divide-line">
                      {byCourse.map((course) => (
                        <li key={course.courseId} className="py-3">
                          <div className="flex items-baseline justify-between gap-3">
                            <Link className="link truncate font-medium" to={`/courses/${course.courseId}`}>
                              {course.title}
                            </Link>
                            <span className="tabular shrink-0 text-sm text-ink-muted">
                              {formatPercent(course.progress ?? 0)}
                            </span>
                          </div>
                          <ProgressBar
                            value={course.progress ?? 0}
                            max={100}
                            tone="accent"
                            label={`${course.title} progress`}
                          />
                          <p className="mt-1 text-xs text-ink-muted">
                            Average score {formatPercent(course.avgScore ?? 0)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel title="Recent results">
                  {recent.length === 0 ? (
                    <EmptyState title="No results yet" />
                  ) : (
                    <Table
                      dense
                      head={[
                        { key: 'test', label: 'Test' },
                        { key: 'score', label: 'Score', align: 'right' },
                        { key: 'outcome', label: 'Outcome' },
                        { key: 'when', label: 'Submitted' },
                      ]}
                    >
                      {recent.map((result) => (
                        <tr key={result.attemptId}>
                          <td>
                            <Link className="link" to={`/student/results/${result.attemptId}`}>
                              {result.testTitle}
                            </Link>
                          </td>
                          <td className="tabular text-right">{formatPercent(result.percentage ?? 0)}</td>
                          <td>
                            <Badge tone={result.passed ? 'positive' : 'critical'}>
                              {result.passed ? 'Passed' : 'Failed'}
                            </Badge>
                          </td>
                          <td className="text-ink-muted">{formatDate(result.submittedAt)}</td>
                        </tr>
                      ))}
                    </Table>
                  )}
                </Panel>
              </div>
            </>
          );
        }}
      </Async>
    </div>
  );
}
