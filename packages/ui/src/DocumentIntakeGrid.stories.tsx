import {
  createDocumentFixtures,
  createDocumentIntakeMocks,
} from '@document-intake/api-client/testing';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { useState } from 'react';
import { STORYBOOK_BASE_URL } from '../.storybook/mocks';
import {
  DocumentIntakeGrid,
  DocumentIntakeGridView,
  type DocumentIntakeQuery,
  defaultDocumentIntakeQuery,
} from './DocumentIntakeGrid';

const fixtures = createDocumentFixtures();

const meta = {
  title: 'Intake/DocumentIntakeGrid',
  component: DocumentIntakeGridView,
  parameters: { slotWidth: 1000, slotHeight: 560 },
} satisfies Meta<typeof DocumentIntakeGridView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pure presentation: rows passed straight in, no network involved. */
export const Populated: Story = {
  args: {
    documents: fixtures.slice(0, 10),
    total: fixtures.length,
    query: { ...defaultDocumentIntakeQuery, pageSize: 10 },
    onQueryChange: () => undefined,
  },
};

export const Loading: Story = {
  args: {
    documents: [],
    total: 0,
    isLoading: true,
    query: defaultDocumentIntakeQuery,
    onQueryChange: () => undefined,
  },
};

export const Empty: Story = {
  args: {
    documents: [],
    total: 0,
    query: defaultDocumentIntakeQuery,
    onQueryChange: () => undefined,
  },
};

export const LoadFailed: Story = {
  args: {
    documents: [],
    total: 0,
    errorMessage: 'Service unavailable (503).',
    query: defaultDocumentIntakeQuery,
    onQueryChange: () => undefined,
    onRetry: () => undefined,
  },
};

function LiveGrid({ initial }: { initial?: DocumentIntakeQuery }) {
  const [query, setQuery] = useState(initial ?? { ...defaultDocumentIntakeQuery, pageSize: 10 });
  return <DocumentIntakeGrid query={query} onQueryChange={setQuery} />;
}

/**
 * Data-backed: the connected grid talking to the MSW handlers derived from
 * `openapi.json`. Paging and sorting round-trip through the mock API, so this
 * story exercises the same code path the control runs in production.
 */
export const LiveAgainstMockApi: Story = {
  args: {
    documents: [],
    total: 0,
    query: defaultDocumentIntakeQuery,
    onQueryChange: () => undefined,
  },
  render: () => <LiveGrid />,
};

/** The same live grid, but the API is failing. */
export const LiveServerError: Story = {
  args: {
    documents: [],
    total: 0,
    query: defaultDocumentIntakeQuery,
    onQueryChange: () => undefined,
  },
  parameters: {
    msw: {
      handlers: [
        http.get(`${STORYBOOK_BASE_URL}/documents`, () =>
          HttpResponse.json({ title: 'Service unavailable', status: 503 }, { status: 503 }),
        ),
        ...createDocumentIntakeMocks({ baseUrl: STORYBOOK_BASE_URL }).handlers,
      ],
    },
  },
  render: () => <LiveGrid />,
};
