import { defineConfig } from 'orval';

/**
 * Two outputs from one spec:
 *   - `documentIntake`     react-query hooks over the hand-written fetch mutator
 *   - `documentIntakeZod`  zod request/response schemas, emitted alongside them
 *
 * Nothing here reads the environment: no `baseUrl` is baked into the generated
 * code, so every request path is host-relative and `customFetch` resolves it
 * against the `ApiClientConfig` injected at runtime.
 */
export default defineConfig({
  documentIntake: {
    input: {
      target: './openapi.json',
    },
    output: {
      mode: 'tags-split',
      target: './src/generated/endpoints/documentIntake.ts',
      schemas: './src/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      indexFiles: true,
      clean: false,
      override: {
        mutator: {
          path: './src/fetcher.ts',
          name: 'customFetch',
        },
        fetch: {
          // Hooks resolve to the payload itself rather than {status,data,headers}.
          includeHttpResponseReturnType: false,
        },
        query: {
          // Deliberately NOT setting `useQuery`/`useMutation` here. Orval routes
          // by verb on its own (GET -> useQuery, everything else -> useMutation),
          // which is what we want. Forcing `useQuery: true` turns *every*
          // operation into a query, so `updateDocumentStatus` would fire its
          // PATCH on render; setting both flags inverts the assignment instead.
          signal: true,
          shouldExportQueryKey: true,
        },
      },
    },
  },
  documentIntakeZod: {
    input: {
      target: './openapi.json',
    },
    output: {
      mode: 'tags-split',
      target: './src/generated/endpoints/documentIntake.ts',
      fileExtension: '.zod.ts',
      client: 'zod',
      indexFiles: false,
      clean: false,
      override: {
        zod: {
          version: 4,
          generate: {
            param: true,
            body: true,
            response: true,
            query: true,
            header: false,
          },
        },
      },
    },
  },
});
