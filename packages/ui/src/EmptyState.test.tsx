import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders a title and description as a status region', () => {
    render(<EmptyState title="Nothing here" description="Try clearing filters." />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('data-tone', 'empty');
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Try clearing filters.')).toBeInTheDocument();
  });

  it('announces the error tone as an alert', () => {
    render(<EmptyState tone="error" title="Load failed" />);
    expect(screen.getByRole('alert')).toHaveAttribute('data-tone', 'error');
  });

  it('renders an action when given one', () => {
    render(
      <EmptyState title="Load failed" tone="error" action={<button type="button">Retry</button>} />,
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('omits the description block entirely when there is none', () => {
    render(<EmptyState title="Only a title" />);
    expect(screen.getByRole('status').textContent).toBe('Only a title');
  });
});
