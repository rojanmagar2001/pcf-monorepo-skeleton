import { ApiProvider, createQueryClient, type DocumentStatus } from '@document-intake/api-client';
import {
  DocumentIntakeGrid,
  type DocumentIntakeQuery,
  defaultDocumentIntakeQuery,
  StatusBadge,
  statusLabel,
  UiRoot,
} from '@document-intake/ui';
import { useMemo, useState } from 'react';
import { resolveBaseUrl } from './config';

const ALL_STATUSES: DocumentStatus[] = [
  'pending',
  'processing',
  'needsReview',
  'approved',
  'rejected',
];

export interface AppProps {
  /** Overridable so tests can pin the origin the mock API is registered on. */
  baseUrl?: string;
}

/**
 * The dev harness shell.
 *
 * It plays the part the PCF host plays in production: it owns the QueryClient,
 * injects the api config, and mounts the shared UI through `UiRoot`. Nothing
 * here is imported by the control - it exists so UI work needs no Dataverse
 * environment.
 */
export function App({ baseUrl }: AppProps = {}): JSX.Element {
  const [queryClient] = useState(() => createQueryClient());
  const config = useMemo(() => ({ baseUrl: baseUrl ?? resolveBaseUrl() }), [baseUrl]);

  const [query, setQuery] = useState<DocumentIntakeQuery>({
    ...defaultDocumentIntakeQuery,
    pageSize: 10,
  });

  const toggleStatus = (status: DocumentStatus) => {
    const current = query.status ?? [];
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    setQuery({ ...query, status: next.length > 0 ? next : undefined, page: 1 });
  };

  return (
    <UiRoot className="di-block">
      <div className="di-flex di-flex-col di-gap-4 di-p-6">
        <header className="di-flex di-flex-col di-gap-1">
          <h1 className="di-m-0 di-text-xl di-font-semibold di-text-slate-900">Document intake</h1>
          <p className="di-m-0 di-text-xs di-text-slate-500">
            Dev harness — served by MSW handlers derived from <code>openapi.json</code>. No
            Dataverse environment required.
          </p>
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
                setQuery({ ...query, search: event.target.value || undefined, page: 1 })
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

        <ApiProvider config={config} client={queryClient}>
          <DocumentIntakeGrid query={query} onQueryChange={setQuery} />
        </ApiProvider>
      </div>
    </UiRoot>
  );
}
