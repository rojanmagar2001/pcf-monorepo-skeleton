import type { z } from 'zod';
import {
  ListDocumentsQueryParams,
  ListDocumentsResponse,
  UpdateDocumentStatusBody,
} from './generated/endpoints/documents/documents.zod';

/**
 * Refinements layered on top of the generated zod schemas.
 *
 * The generated schemas are never edited; cross-field rules that OpenAPI cannot
 * express live here instead. Nothing in this file re-declares a shape the spec
 * already describes — every type below is inferred.
 */

/** A page response whose envelope actually agrees with its contents. */
export const documentPageSchema = ListDocumentsResponse.superRefine((page, ctx) => {
  if (page.items.length > page.pageSize) {
    ctx.addIssue({
      code: 'custom',
      path: ['items'],
      message: `Page returned ${page.items.length} items for pageSize ${page.pageSize}.`,
    });
  }
  const expectedPages = Math.ceil(page.total / page.pageSize);
  if (page.total > 0 && page.totalPages !== expectedPages) {
    ctx.addIssue({
      code: 'custom',
      path: ['totalPages'],
      message: `totalPages ${page.totalPages} disagrees with total ${page.total} / pageSize ${page.pageSize}.`,
    });
  }
});

/** List query params, rejecting a `search` that is only whitespace. */
export const listDocumentsParamsSchema = ListDocumentsQueryParams.refine(
  (params) => params.search === undefined || params.search.trim().length > 0,
  { path: ['search'], message: 'search must contain a non-whitespace character.' },
);

/** Status transitions must carry a note when a document is rejected. */
export const updateDocumentStatusSchema = UpdateDocumentStatusBody.refine(
  (body) => body.status !== 'rejected' || (body.note?.trim().length ?? 0) > 0,
  { path: ['note'], message: 'A note is required when rejecting a document.' },
);

export type DocumentPageInput = z.infer<typeof documentPageSchema>;
export type ListDocumentsParamsInput = z.infer<typeof listDocumentsParamsSchema>;
export type UpdateDocumentStatusInput = z.infer<typeof updateDocumentStatusSchema>;
