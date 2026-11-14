/**
 * Small typed wrapper around fetch for same-origin API requests.
 *
 * Requests always go to relative `/api/...` paths so they resolve against the
 * current origin (the Vite dev proxy in development, the server origin in
 * production). `credentials: 'include'` lets the browser send and store the
 * HTTP-only authentication cookie. JWTs are never stored in web storage.
 */
/** Fired when the server rejects the session cookie; auth state must reset. */
export const SESSION_EXPIRED_EVENT = 'sweety:session-expired';

export class ApiError extends Error {
  readonly status: number;
  readonly details?: Array<{ path: string; message: string }>;

  constructor(status: number, message: string, details?: Array<{ path: string; message: string }>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

interface ApiErrorBody {
  status?: string;
  message?: string;
  details?: Array<{ path: string; message: string }>;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { headers, ...restInit } = init ?? {};

  const response = await fetch(path, {
    // Sensible defaults first so caller-provided options always win.
    credentials: 'include',
    ...restInit,
    // Default JSON Content-Type, overridden only by explicit caller headers.
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (!response.ok) {
    // The cookie expired or was revoked. Let the auth provider react; each
    // caller still receives its ApiError for its own error state.
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }

    let errorBody: ApiErrorBody = {};

    try {
      errorBody = (await response.json()) as ApiErrorBody;
    } catch {
      // Non-JSON error responses (e.g. proxies) still become an ApiError.
    }

    throw new ApiError(
      response.status,
      errorBody.message ?? `Request failed with status ${response.status}`,
      errorBody.details,
    );
  }

  return (await response.json()) as T;
}
