import { render, screen } from '@testing-library/react';
import { createPortal } from 'react-dom';
import { describe, expect, it } from 'vitest';
import { UiRoot, useUiPortalContainer } from './UiRoot';

function Overlay() {
  const container = useUiPortalContainer();
  return container ? createPortal(<div data-testid="overlay">overlay</div>, container) : null;
}

describe('UiRoot', () => {
  it('establishes the .di-root scope the stylesheet is compiled against', () => {
    const { container } = render(<UiRoot>content</UiRoot>);
    const root = container.querySelector('[data-di-root]');
    expect(root).not.toBeNull();
    expect(root?.classList.contains('di-root')).toBe(true);
  });

  it('renders children inside a descendant, not on the scope element itself', () => {
    // `important: '.di-root'` makes utilities descendant selectors, so the
    // scope element can never be styled by them.
    const { container } = render(<UiRoot>content</UiRoot>);
    const root = container.querySelector('[data-di-root]') as HTMLElement;
    expect(root.firstElementChild?.className).toContain('di-flex');
    expect(root.textContent).toContain('content');
  });

  it('mounts portals inside its own container rather than document.body', () => {
    const { container } = render(
      <UiRoot>
        <Overlay />
      </UiRoot>,
    );

    const overlay = screen.getByTestId('overlay');
    expect(container.contains(overlay)).toBe(true);
    expect(overlay.closest('[data-di-root]')).not.toBeNull();
    expect(overlay.parentElement).toHaveAttribute('data-di-portal-host');
    // Nothing escaped to the body.
    expect(document.body.querySelector(':scope > [data-testid="overlay"]')).toBeNull();
  });

  it('keeps two instances isolated from one another', () => {
    const { container } = render(
      <>
        <UiRoot className="first">
          <Overlay />
        </UiRoot>
        <UiRoot className="second">
          <Overlay />
        </UiRoot>
      </>,
    );

    const hosts = container.querySelectorAll('[data-di-portal-host]');
    expect(hosts).toHaveLength(2);
    for (const host of hosts) {
      expect(host.querySelector('[data-testid="overlay"]')).not.toBeNull();
    }
  });

  it('marks the subtree busy for assistive tech while loading', () => {
    const { container } = render(<UiRoot busy>content</UiRoot>);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});
