import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { App } from './App';
import { createHarnessMocks } from './mocks/handlers';

// In jsdom there is no service worker, so the same handlers run through the
// node interceptor. The handler set is identical either way.
const ORIGIN = 'http://localhost';
const mocks = createHarnessMocks(ORIGIN);
const server = setupServer(...mocks.handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  mocks.db.reset();
});
afterAll(() => server.close());

function renderApp() {
  return render(<App baseUrl={`${ORIGIN}/api/v1`} />);
}

async function settled() {
  await waitFor(() => expect(screen.queryByText('Loading documents…')).not.toBeInTheDocument());
}

function bodyRows(): HTMLElement[] {
  const body = screen.getByRole('table').querySelector('tbody') as HTMLElement;
  return within(body).getAllByRole('row');
}

describe('dev harness', () => {
  it('renders the intake grid against the mocked API', async () => {
    renderApp();
    await settled();

    expect(screen.getByRole('heading', { name: 'Document intake' })).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(10);
    expect(screen.getByText(/37 documents/)).toBeInTheDocument();
  });

  it('mounts everything inside the .di-root scope', async () => {
    const { container } = renderApp();
    await settled();

    const root = container.querySelector('[data-di-root]');
    expect(root).not.toBeNull();
    expect(root?.querySelector('table')).not.toBeNull();
  });

  it('filters by status through the API', async () => {
    const user = userEvent.setup();
    renderApp();
    await settled();

    await user.click(screen.getByRole('button', { name: /Filter by Approved/ }));

    await waitFor(() => {
      const statuses = bodyRows().map((row) =>
        row.querySelector('[data-status]')?.getAttribute('data-status'),
      );
      expect(statuses.length).toBeGreaterThan(0);
      expect(statuses.every((s) => s === 'approved')).toBe(true);
    });
  });

  it('searches by file name through the API', async () => {
    const user = userEvent.setup();
    renderApp();
    await settled();

    await user.type(screen.getByLabelText('Search'), 'receipt');

    await waitFor(() => {
      const names = bodyRows().map((row) => (row.querySelector('td') as HTMLElement).textContent);
      expect(names.length).toBeGreaterThan(0);
      expect(names.every((name) => name?.includes('receipt'))).toBe(true);
    });
  });

  it('pages through the queue', async () => {
    const user = userEvent.setup();
    renderApp();
    await settled();

    expect(screen.getByText(/Page 1 of 4/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next/ }));

    await waitFor(() => expect(screen.getByText(/Page 2 of 4/)).toBeInTheDocument());
  });

  it('toggles a status filter back off', async () => {
    const user = userEvent.setup();
    renderApp();
    await settled();

    const approved = screen.getByRole('button', { name: /Filter by Approved/ });
    await user.click(approved);
    await waitFor(() => expect(approved).toHaveAttribute('aria-pressed', 'true'));

    await user.click(approved);
    await waitFor(() => expect(approved).toHaveAttribute('aria-pressed', 'false'));
    await waitFor(() => expect(screen.getByText(/37 documents/)).toBeInTheDocument());
  });
});
