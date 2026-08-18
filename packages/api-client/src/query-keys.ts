import type { ListDocumentsParams } from './generated/model';

/**
 * Typed query-key factory.
 *
 * Hand-written on top of the generated hooks so invalidation is expressed in
 * one place and stays type-safe. Keys are hierarchical: invalidating
 * `documentKeys.lists()` drops every page/sort/filter combination at once.
 */
export const documentKeys = {
  all: () => ['documents'] as const,

  lists: () => [...documentKeys.all(), 'list'] as const,
  list: (params: ListDocumentsParams | undefined) =>
    [...documentKeys.lists(), params ?? {}] as const,

  details: () => [...documentKeys.all(), 'detail'] as const,
  detail: (documentId: string) => [...documentKeys.details(), documentId] as const,

  metadata: (documentId: string) => [...documentKeys.detail(documentId), 'metadata'] as const,
} as const;

export type DocumentQueryKey =
  | ReturnType<typeof documentKeys.all>
  | ReturnType<typeof documentKeys.lists>
  | ReturnType<typeof documentKeys.list>
  | ReturnType<typeof documentKeys.details>
  | ReturnType<typeof documentKeys.detail>
  | ReturnType<typeof documentKeys.metadata>;
