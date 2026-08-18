import { createColumnHelper } from '@tanstack/react-table';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DataTable } from './DataTable';
import { UiRoot } from './UiRoot';

interface Row {
  id: string;
  name: string;
  size: number;
}

const rows: Row[] = [
  { id: 'a', name: 'charlie.pdf', size: 30 },
  { id: 'b', name: 'alpha.pdf', size: 10 },
  { id: 'c', name: 'bravo.pdf', size: 20 },
];

const helper = createColumnHelper<Row>();
const columns = [
  helper.accessor('name', { id: 'name', header: 'Name', enableHiding: false }),
  helper.accessor('size', { id: 'size', header: 'Size' }),
];

function renderTable(props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) {
  return render(
    <UiRoot>
      <DataTable caption="Test table" data={rows} columns={columns} {...props} />
    </UiRoot>,
  );
}

function bodyRowNames(): string[] {
  const table = screen.getByRole('table');
  const body = table.querySelector('tbody') as HTMLElement;
  return within(body)
    .getAllByRole('row')
    .map((row) => (row.querySelector('td') as HTMLElement).textContent ?? '');
}

describe('DataTable', () => {
  it('renders an accessible table with a caption and one row per record', () => {
    renderTable();
    expect(screen.getByRole('table', { name: 'Test table' })).toBeInTheDocument();
    expect(bodyRowNames()).toEqual(['charlie.pdf', 'alpha.pdf', 'bravo.pdf']);
  });

  it('sorts client-side and reflects direction via aria-sort', async () => {
    const user = userEvent.setup();
    renderTable();

    const header = screen.getByRole('columnheader', { name: /Name/ });
    expect(header).not.toHaveAttribute('aria-sort');

    await user.click(within(header).getByRole('button'));
    expect(header).toHaveAttribute('aria-sort', 'ascending');
    expect(bodyRowNames()).toEqual(['alpha.pdf', 'bravo.pdf', 'charlie.pdf']);

    await user.click(within(header).getByRole('button'));
    expect(header).toHaveAttribute('aria-sort', 'descending');
    expect(bodyRowNames()).toEqual(['charlie.pdf', 'bravo.pdf', 'alpha.pdf']);
  });

  it('reports sorting outward instead of sorting itself when manual', async () => {
    const user = userEvent.setup();
    const onSortingChange = vi.fn();
    renderTable({ manualSorting: true, sorting: [], onSortingChange });

    await user.click(
      within(screen.getByRole('columnheader', { name: /Name/ })).getByRole('button'),
    );

    expect(onSortingChange).toHaveBeenCalledOnce();
    // Order is untouched: the server owns it.
    expect(bodyRowNames()).toEqual(['charlie.pdf', 'alpha.pdf', 'bravo.pdf']);
  });

  it('hides a column through the visibility menu', async () => {
    const user = userEvent.setup();
    renderTable();

    expect(screen.getByRole('columnheader', { name: /Size/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Columns' }));
    await user.click(screen.getByRole('checkbox', { name: 'Size' }));

    expect(screen.queryByRole('columnheader', { name: /Size/ })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument();
  });

  it('does not let a non-hideable column be switched off', async () => {
    const user = userEvent.setup();
    renderTable();
    await user.click(screen.getByRole('button', { name: 'Columns' }));
    expect(screen.getByRole('checkbox', { name: 'Name' })).toBeDisabled();
  });

  it('renders the visibility menu inside the UiRoot portal host', async () => {
    const user = userEvent.setup();
    const { container } = renderTable();
    await user.click(screen.getByRole('button', { name: 'Columns' }));

    const menu = screen.getByRole('group', { name: 'Toggle columns' });
    expect(menu.closest('[data-di-portal-host]')).not.toBeNull();
    expect(container.contains(menu)).toBe(true);
  });

  it('pages client-side', async () => {
    const user = userEvent.setup();
    renderTable({ pageSizeOptions: [2, 10] });

    expect(bodyRowNames()).toHaveLength(2);
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(bodyRowNames()).toHaveLength(1);
    expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled();
  });

  it('uses the server row count when pagination is manual', () => {
    renderTable({
      manualPagination: true,
      rowCount: 137,
      pagination: { pageIndex: 0, pageSize: 25 },
    });
    expect(screen.getByText(/137 documents/)).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 6/)).toBeInTheDocument();
  });

  it('reports page changes outward when pagination is manual', async () => {
    const user = userEvent.setup();
    const onPaginationChange = vi.fn();
    renderTable({
      manualPagination: true,
      rowCount: 137,
      pagination: { pageIndex: 0, pageSize: 25 },
      onPaginationChange,
    });

    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(onPaginationChange).toHaveBeenCalledOnce();
  });

  it('shows a loading row instead of an empty table while fetching', () => {
    renderTable({ data: [], isLoading: true });
    expect(screen.getByText('Loading documents…')).toBeInTheDocument();
  });

  it('renders the empty slot when there are no rows', () => {
    renderTable({ data: [], empty: <span>Nothing to see</span> });
    expect(screen.getByText('Nothing to see')).toBeInTheDocument();
  });

  it('lets page size be changed', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 2 });
      return (
        <UiRoot>
          <DataTable
            caption="Test table"
            data={rows}
            columns={columns}
            pageSizeOptions={[2, 10]}
            pagination={pagination}
            onPaginationChange={setPagination}
          />
        </UiRoot>
      );
    }
    render(<Controlled />);

    expect(bodyRowNames()).toHaveLength(2);
    await user.selectOptions(screen.getByLabelText('Rows per page'), '10');
    expect(bodyRowNames()).toHaveLength(3);
  });
});
