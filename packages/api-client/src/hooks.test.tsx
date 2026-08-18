import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiProvider, useApiRequestInit } from './api-provider';
import { configureApiClient, resetApiClient } from './fetcher';
import {
  useGetDocument,
  useListDocuments,
  useUpdateDocumentStatus,
} from './generated/endpoints/documents/documents';
import { createQueryClient, disposeQueryClient } from './query-client';
import { db, TEST_BASE_URL } from './testing/server';

const config = { baseUrl: TEST_BASE_URL };

function wrapper({ children }: { children: ReactNode }) {
  return <ApiProvider config={config}>{children}</ApiProvider>;
}

/** Threads the provider's config onto the request, the way shipped components do. */
function useScopedList(params?: Parameters<typeof useListDocuments>[0]) {
  const request = useApiRequestInit();
  return useListDocuments(params, { request });
}

beforeEach(() => db.reset());
afterEach(() => resetApiClient());

describe('generated query hooks over MSW', () => {
  it('lists the first page against the real contract', async () => {
    const { result } = renderHook(() => useScopedList({ page: 1, pageSize: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items).toHaveLength(10);
    expect(result.current.data?.page).toBe(1);
    expect(result.current.data?.total).toBe(37);
    expect(result.current.data?.totalPages).toBe(4);
  });

  it('honours paging', async () => {
    const { result } = renderHook(() => useScopedList({ page: 4, pageSize: 10 }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(7);
  });

  it('honours sorting', async () => {
    const { result } = renderHook(
      () => useScopedList({ sortBy: 'fileName', sortDir: 'asc', pageSize: 5 }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const names = result.current.data?.items.map((d) => d.fileName) ?? [];
    expect(names).toEqual([...names].sort());
  });

  it('honours status filtering', async () => {
    const { result } = renderHook(() => useScopedList({ status: ['approved'], pageSize: 50 }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items.every((d) => d.status === 'approved')).toBe(true);
    expect(result.current.data?.items.length).toBeGreaterThan(0);
  });

  it('honours free-text search', async () => {
    const { result } = renderHook(() => useScopedList({ search: 'receipt', pageSize: 50 }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items.every((d) => d.fileName.includes('receipt'))).toBe(true);
  });

  it('fetches a single document', async () => {
    const target = db.all()[0];
    const { result } = renderHook(
      () => {
        const request = useApiRequestInit();
        return useGetDocument(target?.id as string, { request });
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(target?.id);
  });

  it('surfaces a 404 as an ApiError rather than resolving', async () => {
    const { result } = renderHook(
      () => {
        const request = useApiRequestInit();
        return useGetDocument('00000000-0000-4000-8000-ffffffffffff', {
          request,
          query: { retry: false },
        });
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as { status?: number })?.status).toBe(404);
  });
});

describe('generated mutation hooks', () => {
  it('updates a document status through PATCH', async () => {
    const target = db.all()[0];
    const { result } = renderHook(
      () => {
        const request = useApiRequestInit();
        return useUpdateDocumentStatus({ request });
      },
      { wrapper },
    );

    const updated = await result.current.mutateAsync({
      documentId: target?.id as string,
      data: { status: 'approved', note: 'looks good' },
    });

    expect(updated.status).toBe('approved');
    expect(db.get(target?.id as string)?.status).toBe('approved');
  });
});

describe('per-instance isolation', () => {
  it('gives two providers independent caches', async () => {
    const clientA = createQueryClient();
    const clientB = createQueryClient();

    const wrapperA = ({ children }: { children: ReactNode }) => (
      <ApiProvider config={config} client={clientA}>
        {children}
      </ApiProvider>
    );
    const wrapperB = ({ children }: { children: ReactNode }) => (
      <ApiProvider config={config} client={clientB}>
        {children}
      </ApiProvider>
    );

    const a = renderHook(() => useScopedList({ page: 1, pageSize: 5 }), { wrapper: wrapperA });
    const b = renderHook(() => useScopedList({ page: 2, pageSize: 5 }), { wrapper: wrapperB });

    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true));

    expect(clientA.getQueryCache().getAll()).toHaveLength(1);
    expect(clientB.getQueryCache().getAll()).toHaveLength(1);
    expect(a.result.current.data?.items[0]?.id).not.toBe(b.result.current.data?.items[0]?.id);

    disposeQueryClient(clientA);
    disposeQueryClient(clientB);
    expect(clientA.getQueryCache().getAll()).toHaveLength(0);
  });

  it('falls back to the ambient config when no request init is threaded', async () => {
    const handle = configureApiClient(config);
    const client = createQueryClient();
    const { result } = renderHook(() => useListDocuments({ pageSize: 3 }), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(3);

    handle.dispose();
    disposeQueryClient(client);
  });
});
