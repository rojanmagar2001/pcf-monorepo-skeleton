import { ApiProvider, createQueryClient, disposeQueryClient } from '@document-intake/api-client';
import {
  createDocumentFixtures,
  createDocumentIntakeMocks,
} from '@document-intake/api-client/testing';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  DocumentIntakeGrid,
  DocumentIntakeGridView,
  type DocumentIntakeQuery,
  defaultDocumentIntakeQuery,
} from './DocumentIntakeGrid';
import { UiRoot } from './UiRoot';

const BASE_URL = 'http://localhost/api/v1';
const mocks = createDocumentIntakeMocks({ baseUrl: BASE_URL });
const server = setupServer(...mocks.handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  mocks.db.reset();
});
afterAll(() => server.close());

const fixtures = createDocumentFixtures();

function bodyRows(): HTMLElement[] {
  const body = screen.getByRole('table').querySelector('tbody') as HTMLElement;
  return within(body).getAllByRole('row');
}

/** Text of the first cell of a body row, or '' when the row is absent. */
function firstCellText(index = 0): string {
  return bodyRows()[index]?.querySelector('td')?.textContent ?? '';
}

describe('DocumentIntakeGridView (presentation only)', () => {
  const baseProps = {
    documents: fixtures.slice(0, 3),
    total: 37,
    query: defaultDocumentIntakeQuery,
    onQueryChange: () => undefined,
  };

  it('renders one row per document with a status badge', () => {
    render(
      <UiRoot>
        <DocumentIntakeGridView {...baseProps} />
      </UiRoot>,
    );

    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByText(fixtures[0]?.fileName as string)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Pending|Processing|Needs review|Approved|Rejected/).length,
    ).toBeGreaterThan(0);
  });

  it('reports the server total rather than the number of rows on screen', () => {
    render(
      <UiRoot>
        <DocumentIntakeGridView {...baseProps} />
      </UiRoot>,
    );
    expect(screen.getByText(/37 documents/)).toBeInTheDocument();
  });

  it('translates a header click into a sort query and resets to page 1', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <UiRoot>
        <DocumentIntakeGridView
          {...baseProps}
          query={{ ...defaultDocumentIntakeQuery, page: 3 }}
          onQueryChange={onQueryChange}
        />
      </UiRoot>,
    );

    await user.click(
      within(screen.getByRole('columnheader', { name: /File name/ })).getByRole('button'),
    );

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'fileName', sortDir: 'asc', page: 1 }),
    );
  });

  it('ignores sorting on a column the API cannot sort by', () => {
    const onQueryChange = vi.fn();
    render(
      <UiRoot>
        <DocumentIntakeGridView {...baseProps} onQueryChange={onQueryChange} />
      </UiRoot>,
    );

    const header = screen.getByRole('columnheader', { name: /Submitted by/ });
    expect(within(header).queryByRole('button')).toBeNull();
    expect(onQueryChange).not.toHaveBeenCalled();
  });

  it('translates paging into a page query', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <UiRoot>
        <DocumentIntakeGridView {...baseProps} onQueryChange={onQueryChange} />
      </UiRoot>,
    );

    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(onQueryChange).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 25 }));
  });

  it('resets to page 1 when the page size changes', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <UiRoot>
        <DocumentIntakeGridView
          {...baseProps}
          query={{ ...defaultDocumentIntakeQuery, page: 3 }}
          onQueryChange={onQueryChange}
        />
      </UiRoot>,
    );

    await user.selectOptions(screen.getByLabelText('Rows per page'), '50');
    expect(onQueryChange).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 50 }));
  });

  it('shows an empty state when there are no documents', () => {
    render(
      <UiRoot>
        <DocumentIntakeGridView {...baseProps} documents={[]} total={0} />
      </UiRoot>,
    );
    expect(screen.getByText('Nothing in the intake queue')).toBeInTheDocument();
  });

  it('shows an error state with a retry action instead of the table', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <UiRoot>
        <DocumentIntakeGridView
          {...baseProps}
          errorMessage="Service unavailable"
          onRetry={onRetry}
        />
      </UiRoot>,
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Service unavailable');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

function Harness({ initial = defaultDocumentIntakeQuery }: { initial?: DocumentIntakeQuery }) {
  const [query, setQuery] = useState(initial);
  return <DocumentIntakeGrid query={query} onQueryChange={setQuery} />;
}

function withProvider(children: ReactNode) {
  const client = createQueryClient();
  const view = render(
    <UiRoot>
      <ApiProvider config={{ baseUrl: BASE_URL }} client={client}>
        {children}
      </ApiProvider>
    </UiRoot>,
  );
  return { ...view, client };
}

describe('DocumentIntakeGrid (bound to the generated hook)', () => {
  it('loads the first page from the API', async () => {
    withProvider(<Harness initial={{ ...defaultDocumentIntakeQuery, pageSize: 10 }} />);

    await waitFor(() => expect(screen.queryByText('Loading documents…')).not.toBeInTheDocument());

    expect(bodyRows()).toHaveLength(10);
    expect(screen.getByText(/37 documents/)).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 4/)).toBeInTheDocument();
  });

  it('refetches when the user pages forward', async () => {
    const user = userEvent.setup();
    withProvider(<Harness initial={{ ...defaultDocumentIntakeQuery, pageSize: 10 }} />);

    await waitFor(() => expect(screen.queryByText('Loading documents…')).not.toBeInTheDocument());
    const firstName = firstCellText();

    await user.click(screen.getByRole('button', { name: /Next/ }));

    await waitFor(() => {
      expect(screen.getByText(/Page 2 of 4/)).toBeInTheDocument();
      expect(firstCellText()).not.toBe(firstName);
    });
  });

  it('refetches with the new sort when a sortable header is clicked', async () => {
    const user = userEvent.setup();
    withProvider(<Harness initial={{ ...defaultDocumentIntakeQuery, pageSize: 10 }} />);
    await waitFor(() => expect(screen.queryByText('Loading documents…')).not.toBeInTheDocument());

    await user.click(
      within(screen.getByRole('columnheader', { name: /File name/ })).getByRole('button'),
    );

    await waitFor(() => {
      const names = bodyRows().map(
        (row) => (row.querySelector('td') as HTMLElement).textContent ?? '',
      );
      expect(names).toEqual([...names].sort());
    });
  });

  it('surfaces a server failure as an error state', async () => {
    const { http, HttpResponse } = await import('msw');
    server.use(
      http.get(`${BASE_URL}/documents`, () =>
        HttpResponse.json({ title: 'Service unavailable', status: 503 }, { status: 503 }),
      ),
    );

    withProvider(<Harness />);

    await waitFor(
      () => expect(screen.getByRole('alert')).toHaveTextContent('Service unavailable'),
      { timeout: 5000 },
    );
  });

  it('keeps two grids on one page independent', async () => {
    const clientA = createQueryClient();
    const clientB = createQueryClient();

    render(
      <>
        <UiRoot className="first">
          <ApiProvider config={{ baseUrl: BASE_URL }} client={clientA}>
            <Harness initial={{ ...defaultDocumentIntakeQuery, pageSize: 5 }} />
          </ApiProvider>
        </UiRoot>
        <UiRoot className="second">
          <ApiProvider config={{ baseUrl: BASE_URL }} client={clientB}>
            <Harness initial={{ ...defaultDocumentIntakeQuery, pageSize: 5, page: 2 }} />
          </ApiProvider>
        </UiRoot>
      </>,
    );

    await waitFor(() => expect(screen.queryAllByText('Loading documents…')).toHaveLength(0));

    expect(clientA.getQueryCache().getAll()).toHaveLength(1);
    expect(clientB.getQueryCache().getAll()).toHaveLength(1);
    expect(screen.getAllByRole('table')).toHaveLength(2);

    disposeQueryClient(clientA);
    disposeQueryClient(clientB);
  });
});
