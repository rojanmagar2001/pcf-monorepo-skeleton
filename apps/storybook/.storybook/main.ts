import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';
import type { Alias, AliasOptions } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
/** `apps/storybook/.storybook` -> the repo root. */
const repoRoot = resolve(here, '../../..');
const fromRoot = (...segments: string[]) => resolve(repoRoot, ...segments);

/**
 * Workspace packages are resolved to their **source** entry points rather than
 * to the `dist/` output named in each package's `exports`.
 *
 * Two reasons, both of which bite immediately if this is left out. Stories sit
 * beside the components they document and import them by relative path, so
 * without these aliases a story's `./UiRoot` and the preview decorator's
 * `@document-intake/ui` would be two different modules - same component, two
 * React contexts, and `useUiPortalContainer` quietly returning `null`. And
 * `pnpm storybook` would need a library build first, which puts stale `dist/`
 * between the author and the source they are editing.
 *
 * Exact-match regexes, not prefix strings: a bare `'@document-intake/ui'` alias
 * would also swallow `@document-intake/ui/tailwind.css`, which must keep
 * resolving through the package's own `exports`.
 */
const workspaceSourceAliases: Alias[] = [
  { find: /^@document-intake\/ui$/, replacement: fromRoot('packages/ui/src/index.ts') },
  {
    find: /^@document-intake\/api-client$/,
    replacement: fromRoot('packages/api-client/src/index.ts'),
  },
  {
    find: /^@document-intake\/api-client\/testing$/,
    replacement: fromRoot('packages/api-client/src/testing/index.ts'),
  },
  {
    find: /^@document-intake\/web$/,
    replacement: fromRoot('apps/document-intake-web/src/index.ts'),
  },
];

/**
 * The workspace's one Storybook.
 *
 * It deliberately owns no components. Stories stay next to the code they
 * document - `packages/ui` for the presentational library, the shell in
 * `apps/document-intake-web` - and this app only collects them, so a component
 * and its story can never drift into separate directories.
 *
 * Storybook builds with Vite, which is also what Vitest transforms with, so
 * stories and tests see identical module resolution.
 *
 * Styling goes through the normal postcss pipeline (`../postcss.config.cjs`)
 * pointed at the one shared `tailwind.config.ts`. That is deliberate: Storybook
 * must render from the same config that produces the control's stylesheet, or
 * it stops being a preview of the real thing.
 */
const config: StorybookConfig = {
  stories: [
    '../../../packages/ui/src/**/*.stories.@(ts|tsx)',
    '../../../apps/document-intake-web/src/**/*.stories.@(ts|tsx)',
  ],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  // Serves the MSW service worker for data-backed stories.
  staticDirs: ['../public'],
  core: {
    disableTelemetry: true,
  },
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    resolve: {
      ...viteConfig.resolve,
      alias: [...workspaceSourceAliases, ...normaliseAlias(viteConfig.resolve?.alias)],
    },
    server: {
      ...viteConfig.server,
      // Every story lives outside this app's own directory, so Vite's dev
      // server has to be told the whole workspace is fair game. Stated
      // explicitly rather than left to Vite's workspace-root detection.
      fs: { ...viteConfig.server?.fs, allow: [repoRoot] },
    },
  }),
};

/** Vite accepts aliases as an object or an array; this config appends, so it needs the array form. */
function normaliseAlias(alias: AliasOptions | undefined): Alias[] {
  if (!alias) return [];
  if (Array.isArray(alias)) return [...alias];
  return Object.entries(alias).map(([find, replacement]) => ({ find, replacement }));
}

export default config;
