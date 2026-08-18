import {
  type ApiClientConfig,
  ApiProvider,
  createQueryClient,
  type DocumentStatus,
} from '@document-intake/api-client';
import {
  DocumentIntakeGrid,
  type DocumentIntakeQuery,
  defaultDocumentIntakeQuery,
  EmptyState,
  StatusBadge,
  statusLabel,
  UiRoot,
} from '@document-intake/ui';
import type { QueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { resolveBaseUrl } from './config';

const ALL_STATUSES: DocumentStatus[] = [
  'pending',
  'processing',
  'needsReview',
  'approved',
  'rejected',
];

/** What the shell reports upward about what the user is currently looking at. */
export interface IntakeShellState {
  selectedDocumentId: string | null;
  visibleDocumentCount: number;
  lastError: string | null;
}

/**
 * Every field is optional, so `<App />` still works - but the parameter itself
 * is not defaulted to `{}`. A defaulted parameter makes the component's type
 * `(props?: AppProps)`, which `createElement` infers as `P = {}`, and the
 * control's call site then fails to type-check its own props.
 */
export interface AppProps {
  /**
   * The full api config. Supplied by a host that owns the config's lifetime -
   * the PCF control builds one in `init()` and disposes it in `destroy()`.
   * Takes precedence over `baseUrl`.
   */
  config?: ApiClientConfig;
  /** Shorthand for `{ baseUrl }`. Overridable so tests can pin the origin. */
  baseUrl?: string;
  /**
   * A host-owned QueryClient. When omitted the shell creates its own and keeps
   * it for the life of the component; a host that must dispose the cache on
   * teardown passes one in instead.
   */
  client?: QueryClient;
  initialPageSize?: number;
  title?: string;
  /** Optional strapline under the title. Omitted entirely when not given. */
  description?: ReactNode;
  /** Reported on every query change, so a host can raise its own change event. */
  onStateChange?: (state: IntakeShellState) => void;
  /** Set when the host's own configuration failed validation; renders instead of the grid. */
  configurationError?: string | null;
}

/**
 * The document intake shell: header, filters and the queue grid.
 *
 * Every host-owned concern is injected rather than assumed - the api config,
 * the QueryClient, the page size and the copy in the header. That is what lets
 * one component serve both hosts: the Vite harness mounts it against MSW, and
 * the PCF control mounts the very same tree against `ComponentFramework.WebApi`.
 *
 * Nothing in this module may reach for the environment, MSW or a Node built-in:
 * it is bundled into the shipped control. `src/purity.test.ts` enforces that.
 */
export function App({
  config,
  baseUrl,
  client,
  initialPageSize = 10,
  title = 'Document intake',
  description,
  onStateChange,
  configurationError = null,
}: AppProps): JSX.Element {
  // Created once and only when the host did not bring its own.
  const [ownQueryClient] = useState(() => client ?? createQueryClient());
  const queryClient = client ?? ownQueryClient;

  const resolvedConfig = useMemo<ApiClientConfig>(
    () => config ?? { baseUrl: baseUrl ?? resolveBaseUrl() },
    [config, baseUrl],
  );

  const [query, setQuery] = useState<DocumentIntakeQuery>({
    ...defaultDocumentIntakeQuery,
    pageSize: initialPageSize,
  });

  const handleQueryChange = useCallback(
    (next: DocumentIntakeQuery) => {
      setQuery(next);
      onStateChange?.({
        selectedDocumentId: null,
        visibleDocumentCount: next.pageSize,
        lastError: null,
      });
    },
    [onStateChange],
  );

  const toggleStatus = (status: DocumentStatus) => {
    const current = query.status ?? [];
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    handleQueryChange({ ...query, status: next.length > 0 ? next : undefined, page: 1 });
  };

  if (configurationError) {
    return (
      <UiRoot className="di-block">
        <EmptyState
          tone="error"
          title="This control is not configured correctly"
          description={configurationError}
        />
      </UiRoot>
    );
  }

  return (
    <UiRoot className="di-block">
      <div className="di-flex di-flex-col di-gap-4 di-p-6">
        <header className="di-flex di-flex-col di-gap-1">
          <h1 className="di-m-0 di-text-xl di-font-semibold di-text-slate-900">{title}</h1>
          {description ? (
            <p className="di-m-0 di-text-xs di-text-slate-500">{description}</p>
          ) : null}
        </header>

        <section
          aria-label="Filters"
          className="di-flex di-flex-wrap di-items-center di-gap-3 di-rounded-md di-border di-border-solid di-border-slate-200 di-bg-slate-50 di-p-3"
        >
          <label className="di-flex di-items-center di-gap-2 di-text-xs di-text-slate-700">
            <span>Search</span>
            <input
              type="search"
              value={query.search ?? ''}
              placeholder="file name or submitter"
              onChange={(event) =>
                handleQueryChange({ ...query, search: event.target.value || undefined, page: 1 })
              }
              className="di-w-56 di-rounded di-border di-border-solid di-border-slate-300 di-bg-white di-px-2 di-py-1"
            />
          </label>

          <div className="di-flex di-flex-wrap di-items-center di-gap-2">
            <span className="di-text-xs di-text-slate-700">Status</span>
            {ALL_STATUSES.map((status) => {
              const active = (query.status ?? []).includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleStatus(status)}
                  aria-label={`Filter by ${statusLabel(status)}`}
                  className={
                    active
                      ? 'di-cursor-pointer di-rounded-full di-border di-border-solid di-border-slate-900 di-p-0'
                      : 'di-cursor-pointer di-rounded-full di-border di-border-solid di-border-transparent di-p-0 di-opacity-60'
                  }
                >
                  <StatusBadge status={status} />
                </button>
              );
            })}
          </div>
        </section>

        <ApiProvider config={resolvedConfig} client={queryClient}>
          <DocumentIntakeGrid query={query} onQueryChange={handleQueryChange} />
        </ApiProvider>
      </div>
    </UiRoot>
  );
}
