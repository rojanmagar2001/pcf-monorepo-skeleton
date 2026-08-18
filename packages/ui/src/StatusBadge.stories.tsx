import type { DocumentStatus } from '@document-intake/api-client';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusBadge } from './StatusBadge';

const meta = {
  title: 'Intake/StatusBadge',
  component: StatusBadge,
  parameters: { slotWidth: 420, slotHeight: 200 },
  argTypes: {
    status: {
      control: 'select',
      options: ['pending', 'processing', 'needsReview', 'approved', 'rejected'],
    },
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = { args: { status: 'pending' } };
export const Processing: Story = { args: { status: 'processing' } };
export const NeedsReview: Story = { args: { status: 'needsReview' } };
export const Approved: Story = { args: { status: 'approved' } };
export const Rejected: Story = { args: { status: 'rejected' } };

const ALL: DocumentStatus[] = ['pending', 'processing', 'needsReview', 'approved', 'rejected'];

/** Every state the generated `DocumentStatus` union allows, in one place. */
export const AllStatuses: Story = {
  args: { status: 'pending' },
  render: () => (
    <div className="di-flex di-flex-wrap di-gap-2">
      {ALL.map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </div>
  ),
};
