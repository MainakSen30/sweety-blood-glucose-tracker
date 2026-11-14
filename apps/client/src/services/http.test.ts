import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, SESSION_EXPIRED_EVENT } from './http.js';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('apiFetch', () => {
  it('defaults to same-origin credentials and a JSON content type', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await apiFetch('/api/auth/me');

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('merges caller headers without dropping the default content type', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'X-Custom': 'value' },
      body: JSON.stringify({ name: 'Demo User' }),
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/register', {
      credentials: 'include',
      method: 'POST',
      body: JSON.stringify({ name: 'Demo User' }),
      headers: { 'Content-Type': 'application/json', 'X-Custom': 'value' },
    });
  });

  it('lets callers override the content type explicitly', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await apiFetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'raw',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/upload', {
      credentials: 'include',
      method: 'POST',
      body: 'raw',
      headers: { 'Content-Type': 'text/plain' },
    });
  });

  it('lets callers override credentials', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await apiFetch('/api/auth/me', { credentials: 'same-origin' });

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('returns the parsed JSON body on success', async () => {
    const user = { id: '1', name: 'Demo User' };
    fetchMock.mockResolvedValueOnce(jsonResponse(user));

    await expect(apiFetch<typeof user>('/api/auth/me')).resolves.toEqual(user);
  });

  it('throws ApiError with server-provided message and details on error responses', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          status: 'error',
          message: 'Validation failed',
          details: [{ path: 'email', message: 'Email must be a valid email address' }],
        },
        { status: 400 },
      ),
    );

    const error = await apiFetch('/api/auth/register').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Validation failed',
      details: [{ path: 'email', message: 'Email must be a valid email address' }],
    });
  });

  it('falls back to a generic message for non-JSON error responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }));

    const error = await apiFetch('/api/health').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 503,
      message: 'Request failed with status 503',
    });
  });

  it('signals an expired session on a 401 response', async () => {
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'Authentication required.' }, { status: 401 }),
    );

    await expect(apiFetch('/api/doctor/patients')).rejects.toBeInstanceOf(ApiError);

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });
});
