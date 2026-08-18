import type { Document, DocumentStatus } from '../generated/model';

const STATUSES: DocumentStatus[] = ['pending', 'processing', 'needsReview', 'approved', 'rejected'];

const SUBMITTERS = [
  'ada.lovelace@contoso.com',
  'grace.hopper@contoso.com',
  'alan.turing@contoso.com',
  'katherine.johnson@contoso.com',
];

const KINDS = [
  { suffix: 'invoice', contentType: 'application/pdf' },
  { suffix: 'contract', contentType: 'application/pdf' },
  { suffix: 'receipt', contentType: 'image/png' },
  { suffix: 'statement', contentType: 'application/pdf' },
  {
    suffix: 'claim-form',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
];

/** Deterministic id so fixtures are stable across runs and snapshots. */
function fixtureId(index: number): string {
  const hex = (index + 1).toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

/**
 * A deterministic corpus of intake documents.
 *
 * No randomness and no `Date.now()`: the same seed produces the same rows in
 * tests, in Storybook and in the web harness.
 */
export function createDocumentFixtures(count = 37): Document[] {
  const base = Date.parse('2026-05-01T09:00:00.000Z');
  return Array.from({ length: count }, (_, i) => {
    const kind = KINDS[i % KINDS.length] as (typeof KINDS)[number];
    const status = STATUSES[i % STATUSES.length] as DocumentStatus;
    const submittedAt = new Date(base - i * 3_600_000).toISOString();
    return {
      id: fixtureId(i),
      fileName: `${String(i + 1).padStart(4, '0')}-${kind.suffix}.${kind.contentType === 'image/png' ? 'png' : 'pdf'}`,
      contentType: kind.contentType,
      sizeBytes: 24_000 + i * 5_137,
      status,
      submittedBy: SUBMITTERS[i % SUBMITTERS.length] as string,
      submittedAt,
      updatedAt: new Date(base - i * 3_600_000 + 900_000).toISOString(),
      pageCount: status === 'pending' ? null : 1 + (i % 12),
      confidence: status === 'pending' ? null : Number((0.55 + (i % 40) / 100).toFixed(2)),
      tags: i % 3 === 0 ? ['priority'] : i % 3 === 1 ? ['batch', 'scanned'] : [],
    } satisfies Document;
  });
}
