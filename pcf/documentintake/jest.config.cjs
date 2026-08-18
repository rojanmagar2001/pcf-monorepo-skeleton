/**
 * Jest (not Vitest) for the control, because the control is the one package
 * Vite never touches - pcf-scripts owns its build end to end.
 *
 * The workspace libraries ship ESM, so their `dist` output is mapped to
 * explicit paths and run through babel-jest; only the control's own TypeScript
 * goes through ts-jest.
 */
const { resolve } = require('node:path');

const ui = resolve(__dirname, '../../packages/ui/dist');
const apiClient = resolve(__dirname, '../../packages/api-client/dist');

module.exports = {
  testEnvironment: '<rootDir>/test/jsdomWithPlatformGlobals.cjs',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@document-intake/ui/styles$': `${ui}/styles.js`,
    '^@document-intake/ui$': `${ui}/index.js`,
    '^@document-intake/api-client/testing$': `${apiClient}/testing/index.js`,
    '^@document-intake/api-client$': `${apiClient}/index.js`,
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
    '^.+\\.jsx?$': [
      'babel-jest',
      { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] },
    ],
  },
  // The mapped workspace dist files live outside node_modules, so they are
  // transformed; everything genuinely inside node_modules resolves to CJS.
  transformIgnorePatterns: ['/node_modules/(?!(\\.pnpm|@tanstack)/)'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  clearMocks: true,
  restoreMocks: true,
};
