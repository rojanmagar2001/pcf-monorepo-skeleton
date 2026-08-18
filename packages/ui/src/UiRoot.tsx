import { createContext, type ReactNode, useContext, useState } from 'react';
import { cx } from './cx';

/**
 * The element overlays portal into.
 *
 * Never `document.body`: a PCF control only owns its own container div, and
 * anything escaping it survives the host destroying the control, inherits none
 * of the `.di-root` scoping, and leaks between instances.
 */
const PortalContainerContext = createContext<HTMLElement | null>(null);

/**
 * The container every portal in this library mounts into. `null` until the
 * root has laid out, so callers should render inline until it resolves.
 */
export function useUiPortalContainer(): HTMLElement | null {
  return useContext(PortalContainerContext);
}

export interface UiRootProps {
  children: ReactNode;
  /** Extra classes for the scope element itself. */
  className?: string;
  /** Marks the subtree as busy for assistive tech while data loads. */
  busy?: boolean;
}

/**
 * Establishes the `.di-root` scope.
 *
 * Every generated utility is emitted as `.di-root <utility>`, so components
 * only pick up styling beneath this element. The control and the web app both
 * mount through it, which is what keeps the two renderings identical.
 *
 * Note the inner wrapper: because `important: '.di-root'` makes utilities
 * *descendant* selectors, the scope element itself cannot be styled by them.
 */
export function UiRoot({ children, className, busy }: UiRootProps): JSX.Element {
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);

  return (
    <div className={cx('di-root', className)} data-di-root="">
      <PortalContainerContext.Provider value={portalHost}>
        <div className="di-flex di-h-full di-w-full di-flex-col" aria-busy={busy || undefined}>
          {children}
        </div>
        {/*
          Portal host is a sibling of the content so overlays stack above it
          without a stacking-context fight, but is still inside `.di-root`.
        */}
        <div ref={setPortalHost} data-di-portal-host="" className="di-relative di-z-50" />
      </PortalContainerContext.Provider>
    </div>
  );
}
