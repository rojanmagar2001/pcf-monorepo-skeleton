import type { DocumentStatus } from '@document-intake/api-client';
import { cx } from './cx';

/**
 * Presentational only. The `DocumentStatus` union comes from the generated
 * schema, so adding a status to `openapi.json` breaks this file at compile
 * time rather than silently rendering an unlabelled badge.
 */
const PRESENTATION: Record<DocumentStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'di-border-slate-300 di-bg-slate-100 di-text-slate-700',
  },
  processing: {
    label: 'Processing',
    className: 'di-border-sky-300 di-bg-sky-50 di-text-sky-800',
  },
  needsReview: {
    label: 'Needs review',
    className: 'di-border-amber-300 di-bg-amber-50 di-text-amber-800',
  },
  approved: {
    label: 'Approved',
    className: 'di-border-green-300 di-bg-green-50 di-text-green-800',
  },
  rejected: {
    label: 'Rejected',
    className: 'di-border-red-300 di-bg-red-50 di-text-red-800',
  },
};

export interface StatusBadgeProps {
  status: DocumentStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps): JSX.Element {
  const presentation = PRESENTATION[status];
  return (
    <span
      // `di-border-solid` is explicit: preflight is off, so a width alone
      // would render nothing.
      className={cx(
        'di-inline-flex di-items-center di-rounded-full di-border di-border-solid',
        'di-px-2 di-py-0.5 di-text-field-xs di-font-medium di-whitespace-nowrap',
        presentation.className,
        className,
      )}
      data-status={status}
    >
      {presentation.label}
    </span>
  );
}

/** The human-readable label for a status, for use outside a badge. */
export function statusLabel(status: DocumentStatus): string {
  return PRESENTATION[status].label;
}
