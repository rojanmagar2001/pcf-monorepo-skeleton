import { act } from 'react';
import { DocumentIntake } from '../documentintake/index';
import { styleRefCount } from '../documentintake/styles';
import { createMockContext, emptyState } from './mockContext';

function injectedStyles(): NodeListOf<HTMLStyleElement> {
  return document.head.querySelectorAll<HTMLStyleElement>('style[data-di-styles]');
}

/** Polls until `predicate` holds, flushing React work between attempts. */
async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error('waitFor: condition not met before timeout');
}

/** Every control mounted by a test, torn down in `afterEach` even on failure. */
const mounted: DocumentIntake[] = [];

async function mount(
  control: DocumentIntake,
  mock: ReturnType<typeof createMockContext>,
): Promise<void> {
  mounted.push(control);
  await act(async () => {
    control.init(mock.context, mock.notifyOutputChanged, emptyState, mock.container);
  });
}

describe('DocumentIntake control lifecycle', () => {
  // Teardown must run even when an assertion throws mid-test: the stylesheet
  // is reference counted at module scope, so a leaked instance would corrupt
  // every test after it. `destroy()` is idempotent, so tests that call it
  // explicitly are safe here too.
  afterEach(async () => {
    for (const control of mounted.splice(0)) {
      await act(async () => control.destroy());
    }
    for (const style of Array.from(injectedStyles())) style.remove();
    document.body.innerHTML = '';
  });

  it('renders into the container the host provided', async () => {
    const mock = createMockContext();
    const control = new DocumentIntake();
    await mount(control, mock);

    expect(mock.container.querySelector('[data-di-root]')).not.toBeNull();

    await act(async () => control.destroy());
  });

  it('renders the shared @document-intake/web shell, not a control-only tree', async () => {
    const mock = createMockContext();
    const control = new DocumentIntake();
    await mount(control, mock);

    // The chrome the harness shows is the chrome the control shows: one shell,
    // two hosts. If the control ever forked its own tree again, this fails.
    expect(mock.container.querySelector('section[aria-label="Filters"]')).not.toBeNull();
    expect(mock.container.querySelector('input[type="search"]')).not.toBeNull();
    expect(mock.container.textContent).toContain('Document intake');

    // The harness-only strapline is passed in by `main.tsx`, never by the
    // control - MSW must not be described to a user inside a real host.
    expect(mock.container.textContent).not.toContain('Dataverse environment required');

    await act(async () => control.destroy());
  });

  it('injects the scoped stylesheet exactly once in init()', async () => {
    const mock = createMockContext();
    const control = new DocumentIntake();
    await mount(control, mock);

    expect(injectedStyles()).toHaveLength(1);
    expect(injectedStyles()[0]?.textContent).toContain('.di-root');

    await act(async () => control.destroy());
  });

  it('routes data through context.webAPI rather than the network', async () => {
    const mock = createMockContext({ records: [] });
    const control = new DocumentIntake();
    await mount(control, mock);

    await waitFor(() => mock.webAPI.retrieveMultipleRecords.mock.calls.length > 0);

    expect(mock.webAPI.retrieveMultipleRecords).toHaveBeenCalled();
    expect(mock.webAPI.retrieveMultipleRecords.mock.calls[0][0]).toBe('di_document');

    await act(async () => control.destroy());
  });

  it('renders a configuration error instead of the grid when baseUrl is invalid', async () => {
    const mock = createMockContext({ baseUrl: '' });
    const control = new DocumentIntake();
    await mount(control, mock);

    expect(mock.container.textContent).toContain('not configured correctly');
    expect(mock.container.querySelector('table')).toBeNull();
    expect(mock.webAPI.retrieveMultipleRecords).not.toHaveBeenCalled();

    await act(async () => control.destroy());
  });

  it('re-renders on updateView without remounting the root', async () => {
    const mock = createMockContext({ pageSize: 10 });
    const control = new DocumentIntake();
    await mount(control, mock);

    const rootBefore = mock.container.querySelector('[data-di-root]');

    await act(async () => {
      control.updateView(mock.pushUpdate({ pageSize: 50, paging: { pageSize: 50 } }));
    });

    expect(mock.container.querySelector('[data-di-root]')).toBe(rootBefore);

    await act(async () => control.destroy());
  });

  it('reports outputs in the shape the manifest declares', async () => {
    const mock = createMockContext();
    const control = new DocumentIntake();
    await mount(control, mock);

    const outputs = control.getOutputs();
    expect(Object.keys(outputs).sort()).toEqual([
      'lastError',
      'selectedDocumentId',
      'visibleDocumentCount',
    ]);
    expect(typeof outputs.visibleDocumentCount).toBe('number');

    await act(async () => control.destroy());
  });

  it('notifies the host and records the message when a request fails', async () => {
    const mock = createMockContext();
    mock.webAPI.retrieveMultipleRecords.mockRejectedValue(new Error('privilege missing'));

    const control = new DocumentIntake();
    await mount(control, mock);

    await waitFor(() => mock.notifyOutputChanged.mock.calls.length > 0);

    expect(control.getOutputs().lastError).toBeTruthy();

    await act(async () => control.destroy());
  });

  it('tears everything down in destroy()', async () => {
    const mock = createMockContext();
    const control = new DocumentIntake();
    await mount(control, mock);

    expect(styleRefCount()).toBe(1);

    await act(async () => control.destroy());

    expect(mock.container.childElementCount).toBe(0);
    expect(injectedStyles()).toHaveLength(0);
    expect(styleRefCount()).toBe(0);
  });

  it('supports several instances on one form, sharing one <style> element', async () => {
    const first = createMockContext();
    const second = createMockContext();
    const controlA = new DocumentIntake();
    const controlB = new DocumentIntake();

    await mount(controlA, first);
    await mount(controlB, second);

    expect(injectedStyles()).toHaveLength(1);
    expect(styleRefCount()).toBe(2);
    expect(first.container.querySelector('[data-di-root]')).not.toBeNull();
    expect(second.container.querySelector('[data-di-root]')).not.toBeNull();

    // Destroying one must not strip the stylesheet from the other.
    await act(async () => controlA.destroy());
    expect(injectedStyles()).toHaveLength(1);
    expect(second.container.querySelector('[data-di-root]')).not.toBeNull();

    await act(async () => controlB.destroy());
    expect(injectedStyles()).toHaveLength(0);
  });

  it('can be destroyed and recreated by the host', async () => {
    const mock = createMockContext();
    const control = new DocumentIntake();

    await mount(control, mock);
    await act(async () => control.destroy());

    const recreated = new DocumentIntake();
    const fresh = createMockContext();
    await mount(recreated, fresh);

    expect(fresh.container.querySelector('[data-di-root]')).not.toBeNull();
    expect(injectedStyles()).toHaveLength(1);

    await act(async () => recreated.destroy());
  });
});
