/**
 * pcf-scripts runs an ESLint pass as a fixed step of `pcf-scripts build` and
 * fails the build when it cannot find a config file. This workspace lints and
 * formats with Biome instead (see the repo-root `biome.json`), so this config
 * exists only to satisfy that step rather than to introduce a second, diverging
 * rule set for one package.
 *
 * The control's sources are covered by `pnpm lint` at the repo root.
 */
export default [
  {
    ignores: ['**/*'],
  },
];
