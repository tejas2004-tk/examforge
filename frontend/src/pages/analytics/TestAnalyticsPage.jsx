import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Download, Plug } from 'lucide-react';
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  PageHeader,
  Panel,
  Select,
  StatTile,
  Table,
  Tooltip as UiTooltip,
} from '../../components/ui.jsx';
import { formatDuration, formatNumber, formatPercent } from '../../lib/format.js';
import { Async, ChartSkeleton, StatSkeleton } from '../_shared/Async.jsx';
import { getDataOptional, retryUnlessDenied } from '../_shared/request.js';
import { axisProps, tooltipProps, useChartColors } from '../_shared/chart.js';
import { downloadCsv } from '../_shared/csv.js';
import { questionTypeLabel } from '../_shared/domain.js';

/**
 * Classical item analysis thresholds: an item almost everyone or almost nobody gets
 * right carries little information, and discrimination under 0.2 fails to separate
 * strong candidates from weak ones.
 */
const weakness = (item) => {
  const reasons = [];
  if (item.correctRate <= 0.2) reasons.push('Almost nobody answers it correctly');
  if (item.correctRate >= 0.95) reasons.push('Almost everybody answers it correctly');
  if (item.discrimination !== null && item.discrimination !== undefined && item.discrimination < 0.2) {
    reasons.push('Does not separate strong from weak candidates');
  }
  return reasons;
};

const SORTS = {
  order: null,
  correctRate: (a, b) => (a.correctRate ?? 0) - (b.correctRate ?? 0),
  discrimination: (a, b) => (a.discrimination ?? 0) - (b.discrimination ?? 0),
  avgTimeSec: (a, b) => (b.avgTimeSec ?? 0) - (a.avgTimeSec ?? 0),
};

const SORT_OPTIONS = [
  { value: 'order', label: 'Test order' },
  { value: 'correctRate', label: 'Hardest first' },
  { value: 'discrimination', label: 'Weakest discrimination first' },
  { value: 'avgTimeSec', label: 'Slowest first' },
];

export function TestAnalyticsPage() {
  const { testId } = useParams();
  const colors = useChartColors();
  const [sort, setSort] = useState('order');
  const [weakOnly, setWeakOnly] = useState(false);

  const query = useQuery({
    queryKey: ['analytics', 'test', testId],
    queryFn: () => getDataOptional(`/analytics/tests/${testId}`),
    retry: retryUnlessDenied,
    staleTime: 60_000,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Insight"
        breadcrumbs={[{ label: 'Analytics', to: '/analytics' }, { label: query.data?.test?.title ?? 'Test' }]}
        title={query.data?.test?.title ?? 'Test analytics'}
        description="Score distribution and item statistics for every question on this test."
        actions={
          <Button
            variant="secondary"
            icon={Download}
            disabled={!query.data?.questionStats?.length}
            onClick={() =>
              downloadCsv(
                `test-${testId}-items.csv`,
                [
                  { label: 'Question', value: (r) => r.text },
                  { label: 'Type', value: (r) => r.type },
                  { label: 'Attempts', value: (r) => r.attempts },
                  { label: 'Correct rate', value: (r) => r.correctRate },
                  { label: 'Difficulty index', value: (r) => r.difficultyIndex },
                  { label: 'Discrimination', value: (r) => r.discrimination },
                  { label: 'Average time (s)', value: (r) => r.avgTimeSec },
                ],
                query.data.questionStats,
              )
            }
          >
            Export items
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
                title="Item analysis is not available on this server"
                description="The /api/analytics/tests endpoint did not respond. Once it is deployed this page fills in automatically."
              />
            );
          }
          return <TestAnalyticsBody data={data} colors={colors} sort={sort} setSort={setSort} weakOnly={weakOnly} setWeakOnly={setWeakOnly} />;
        }}
      </Async>
    </div>
  );
}

function TestAnalyticsBody({ data, colors, sort, setSort, weakOnly, setWeakOnly }) {
  const summary = data.summary ?? {};
  const distribution = data.scoreDistribution ?? [];
  const items = data.questionStats ?? [];

  const rows = useMemo(() => {
    const comparator = SORTS[sort];
    const sorted = comparator ? items.slice().sort(comparator) : items.slice();
    return weakOnly ? sorted.filter((item) => weakness(item).length > 0) : sorted;
  }, [items, sort, weakOnly]);

  const weakCount = useMemo(() => items.filter((item) => weakness(item).length > 0).length, [items]);
  const passMark = data.test?.passingMarks;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Attempts" value={formatNumber(summary.attempts ?? 0)} hint={`${formatNumber(summary.completed ?? 0)} completed`} />
        <StatTile label="Average score" value={formatNumber(summary.avgScore ?? 0)} hint={`${formatPercent(summary.avgPercentage ?? 0)} of ${data.test?.totalMarks ?? 0} marks`} />
        <StatTile
          label="Pass rate"
          value={formatPercent(summary.passRate ?? 0)}
          hint={passMark !== undefined ? `Pass mark ${passMark}` : undefined}
          tone={(summary.passRate ?? 0) >= 60 ? 'positive' : 'caution'}
        />
        <StatTile label="Average duration" value={formatDuration(summary.avgDurationSec ?? 0)} hint="From start to submit" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Score distribution" description="Candidates per percentage band.">
          {distribution.length === 0 ? (
            <EmptyState title="No scored attempts yet" description="Distribution appears after the first submission is evaluated." />
          ) : (
            <div className="h-64" role="img" aria-label="Candidates per score band">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke={colors.line} vertical={false} />
                  <XAxis dataKey="bucket" {...axisProps(colors)} />
                  <YAxis {...axisProps(colors)} width={44} allowDecimals={false} />
                  <Tooltip {...tooltipProps(colors)} />
                  <Bar dataKey="count" name="Candidates" radius={[3, 3, 0, 0]}>
                    {distribution.map((bucket) => (
                      <Cell
                        key={bucket.bucket}
                        fill={Number.parseInt(bucket.bucket, 10) < 40 ? colors.critical : colors.accent}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Spread">
          <dl className="divide-y divide-line text-sm">
            {[
              ['Highest', formatNumber(summary.highest ?? 0)],
              ['Median', formatNumber(summary.median ?? 0)],
              ['Lowest', formatNumber(summary.lowest ?? 0)],
              ['Total marks', formatNumber(data.test?.totalMarks ?? 0)],
              ['Pass mark', formatNumber(data.test?.passingMarks ?? 0)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-2">
                <dt className="text-ink-muted">{label}</dt>
                <dd className="tabular font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <Panel
        title="Item analysis"
        description={
          weakCount > 0
            ? `${weakCount} of ${items.length} items look weak on difficulty or discrimination.`
            : 'Every item is within the expected difficulty and discrimination range.'
        }
        action={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="weak-only"
                checked={weakOnly}
                onChange={(e) => setWeakOnly(e.target.checked)}
                disabled={weakCount === 0}
              />
              <label htmlFor="weak-only" className="text-sm text-ink-muted">
                Flagged only
              </label>
            </div>
            <Select aria-label="Sort items" value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        {items.length === 0 ? (
          <EmptyState title="No item statistics yet" description="Statistics need at least one evaluated attempt." />
        ) : (
          <Table
            head={[
              { key: 'text', label: 'Question' },
              { key: 'type', label: 'Type' },
              { key: 'attempts', label: 'Attempts', align: 'right' },
              { key: 'correctRate', label: 'Correct', align: 'right' },
              { key: 'difficultyIndex', label: 'Difficulty', align: 'right' },
              { key: 'discrimination', label: 'Discrimination', align: 'right' },
              { key: 'avgTimeSec', label: 'Avg time', align: 'right' },
            ]}
          >
            {rows.map((item) => {
              const reasons = weakness(item);
              return (
                <tr key={item.questionId}>
                  <td className="max-w-md">
                    <div className="flex items-start gap-2">
                      {reasons.length > 0 && (
                        <UiTooltip label={reasons.join('. ')}>
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-caution" aria-label="Flagged item" />
                        </UiTooltip>
                      )}
                      <span className="line-clamp-2 text-ink">{item.text}</span>
                    </div>
                  </td>
                  <td className="text-ink-muted">{questionTypeLabel(item.type)}</td>
                  <td className="tabular text-right">{formatNumber(item.attempts ?? 0)}</td>
                  <td className="text-right">
                    <Badge
                      tone={item.correctRate >= 0.7 ? 'positive' : item.correctRate >= 0.4 ? 'caution' : 'critical'}
                    >
                      {formatPercent((item.correctRate ?? 0) * 100)}
                    </Badge>
                  </td>
                  <td className="tabular text-right">{(item.difficultyIndex ?? 0).toFixed(2)}</td>
                  <td className="tabular text-right">
                    <span className={item.discrimination < 0.2 ? 'text-critical' : 'text-ink'}>
                      {(item.discrimination ?? 0).toFixed(2)}
                    </span>
                  </td>
                  <td className="tabular text-right">{formatDuration(item.avgTimeSec ?? 0)}</td>
                </tr>
              );
            })}
          </Table>
        )}
      </Panel>
    </>
  );
}
