import { createDocumentIntakeMocks } from '@document-intake/api-client/testing';
import { resolveBaseUrl } from '../config';

/**
 * The harness runs against the MSW handlers derived from `openapi.json`, so UI
 * work needs no Dataverse environment and no live API - while still exercising
 * the real generated client and the real contract.
 */
export function createHarnessMocks(origin?: string) {
  return createDocumentIntakeMocks({ baseUrl: resolveBaseUrl(origin) });
}
