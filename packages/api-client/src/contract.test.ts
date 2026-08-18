import { describe, expect, it } from 'vitest';
import * as zodSchemas from './generated/endpoints/documents/documents.zod';
import {
  documentPageSchema,
  listDocumentsParamsSchema,
  updateDocumentStatusSchema,
} from './refinements';
import { DocumentIntakeDb } from './testing/db';
import { assertContractCoverage, specOperations, toMswPath } from './testing/handlers';

describe('contract coverage', () => {
  it('mocks every operation declared in openapi.json', () => {
    expect(() => assertContractCoverage()).not.toThrow();
  });

  it('reads all four operations out of the spec', () => {
    expect([...specOperations().values()].sort()).toEqual([
      'getDocument',
      'listDocuments',
      'updateDocumentStatus',
      'uploadDocumentMetadata',
    ]);
  });

  it('converts OpenAPI path templates to msw params', () => {
    expect(toMswPath('/documents/{documentId}/status')).toBe('/documents/:documentId/status');
  });
});

describe('generated zod schemas', () => {
  const db = new DocumentIntakeDb();

  it('accepts the mock list response', () => {
    const parsed = zodSchemas.ListDocumentsResponse.safeParse(db.list({ pageSize: 10 }));
    expect(parsed.success).toBe(true);
  });

  it('accepts a single mock document', () => {
    expect(zodSchemas.GetDocumentResponse.safeParse(db.all()[0]).success).toBe(true);
  });

  it('rejects an unknown status', () => {
    const bad = { ...(db.all()[0] as object), status: 'archived' };
    expect(zodSchemas.GetDocumentResponse.safeParse(bad).success).toBe(false);
  });

  it('carries the spec constraints into the schema', () => {
    expect(zodSchemas.listDocumentsQueryPageSizeMax).toBe(200);
    expect(zodSchemas.listDocumentsQuerySortByDefault).toBe('submittedAt');
  });
});

describe('hand-written refinements', () => {
  it('rejects a page whose envelope contradicts its contents', () => {
    const page = { ...db_list(), totalPages: 99 };
    expect(documentPageSchema.safeParse(page).success).toBe(false);
  });

  it('accepts a self-consistent page', () => {
    expect(documentPageSchema.safeParse(db_list()).success).toBe(true);
  });

  it('rejects a whitespace-only search', () => {
    expect(listDocumentsParamsSchema.safeParse({ search: '   ' }).success).toBe(false);
    expect(listDocumentsParamsSchema.safeParse({ search: 'invoice' }).success).toBe(true);
  });

  it('requires a note when rejecting a document', () => {
    expect(updateDocumentStatusSchema.safeParse({ status: 'rejected' }).success).toBe(false);
    expect(
      updateDocumentStatusSchema.safeParse({ status: 'rejected', note: 'illegible scan' }).success,
    ).toBe(true);
    expect(updateDocumentStatusSchema.safeParse({ status: 'approved' }).success).toBe(true);
  });
});

function db_list() {
  return new DocumentIntakeDb().list({ pageSize: 10 });
}
