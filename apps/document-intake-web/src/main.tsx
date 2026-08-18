import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startMockApi } from './mocks/browser';
// The harness compiles the library's own source stylesheet through its normal
// postcss pipeline, using the one shared Tailwind config. The control gets the
// same CSS as a prebuilt string instead.
import '@document-intake/ui/tailwind.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

// The SPA entry, and the only place MSW is wired up. The library entry
// (`src/index.ts`) must never reach this module - see `src/purity.test.ts`.
// Requests are only intercepted once the worker is ready, so render after.
void startMockApi().then(() => {
  createRoot(container).render(
    <App
      description={
        <>
          Dev harness — served by MSW handlers derived from <code>openapi.json</code>. No Dataverse
          environment required.
        </>
      }
    />,
  );
});
