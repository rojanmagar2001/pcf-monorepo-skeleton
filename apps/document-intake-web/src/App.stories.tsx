import {
  createDocumentIntakeMocks,
  DEFAULT_MOCK_BASE_URL,
  DocumentIntakeDb,
} from '@document-intake/api-client/testing';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type {} from 'msw-storybook-addon/types';
import { App } from './App';

/**
 * The whole shell - header, filters and the live grid - as the PCF control
 * mounts it. `packages/ui` stories cover the pieces in isolation; these cover
 * the composition, which is the part the control actually renders.
 *
 * `baseUrl` is passed explicitly rather than left to `resolveBaseUrl()`: that
 * helper resolves against `window.location.origin`, which inside Storybook is
 * the Storybook dev server, not the origin the MSW handlers answer on.
 *
 * `uiRoot: false` because `App` mounts its own `UiRoot`; without it the preview
 * decorator would nest a second `.di-root` scope around this one.
 */
const meta = {
  title: 'Shell/App',
  component: App,
  parameters: { slotWidth: 1040, slotHeight: 640, uiRoot: false },
  args: { baseUrl: DEFAULT_MOCK_BASE_URL },
} satisfies Meta<typeof App>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default corpus, served by the same MSW handlers the web harness uses. */
export const Default: Story = {};

/** A cramped field slot, which is what a model-driven form usually hands over. */
export const NarrowFieldSlot: Story = {
  parameters: { slotWidth: 520, slotHeight: 560, uiRoot: false },
  args: { initialPageSize: 5 },
};

export const WithDescription: Story = {
  args: {
    title: 'Invoice intake queue',
    description: 'Documents awaiting review before they post to finance.',
  },
};

/**
 * A backend with nothing in it - the grid's own empty state, not an error.
 *
 * The whole mock backend is replaced here rather than a single route stubbed,
 * because "empty" has to hold for paging and filtering too, not just the first
 * response. Story annotations run after the preview's, and `msw.use()`
 * prepends, so these shadow the defaults.
 */
export const NoDocuments: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      ...createDocumentIntakeMocks({
        baseUrl: DEFAULT_MOCK_BASE_URL,
        db: new DocumentIntakeDb([]),
      }).handlers,
    );
  },
};

/**
 * What the control renders when its own manifest properties fail validation -
 * the grid is never mounted, so no request is made.
 */
export const ConfigurationError: Story = {
  args: {
    configurationError:
      'The "apiBaseUrl" property is empty. Set it on the control in the form designer.',
  },
};
