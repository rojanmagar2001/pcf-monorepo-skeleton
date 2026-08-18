import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table';
import { type ReactNode, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';
import { useUiPortalContainer } from './UiRoot';

/**
 * Headless data table over @tanstack/react-table v8.
 *
 * Presentation only: it renders whatever rows it is handed and reports
 * interaction back through callbacks. It performs no fetching and knows nothing
 * about the intake API - `DocumentIntakeGrid` supplies both.
 *
 * Every piece of state can be driven from outside (server-side paging and
 * sorting) or left to the table (client-side), decided per prop.
 */
export interface DataTableProps<TData> {
  data: TData[];
  /**
   * react-table's `ColumnDef` is invariant in its value type, so a list of
   * differently-typed accessor columns cannot be expressed without `any` here.
   */
  // biome-ignore lint/suspicious/noExplicitAny: see above - required by ColumnDef's variance.
  columns: ColumnDef<TData, any>[];

  /** Accessible name for the table. Required: this renders a real <table>. */
  caption: string;

  /** Total rows on the server. Provide together with `manualPagination`. */
  rowCount?: number;
  manualPagination?: boolean;
  manualSorting?: boolean;

  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;

  isLoading?: boolean;
  /** Rendered in place of the table body when there are no rows. */
  empty?: ReactNode;
  getRowId?: (row: TData, index: number) => string;
  pageSizeOptions?: number[];
  className?: string;
}

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

export function DataTable<TData>({
  data,
  columns,
  caption,
  rowCount,
  manualPagination = false,
  manualSorting = false,
  sorting,
  onSortingChange,
  pagination,
  onPaginationChange,
  columnVisibility,
  onColumnVisibilityChange,
  isLoading = false,
  empty,
  getRowId,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  className,
}: DataTableProps<TData>): JSX.Element {
  // Each piece of state falls back to being owned here when it is not driven
  // from outside, so the same component serves both modes.
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: pageSizeOptions[0] ?? 25,
  });
  const [internalVisibility, setInternalVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting: sorting ?? internalSorting,
      pagination: pagination ?? internalPagination,
      columnVisibility: columnVisibility ?? internalVisibility,
    },
    onSortingChange: onSortingChange ?? setInternalSorting,
    onPaginationChange: onPaginationChange ?? setInternalPagination,
    onColumnVisibilityChange: onColumnVisibilityChange ?? setInternalVisibility,
    manualPagination,
    manualSorting,
    rowCount: manualPagination ? rowCount : undefined,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;
  const activePagination = pagination ?? internalPagination;
  const pageCount = table.getPageCount();

  return (
    <div className={cx('di-flex di-w-full di-flex-col di-gap-2', className)}>
      <div className="di-flex di-items-center di-justify-end">
        <ColumnVisibilityMenu table={table} />
      </div>

      {/* Wide tables scroll inside their own box; the host form never does. */}
      <div className="di-w-full di-overflow-x-auto di-rounded-md di-border di-border-solid di-border-slate-200">
        <table className="di-w-full di-min-w-full di-text-left di-text-sm">
          <caption className="di-sr-only">{caption}</caption>
          <thead className="di-bg-slate-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const direction = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        !canSort || direction === false
                          ? undefined
                          : direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                      }
                      className="di-border-b di-border-solid di-border-slate-200 di-px-3 di-py-2 di-font-semibold di-text-slate-700"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="di-inline-flex di-cursor-pointer di-items-center di-gap-1 di-rounded di-px-1 hover:di-bg-slate-200"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span aria-hidden="true" className="di-text-field-xs di-text-slate-500">
                            {direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '↕'}
                          </span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="di-px-3 di-py-8 di-text-center di-text-slate-500"
                >
                  Loading documents…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={table.getVisibleLeafColumns().length} className="di-p-3">
                  {empty ?? <span className="di-text-slate-500">No rows.</span>}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="di-border-t di-border-solid di-border-slate-100 hover:di-bg-slate-50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="di-px-3 di-py-2 di-align-middle di-text-slate-800">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        pageIndex={activePagination.pageIndex}
        pageSize={activePagination.pageSize}
        pageCount={pageCount}
        rowCount={manualPagination ? (rowCount ?? 0) : data.length}
        pageSizeOptions={pageSizeOptions}
        canPrevious={table.getCanPreviousPage()}
        canNext={table.getCanNextPage()}
        onFirst={() => table.setPageIndex(0)}
        onPrevious={() => table.previousPage()}
        onNext={() => table.nextPage()}
        onLast={() => table.setPageIndex(Math.max(0, pageCount - 1))}
        onPageSize={(size) => table.setPageSize(size)}
      />
    </div>
  );
}

const CONTROL_CLASS =
  'di-cursor-pointer di-rounded di-border di-border-solid di-border-slate-300 di-bg-white ' +
  'di-px-2 di-py-1 di-text-xs di-text-slate-700 hover:di-bg-slate-50 ' +
  'disabled:di-cursor-not-allowed disabled:di-opacity-40';

interface PaginationProps {
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  rowCount: number;
  pageSizeOptions: number[];
  canPrevious: boolean;
  canNext: boolean;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLast: () => void;
  onPageSize: (size: number) => void;
}

function Pagination({
  pageIndex,
  pageSize,
  pageCount,
  rowCount,
  pageSizeOptions,
  canPrevious,
  canNext,
  onFirst,
  onPrevious,
  onNext,
  onLast,
  onPageSize,
}: PaginationProps): JSX.Element {
  const selectId = useId();
  return (
    <nav
      aria-label="Pagination"
      className="di-flex di-flex-wrap di-items-center di-justify-between di-gap-2 di-text-xs di-text-slate-600"
    >
      <div className="di-flex di-items-center di-gap-2">
        <label htmlFor={selectId}>Rows per page</label>
        <select
          id={selectId}
          value={pageSize}
          onChange={(event) => onPageSize(Number(event.target.value))}
          className="di-rounded di-border di-border-solid di-border-slate-300 di-bg-white di-px-1 di-py-1"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="di-flex di-items-center di-gap-2">
        <span aria-live="polite">
          Page {Math.min(pageIndex + 1, Math.max(pageCount, 1))} of {Math.max(pageCount, 1)} ·{' '}
          {rowCount} document{rowCount === 1 ? '' : 's'}
        </span>
        <button type="button" className={CONTROL_CLASS} onClick={onFirst} disabled={!canPrevious}>
          « First
        </button>
        <button
          type="button"
          className={CONTROL_CLASS}
          onClick={onPrevious}
          disabled={!canPrevious}
        >
          ‹ Previous
        </button>
        <button type="button" className={CONTROL_CLASS} onClick={onNext} disabled={!canNext}>
          Next ›
        </button>
        <button type="button" className={CONTROL_CLASS} onClick={onLast} disabled={!canNext}>
          Last »
        </button>
      </div>
    </nav>
  );
}

interface ColumnVisibilityMenuProps<TData> {
  table: ReturnType<typeof useReactTable<TData>>;
}

function ColumnVisibilityMenu<TData>({ table }: ColumnVisibilityMenuProps<TData>): JSX.Element {
  const [open, setOpen] = useState(false);
  const portalContainer = useUiPortalContainer();
  const menuId = useId();

  const panel = (
    <fieldset
      id={menuId}
      className={cx(
        'di-absolute di-right-0 di-top-0 di-flex di-w-56 di-flex-col di-gap-1 di-rounded-md',
        'di-border di-border-solid di-border-slate-200 di-bg-white di-p-2 di-shadow-lg',
      )}
    >
      {/* A fieldset's legend names the group for assistive tech. */}
      <legend className="di-sr-only">Toggle columns</legend>
      {table.getAllLeafColumns().map((column) => (
        <label
          key={column.id}
          className="di-flex di-cursor-pointer di-items-center di-gap-2 di-rounded di-px-1 di-py-0.5 di-text-xs hover:di-bg-slate-50"
        >
          <input
            type="checkbox"
            checked={column.getIsVisible()}
            onChange={column.getToggleVisibilityHandler()}
            disabled={!column.getCanHide()}
          />
          <span>
            {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
          </span>
        </label>
      ))}
    </fieldset>
  );

  return (
    <>
      <button
        type="button"
        className={CONTROL_CLASS}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        Columns
      </button>
      {/*
        Portals into the UiRoot's own host element, never document.body: the
        control only owns its container, and anything outside it outlives
        destroy() and loses the .di-root scope.
      */}
      {open ? (portalContainer ? createPortal(panel, portalContainer) : panel) : null}
    </>
  );
}
