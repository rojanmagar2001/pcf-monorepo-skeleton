import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `packages/ui` is bundled straight into the PCF control, so it must stay free
 * of anything that assumes Node, a bundler define step, code splitting, or a
 * CSS loader. A side-effect `import './x.css'` in particular would drag postcss
 * into pcf-scripts' webpack build, which is exactly what the out-of-band
 * stylesheet exists to avoid.
 */
const SRC = resolve(process.cwd(), 'src');

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Drop import statements so importing a type is not mistaken for declaring one. */
function stripImports(source: string): string {
  return source.replace(/import\s[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
}

function shippedSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'styles') continue;
      out.push(...shippedSources(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    if (/\.(test|stories)\.tsx?$/.test(entry)) continue;
    out.push(full);
  }
  return out;
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

describe('ui stays bundleable into a PCF control', () => {
  const files = shippedSources(SRC);

  it('finds sources to check', () => {
    expect(files.length).toBeGreaterThan(4);
  });

  for (const [name, pattern] of FORBIDDEN) {
    it(`contains no ${name}`, () => {
      const offenders = files
        .filter((file) => pattern.test(stripComments(readFileSync(file, 'utf8'))))
        .map((file) => file.replace(`${SRC}/`, ''));
      expect(offenders).toEqual([]);
    });
  }

  it('portals only ever target the UiRoot container, never document.body', () => {
    const offenders = files
      .filter((file) => /createPortal\s*\([^)]*document\.body/.test(readFileSync(file, 'utf8')))
      .map((file) => file.replace(`${SRC}/`, ''));
    expect(offenders).toEqual([]);
  });

  it('declares no DTO of its own - domain types come from api-client', () => {
    // A hand-written `interface Document`/`type DocumentStatus` here would
    // duplicate what the generated schema already infers.
    const offenders = files
      .filter((file) =>
        /\b(interface|type)\s+(Document|DocumentStatus|DocumentPage|DocumentMetadata)\b\s*[={<]/.test(
          stripImports(stripComments(readFileSync(file, 'utf8'))),
        ),
      )
      .map((file) => file.replace(`${SRC}/`, ''));
    expect(offenders).toEqual([]);
  });
});
