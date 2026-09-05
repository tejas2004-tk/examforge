export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

export function parsePagination(query: Record<string, unknown>): Pagination {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}
