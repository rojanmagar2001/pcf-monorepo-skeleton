import { defineConfig } from 'tsup';

/**
 * The library build - the artifact `pcf/documentintake` consumes. Vite still
 * builds the SPA (into `dist-app`), and never touches this output.
 *
 * Same shape as `packages/ui`: ESM + .d.ts, `es2017`, no splitting. Every peer
 * is external so the control bundle ends up with exactly one copy of React and
 * of @tanstack/react-query.
 */
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  dts: true,
  target: 'es2017',
  platform: 'browser',
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@tanstack/react-query',
    '@document-intake/ui',
    '@document-intake/ui/styles',
    '@document-intake/api-client',
  ],
});
