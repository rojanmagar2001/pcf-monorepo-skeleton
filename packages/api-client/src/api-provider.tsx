import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type ApiClientConfig, type ApiRequestInit, withApiConfig } from './fetcher';
import { createQueryClient, disposeQueryClient } from './query-client';

const ApiConfigContext = createContext<ApiClientConfig | undefined>(undefined);

export interface ApiProviderProps {
  /** Runtime configuration for this instance. Injected by the host, never read from the environment. */
  config: ApiClientConfig;
  /**
   * The instance's QueryClient. The PCF control creates one in `init()` and
   * disposes it in `destroy()`. When omitted a client is created for, and torn
   * down with, this provider.
   */
  client?: QueryClient;
  children: ReactNode;
}

/**
 * Wires one control instance's config and QueryClient into the React tree.
 *
 * Everything here is per instance. No module-level QueryClient, no shared
 * config object: two controls on the same form get two independent caches.
 */
export function ApiProvider({ config, client, children }: ApiProviderProps): JSX.Element {
  // Lazy initialiser so a client is built once per mount, not once per render.
  const [ownedClient] = useState<QueryClient | undefined>(() =>
    client ? undefined : createQueryClient(),
  );
  const activeClient = client ?? (ownedClient as QueryClient);

  // Only dispose what this provider created; a host-owned client outlives it.
  const ownedRef = useRef(ownedClient);
  useEffect(() => {
    const owned = ownedRef.current;
    return () => {
      if (owned) disposeQueryClient(owned);
    };
  }, []);

  return (
    <ApiConfigContext.Provider value={config}>
      <QueryClientProvider client={activeClient}>{children}</QueryClientProvider>
    </ApiConfigContext.Provider>
  );
}

/** The config for the nearest `<ApiProvider>`. Throws outside one. */
export function useApiConfig(): ApiClientConfig {
  const config = useContext(ApiConfigContext);
  if (!config) {
    throw new Error('useApiConfig() must be called beneath <ApiProvider>.');
  }
  return config;
}

/**
 * A request init carrying this instance's config.
 *
 * Pass it as the generated hooks' `request` option so the call resolves against
 * the provider's `baseUrl` rather than the ambient registration. `request` is
 * orval's `SecondParameter<typeof customFetch>`, i.e. exactly our
 * `ApiRequestInit`:
 *
 * ```tsx
 * const request = useApiRequestInit();
 * useListDocuments(params, { request });
 * ```
 */
export function useApiRequestInit(init?: RequestInit): ApiRequestInit {
  const config = useApiConfig();
  const serialisedInit = init ? JSON.stringify({ ...init, signal: undefined }) : '';
  // biome-ignore lint/correctness/useExhaustiveDependencies: `init` is compared by value via `serialisedInit`.
  return useMemo(() => withApiConfig(config, init), [config, serialisedInit]);
}
