import type { Meta, StoryObj } from '@storybook/react-vite';
import { createPortal } from 'react-dom';
import { StatusBadge } from './StatusBadge';
import { UiRoot, useUiPortalContainer } from './UiRoot';

/**
 * `UiRoot` is already applied by the global decorator, so these stories render
 * their own nested instance to show the scoping and portal behaviour directly.
 */
const meta = {
  title: 'Intake/UiRoot',
  component: UiRoot,
  parameters: { slotWidth: 560, slotHeight: 320 },
} satisfies Meta<typeof UiRoot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Scope: Story = {
  args: {
    children: (
      <div className="di-flex di-flex-col di-gap-2">
        <p className="di-m-0 di-text-sm di-text-slate-700">
          Everything inside this element is styled by <code>.di-root</code>-scoped rules.
        </p>
        <div>
          <StatusBadge status="approved" />
        </div>
      </div>
    ),
  },
};

function PortalDemo() {
  const container = useUiPortalContainer();
  return (
    <div className="di-text-sm di-text-slate-700">
      <p className="di-m-0">Overlays mount into the control's own container, never the body.</p>
      {container
        ? createPortal(
            <div className="di-mt-2 di-rounded di-border di-border-solid di-border-slate-300 di-bg-white di-p-2 di-text-xs di-shadow">
              I am rendered through the portal host.
            </div>,
            container,
          )
        : null}
    </div>
  );
}

export const PortalHost: Story = {
  args: { children: <PortalDemo /> },
};
