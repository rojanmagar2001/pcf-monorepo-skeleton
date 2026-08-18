import { createDocumentIntakeMocks } from '@document-intake/api-client/testing';

/**
 * One mock backend shared by `preview.tsx` and any story that needs to override
 * a handler. Kept in its own module so stories do not have to import the
 * preview (and its CSS side effect) just to learn the base URL.
 */
export const STORYBOOK_BASE_URL = 'http://localhost/api/v1';

export const storyMocks = createDocumentIntakeMocks({ baseUrl: STORYBOOK_BASE_URL });
