/**
 * `@document-intake/api-client`
 *
 * Generated modules are re-exported unmodified; everything hand-written sits
 * beside them. This package depends on nothing else in the workspace and reads
 * nothing from the environment.
 */

/**
 * Re-exported so consumers validate against the same zod instance the generated
 * schemas were built with. The PCF control uses this to validate its input
 * parameters — never hand-write a type the schema can infer.
 */
export { z } from 'zod';
export {
  ApiProvider,
  type ApiProviderProps,
  useApiConfig,
  useApiRequestInit,
} from './api-provider';
// --- hand-written on top ---------------------------------------------------
export {
  API_CONFIG,
  type ApiClientConfig,
  type ApiClientHandle,
  ApiClientNotConfiguredError,
  ApiError,
  type ApiRequestInit,
  configureApiClient,
  customFetch,
  type HeadersSource,
  resetApiClient,
  resolveApiClientConfig,
  withApiConfig,
} from './fetcher';
export * from './generated/endpoints/documents/documents';
/** Generated zod request/response schemas, namespaced to keep names unambiguous. */
export * as schemas from './generated/endpoints/documents/documents.zod';
// --- generated, unmodified -------------------------------------------------
export * from './generated/model';
export { createQueryClient, disposeQueryClient } from './query-client';
export { type DocumentQueryKey, documentKeys } from './query-keys';
export {
  type DocumentPageInput,
  documentPageSchema,
  type ListDocumentsParamsInput,
  listDocumentsParamsSchema,
  type UpdateDocumentStatusInput,
  updateDocumentStatusSchema,
} from './refinements';
export {
  type CreateWebApiFetchOptions,
  createWebApiFetch,
  defaultEntityMap,
  type WebApiEntityMap,
} from './webapi-fetch';
