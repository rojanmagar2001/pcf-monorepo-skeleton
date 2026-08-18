import type { DocumentStatus } from '@document-intake/api-client';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge, statusLabel } from './StatusBadge';

const ALL: DocumentStatus[] = ['pending', 'processing', 'needsReview', 'approved', 'rejected'];

describe('StatusBadge', () => {
  it('renders a human label for every status in the contract', () => {
    for (const status of ALL) {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(statusLabel(status))).toBeInTheDocument();
      unmount();
    }
  });

  it('exposes the raw status as a data attribute for styling and tests', () => {
    render(<StatusBadge status="needsReview" />);
    expect(screen.getByText('Needs review')).toHaveAttribute('data-status', 'needsReview');
  });

  it('always pairs a border width with an explicit border style', () => {
    // Preflight is disabled, so `border` alone renders nothing.
    render(<StatusBadge status="approved" />);
    const badge = screen.getByText('Approved');
    expect(badge.className).toContain('di-border-solid');
  });

  it('merges a caller className', () => {
    render(<StatusBadge status="pending" className="di-mt-2" />);
    expect(screen.getByText('Pending').className).toContain('di-mt-2');
  });
});
