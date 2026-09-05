export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function parsePagination(query: Record<string, unknown>): Pagination {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const requested = Math.floor(Number(query.limit ?? query.pageSize) || DEFAULT_PAGE_SIZE);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, requested));
  return { page, limit, skip: (page - 1) * limit };
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export const pageMeta = (pagination: Pagination, total: number): PageMeta => ({
  page: pagination.page,
  limit: pagination.limit,
  total,
  pages: Math.max(1, Math.ceil(total / pagination.limit)),
});

export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}

export const paged = <T>(items: T[], pagination: Pagination, total: number): Paged<T> => ({
  items,
  meta: pageMeta(pagination, total),
});

export type SortDirection = 'asc' | 'desc';

/**
 * Sort fields come from an explicit allowlist so a query string cannot order by
 * an unindexed or sensitive column, or inject a nested relation path.
 */
export function parseSort<T extends string>(
  query: Record<string, unknown>,
  allowed: readonly T[],
  fallback: T,
  fallbackDirection: SortDirection = 'desc',
): { field: T; direction: SortDirection } {
  const raw = typeof query.sort === 'string' ? query.sort : undefined;
  const explicitDir = typeof query.order === 'string' ? query.order.toLowerCase() : undefined;

  let field = fallback;
  let direction: SortDirection = fallbackDirection;

  if (raw) {
    // Accepts both "field:asc" and "-field".
    const descPrefixed = raw.startsWith('-');
    const [namePart, dirPart] = (descPrefixed ? raw.slice(1) : raw).split(':');
    if ((allowed as readonly string[]).includes(namePart)) {
      field = namePart as T;
      direction = descPrefixed ? 'desc' : dirPart === 'asc' || dirPart === 'desc' ? dirPart : fallbackDirection;
    }
  }
  if (explicitDir === 'asc' || explicitDir === 'desc') direction = explicitDir;

  return { field, direction };
}

export const orderBy = <T extends string>(sort: { field: T; direction: SortDirection }) =>
  ({ [sort.field]: sort.direction }) as Record<T, SortDirection>;

/** Trims a free-text filter and drops it when empty so `where` stays minimal. */
export const parseSearch = (query: Record<string, unknown>, maxLength = 200): string | undefined => {
  const raw = typeof query.search === 'string' ? query.search : typeof query.q === 'string' ? query.q : undefined;
  const trimmed = raw?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
};

/** Reads an ISO date from the query string, ignoring unparseable values. */
export const parseDate = (value: unknown): Date | undefined => {
  if (typeof value !== 'string' || !value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};
