import { acquireStyles, releaseStyles, styleRefCount } from '../documentintake/styles';

function injectedStyles(): NodeListOf<HTMLStyleElement> {
  return document.head.querySelectorAll<HTMLStyleElement>('style[data-di-styles]');
}

describe('shared stylesheet injection', () => {
  afterEach(() => {
    // Drain any leftover references so each test starts from zero.
    while (styleRefCount() > 0) releaseStyles();
    for (const style of Array.from(injectedStyles())) style.remove();
  });

  it('injects exactly one <style data-di-styles> element', () => {
    acquireStyles(document);
    expect(injectedStyles()).toHaveLength(1);
  });

  it('injects the compiled, .di-root scoped stylesheet', () => {
    acquireStyles(document);
    const css = injectedStyles()[0]?.textContent ?? '';
    expect(css.length).toBeGreaterThan(100);
    expect(css).toContain('.di-root');
    // Preflight is off: no global reset may reach the host app.
    expect(css).not.toMatch(/(^|[},])\s*\*\s*,\s*::?before/);
  });

  it('injects once for N instances and removes it only with the last', () => {
    acquireStyles(document);
    acquireStyles(document);
    acquireStyles(document);
    expect(injectedStyles()).toHaveLength(1);
    expect(styleRefCount()).toBe(3);

    releaseStyles();
    releaseStyles();
    expect(injectedStyles()).toHaveLength(1);

    releaseStyles();
    expect(injectedStyles()).toHaveLength(0);
  });

  it('never drops the reference count below zero', () => {
    releaseStyles();
    releaseStyles();
    expect(styleRefCount()).toBe(0);

    acquireStyles(document);
    expect(injectedStyles()).toHaveLength(1);
  });

  it('reuses an element another bundle already injected', () => {
    const existing = document.createElement('style');
    existing.setAttribute('data-di-styles', '');
    existing.textContent = '.di-root{}';
    document.head.appendChild(existing);

    acquireStyles(document);

    expect(injectedStyles()).toHaveLength(1);
    expect(injectedStyles()[0]).toBe(existing);
  });
});
