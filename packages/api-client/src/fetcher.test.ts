import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiClientNotConfiguredError,
  ApiError,
  configureApiClient,
  customFetch,
  resetApiClient,
  resolveApiClientConfig,
  withApiConfig,
} from './fetcher';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => resetApiClient());

describe('customFetch', () => {
  it('throws a typed error when nothing has been configured', async () => {
    await expect(customFetch('/documents')).rejects.toBeInstanceOf(ApiClientNotConfiguredError);
  });

  it('resolves host-relative baseUrls without going through the URL constructor', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ ok: true }),
    );
    configureApiClient({ baseUrl: '/api/v1', fetchImpl });

    await customFetch('/documents?page=2');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('/api/v1/documents?page=2');
  });

  it('trims duplicate slashes when joining base and path', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({}),
    );
    configureApiClient({ baseUrl: 'https://host.example/api/v1/', fetchImpl });

    await customFetch('/documents');

    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://host.example/api/v1/documents');
  });

  it('merges configured headers, letting per-request headers win', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({}),
    );
    configureApiClient({
      baseUrl: '/api',
      fetchImpl,
      headers: { Authorization: 'Bearer static', 'X-Client': 'pcf' },
    });

    await customFetch('/documents', { headers: { Authorization: 'Bearer override' } });

    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer override');
    expect(headers.get('x-client')).toBe('pcf');
  });

  it('supports an async header resolver for short-lived tokens', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({}),
    );
    configureApiClient({
      baseUrl: '/api',
      fetchImpl,
      headers: async () => ({ Authorization: 'Bearer fresh' }),
    });

    await customFetch('/documents');

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer fresh');
  });

  it('raises ApiError carrying the problem body and notifies onError', async () => {
    const onError = vi.fn();
    configureApiClient({
      baseUrl: '/api',
      onError,
      fetchImpl: async () => jsonResponse({ title: 'Not found', status: 404, detail: 'gone' }, 404),
    });

    const error = await customFetch('/documents/x').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).message).toBe('Not found: gone');
    expect((error as ApiError).body).toMatchObject({ title: 'Not found' });
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('returns null for 204 rather than trying to parse a body', async () => {
    configureApiClient({
      baseUrl: '/api',
      fetchImpl: async () => new Response(null, { status: 204 }),
    });
    await expect(customFetch('/documents/x')).resolves.toBeNull();
  });

  it('prefers a per-request config over the ambient one', async () => {
    const ambient = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ from: 'ambient' }),
    );
    const scoped = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ from: 'scoped' }),
    );
    configureApiClient({ baseUrl: '/ambient', fetchImpl: ambient });

    const result = await customFetch(
      '/documents',
      withApiConfig({ baseUrl: '/scoped', fetchImpl: scoped }),
    );

    expect(result).toEqual({ from: 'scoped' });
    expect(scoped.mock.calls[0]?.[0]).toBe('/scoped/documents');
    expect(ambient).not.toHaveBeenCalled();
  });

  it('does not leak the config symbol into the transport init', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({}),
    );
    await customFetch('/documents', withApiConfig({ baseUrl: '/api', fetchImpl }));

    const init = fetchImpl.mock.calls[0]?.[1] as object;
    expect(Object.getOwnPropertySymbols(init)).toHaveLength(0);
  });
});

describe('ambient configuration lifecycle', () => {
  it('is last-in-wins and survives a sibling being disposed out of order', () => {
    const first = configureApiClient({ baseUrl: '/one' });
    const second = configureApiClient({ baseUrl: '/two' });

    expect(resolveApiClientConfig()?.baseUrl).toBe('/two');

    // The *first* control is destroyed while the second is still alive.
    first.dispose();
    expect(resolveApiClientConfig()?.baseUrl).toBe('/two');

    second.dispose();
    expect(resolveApiClientConfig()).toBeUndefined();
  });

  it('ignores a repeated dispose', () => {
    const handle = configureApiClient({ baseUrl: '/one' });
    configureApiClient({ baseUrl: '/one' });
    handle.dispose();
    handle.dispose();
    expect(resolveApiClientConfig()?.baseUrl).toBe('/one');
  });

  it('warns when a second instance registers a different baseUrl', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    configureApiClient({ baseUrl: '/one' });
    configureApiClient({ baseUrl: '/two' });
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
