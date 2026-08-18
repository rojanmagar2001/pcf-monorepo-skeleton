/**
 * `@document-intake/web` - library entry point.
 *
 * This app is two things at once. `main.tsx` boots it as a Vite SPA against MSW
 * so UI work needs no Dataverse environment; this module exposes the same shell
 * as a component, which `pcf/documentintake` renders inside the real host.
 *
 * The two entries share the shell and nothing else. Everything reachable from
 * here is bundled into the shipped control, so this module must never re-export
 * `main.tsx`, `mocks/*` or anything that pulls in MSW - `purity.test.ts` fails
 * the build if it does.
 */
export { App, type AppProps, type IntakeShellState } from './App';
export { API_BASE_PATH, resolveBaseUrl } from './config';
