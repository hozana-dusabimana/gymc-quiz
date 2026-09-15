/**
 * Thin API client for the GYMC Quiz backend.
 * - unwraps the `{ success, data }` envelope
 * - attaches the in-memory access token
 * - transparently refreshes the token once on 401 (refresh cookie is httpOnly)
 * - throws `ApiError` with the server's `{ code, message }` on failure
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:4000/api';

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

let accessToken: string | null = null;
const TOKEN_KEY = 'uas_access_token';

export function setAccessToken(token: string | null) {
  accessToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  try {
    accessToken = localStorage.getItem(TOKEN_KEY);
  } catch {
    accessToken = null;
  }
  return accessToken;
}

type Options = {
  method?: string;
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
  _retry?: boolean;
};

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const json = await res.json();
        if (json?.data?.accessToken) {
          setAccessToken(json.data.accessToken);
          return true;
        }
        return false;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method || (body ? 'POST' : 'GET'),
    headers,
    body,
    credentials: 'include',
    signal: opts.signal,
  });

  if (res.status === 401 && !opts._retry && path !== '/auth/refresh') {
    const ok = await tryRefresh();
    if (ok) return api<T>(path, { ...opts, _retry: true });
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }

  if (!res.ok || json?.success === false) {
    const err = json?.error || {};
    throw new ApiError(
      res.status,
      err.code || 'REQUEST_FAILED',
      err.message || `Request failed (${res.status})`,
      err.details,
    );
  }

  return (json?.data ?? json) as T;
}

export const http = {
  get: <T,>(p: string, signal?: AbortSignal) => api<T>(p, { method: 'GET', signal }),
  post: <T,>(p: string, body?: unknown) => api<T>(p, { method: 'POST', body }),
  patch: <T,>(p: string, body?: unknown) => api<T>(p, { method: 'PATCH', body }),
  put: <T,>(p: string, body?: unknown) => api<T>(p, { method: 'PUT', body }),
  del: <T,>(p: string) => api<T>(p, { method: 'DELETE' }),
  upload: <T,>(p: string, form: FormData) => api<T>(p, { method: 'POST', form }),
};

export { BASE_URL };
