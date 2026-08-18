import { createDocumentFixtures } from '@document-intake/api-client/testing';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { createColumnHelper } from '@tanstack/react-table';
import type { ComponentType } from 'react';
import { DataTable, type DataTableProps } from './DataTable';
import { EmptyState } from './EmptyState';
import { StatusBadge } from './StatusBadge';

const fixtures = createDocumentFixtures(23);
const helper = createColumnHelper<(typeof fixtures)[number]>();

const columns = [
  helper.accessor('fileName', { id: 'fileName', header: 'File name', enableHiding: false }),
  helper.accessor('status', {
    id: 'status',
    header: 'Status',
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  helper.accessor('submittedBy', { id: 'submittedBy', header: 'Submitted by' }),
  helper.accessor('sizeBytes', {
    id: 'sizeBytes',
    header: 'Size',
    cell: (info) => `${(info.getValue() / 1024).toFixed(1)} KB`,
  }),
];

type Row = (typeof fixtures)[number];

// Annotated rather than `satisfies`: `DataTable` is generic, so letting
// Storybook infer the component's props would resolve TData to `unknown` and
// reject the typed column defs below.
const meta: Meta<DataTableProps<Row>> = {
  title: 'Intake/DataTable',
  component: DataTable as ComponentType<DataTableProps<Row>>,
  parameters: { slotWidth: 900, slotHeight: 520 },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Client-side sorting, paging and column visibility, all owned by the table. */
export const ClientSide: Story = {
  args: {
    caption: 'Documents',
    data: fixtures,
    columns,
    pageSizeOptions: [10, 25, 50],
  },
};

export const Loading: Story = {
  args: { caption: 'Documents', data: [], columns, isLoading: true },
};

export const Empty: Story = {
  args: {
    caption: 'Documents',
    data: [],
    columns,
    empty: <EmptyState title="No documents" description="Nothing has been submitted yet." />,
  },
};

/** Paging driven from outside, as the intake grid does against the API. */
export const ServerDriven: Story = {
  args: {
    caption: 'Documents',
    data: fixtures.slice(0, 10),
    columns,
    manualPagination: true,
    manualSorting: true,
    rowCount: 137,
    pagination: { pageIndex: 0, pageSize: 10 },
    sorting: [{ id: 'fileName', desc: false }],
  },
};

/** A deliberately narrow slot: the table scrolls inside its own box. */
export const NarrowFieldSlot: Story = {
  parameters: { slotWidth: 420, slotHeight: 420 },
  args: { caption: 'Documents', data: fixtures.slice(0, 8), columns, pageSizeOptions: [5, 10] },
};
