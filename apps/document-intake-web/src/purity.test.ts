import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * This package is no longer only a dev harness: `src/index.ts` is bundled
 * straight into the shipped PCF control, so everything reachable from it lives
 * under the same constraints as `packages/ui`.
 *
 * The hazard specific to this package is MSW. `main.tsx` and the tests import
 * `mocks/*` quite legitimately; if the library entry ever reached them, the
 * mock service worker and its handler table would ship inside the control and
 * intercept the host's own requests. So this test walks the real import graph
 * from `src/index.ts` rather than scanning the folder, and asserts what that
 * graph does *not* contain.
 */
const SRC = resolve(process.cwd(), 'src');
const ENTRY = resolve(SRC, 'index.ts');

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Every module specifier in a file, from static imports, re-exports and `import()`. */
function specifiers(source: string): string[] {
  const out: string[] = [];
  const pattern = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;
  let match = pattern.exec(source);
  while (match) {
    if (match[1]) out.push(match[1]);
    match = pattern.exec(source);
  }
  return out;
}

function resolveRelative(from: string, specifier: string): string | null {
  const base = resolve(dirname(from), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    if (existsSync(candidate) && !candidate.endsWith('/')) return candidate;
  }
  return null;
}

/** Files reachable from the library entry, plus the bare specifiers they pull in. */
function walk(): { files: string[]; bare: Set<string> } {
  const files: string[] = [];
  const bare = new Set<string>();
  const seen = new Set<string>();
  const queue = [ENTRY];

  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    files.push(file);

    for (const specifier of specifiers(stripComments(readFileSync(file, 'utf8')))) {
      if (!specifier.startsWith('.')) {
        bare.add(specifier);
        continue;
      }
      const resolved = resolveRelative(file, specifier);
      if (resolved) queue.push(resolved);
    }
  }

  return { files, bare };
}

const FORBIDDEN: [name: string, pattern: RegExp][] = [
  ['process.env', /process\s*\.\s*env/],
  ['import.meta.env', /import\s*\.\s*meta\s*\.\s*env/],
  ['node: built-in import', /from\s+['"]node:/],
  ['dynamic import()', /(?<![.\w])import\s*\(/],
  ['React.lazy', /React\.lazy|\blazy\s*\(/],
  ['axios', /['"]axios['"]/],
  ['new Worker', /new\s+Worker\s*\(/],
  ['side-effect css import', /import\s+['"][^'"]+\.css['"]/],
  ['top-level await', /^await\s/m],
];

/** Bare specifiers the control bundle is allowed to see from this entry. */
const ALLOWED_BARE = new Set([
  'react',
  'react-dom',
  'react/jsx-runtime',
  '@tanstack/react-query',
  '@document-intake/ui',
  '@document-intake/api-client',
]);

describe('the library entry stays bundleable into a PCF control', () => {
  const { files, bare } = walk();
  const rel = (file: string) => relative(SRC, file);

  it('reaches the shell', () => {
    expect(files.map(rel)).toContain('App.tsx');
  });

  it('never reaches the MSW harness', () => {
    // `main.tsx` and `mocks/*` exist to serve the SPA. If either turns up here,
    // the service worker ships inside the control.
    const offenders = files
      .map(rel)
      .filter((file) => file === 'main.tsx' || file.startsWith('mocks/'));
    expect(offenders).toEqual([]);
    expect([...bare].filter((s) => s === 'msw' || s.startsWith('msw/'))).toEqual([]);
  });

  it('imports nothing outside the control bundle’s dependency set', () => {
    expect([...bare].filter((s) => !ALLOWED_BARE.has(s)).sort()).toEqual([]);
  });

  for (const [name, pattern] of FORBIDDEN) {
    it(`contains no ${name}`, () => {
      const offenders = files
        .filter((file) => pattern.test(stripComments(readFileSync(file, 'utf8'))))
        .map(rel);
      expect(offenders).toEqual([]);
    });
  }
});
