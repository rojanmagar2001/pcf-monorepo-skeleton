import {
  type Document,
  type ListDocumentsParams,
  type ListDocumentsSortBy,
  type ListDocumentsSortDir,
  useApiRequestInit,
  useListDocuments,
} from '@document-intake/api-client';
import {
  createColumnHelper,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import { useCallback, useMemo } from 'react';
import { DataTable } from './DataTable';
import { EmptyState } from './EmptyState';
import { StatusBadge } from './StatusBadge';

/**
 * The intake queue.
 *
 * Two pieces on purpose:
 *   - `DocumentIntakeGridView` is pure presentation and takes rows as props.
 *     Stories and tests drive it directly with no network at all.
 *   - `DocumentIntakeGrid` binds it to the generated `useListDocuments` hook.
 *
 * No DTO is declared here: every row type is `Document`, inferred from the
 * generated schema.
 */

const columnHelper = createColumnHelper<Document>();

const dateFormat = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Column ids that the API can actually sort on, per `openapi.json`. */
const SORTABLE: ReadonlySet<string> = new Set<ListDocumentsSortBy>([
  'fileName',
  'status',
  'submittedAt',
  'updatedAt',
  'sizeBytes',
]);

export const documentColumns = [
  columnHelper.accessor('fileName', {
    id: 'fileName',
    header: 'File name',
    enableHiding: false,
    cell: (info) => <span className="di-font-medium di-text-slate-900">{info.getValue()}</span>,
  }),
  columnHelper.accessor('status', {
    id: 'status',
    header: 'Status',
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  columnHelper.accessor('submittedBy', {
    id: 'submittedBy',
    header: 'Submitted by',
    enableSorting: false,
  }),
  columnHelper.accessor('submittedAt', {
    id: 'submittedAt',
    header: 'Submitted',
    cell: (info) => (
      <time dateTime={info.getValue()} className="di-whitespace-nowrap di-text-slate-600">
        {dateFormat.format(new Date(info.getValue()))}
      </time>
    ),
  }),
  columnHelper.accessor('sizeBytes', {
    id: 'sizeBytes',
    header: 'Size',
    cell: (info) => (
      <span className="di-whitespace-nowrap di-tabular-nums">{formatBytes(info.getValue())}</span>
    ),
  }),
  columnHelper.accessor('pageCount', {
    id: 'pageCount',
    header: 'Pages',
    enableSorting: false,
    cell: (info) => info.getValue() ?? '—',
  }),
  columnHelper.accessor('confidence', {
    id: 'confidence',
    header: 'Confidence',
    enableSorting: false,
    cell: (info) => {
      const value = info.getValue();
      return value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`;
    },
  }),
];

/**
 * The generated hooks type their error as the spec's `Problem` schema, but the
 * fetcher throws an `ApiError` at runtime. Handle both rather than casting one
 * to the other.
 */
function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const problem = error as { title?: unknown; detail?: unknown };
    const parts = [problem.title, problem.detail].filter(
      (part): part is string => typeof part === 'string',
    );
    if (parts.length > 0) return parts.join(': ');
  }
  return 'Request failed';
}

/** The server-side query the grid is currently showing. */
export interface DocumentIntakeQuery {
  page: number;
  pageSize: number;
  sortBy: ListDocumentsSortBy;
  sortDir: ListDocumentsSortDir;
  status?: Document['status'][];
  search?: string;
}

export const defaultDocumentIntakeQuery: DocumentIntakeQuery = {
  page: 1,
  pageSize: 25,
  sortBy: 'submittedAt',
  sortDir: 'desc',
};

export interface DocumentIntakeGridViewProps {
  documents: Document[];
  total: number;
  query: DocumentIntakeQuery;
  onQueryChange: (next: DocumentIntakeQuery) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  className?: string;
}

/** Pure presentation: rows in, interactions out. No fetching. */
export function DocumentIntakeGridView({
  documents,
  total,
  query,
  onQueryChange,
  isLoading = false,
  errorMessage = null,
  onRetry,
  className,
}: DocumentIntakeGridViewProps): JSX.Element {
  const sorting = useMemo<SortingState>(
    () => [{ id: query.sortBy, desc: query.sortDir === 'desc' }],
    [query.sortBy, query.sortDir],
  );

  const pagination = useMemo<PaginationState>(
    () => ({ pageIndex: query.page - 1, pageSize: query.pageSize }),
    [query.page, query.pageSize],
  );

  const handleSortingChange = useCallback<OnChangeFn<SortingState>>(
    (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const first = next[0];
      if (!first || !SORTABLE.has(first.id)) return;
      onQueryChange({
        ...query,
        sortBy: first.id as ListDocumentsSortBy,
        sortDir: first.desc ? 'desc' : 'asc',
        // A new sort order invalidates the current offset.
        page: 1,
      });
    },
    [onQueryChange, query, sorting],
  );

  const handlePaginationChange = useCallback<OnChangeFn<PaginationState>>(
    (updater) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      onQueryChange({
        ...query,
        page: next.pageSize === query.pageSize ? next.pageIndex + 1 : 1,
        pageSize: next.pageSize,
      });
    },
    [onQueryChange, pagination, query],
  );

  if (errorMessage) {
    return (
      <div className={className}>
        <EmptyState
          tone="error"
          title="Could not load the intake queue"
          description={errorMessage}
          action={
            onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="di-cursor-pointer di-rounded di-border di-border-solid di-border-red-300 di-bg-white di-px-3 di-py-1 di-text-xs di-text-red-800 hover:di-bg-red-100"
              >
                Try again
              </button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <DataTable
      className={className}
      caption="Document intake queue"
      data={documents}
      columns={documentColumns}
      rowCount={total}
      manualPagination
      manualSorting
      sorting={sorting}
      onSortingChange={handleSortingChange}
      pagination={pagination}
      onPaginationChange={handlePaginationChange}
      isLoading={isLoading}
      getRowId={(row) => row.id}
      empty={
        <EmptyState
          title="Nothing in the intake queue"
          description="Documents appear here as soon as they are submitted."
        />
      }
    />
  );
}

export interface DocumentIntakeGridProps {
  /** Starting query. The grid owns it from then on. */
  query: DocumentIntakeQuery;
  onQueryChange: (next: DocumentIntakeQuery) => void;
  className?: string;
}

/**
 * `DocumentIntakeGridView` bound to the generated hook.
 *
 * The request init comes from `useApiRequestInit()`, so the call resolves
 * against *this* provider's `baseUrl` rather than any ambient registration -
 * which is what lets two controls on one form talk to different endpoints.
 */
export function DocumentIntakeGrid({
  query,
  onQueryChange,
  className,
}: DocumentIntakeGridProps): JSX.Element {
  const request = useApiRequestInit();

  const params: ListDocumentsParams = {
    page: query.page,
    pageSize: query.pageSize,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
    ...(query.status && query.status.length > 0 ? { status: query.status } : {}),
    ...(query.search ? { search: query.search } : {}),
  };

  const { data, isPending, isError, error, refetch } = useListDocuments(params, {
    request,
    query: { placeholderData: (previous) => previous },
  });

  return (
    <DocumentIntakeGridView
      className={className}
      documents={data?.items ?? []}
      total={data?.total ?? 0}
      query={query}
      onQueryChange={onQueryChange}
      isLoading={isPending}
      errorMessage={isError ? describeError(error) : null}
      onRetry={() => {
        void refetch();
      }}
    />
  );
}
