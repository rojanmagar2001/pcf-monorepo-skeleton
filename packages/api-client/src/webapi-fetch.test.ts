import { describe, expect, it, vi } from 'vitest';
import { createWebApiFetch, defaultEntityMap } from './webapi-fetch';

const c = defaultEntityMap.columns;

function row(overrides: Record<string, unknown> = {}) {
  return {
    [c.id]: '00000000-0000-4000-8000-000000000001',
    [c.fileName]: 'invoice.pdf',
    [c.contentType]: 'application/pdf',
    [c.sizeBytes]: 1024,
    [c.status]: defaultEntityMap.statusValues.approved,
    [c.submittedBy]: 'ada@contoso.com',
    [c.submittedAt]: '2026-05-01T09:00:00.000Z',
    [c.updatedAt]: '2026-05-01T09:15:00.000Z',
    [c.pageCount]: 3,
    [c.confidence]: 0.91,
    [c.tags]: 'priority;scanned',
    ...overrides,
  };
}

function makeContext(webAPI: Partial<ComponentFramework.WebApi>) {
  return { webAPI } as unknown as ComponentFramework.Context<unknown>;
}

describe('createWebApiFetch', () => {
  it('maps a list request onto retrieveMultipleRecords and returns the DTO shape', async () => {
    const retrieveMultipleRecords = vi.fn(
      async (_entity: string, _options?: string, _max?: number) => ({ entities: [row(), row()] }),
    );
    const fetchImpl = createWebApiFetch(makeContext({ retrieveMultipleRecords } as never));

    const response = await fetchImpl(
      '/api/v1/documents?page=1&pageSize=25&sortBy=fileName&sortDir=asc',
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toMatchObject({
      fileName: 'invoice.pdf',
      status: 'approved',
      tags: ['priority', 'scanned'],
      pageCount: 3,
    });
    const query = retrieveMultipleRecords.mock.calls[0]?.[1] as string;
    expect(query).toContain(`$orderby=${c.fileName} asc`);
    expect(query).toContain('$count=true');
  });

  it('translates status filters into option-set values', async () => {
    const retrieveMultipleRecords = vi.fn(
      async (_entity: string, _options?: string, _max?: number) => ({ entities: [] }),
    );
    const fetchImpl = createWebApiFetch(makeContext({ retrieveMultipleRecords } as never));

    await fetchImpl('/api/v1/documents?status=approved&status=rejected');

    const query = retrieveMultipleRecords.mock.calls[0]?.[1] as string;
    expect(query).toContain(`${c.status} eq ${defaultEntityMap.statusValues.approved}`);
    expect(query).toContain(`${c.status} eq ${defaultEntityMap.statusValues.rejected}`);
  });

  it('escapes single quotes in the search term', async () => {
    const retrieveMultipleRecords = vi.fn(
      async (_entity: string, _options?: string, _max?: number) => ({ entities: [] }),
    );
    const fetchImpl = createWebApiFetch(makeContext({ retrieveMultipleRecords } as never));

    await fetchImpl("/api/v1/documents?search=o'brien");

    expect(retrieveMultipleRecords.mock.calls[0]?.[1]).toContain("o''brien");
  });

  it('maps a status PATCH onto updateRecord then re-reads the row', async () => {
    const updateRecord = vi.fn(
      async (_entity: string, _id: string, _data: Record<string, unknown>) => ({
        entityType: 'di_document',
        id: 'x',
      }),
    );
    const retrieveRecord = vi.fn(async (_entity: string, _id: string, _options?: string) =>
      row({ [c.status]: defaultEntityMap.statusValues.rejected }),
    );
    const fetchImpl = createWebApiFetch(makeContext({ updateRecord, retrieveRecord } as never));

    const response = await fetchImpl('/api/v1/documents/abc/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'rejected', note: 'illegible' }),
    });

    expect(updateRecord).toHaveBeenCalledWith('di_document', 'abc', {
      [c.status]: defaultEntityMap.statusValues.rejected,
    });
    expect((await response.json()).status).toBe('rejected');
  });

  it('rejects an unknown status without calling Dataverse', async () => {
    const updateRecord = vi.fn();
    const fetchImpl = createWebApiFetch(makeContext({ updateRecord } as never));

    const response = await fetchImpl('/api/v1/documents/abc/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'archived' }),
    });

    expect(response.status).toBe(400);
    expect(updateRecord).not.toHaveBeenCalled();
  });

  it('maps a metadata POST onto createRecord and answers 201', async () => {
    const createRecord = vi.fn(async (_entity: string, _data: Record<string, unknown>) => ({
      entityType: 'di_documentmetadata',
      id: 'm1',
    }));
    const fetchImpl = createWebApiFetch(makeContext({ createRecord } as never));

    const response = await fetchImpl('/api/v1/documents/abc/metadata', {
      method: 'POST',
      body: JSON.stringify({ fields: { total: '42.00' }, tags: ['ocr'], source: 'ocr' }),
    });

    expect(response.status).toBe(201);
    expect(createRecord).toHaveBeenCalledOnce();
    expect(await response.json()).toMatchObject({ documentId: 'abc', source: 'ocr' });
  });

  it('turns a webAPI rejection into a 502 problem document', async () => {
    const retrieveMultipleRecords = vi.fn(
      async (
        _entity: string,
        _options?: string,
        _max?: number,
      ): Promise<{ entities: unknown[] }> => {
        throw new Error('privilege missing');
      },
    );
    const fetchImpl = createWebApiFetch(makeContext({ retrieveMultipleRecords } as never));

    const response = await fetchImpl('/api/v1/documents');

    expect(response.status).toBe(502);
    expect((await response.json()).detail).toBe('privilege missing');
  });

  it('404s on a route it does not map', async () => {
    const fetchImpl = createWebApiFetch(makeContext({}));
    expect((await fetchImpl('/api/v1/unknown')).status).toBe(404);
  });

  it('honours an overridden entity map', async () => {
    const retrieveMultipleRecords = vi.fn(
      async (_entity: string, _options?: string, _max?: number) => ({ entities: [] }),
    );
    const fetchImpl = createWebApiFetch(makeContext({ retrieveMultipleRecords } as never), {
      entityMap: { documentEntity: 'contoso_doc' },
    });

    await fetchImpl('/api/v1/documents');

    expect(retrieveMultipleRecords.mock.calls[0]?.[0]).toBe('contoso_doc');
  });
});
