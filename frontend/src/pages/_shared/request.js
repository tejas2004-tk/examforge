import { api } from '../../api/client.js';

/**
 * The client normalises failures into an ApiError carrying `status`/`details`, but a
 * raw axios rejection can still surface from a cancelled or pre-interceptor call, so
 * read both shapes rather than assuming one.
 */
export const status = (error) => error?.status ?? error?.response?.status ?? null;

export const details = (error) => error?.details ?? error?.response?.data?.details ?? null;

/** Every endpoint answers `{ success, data }`; callers only ever want `data`. */
export const getData = async (url, config) => {
  const response = await api.get(url, config);
  return response.data?.data ?? response.data;
};

/**
 * For endpoints that may not be deployed yet: a 404 becomes `null` so the page can
 * render an informative empty state instead of an error the user cannot act on.
 */
export const getDataOptional = async (url, config) => {
  try {
    return await getData(url, config);
  } catch (error) {
    if (status(error) === 404) return null;
    throw error;
  }
};

export const isForbidden = (error) => status(error) === 403;
export const isMissing = (error) => status(error) === 404;

/** react-query should not retry a request the server has already refused on policy. */
export const retryUnlessDenied = (failureCount, error) => {
  const code = status(error);
  if (code === 401 || code === 403 || code === 404 || code === 409) return false;
  return failureCount < 2;
};

/** Numeric page metadata, tolerating both `{ meta: {...} }` and flat `{ total, page }` payloads. */
export const pageMeta = (data, fallbackSize = 20) => {
  const meta = data?.meta ?? data ?? {};
  const total = Number(meta.total ?? 0);
  const limit = Number(meta.limit ?? fallbackSize);
  return {
    page: Number(meta.page ?? 1),
    pageSize: limit,
    total,
    pageCount: Number(meta.pages ?? Math.max(1, Math.ceil(total / Math.max(1, limit)))),
  };
};
