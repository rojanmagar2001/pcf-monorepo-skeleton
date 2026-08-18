import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The shipped surface of this package is bundled into a PCF control. Anything
 * that assumes Node, a bundler's define step, or code splitting would only fail
 * once it reached a model-driven app host, so it fails here instead.
 *
 * Test files and the `testing/` entry point are excluded: they never reach the
 * control bundle.
 */
// Vitest runs with the package root as cwd.
const SRC = resolve(process.cwd(), 'src');

function shippedSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'testing') continue;
      out.push(...shippedSources(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    if (/\.test\.tsx?$/.test(entry)) continue;
    out.push(full);
  }
  return out;
}

/**
 * Strip comments before matching: these rules are about emitted code, and the
 * doc comments in this package legitimately name the things they forbid.
 * `//` preceded by `:` is left alone so URLs in string literals survive.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
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
];

describe('api-client stays bundleable into a PCF control', () => {
  const files = shippedSources(SRC);

  it('finds sources to check', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const [name, pattern] of FORBIDDEN) {
    it(`contains no ${name}`, () => {
      const offenders = files
        .filter((file) => pattern.test(stripComments(readFileSync(file, 'utf8'))))
        .map((file) => file.replace(`${SRC}/`, ''));
      expect(offenders).toEqual([]);
    });
  }
});
