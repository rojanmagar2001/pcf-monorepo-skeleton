import { setupWorker } from 'msw/browser';
import { createHarnessMocks } from './handlers';

const mocks = createHarnessMocks();

export const db = mocks.db;
export const worker = setupWorker(...mocks.handlers);

/** Starts the service worker. Resolves once requests are being intercepted. */
export async function startMockApi(): Promise<void> {
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
  });
}
