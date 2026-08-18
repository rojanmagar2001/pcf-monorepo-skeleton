import type {
  Document,
  DocumentMetadata,
  DocumentPage,
  DocumentStatus,
  ListDocumentsSortBy,
  ListDocumentsSortDir,
} from './generated/model';

/**
 * Adapter that satisfies `ApiClientConfig['fetchImpl']` by routing the generated
 * client's requests through `ComponentFramework.WebApi` instead of the network.
 *
 * This is what lets one set of generated hooks serve both worlds: the web
 * harness passes plain `fetch`, the control passes `createWebApiFetch(context)`,
 * and nothing above the transport changes.
 *
 * Only ComponentFramework *types* are referenced here, and they are erased at
 * compile time — the runtime `context` is handed in by the caller.
 */

/** Dataverse logical names backing the document-intake contract. */
export interface WebApiEntityMap {
  documentEntity: string;
  metadataEntity: string;
  columns: {
    id: string;
    fileName: string;
    contentType: string;
    sizeBytes: string;
    status: string;
    submittedBy: string;
    submittedAt: string;
    updatedAt: string;
    pageCount: string;
    confidence: string;
    tags: string;
  };
  /** Dataverse option-set values for `DocumentStatus`. */
  statusValues: Record<DocumentStatus, number>;
}

export const defaultEntityMap: WebApiEntityMap = {
  documentEntity: 'di_document',
  metadataEntity: 'di_documentmetadata',
  columns: {
    id: 'di_documentid',
    fileName: 'di_filename',
    contentType: 'di_contenttype',
    sizeBytes: 'di_sizebytes',
    status: 'di_status',
    submittedBy: 'di_submittedby',
    submittedAt: 'di_submittedon',
    updatedAt: 'modifiedon',
    pageCount: 'di_pagecount',
    confidence: 'di_confidence',
    tags: 'di_tags',
  },
  statusValues: {
    pending: 100000000,
    processing: 100000001,
    needsReview: 100000002,
    approved: 100000003,
    rejected: 100000004,
  },
};

export interface CreateWebApiFetchOptions {
  /** Override any part of the default Dataverse mapping. */
  entityMap?: Partial<WebApiEntityMap> & { columns?: Partial<WebApiEntityMap['columns']> };
}

type Row = Record<string, unknown>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function problem(status: number, title: string, detail?: string): Response {
  return json(detail ? { title, status, detail } : { title, status }, status);
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function nullableNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function iso(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return new Date(0).toISOString();
}

function mergeMap(overrides: CreateWebApiFetchOptions['entityMap']): WebApiEntityMap {
  if (!overrides) return defaultEntityMap;
  return {
    ...defaultEntityMap,
    ...overrides,
    columns: { ...defaultEntityMap.columns, ...(overrides.columns ?? {}) },
    statusValues: { ...defaultEntityMap.statusValues, ...(overrides.statusValues ?? {}) },
  };
}

function toDocument(row: Row, map: WebApiEntityMap): Document {
  const c = map.columns;
  const statusEntry = (Object.entries(map.statusValues) as [DocumentStatus, number][]).find(
    ([, value]) => value === row[c.status],
  );
  const rawTags = row[c.tags];
  return {
    id: str(row[c.id]),
    fileName: str(row[c.fileName]),
    contentType: str(row[c.contentType], 'application/octet-stream'),
    sizeBytes: num(row[c.sizeBytes], 0),
    status: statusEntry ? statusEntry[0] : 'pending',
    submittedBy: str(row[c.submittedBy]),
    submittedAt: iso(row[c.submittedAt]),
    updatedAt: iso(row[c.updatedAt]),
    pageCount: nullableNum(row[c.pageCount]),
    confidence: nullableNum(row[c.confidence]),
    tags: typeof rawTags === 'string' && rawTags.length > 0 ? rawTags.split(';') : [],
  };
}

const SORT_COLUMN: Record<ListDocumentsSortBy, keyof WebApiEntityMap['columns']> = {
  fileName: 'fileName',
  status: 'status',
  submittedAt: 'submittedAt',
  updatedAt: 'updatedAt',
  sizeBytes: 'sizeBytes',
};

function buildOptions(search: URLSearchParams, map: WebApiEntityMap): string {
  const c = map.columns;
  const select = Object.values(c).join(',');

  const filters: string[] = [];
  const statuses = search.getAll('status');
  if (statuses.length > 0) {
    const clauses = statuses
      .map((s) => map.statusValues[s as DocumentStatus])
      .filter((v): v is number => typeof v === 'number')
      .map((v) => `${c.status} eq ${v}`);
    if (clauses.length > 0) filters.push(`(${clauses.join(' or ')})`);
  }
  const term = search.get('search');
  if (term) {
    const escaped = term.replace(/'/g, "''");
    filters.push(
      `(contains(${c.fileName},'${escaped}') or contains(${c.submittedBy},'${escaped}'))`,
    );
  }

  const sortBy = (search.get('sortBy') ?? 'submittedAt') as ListDocumentsSortBy;
  const sortDir = (search.get('sortDir') ?? 'desc') as ListDocumentsSortDir;
  const orderColumn = c[SORT_COLUMN[sortBy] ?? 'submittedAt'];

  const parts = [`?$select=${select}`, `$orderby=${orderColumn} ${sortDir}`];
  if (filters.length > 0) parts.push(`$filter=${filters.join(' and ')}`);
  parts.push('$count=true');
  return parts.join('&');
}

/**
 * Build a `fetchImpl` backed by `context.webAPI`.
 *
 * Paging note: `retrieveMultipleRecords` is cursor-paged, not offset-paged, so
 * this adapter requests `page * pageSize` rows and slices the requested window.
 * That is exact for the first pages the intake grid actually shows and degrades
 * gracefully beyond them.
 */
export function createWebApiFetch(
  context: ComponentFramework.Context<unknown>,
  options: CreateWebApiFetchOptions = {},
): typeof fetch {
  const map = mergeMap(options.entityMap);
  const webApi = context.webAPI;

  return async function webApiFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    // A placeholder origin lets one parser handle absolute and host-relative URLs alike.
    const url = new URL(rawUrl, 'https://pcf.invalid');
    const method = (init?.method ?? 'GET').toUpperCase();
    const segments = url.pathname.split('/').filter(Boolean);
    const anchor = segments.lastIndexOf('documents');

    if (anchor === -1) {
      return problem(
        404,
        'Unsupported route',
        `${method} ${url.pathname} is not mapped to webAPI.`,
      );
    }
    const rest = segments.slice(anchor + 1);

    try {
      if (method === 'GET' && rest.length === 0) {
        const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
        const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') ?? '25') || 25);
        const response = await webApi.retrieveMultipleRecords(
          map.documentEntity,
          buildOptions(url.searchParams, map),
          page * pageSize,
        );
        const rows = response.entities as Row[];
        const total = rows.length;
        const items = rows
          .slice((page - 1) * pageSize, page * pageSize)
          .map((r) => toDocument(r, map));
        const body: DocumentPage = {
          items,
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        };
        return json(body);
      }

      if (method === 'GET' && rest.length === 1) {
        const record = await webApi.retrieveRecord(
          map.documentEntity,
          rest[0] as string,
          `?$select=${Object.values(map.columns).join(',')}`,
        );
        return json(toDocument(record as Row, map));
      }

      if (method === 'PATCH' && rest.length === 2 && rest[1] === 'status') {
        const documentId = rest[0] as string;
        const payload = JSON.parse(str(init?.body, '{}')) as { status: DocumentStatus };
        const optionValue = map.statusValues[payload.status];
        if (typeof optionValue !== 'number') {
          return problem(400, 'Invalid status', `Unknown status "${payload.status}".`);
        }
        await webApi.updateRecord(map.documentEntity, documentId, {
          [map.columns.status]: optionValue,
        });
        const record = await webApi.retrieveRecord(
          map.documentEntity,
          documentId,
          `?$select=${Object.values(map.columns).join(',')}`,
        );
        return json(toDocument(record as Row, map));
      }

      if (method === 'POST' && rest.length === 2 && rest[1] === 'metadata') {
        const documentId = rest[0] as string;
        const payload = JSON.parse(str(init?.body, '{}')) as {
          fields: Record<string, string>;
          tags?: string[];
          source?: DocumentMetadata['source'];
        };
        await webApi.createRecord(map.metadataEntity, {
          [`${map.documentEntity}@odata.bind`]: `/${map.documentEntity}s(${documentId})`,
          di_fields: JSON.stringify(payload.fields),
          di_tags: (payload.tags ?? []).join(';'),
          di_source: payload.source ?? 'manual',
        });
        const body: DocumentMetadata = {
          documentId,
          fields: payload.fields,
          tags: payload.tags ?? [],
          source: payload.source ?? 'manual',
          capturedAt: new Date().toISOString(),
        };
        return json(body, 201);
      }

      return problem(
        404,
        'Unsupported route',
        `${method} ${url.pathname} is not mapped to webAPI.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'webAPI call failed';
      return problem(502, 'Dataverse webAPI error', message);
    }
  };
}
