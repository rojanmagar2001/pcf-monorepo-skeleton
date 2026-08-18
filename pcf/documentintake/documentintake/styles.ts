import { uiStyles } from '@document-intake/ui/styles';

/**
 * Injects the compiled, `.di-root`-scoped stylesheet into the host document.
 *
 * A model-driven form can host several instances of this control and can
 * destroy and recreate any of them. The <style> element is therefore shared and
 * reference counted at module scope: N instances inject exactly one element,
 * and it is removed only when the last instance goes away.
 *
 * The counter is module state on purpose - it tracks a single shared DOM node,
 * not per-instance state. Everything that belongs to an instance (QueryClient,
 * React root, api config) is created per instance instead.
 */
const STYLE_ATTRIBUTE = 'data-di-styles';

let refCount = 0;
let injected: HTMLStyleElement | null = null;

export function acquireStyles(doc: globalThis.Document = document): void {
  refCount += 1;
  if (injected) return;

  // Another bundle of this control may already have injected it (for instance
  // an older version still on the form); reuse rather than duplicate.
  const existing = doc.head.querySelector<HTMLStyleElement>(`style[${STYLE_ATTRIBUTE}]`);
  if (existing) {
    injected = existing;
    return;
  }

  const style = doc.createElement('style');
  style.setAttribute(STYLE_ATTRIBUTE, '');
  style.textContent = uiStyles;
  doc.head.appendChild(style);
  injected = style;
}

export function releaseStyles(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0 || !injected) return;

  injected.parentNode?.removeChild(injected);
  injected = null;
}

/** Test-only view of the shared counter. */
export function styleRefCount(): number {
  return refCount;
}
