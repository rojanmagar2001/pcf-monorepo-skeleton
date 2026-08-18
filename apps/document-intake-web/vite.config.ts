import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Dev harness for the intake UI. Vite drives this app, Storybook's builder and
 * Vitest's transform - but never the PCF control, which pcf-scripts owns end to
 * end.
 *
 * `pnpm build` here produces two artifacts: the tsup library build in `dist/`,
 * which the control bundles, and this SPA in `dist-app/`.
 *
 * Styling goes through `postcss.config.cjs`, which points at
 * `packages/ui/tailwind.config.ts`. There is no second Tailwind config.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    // Explicit, and deliberately the same target the control ships at, so the
    // harness cannot quietly accept syntax the real bundle would not.
    target: 'es2017',
    // The SPA, not the library. `dist/` belongs to the tsup build that
    // pcf/documentintake consumes, so the two outputs cannot collide.
    outDir: 'dist-app',
    sourcemap: true,
  },
});
