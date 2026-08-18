import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Storybook builds with Vite, which is also what Vitest transforms with, so
 * stories and tests see identical module resolution.
 *
 * Styling goes through the normal postcss pipeline (`../postcss.config.cjs`)
 * pointed at the one shared `tailwind.config.ts`. That is deliberate: Storybook
 * must render from the same config that produces the control's stylesheet, or
 * it stops being a preview of the real thing.
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  // Serves the MSW service worker for data-backed stories.
  staticDirs: ['./public'],
  core: {
    disableTelemetry: true,
  },
};

export default config;
