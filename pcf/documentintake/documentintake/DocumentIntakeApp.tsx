import { type ApiClientConfig, ApiProvider, type Document } from '@document-intake/api-client';
import {
  DocumentIntakeGrid,
  type DocumentIntakeQuery,
  defaultDocumentIntakeQuery,
  EmptyState,
  UiRoot,
} from '@document-intake/ui';
import type { QueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

/**
 * The control's React tree.
 *
 * Everything it needs is passed in: the host owns the QueryClient and the api
 * config lifetimes, because they have to outlive individual renders and be
 * disposed in `destroy()`.
 */
export interface DocumentIntakeAppProps {
  config: ApiClientConfig;
  queryClient: QueryClient;
  initialPageSize: number;
  /** Reported upward so the control can raise `notifyOutputChanged`. */
  onStateChange: (state: DocumentIntakeAppState) => void;
  /** Set when the manifest inputs failed validation; renders instead of the grid. */
  configurationError?: string | null;
}

export interface DocumentIntakeAppState {
  selectedDocumentId: string | null;
  visibleDocumentCount: number;
  lastError: string | null;
}

export function DocumentIntakeApp({
  config,
  queryClient,
  initialPageSize,
  onStateChange,
  configurationError = null,
}: DocumentIntakeAppProps): JSX.Element {
  const [query, setQuery] = useState<DocumentIntakeQuery>({
    ...defaultDocumentIntakeQuery,
    pageSize: initialPageSize,
  });

  const handleQueryChange = useCallback(
    (next: DocumentIntakeQuery) => {
      setQuery(next);
      onStateChange({
        selectedDocumentId: null,
        visibleDocumentCount: next.pageSize,
        lastError: null,
      });
    },
    [onStateChange],
  );

  if (configurationError) {
    return (
      <UiRoot>
        <EmptyState
          tone="error"
          title="This control is not configured correctly"
          description={configurationError}
        />
      </UiRoot>
    );
  }

  return (
    <UiRoot>
      <ApiProvider config={config} client={queryClient}>
        <DocumentIntakeGrid query={query} onQueryChange={handleQueryChange} />
      </ApiProvider>
    </UiRoot>
  );
}

/** Narrow re-export so the control file never reaches past the UI package. */
export type { Document, DocumentIntakeQuery };
