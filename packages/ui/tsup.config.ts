import { defineConfig } from 'tsup';

/**
 * ESM + .d.ts only.
 *
 * tsup rather than Vite's library mode: Vite 8 bundles with Rolldown, and the
 * dts plugin this build would need still declares a Rollup peer. This build
 * needs neither a dev server nor a plugin pipeline, so the simpler tool wins.
 * Vite is still what drives the web app, Storybook's builder and Vitest.
 */
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  dts: true,
  // Explicit, never inferred: this output is bundled into a control that runs
  // inside a model-driven app host.
  target: 'es2017',
  platform: 'browser',
  sourcemap: true,
  // The Tailwind stylesheet is emitted into dist/ separately, so the JS build
  // must not wipe the folder out from under it.
  clean: false,
  splitting: false,
  treeshake: true,
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@tanstack/react-query',
    '@tanstack/react-table',
    '@document-intake/api-client',
  ],
});
