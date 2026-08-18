import { ApiProvider, createQueryClient, disposeQueryClient } from '@document-intake/api-client';
import type { Decorator, Preview } from '@storybook/react-vite';
import addonMsw from 'msw-storybook-addon';
import { useEffect, useState } from 'react';
import { UiRoot } from '../src/UiRoot';
import { STORYBOOK_BASE_URL, storyMocks } from './mocks';
// The only CSS import in the workspace, and it lives in Storybook's own config
// rather than in library source - nothing here reaches the control bundle.
// It goes through the normal postcss pipeline against the shared
// `tailwind.config.ts`, so Storybook renders what the control ships.
import '../src/styles/tailwind.css';

/**
 * Mimics a PCF field slot: a model-driven form hands a control a fixed, usually
 * cramped box, so stories are framed the same way rather than being allowed to
 * sprawl across the viewport. Resizable, to make overflow behaviour obvious.
 */
const withFieldSlot: Decorator = (Story, context) => {
  const { slotWidth = 960, slotHeight = 520 } = context.parameters as {
    slotWidth?: number | string;
    slotHeight?: number | string;
  };
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
      <UiRoot>
        <Story />
      </UiRoot>
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

const preview: Preview = {
  // MSW is wired in as a preview addon; stories declare handlers through the
  // `msw` parameter.
  addons: [addonMsw()],
  decorators: [withFreshQueryClient, withFieldSlot],
  parameters: {
    layout: 'centered',
    controls: { expanded: true },
    msw: { handlers: storyMocks.handlers },
  },
};

export default preview;
