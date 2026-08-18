import {
  createDocumentIntakeMocks,
  DEFAULT_MOCK_BASE_URL,
} from '@document-intake/api-client/testing';

/**
 * One mock backend shared by `preview.tsx` and any story that needs to override
 * a handler.
 *
 * The origin comes from `api-client/testing` rather than being declared here,
 * so a story in `packages/ui` or `apps/document-intake-web` can name the same
 * origin without importing anything out of this app's private config.
 */
export const STORYBOOK_BASE_URL = DEFAULT_MOCK_BASE_URL;

export const storyMocks = createDocumentIntakeMocks({ baseUrl: STORYBOOK_BASE_URL });
