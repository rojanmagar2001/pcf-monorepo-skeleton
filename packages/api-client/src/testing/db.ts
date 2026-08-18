import type {
  Document,
  DocumentMetadata,
  DocumentMetadataUpload,
  DocumentPage,
  DocumentStatus,
  ListDocumentsSortBy,
  ListDocumentsSortDir,
} from '../generated/model';
import { createDocumentFixtures } from './fixtures';

export interface ListQuery {
  page?: number;
  pageSize?: number;
  sortBy?: ListDocumentsSortBy;
  sortDir?: ListDocumentsSortDir;
  status?: DocumentStatus[];
  search?: string;
}

/**
 * In-memory store backing the mock handlers.
 *
 * One instance per test / per harness boot, so state never leaks between
 * suites. It implements paging, sorting and filtering for real rather than
 * returning a canned page, which is what makes the grid's behaviour testable.
 */
export class DocumentIntakeDb {
  private documents: Document[];
  private metadata = new Map<string, DocumentMetadata>();

  constructor(seed: Document[] = createDocumentFixtures()) {
    this.documents = seed.map((d) => ({ ...d }));
  }

  reset(seed: Document[] = createDocumentFixtures()): void {
    this.documents = seed.map((d) => ({ ...d }));
    this.metadata.clear();
  }

  all(): Document[] {
    return this.documents.map((d) => ({ ...d }));
  }

  get(documentId: string): Document | undefined {
    const found = this.documents.find((d) => d.id === documentId);
    return found ? { ...found } : undefined;
  }

  list(query: ListQuery = {}): DocumentPage {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 25));
    const sortBy = query.sortBy ?? 'submittedAt';
    const sortDir = query.sortDir ?? 'desc';

    let rows = this.documents.slice();

    if (query.status && query.status.length > 0) {
      const wanted = new Set(query.status);
      rows = rows.filter((d) => wanted.has(d.status));
    }
    if (query.search && query.search.trim() !== '') {
      const term = query.search.trim().toLowerCase();
      rows = rows.filter(
        (d) =>
          d.fileName.toLowerCase().includes(term) || d.submittedBy.toLowerCase().includes(term),
      );
    }

    rows.sort((a, b) => {
      const left = a[sortBy];
      const right = b[sortBy];
      const cmp =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right));
      return sortDir === 'asc' ? cmp : -cmp;
    });

    const total = rows.length;
    const start = (page - 1) * pageSize;
    return {
      items: rows.slice(start, start + pageSize).map((d) => ({ ...d })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  updateStatus(documentId: string, status: DocumentStatus): Document | undefined {
    const index = this.documents.findIndex((d) => d.id === documentId);
    if (index === -1) return undefined;
    const current = this.documents[index] as Document;
    const updated: Document = {
      ...current,
      status,
      updatedAt: new Date(Date.parse(current.updatedAt) + 1000).toISOString(),
    };
    this.documents[index] = updated;
    return { ...updated };
  }

  putMetadata(documentId: string, upload: DocumentMetadataUpload): DocumentMetadata | undefined {
    if (!this.get(documentId)) return undefined;
    const record: DocumentMetadata = {
      documentId,
      fields: upload.fields,
      tags: upload.tags ?? [],
      source: upload.source ?? 'manual',
      capturedAt: new Date(Date.parse('2026-05-01T09:00:00.000Z')).toISOString(),
    };
    this.metadata.set(documentId, record);
    return { ...record };
  }

  getMetadata(documentId: string): DocumentMetadata | undefined {
    return this.metadata.get(documentId);
  }
}
