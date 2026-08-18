/**
 * `@document-intake/ui`
 *
 * Presentation and Tailwind styles only. This package declares no DTOs of its
 * own - every domain type comes from `@document-intake/api-client` - and it
 * imports no CSS, so nothing here can pull a loader into the PCF build.
 *
 * The compiled stylesheet is a separate entry point: `@document-intake/ui/styles`.
 */
export { type ClassValue, cx } from './cx';
export { DataTable, type DataTableProps } from './DataTable';
export {
  DocumentIntakeGrid,
  type DocumentIntakeGridProps,
  DocumentIntakeGridView,
  type DocumentIntakeGridViewProps,
  type DocumentIntakeQuery,
  defaultDocumentIntakeQuery,
  documentColumns,
} from './DocumentIntakeGrid';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { StatusBadge, type StatusBadgeProps, statusLabel } from './StatusBadge';
export { UiRoot, type UiRootProps, useUiPortalContainer } from './UiRoot';
