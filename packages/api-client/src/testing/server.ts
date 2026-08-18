import type { RequestHandler } from 'msw';
import { setupServer } from 'msw/node';
import type { DocumentIntakeDb } from './db';
import { createDocumentIntakeMocks } from './handlers';

/**
 * Node-side MSW server used by this package's Vitest suite.
 * Exported alongside its db so tests can seed and assert against the same store.
 */
const mocks = createDocumentIntakeMocks();

export const db: DocumentIntakeDb = mocks.db;
export const handlers: RequestHandler[] = mocks.handlers;

export const server = setupServer(...handlers);

export const TEST_BASE_URL = 'http://localhost/api/v1';
