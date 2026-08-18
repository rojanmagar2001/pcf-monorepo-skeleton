import { ApiProvider, createQueryClient, disposeQueryClient } from '@document-intake/api-client';
import { UiRoot } from '@document-intake/ui';
import { type Decorator, definePreview } from '@storybook/react-vite';
import addonMsw from 'msw-storybook-addon';
// Type-only: augments `StoryContext` with `msw`, the running SetupWorker that
// `addonMsw()` hands to every `beforeEach`. Erased at compile time - the
// package's `./types` subpath is declarations only and has no runtime module.
import type {} from 'msw-storybook-addon/types';
import { useEffect, useState } from 'react';
import { STORYBOOK_BASE_URL, storyMocks } from './mocks';
// The only CSS import in the workspace, and it lives in Storybook's own config
// rather than in library source - nothing here reaches the control bundle.
// It goes through the normal postcss pipeline against the shared
// `tailwind.config.ts`, so Storybook renders what the control ships.
import '@document-intake/ui/tailwind.css';

/** Story-level knobs this preview understands, declared via `parameters`. */
interface SlotParameters {
  slotWidth?: number | string;
  slotHeight?: number | string;
  /**
   * Set `false` by a story whose subject mounts its own `UiRoot` - the web
   * shell does - so the preview does not nest a second scope around it.
   */
  uiRoot?: boolean;
}

/**
 * Mimics a PCF field slot: a model-driven form hands a control a fixed, usually
 * cramped box, so stories are framed the same way rather than being allowed to
 * sprawl across the viewport. Resizable, to make overflow behaviour obvious.
 */
const withFieldSlot: Decorator = (Story, context) => {
  const { slotWidth = 960, slotHeight = 520, uiRoot = true } = context.parameters as SlotParameters;
  return (
    <div
      data-pcf-field-slot=""
      style={{
        width: typeof slotWidth === 'number' ? `${slotWidth}px` : slotWidth,
        height: typeof slotHeight === 'number' ? `${slotHeight}px` : slotHeight,
        overflow: 'auto',
        resize: 'both',
        border: '1px dashed #cbd5e1',
        borderRadius: '6px',
        padding: '12px',
        background: '#ffffff',
        boxSizing: 'border-box',
      }}
    >
      {uiRoot ? (
        <UiRoot>
          <Story />
        </UiRoot>
      ) : (
        <Story />
      )}
    </div>
  );
};

/**
 * A brand-new QueryClient per story, disposed on unmount - the same lifecycle
 * the control gives each instance. Sharing one across stories would let cached
 * data leak between them.
 */
const withFreshQueryClient: Decorator = (Story) => {
  const [client] = useState(() => createQueryClient());
  useEffect(() => () => disposeQueryClient(client), [client]);

  return (
    <ApiProvider config={{ baseUrl: STORYBOOK_BASE_URL }} client={client}>
      <Story />
    </ApiProvider>
  );
};

/**
 * `definePreview` rather than a plain `Preview` object: preview *addons* are
 * only accepted through it, and MSW is registered as one.
 *
 * The mock backend is installed in `beforeEach` rather than declared as a
 * `parameters.msw` block. As of msw-storybook-addon 3 that parameter is only
 * read by the legacy `msw-storybook-addon/csf3` loader; the addon proper starts
 * a worker with no handlers and exposes it as `context.msw`, and resets it
 * after every story - which is why these have to be re-applied per story rather
 * than registered once.
 *
 * A story that needs different behaviour adds its own `beforeEach` and calls
 * `msw.use()`. Story annotations run after the preview's, and `use()` prepends,
 * so a story's handler shadows the default without having to restate the rest.
 */
export default definePreview({
  addons: [addonMsw()],
  decorators: [withFreshQueryClient, withFieldSlot],
  beforeEach: ({ msw }) => {
    msw.use(...storyMocks.handlers);
  },
  parameters: {
    layout: 'centered',
    controls: { expanded: true },
  },
});
