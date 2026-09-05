import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';

const REQUEST_TIMEOUT_MS = 30_000;

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: REQUEST_TIMEOUT_MS,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * One in-flight refresh, shared by every 401 that arrives while it runs.
 * A dashboard fires six requests at once; without this, an expired token turns
 * into six refresh calls, five of which race to rotate the refresh cookie and
 * end up invalidating each other.
 */
let refreshPromise = null;

function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post('/api/auth/refresh', {}, { withCredentials: true, timeout: REQUEST_TIMEOUT_MS })
      .then(({ data }) => {
        const { accessToken, user } = data.data;
        useAuthStore.getState().setAuth(accessToken, user);
        return accessToken;
      })
      .catch((error) => {
        useAuthStore.getState().clearAuth();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/** Requests made against these paths must never trigger a refresh loop. */
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

const isAuthPath = (url = '') => AUTH_PATHS.some((path) => url.includes(path));

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (status === 401 && original && !original._retry && !isAuthPath(original.url)) {
      original._retry = true;
      try {
        const accessToken = await refreshSession();
        original.headers = { ...original.headers, Authorization: `Bearer ${accessToken}` };
        return api(original);
      } catch (refreshError) {
        return Promise.reject(normaliseError(refreshError));
      }
    }

    return Promise.reject(normaliseError(error));
  },
);

/**
 * Error shape every caller can rely on. Axios errors carry the useful parts on
 * four different nested paths depending on whether the failure was HTTP,
 * network, timeout or abort, and page code should not have to know which.
 */
export class ApiError extends Error {
  constructor({ message, status, code, kind, details, cause }) {
    super(message);
    this.name = 'ApiError';
    this.status = status ?? null;
    this.code = code ?? null;
    this.kind = kind;
    this.details = details ?? null;
    this.cause = cause;
    // The raw axios fields ride along so callers that already read
    // `err.response.data` keep working against the normalised error.
    this.response = cause?.response;
    this.config = cause?.config;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isCanceled() {
    return this.kind === 'canceled';
  }
}

function classify(error) {
  if (axios.isCancel?.(error) || error?.code === 'ERR_CANCELED') return 'canceled';
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') return 'timeout';
  if (error?.response) return 'http';
  if (error?.request) return 'network';
  return 'unknown';
}

const KIND_FALLBACK = {
  canceled: 'Request cancelled.',
  timeout: 'The request timed out after 30 seconds.',
  network: 'Cannot reach the server. Check your connection.',
  http: 'The server rejected the request.',
  unknown: 'Something went wrong.',
};

const STATUS_FALLBACK = {
  400: 'The request was not valid.',
  401: 'Your session has expired. Sign in again.',
  403: 'You do not have permission to do that.',
  404: 'That record no longer exists.',
  409: 'That change conflicts with the current state.',
  422: 'Some fields need attention.',
  429: 'Too many requests. Wait a moment and try again.',
  500: 'The server hit an unexpected error.',
  503: 'The service is temporarily unavailable.',
};

export function normaliseError(error) {
  if (error instanceof ApiError) return error;

  const kind = classify(error);
  const status = error?.response?.status ?? null;
  const data = error?.response?.data;

  let message = null;
  let details = null;
  if (data && typeof data === 'object') {
    message = data.message ?? (typeof data.error === 'string' ? data.error : data.error?.message);
    details = data.errors ?? data.details ?? null;
    if (!message && Array.isArray(data.errors) && data.errors.length) {
      message = data.errors.map((e) => e.message ?? String(e)).join(' ');
    }
  } else if (typeof data === 'string' && data.trim()) {
    message = data;
  }

  return new ApiError({
    message: message ?? STATUS_FALLBACK[status] ?? KIND_FALLBACK[kind],
    status,
    code: error?.code ?? null,
    kind,
    details,
    cause: error,
  });
}

/**
 * Cancellation helper: `const c = cancelable(); api.get(url, c.config)` and call
 * `c.cancel()` on unmount so a stale response cannot overwrite fresh state.
 */
export function cancelable() {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    config: { signal: controller.signal },
    cancel: (reason) => controller.abort(reason),
  };
}

/** True when an error is only the result of the caller aborting the request. */
export const isCanceled = (error) => normaliseError(error).kind === 'canceled';

/** Unwraps the `{ success, data }` envelope every endpoint returns. */
export async function request(config) {
  const response = await api.request(config);
  return response.data?.data ?? response.data;
}

export const get = (url, config) => request({ ...config, method: 'get', url });
export const post = (url, data, config) => request({ ...config, method: 'post', url, data });
export const patch = (url, data, config) => request({ ...config, method: 'patch', url, data });
export const put = (url, data, config) => request({ ...config, method: 'put', url, data });
export const del = (url, config) => request({ ...config, method: 'delete', url });
