import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from './EmptyState';

const meta = {
  title: 'Intake/EmptyState',
  component: EmptyState,
  parameters: { slotWidth: 560, slotHeight: 300 },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    title: 'Nothing in the intake queue',
    description: 'Documents appear here as soon as they are submitted.',
  },
};

export const NoSearchResults: Story = {
  args: {
    title: 'No documents match those filters',
    description: 'Try widening the status filter or clearing the search box.',
    action: (
      <button
        type="button"
        className="di-cursor-pointer di-rounded di-border di-border-solid di-border-slate-300 di-bg-white di-px-3 di-py-1 di-text-xs hover:di-bg-slate-50"
      >
        Clear filters
      </button>
    ),
  },
};

export const LoadFailed: Story = {
  args: {
    tone: 'error',
    title: 'Could not load the intake queue',
    description: 'Service unavailable (503).',
    action: (
      <button
        type="button"
        className="di-cursor-pointer di-rounded di-border di-border-solid di-border-red-300 di-bg-white di-px-3 di-py-1 di-text-xs di-text-red-800 hover:di-bg-red-100"
      >
        Try again
      </button>
    ),
  },
};
