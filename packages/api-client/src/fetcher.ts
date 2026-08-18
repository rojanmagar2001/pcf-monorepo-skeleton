/**
 * The mutator orval points every generated operation at.
 *
 * Contract (orval `httpClient: 'fetch'`): the generated code calls
 * `customFetch<T>(url, requestInit)` where `url` is the host-relative route the
 * generated `get*Url` helper produced and `requestInit` is the caller's options
 * spread together with the method, headers and body.
 *
 * This module reads no environment: there is no `process.env`, no
 * `import.meta.env`, and no Node built-in anywhere in the import graph. Every
 * piece of configuration arrives at runtime from the host.
 */

/** Runtime configuration for one API client. Supplied by the host, never read from the environment. */
export interface ApiClientConfig {
  /** Absolute or host-relative API root, e.g. `https://contoso.crm.dynamics.com/api/v1` or `/api/v1`. */
  baseUrl: string;
  /** Transport. Defaults to the platform `fetch`. The PCF control injects `createWebApiFetch(context)`. */
  fetchImpl?: typeof fetch;
  /** Static headers, or a resolver invoked per request (for short-lived tokens). */
  headers?: HeadersSource;
  /** Notified for every failed request before the error is rethrown. */
  onError?: (error: ApiError) => void;
}

export type HeadersSource =
  | Record<string, string>
  | (() => Record<string, string> | Promise<Record<string, string>>);

/**
 * Per-request configuration channel.
 *
 * `ApiProvider` threads the instance's config onto each request through this
 * symbol, so a form hosting several controls resolves the right `baseUrl` per
 * React tree instead of sharing one process-wide value. Symbol-keyed properties
 * survive the object spread orval emits, so it reaches the mutator intact.
 */
export const API_CONFIG: unique symbol = Symbol.for('@document-intake/api-client:config');

export type ApiRequestInit = RequestInit & { [API_CONFIG]?: ApiClientConfig };

/** Attach a config to a request init so `customFetch` uses it instead of the ambient one. */
export function withApiConfig(config: ApiClientConfig, init: RequestInit = {}): ApiRequestInit {
  return { ...init, [API_CONFIG]: config };
}

/** Thrown when a request fails, carrying the parsed RFC7807 body when the server sent one. */
export class ApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly body: unknown;

  constructor(message: string, status: number, url: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
    this.body = body;
    // Target is ES2017; restore the prototype chain for `instanceof` after downlevel.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export class ApiClientNotConfiguredError extends Error {
  constructor() {
    super(
      'No ApiClientConfig available. Call configureApiClient() in your control init(), ' +
        'or render the request beneath <ApiProvider config={...}>.',
    );
    this.name = 'ApiClientNotConfiguredError';
    Object.setPrototypeOf(this, ApiClientNotConfiguredError.prototype);
  }
}

/** Handle returned by {@link configureApiClient}. Dispose it when the control is destroyed. */
export interface ApiClientHandle {
  readonly config: ApiClientConfig;
  dispose(): void;
}

/**
 * Ambient config registry.
 *
 * This is a refcounted stack rather than a single slot: several control
 * instances can live on one form, and each registers and disposes
 * independently. Disposing an entry that is not on top leaves the top entry
 * intact, so one control being destroyed never pulls configuration out from
 * under its siblings. It is a *fallback* only — `ApiProvider` passes config
 * per request, which is what the shipped components use.
 */
const configStack: { id: number; config: ApiClientConfig }[] = [];
let nextConfigId = 1;

/**
 * Register a config as the ambient fallback for requests that do not carry
 * their own. Call once per control instance in `init()` and dispose in
 * `destroy()`.
 */
export function configureApiClient(config: ApiClientConfig): ApiClientHandle {
  const entry = { id: nextConfigId++, config };
  const conflicting = configStack.find((e) => e.config.baseUrl !== config.baseUrl);
  if (conflicting) {
    console.warn(
      `[api-client] configureApiClient() called with baseUrl "${config.baseUrl}" while ` +
        `"${conflicting.config.baseUrl}" is already registered. Ambient resolution is ` +
        'last-in-wins; render through <ApiProvider> so each instance resolves its own.',
    );
  }
  configStack.push(entry);
  let disposed = false;
  return {
    config,
    dispose() {
      if (disposed) return;
      disposed = true;
      const index = configStack.findIndex((e) => e.id === entry.id);
      if (index !== -1) configStack.splice(index, 1);
    },
  };
}

/** The ambient config, if any. Most call sites should not need this. */
export function resolveApiClientConfig(): ApiClientConfig | undefined {
  return configStack.length > 0 ? configStack[configStack.length - 1]?.config : undefined;
}

/** Test/teardown helper: drop every ambient registration. */
export function resetApiClient(): void {
  configStack.length = 0;
}

function joinUrl(baseUrl: string, path: string): string {
  // Plain string join, deliberately not `new URL()`: baseUrl is allowed to be
  // host-relative ("/api/v1") and the URL constructor throws on those.
  const base = baseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

async function resolveHeaders(
  source: HeadersSource | undefined,
  requestHeaders: HeadersInit | undefined,
): Promise<Headers> {
  const headers = new Headers();
  const configured = typeof source === 'function' ? await source() : source;
  if (configured) {
    for (const [key, value] of Object.entries(configured)) headers.set(key, value);
  }
  // Per-request headers from the generated code win over configured defaults.
  if (requestHeaders) {
    new Headers(requestHeaders).forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return headers;
}

async function readBody<T>(response: Response): Promise<T> {
  if (response.status === 204 || response.status === 205 || response.status === 304) {
    return null as T;
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json') || contentType.includes('+json')) {
    return (await response.json()) as T;
  }
  if (contentType.startsWith('text/') || contentType === '') {
    const text = await response.text();
    return (text === '' ? null : text) as T;
  }
  return (await response.blob()) as T;
}

async function readErrorBody(response: Response): Promise<unknown> {
  try {
    return await readBody<unknown>(response.clone());
  } catch {
    return undefined;
  }
}

function describe(body: unknown, response: Response): string {
  if (body && typeof body === 'object') {
    const problem = body as { title?: unknown; detail?: unknown };
    const parts = [problem.title, problem.detail].filter((p): p is string => typeof p === 'string');
    if (parts.length > 0) return parts.join(': ');
  }
  return `${response.status} ${response.statusText || 'Request failed'}`;
}

/**
 * The orval mutator. Every generated operation funnels through here.
 */
export const customFetch = async <T>(url: string, options: ApiRequestInit = {}): Promise<T> => {
  const { [API_CONFIG]: scoped, ...init } = options;
  const config = scoped ?? resolveApiClientConfig();
  if (!config) throw new ApiClientNotConfiguredError();

  const requestUrl = joinUrl(config.baseUrl, url);
  const headers = await resolveHeaders(config.headers, init.headers);
  // Native fetch, or whatever transport the host injected. No axios, no polyfill.
  const transport = config.fetchImpl ?? globalThis.fetch;

  const response = await transport(requestUrl, { ...init, headers });

  if (!response.ok) {
    const body = await readErrorBody(response);
    const error = new ApiError(describe(body, response), response.status, requestUrl, body);
    config.onError?.(error);
    throw error;
  }

  return readBody<T>(response);
};

export default customFetch;
