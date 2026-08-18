import { HttpResponse, http, type RequestHandler } from 'msw';
import openapi from '../../openapi.json';
import type {
  DocumentMetadataUpload,
  DocumentStatus,
  ListDocumentsSortBy,
  ListDocumentsSortDir,
  UpdateDocumentStatusRequest,
} from '../generated/model';
import { DocumentIntakeDb } from './db';

/**
 * Mock handlers derived from `openapi.json`.
 *
 * The route table is built from the spec itself, not typed out by hand, and
 * {@link assertContractCoverage} fails the suite if the spec grows an operation
 * with no handler behind it. Hook tests therefore always run against the same
 * contract the client was generated from.
 */

type OpenApiDoc = {
  paths: Record<string, Record<string, { operationId?: string }>>;
};

const spec = openapi as OpenApiDoc;

const HTTP_METHODS = ['get', 'put', 'post', 'patch', 'delete', 'head', 'options'] as const;

/** `/documents/{documentId}/status` -> `/documents/:documentId/status` */
export function toMswPath(openApiPath: string): string {
  return openApiPath.replace(/\{([^}]+)\}/g, ':$1');
}

/** Every `operationId` the spec declares, keyed as `METHOD path`. */
export function specOperations(): Map<string, string> {
  const operations = new Map<string, string>();
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = item[method];
      if (!operation?.operationId) continue;
      operations.set(`${method.toUpperCase()} ${path}`, operation.operationId);
    }
  }
  return operations;
}

function routeOf(openApiPath: string): string {
  return toMswPath(openApiPath);
}

export interface HandlerOptions {
  /**
   * API root the generated client will be pointed at. Must match the
   * `ApiClientConfig.baseUrl` under test so MSW intercepts the right origin.
   */
  baseUrl?: string;
  db?: DocumentIntakeDb;
}

export interface DocumentIntakeMocks {
  db: DocumentIntakeDb;
  handlers: RequestHandler[];
}

function url(baseUrl: string, openApiPath: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${routeOf(openApiPath)}`;
}

function problem(status: number, title: string, detail?: string) {
  return HttpResponse.json(detail ? { title, status, detail } : { title, status }, { status });
}

export function createDocumentIntakeMocks(options: HandlerOptions = {}): DocumentIntakeMocks {
  const baseUrl = options.baseUrl ?? 'http://localhost/api/v1';
  const db = options.db ?? new DocumentIntakeDb();

  const handlers: RequestHandler[] = [
    http.get(url(baseUrl, '/documents'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      const statuses = params.getAll('status') as DocumentStatus[];
      const page = db.list({
        page: params.has('page') ? Number(params.get('page')) : undefined,
        pageSize: params.has('pageSize') ? Number(params.get('pageSize')) : undefined,
        sortBy: (params.get('sortBy') ?? undefined) as ListDocumentsSortBy | undefined,
        sortDir: (params.get('sortDir') ?? undefined) as ListDocumentsSortDir | undefined,
        status: statuses.length > 0 ? statuses : undefined,
        search: params.get('search') ?? undefined,
      });
      return HttpResponse.json(page);
    }),

    http.get(url(baseUrl, '/documents/{documentId}'), ({ params }) => {
      const document = db.get(String(params.documentId));
      if (!document) return problem(404, 'Not found', 'No such document.');
      return HttpResponse.json(document);
    }),

    http.patch(url(baseUrl, '/documents/{documentId}/status'), async ({ params, request }) => {
      const body = (await request.json()) as UpdateDocumentStatusRequest;
      const updated = db.updateStatus(String(params.documentId), body.status);
      if (!updated) return problem(404, 'Not found', 'No such document.');
      return HttpResponse.json(updated);
    }),

    http.post(url(baseUrl, '/documents/{documentId}/metadata'), async ({ params, request }) => {
      const body = (await request.json()) as DocumentMetadataUpload;
      if (!body || typeof body.fields !== 'object') {
        return problem(400, 'Invalid payload', '`fields` is required.');
      }
      const stored = db.putMetadata(String(params.documentId), body);
      if (!stored) return problem(404, 'Not found', 'No such document.');
      return HttpResponse.json(stored, { status: 201 });
    }),
  ];

  return { db, handlers };
}

/** Route keys this module implements, in the spec's own `METHOD path` form. */
export const implementedOperations: ReadonlySet<string> = new Set([
  'GET /documents',
  'GET /documents/{documentId}',
  'PATCH /documents/{documentId}/status',
  'POST /documents/{documentId}/metadata',
]);

/**
 * Throws when `openapi.json` and the handler table have drifted apart.
 * Called by the test suite so adding an operation to the spec without mocking
 * it is a hard failure rather than a silent gap.
 */
export function assertContractCoverage(): void {
  const declared = specOperations();
  const missing = [...declared.keys()].filter((key) => !implementedOperations.has(key));
  const extra = [...implementedOperations].filter((key) => !declared.has(key));
  const problems: string[] = [];
  if (missing.length > 0) problems.push(`no mock handler for: ${missing.join(', ')}`);
  if (extra.length > 0)
    problems.push(`handler for operation absent from spec: ${extra.join(', ')}`);
  if (problems.length > 0) {
    throw new Error(`MSW handlers drifted from openapi.json - ${problems.join('; ')}`);
  }
}
