/**
 * Test-only entry point (`@document-intake/api-client/testing`).
 *
 * Kept out of the package root on purpose: it pulls in msw and the raw spec,
 * neither of which belongs anywhere near the control bundle.
 */
export { DocumentIntakeDb, type ListQuery } from './db';
export { createDocumentFixtures } from './fixtures';
export {
  assertContractCoverage,
  createDocumentIntakeMocks,
  type DocumentIntakeMocks,
  type HandlerOptions,
  implementedOperations,
  specOperations,
  toMswPath,
} from './handlers';
