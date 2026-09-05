import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
import { Download, Plug } from 'lucide-react';
import {
  Button,
  EmptyState,
  PageHeader,
  Panel,
  Select,
  StatTile,
  Table,
  Tabs,
  Badge,
} from '../../components/ui.jsx';
import { formatNumber, formatPercent, formatRelative } from '../../lib/format.js';
import { Async, StatSkeleton, ChartSkeleton } from '../_shared/Async.jsx';
import { getDataOptional, retryUnlessDenied } from '../_shared/request.js';
import { axisProps, tooltipProps, useChartColors } from '../_shared/chart.js';
import { downloadCsv } from '../_shared/csv.js';
import { useUrlState } from '../_shared/hooks.js';

const RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '365d', label: 'Last 12 months' },
];

const DEFAULTS = { range: '30d', chart: 'attempts' };

const CHART_TABS = [
  { value: 'attempts', label: 'Attempts' },
  { value: 'avgScore', label: 'Average score' },
  { value: 'passRate', label: 'Pass rate' },
];

const trendOf = (delta) => {
  if (delta === null || delta === undefined || Number.isNaN(Number(delta))) return undefined;
  const value = Number(delta);
  if (Math.abs(value) < 0.05) return { direction: 'flat', value: 'no change' };
  return { direction: value > 0 ? 'up' : 'down', value: `${value > 0 ? '+' : ''}${value.toFixed(1)}%` };
};

export function AnalyticsPage() {
  const [state, setState] = useUrlState(DEFAULTS);
  const colors = useChartColors();

  const query = useQuery({
    queryKey: ['analytics', 'overview', state.range],
    queryFn: () => getDataOptional(`/analytics/overview?range=${state.range}`),
    retry: retryUnlessDenied,
    staleTime: 60_000,
  });

  const exportCsv = (data) => {
    downloadCsv(
      `analytics-${state.range}.csv`,
      [
        { label: 'Date', value: (r) => r.date },
        { label: 'Attempts', value: (r) => r.attempts },
        { label: 'Average score', value: (r) => r.avgScore },
        { label: 'Pass rate', value: (r) => r.passRate },
      ],
      data.series ?? [],
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Insight"
        title="Analytics"
        description="Attempt volume, scoring and pass rates across the tests you can see."
        actions={
          <div className="flex items-center gap-2">
            <Select
              aria-label="Date range"
              value={state.range}
              onChange={(e) => setState({ range: e.target.value })}
            >
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              icon={Download}
              disabled={!query.data?.series?.length}
              onClick={() => query.data && exportCsv(query.data)}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      <Async
        query={query}
        skeleton={
          <div className="space-y-4">
            <StatSkeleton count={5} />
            <ChartSkeleton />
          </div>
        }
      >
        {(data) => {
          if (!data) {
            return (
              <EmptyState
                icon={Plug}
                title="Analytics are not available on this server"
                description="The /api/analytics/overview endpoint did not respond. Once it is deployed this page fills in automatically."
              />
            );
          }

          const kpis = data.kpis ?? {};
          const series = data.series ?? [];
          const distribution = data.scoreDistribution ?? [];
          const topTests = data.topTests ?? [];
          const activity = data.recentActivity ?? [];

          return (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <StatTile
                  label="Attempts"
                  value={formatNumber(kpis.attempts ?? 0)}
                  hint="Submitted in range"
                  trend={trendOf(kpis.deltaAttempts)}
                />
                <StatTile
                  label="Average score"
                  value={formatPercent(kpis.avgScore ?? 0)}
                  hint="Across submitted attempts"
                  trend={trendOf(kpis.deltaAvgScore)}
                />
                <StatTile
                  label="Pass rate"
                  value={formatPercent(kpis.passRate ?? 0)}
                  hint="Attempts at or above pass mark"
                  trend={trendOf(kpis.deltaPassRate)}
                  tone={(kpis.passRate ?? 0) >= 60 ? 'positive' : 'caution'}
                />
                <StatTile label="Active students" value={formatNumber(kpis.activeStudents ?? 0)} hint="Attempted at least one test" />
                <StatTile label="Published tests" value={formatNumber(kpis.publishedTests ?? 0)} hint="Open to candidates" />
              </div>

              <Panel
                title="Activity over time"
                description="Daily totals for the selected range."
                action={
                  <Tabs tabs={CHART_TABS} value={state.chart} onChange={(value) => setState({ chart: value })} />
                }
              >
                {series.length === 0 ? (
                  <EmptyState title="No attempts in this range" description="Widen the range or publish a test to collect data." />
                ) : (
                  <div className="h-72" role="img" aria-label={`${CHART_TABS.find((t) => t.value === state.chart)?.label} over time`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                        <defs>
                          <linearGradient id="analytics-series" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={colors.accent} stopOpacity={0.28} />
                            <stop offset="100%" stopColor={colors.accent} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke={colors.line} vertical={false} />
                        <XAxis dataKey="date" {...axisProps(colors)} />
                        <YAxis {...axisProps(colors)} width={48} />
                        <Tooltip {...tooltipProps(colors)} />
                        <Area
                          type="monotone"
                          dataKey={state.chart}
                          name={CHART_TABS.find((t) => t.value === state.chart)?.label}
                          stroke={colors.accent}
                          strokeWidth={2}
                          fill="url(#analytics-series)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Panel>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Score distribution" description="Attempts by percentage band.">
                  {distribution.length === 0 ? (
                    <EmptyState title="No scored attempts yet" />
                  ) : (
                    <div className="h-64" role="img" aria-label="Attempts by score band">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={distribution} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                          <CartesianGrid stroke={colors.line} vertical={false} />
                          <XAxis dataKey="bucket" {...axisProps(colors)} />
                          <YAxis {...axisProps(colors)} width={48} allowDecimals={false} />
                          <Tooltip {...tooltipProps(colors)} />
                          <Bar dataKey="count" name="Attempts" fill={colors.accent} radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Panel>

                <Panel title="Recent activity" description="Latest events across your tests.">
                  {activity.length === 0 ? (
                    <EmptyState title="Nothing has happened yet" description="Attempts, publishes and grading appear here." />
                  ) : (
                    <ul className="divide-y divide-line">
                      {activity.slice(0, 10).map((item) => (
                        <li key={item.id} className="flex items-start justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-ink">{item.message}</p>
                            <p className="eyebrow">{item.type}</p>
                          </div>
                          <time className="shrink-0 text-xs text-ink-muted" dateTime={item.at}>
                            {formatRelative(item.at)}
                          </time>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>

              <Panel title="Tests by attempt volume" description="Open a test for its question-level breakdown.">
                {topTests.length === 0 ? (
                  <EmptyState title="No tests have been attempted" />
                ) : (
                  <Table
                    head={[
                      { key: 'title', label: 'Test' },
                      { key: 'attempts', label: 'Attempts', align: 'right' },
                      { key: 'avgScore', label: 'Average', align: 'right' },
                      { key: 'passRate', label: 'Pass rate', align: 'right' },
                      { key: 'actions', label: '', align: 'right' },
                    ]}
                  >
                    {topTests.map((test) => (
                      <tr key={test.id}>
                        <td className="font-medium text-ink">{test.title}</td>
                        <td className="tabular text-right">{formatNumber(test.attempts)}</td>
                        <td className="tabular text-right">{formatPercent(test.avgScore)}</td>
                        <td className="text-right">
                          <Badge tone={test.passRate >= 60 ? 'positive' : test.passRate >= 40 ? 'caution' : 'critical'}>
                            {formatPercent(test.passRate)}
                          </Badge>
                        </td>
                        <td className="text-right">
                          <Link className="link" to={`/analytics/tests/${test.id}`}>
                            Breakdown
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </Table>
                )}
              </Panel>
            </>
          );
        }}
      </Async>
    </div>
  );
}
