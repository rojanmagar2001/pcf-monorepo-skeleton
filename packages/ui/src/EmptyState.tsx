import type { ReactNode } from 'react';
import { cx } from './cx';

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  /** Rendered beneath the description, e.g. a "clear filters" button. */
  action?: ReactNode;
  /** Renders the error styling; use for a failed load rather than an empty result. */
  tone?: 'empty' | 'error';
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  tone = 'empty',
  className,
}: EmptyStateProps): JSX.Element {
  const isError = tone === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={cx(
        'di-flex di-flex-col di-items-center di-justify-center di-gap-2',
        'di-rounded-md di-border di-border-solid di-border-dashed di-px-6 di-py-10 di-text-center',
        isError ? 'di-border-red-300 di-bg-red-50' : 'di-border-slate-300 di-bg-slate-50',
        className,
      )}
      data-tone={tone}
    >
      <p
        className={cx(
          'di-m-0 di-text-sm di-font-semibold',
          isError ? 'di-text-red-800' : 'di-text-slate-800',
        )}
      >
        {title}
      </p>
      {description ? (
        <div className={cx('di-text-xs', isError ? 'di-text-red-700' : 'di-text-slate-600')}>
          {description}
        </div>
      ) : null}
      {action ? <div className="di-mt-1">{action}</div> : null}
    </div>
  );
}
