import { QueryClient } from '@tanstack/react-query';

/**
 * Create a QueryClient scoped to a single control instance.
 *
 * Never module-level. The host can mount several controls on one form and can
 * destroy and recreate any of them; each owns its cache and disposes it in
 * `destroy()`.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Model-driven forms re-focus constantly as the user moves between
        // sections; refetching on every focus would hammer the API.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

/** Tear a client down completely. Call from the control's `destroy()`. */
export function disposeQueryClient(client: QueryClient): void {
  client.cancelQueries();
  client.unmount();
  client.clear();
}
