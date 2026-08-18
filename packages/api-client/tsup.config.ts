import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'testing/index': 'src/testing/index.ts',
  },
  format: ['esm'],
  dts: true,
  // Explicit: the output ships into a model-driven app host, so the syntax
  // level is a decision, never a default.
  target: 'es2017',
  platform: 'browser',
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  // Peer deps only. Two copies of @tanstack/react-query in one bundle break
  // QueryClientProvider's context identity.
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@tanstack/react-query',
    'zod',
    'msw',
    'msw/node',
    'msw/browser',
  ],
});
