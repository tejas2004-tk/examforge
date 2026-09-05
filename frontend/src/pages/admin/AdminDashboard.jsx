import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BookOpen, ClipboardList, FileQuestion, ShieldCheck, UserPlus, Users } from 'lucide-react';
import {
  Button,
  EmptyState,
  PageHeader,
  Panel,
  StatTile,
  Table,
  Badge,
} from '../../components/ui.jsx';
import { formatNumber, formatPercent, formatRelative } from '../../lib/format.js';
import { Async, StatSkeleton } from '../_shared/Async.jsx';
import { getData, getDataOptional, retryUnlessDenied } from '../_shared/request.js';
import { axisProps, tooltipProps, useChartColors } from '../_shared/chart.js';

const QUICK_ACTIONS = [
  { to: '/admin/users', label: 'Manage users', icon: Users },
  { to: '/admin/courses', label: 'Courses', icon: BookOpen },
  { to: '/admin/tests', label: 'Tests', icon: ClipboardList },
  { to: '/admin/proctoring', label: 'Live proctoring', icon: ShieldCheck },
  { to: '/admin/audit', label: 'Audit log', icon: FileQuestion },
];

export function AdminDashboard() {
  const colors = useChartColors();

  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => getData('/admin/stats'),
    retry: retryUnlessDenied,
    staleTime: 30_000,
  });

  const overview = useQuery({
    queryKey: ['analytics', 'overview', '30d'],
    queryFn: () => getDataOptional('/analytics/overview?range=30d'),
    retry: retryUnlessDenied,
    staleTime: 60_000,
  });

  const roleSplit = stats.data
    ? [
        { name: 'Students', value: stats.data.totalStudents ?? 0 },
        { name: 'Teachers', value: stats.data.totalTeachers ?? 0 },
        { name: 'Proctors', value: stats.data.totalProctors ?? 0 },
        {
          name: 'Admins',
          value: Math.max(
            0,
            (stats.data.totalUsers ?? 0) -
              (stats.data.totalStudents ?? 0) -
              (stats.data.totalTeachers ?? 0) -
              (stats.data.totalProctors ?? 0),
          ),
        },
      ].filter((slice) => slice.value > 0)
    : [];

  const roleColors = [colors.accent, colors.info, colors.caution, colors['ink-muted']];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Institution overview"
        description="Accounts, content and assessment activity across every organisation on this deployment."
        actions={
          <div className="flex gap-2">
            <Button as={Link} to="/analytics" variant="secondary">
              Full analytics
            </Button>
            <Button as={Link} to="/admin/users" icon={UserPlus}>
              Add user
            </Button>
          </div>
        }
      />

      <Async query={stats} skeleton={<StatSkeleton count={4} />}>
        {(data) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                label="Users"
                value={formatNumber(data.totalUsers ?? 0)}
                hint={`${formatNumber(data.totalStudents ?? 0)} students · ${formatNumber(data.totalTeachers ?? 0)} teachers`}
                icon={Users}
              />
              <StatTile
                label="Tests"
                value={formatNumber(data.totalTests ?? 0)}
                hint={`${formatNumber(data.publishedTests ?? 0)} published`}
                icon={ClipboardList}
              />
              <StatTile
                label="Questions"
                value={formatNumber(data.totalQuestions ?? 0)}
                hint={`${formatNumber(data.totalCodingProblems ?? 0)} coding problems`}
                icon={FileQuestion}
              />
              <StatTile
                label="Attempts"
                value={formatNumber(data.totalAttempts ?? 0)}
                hint={`${formatNumber(data.evaluatedAttempts ?? 0)} evaluated`}
                tone="accent"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Panel
                title="Attempts over the last 30 days"
                description="Daily submitted attempts across every test."
                action={
                  <Link className="link text-sm" to="/analytics">
                    Open analytics
                  </Link>
                }
              >
                {overview.isPending ? (
                  <div className="h-64 animate-pulse rounded-md bg-surface-sunken" />
                ) : overview.data?.series?.length ? (
                  <div className="h-64" role="img" aria-label="Attempts per day over the last 30 days">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={overview.data.series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                        <defs>
                          <linearGradient id="admin-attempts" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={colors.accent} stopOpacity={0.28} />
                            <stop offset="100%" stopColor={colors.accent} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke={colors.line} vertical={false} />
                        <XAxis dataKey="date" {...axisProps(colors)} />
                        <YAxis {...axisProps(colors)} width={44} allowDecimals={false} />
                        <Tooltip {...tooltipProps(colors)} />
                        <Area
                          type="monotone"
                          dataKey="attempts"
                          name="Attempts"
                          stroke={colors.accent}
                          strokeWidth={2}
                          fill="url(#admin-attempts)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <TotalsFallback data={data} />
                )}
              </Panel>

              <Panel title="Accounts by role">
                {roleSplit.length === 0 ? (
                  <EmptyState title="No users yet" />
                ) : (
                  <>
                    <div className="h-48" role="img" aria-label="Share of accounts by role">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={roleSplit}
                            dataKey="value"
                            nameKey="name"
                            innerRadius="58%"
                            outerRadius="88%"
                            paddingAngle={2}
                            stroke={colors.surface}
                          >
                            {roleSplit.map((slice, i) => (
                              <Cell key={slice.name} fill={roleColors[i % roleColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip {...tooltipProps(colors)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {roleSplit.map((slice, i) => (
                        <li key={slice.name} className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-ink-muted">
                            <span
                              className="h-2.5 w-2.5 rounded-sm"
                              style={{ background: roleColors[i % roleColors.length] }}
                              aria-hidden="true"
                            />
                            {slice.name}
                          </span>
                          <span className="tabular text-ink">{formatNumber(slice.value)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Scoring" description="How attempts are distributed across score bands.">
                {overview.data?.scoreDistribution?.length ? (
                  <div className="h-56" role="img" aria-label="Attempts per score band">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overview.data.scoreDistribution} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                        <CartesianGrid stroke={colors.line} vertical={false} />
                        <XAxis dataKey="bucket" {...axisProps(colors)} />
                        <YAxis {...axisProps(colors)} width={44} allowDecimals={false} />
                        <Tooltip {...tooltipProps(colors)} />
                        <Bar dataKey="count" name="Attempts" fill={colors.accent} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <dl className="divide-y divide-line text-sm">
                    <Row label="Average score" value={data.avgScore === null ? 'Not scored yet' : formatNumber(data.avgScore)} />
                    <Row label="Average percentage" value={data.avgPercentage === null ? 'Not scored yet' : formatPercent(data.avgPercentage)} />
                    <Row label="Passed attempts" value={formatNumber(data.passedAttempts ?? 0)} />
                  </dl>
                )}
              </Panel>

              <Panel title="Recent activity">
                {overview.data?.recentActivity?.length ? (
                  <ul className="divide-y divide-line">
                    {overview.data.recentActivity.slice(0, 8).map((item) => (
                      <li key={item.id} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-ink">{item.message}</p>
                          <Badge tone="neutral">{item.type}</Badge>
                        </div>
                        <time className="shrink-0 text-xs text-ink-muted" dateTime={item.at}>
                          {formatRelative(item.at)}
                        </time>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    title="No recent activity"
                    description="Attempts, publishes and grading show up here as they happen."
                  />
                )}
              </Panel>
            </div>

            <Panel title="Jump to" bodyClassName="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => (
                <Button key={action.to} as={Link} to={action.to} variant="secondary" icon={action.icon}>
                  {action.label}
                </Button>
              ))}
            </Panel>
          </>
        )}
      </Async>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="tabular font-medium text-ink">{value}</dd>
    </div>
  );
}

/** Without the time series endpoint the counters are still worth showing. */
function TotalsFallback({ data }) {
  return (
    <Table
      dense
      head={[
        { key: 'metric', label: 'Metric' },
        { key: 'value', label: 'Total', align: 'right' },
      ]}
    >
      {[
        ['Organisations', data.totalOrganizations],
        ['Courses', data.totalCourses],
        ['Assignments', data.totalAssignments],
        ['Assignment submissions', data.totalSubmissions],
        ['Passed attempts', data.passedAttempts],
      ].map(([label, value]) => (
        <tr key={label}>
          <td className="text-ink-muted">{label}</td>
          <td className="tabular text-right font-medium text-ink">{formatNumber(value ?? 0)}</td>
        </tr>
      ))}
    </Table>
  );
}
