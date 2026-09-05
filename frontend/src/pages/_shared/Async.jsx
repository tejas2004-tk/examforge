import { Lock, Plug } from 'lucide-react';
import { EmptyState, ErrorAlert, Skeleton, SkeletonTable } from '../../components/ui.jsx';
import { isForbidden, isMissing } from './request.js';

/**
 * One place for the loading / error / permission branches every async surface needs,
 * so pages only spell out their own empty state and their success rendering.
 */
export function Async({
  query,
  skeleton,
  children,
  forbiddenTitle = 'You do not have access to this data',
  forbiddenDescription = 'Ask an administrator to grant your account the required role.',
  missingTitle,
  missingDescription = 'This endpoint is not available on the connected server yet.',
}) {
  if (query.isPending || (query.isLoading && !query.data)) return skeleton ?? <SkeletonTable rows={6} cols={4} />;

  if (query.isError) {
    if (isForbidden(query.error)) {
      return <EmptyState icon={Lock} title={forbiddenTitle} description={forbiddenDescription} />;
    }
    if (missingTitle && isMissing(query.error)) {
      return <EmptyState icon={Plug} title={missingTitle} description={missingDescription} />;
    }
    return <ErrorAlert error={query.error} onRetry={() => query.refetch()} />;
  }

  return children(query.data);
}

/** Placeholder for a KPI row while its query resolves. */
export function StatSkeleton({ count = 4 }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  );
}

/** Placeholder sized like a chart panel. */
export function ChartSkeleton({ className = 'h-72' }) {
  return <Skeleton className={className} />;
}
