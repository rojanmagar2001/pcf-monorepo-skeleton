import type { Config } from 'tailwindcss';

/**
 * The single Tailwind config for the whole workspace.
 *
 * The web app and Storybook load *this* file rather than declaring their own,
 * so what Storybook renders is what the control ships.
 *
 * The content globs are written relative to a package directory two levels
 * below the repo root, which is true of every consumer (`packages/ui`,
 * `apps/*`). Tailwind resolves relative globs against the working directory,
 * so the same list works from each of them.
 */
const config: Config = {
  content: [
    '../../packages/ui/src/**/*.{ts,tsx}',
    '../../apps/*/src/**/*.{ts,tsx}',
    '../../pcf/*/**/*.{ts,tsx}',
    // Not a source root - just keeps Tailwind's glob walker (and its
    // "matching all of node_modules" warning) out of installed packages.
    '!../../**/node_modules/**',
  ],

  // The control renders inside a model-driven app that already has its own
  // global stylesheet. Preflight would reset the host's typography and borders.
  corePlugins: {
    preflight: false,
  },

  // Scopes every rule under the control's own root and wins specificity fights
  // against the host's stylesheet without a single `!important`.
  important: '.di-root',

  // Namespaces the utility classes so they cannot collide with host classes.
  prefix: 'di-',

  theme: {
    extend: {
      colors: {
        status: {
          pending: '#64748b',
          processing: '#0369a1',
          review: '#b45309',
          approved: '#15803d',
          rejected: '#b91c1c',
        },
      },
      // rem/px only - no viewport or container-query units.
      fontSize: {
        'field-xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
    },
  },

  plugins: [],
};

export default config;
