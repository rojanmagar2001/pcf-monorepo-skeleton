/**
 * Verifies the built PCF bundle against the constraints of a model-driven app
 * host. Run as the last step of `pnpm build`.
 *
 * These are the failures that are cheap to catch here and expensive to catch in
 * production: a dynamic import the PCF runtime cannot load, a `process.env`
 * reference no bundler replaced, axios arriving through a transitive
 * dependency, or - worst of the four - a second copy of @tanstack/react-query,
 * which produces two QueryClientProvider contexts and a control that throws
 * "No QueryClient set" at runtime.
 *
 * It checks the *production* bundle deliberately. That is the artifact a
 * solution ships, and being minified it carries no comments, so these patterns
 * can be matched against the source as-is. Scanning a development build would
 * mean stripping comments first, and a `//` inside one of the embedded module
 * strings makes that unreliable enough to hide a real violation.
 */
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const BUNDLE = resolve(process.cwd(), 'pcf/documentintake/out/controls/documentintake/bundle.js');

let code;
try {
  code = readFileSync(BUNDLE, 'utf8');
} catch {
  console.error(
    `check-bundle: no bundle at ${BUNDLE}.\n` +
      'Either the build has not run, or it ran and failed: pcf-scripts exits 0 even ' +
      'when webpack fails to compile, so the control build clears out/ first and a ' +
      'missing bundle here is how that failure surfaces. Check the build log above.',
  );
  process.exit(1);
}

// Refuse to certify a development build: it carries all of its dependencies'
// comments, so a clean result would not mean what it appears to.
const blockComments = (code.match(/\/\*/g) ?? []).length;
const lineCount = code.split('\n').length;
if (blockComments > 50 || lineCount > 1000) {
  console.error(
    'check-bundle: this looks like a development bundle ' +
      `(${blockComments} block comments across ${lineCount} lines). ` +
      'These checks only certify the production build - run `pnpm build`.',
  );
  process.exit(1);
}

const FORBIDDEN = [
  { name: 'dynamic import()', re: /(?<![.\w$])import\s*\(/g },
  { name: 'process.env reference', re: /process\s*\.\s*env/g },
  { name: 'axios', re: /\baxios\b/g },
  { name: 'web worker', re: /new\s+Worker\s*\(/g },
  { name: 'top-level await', re: /^await\s/gm },
  // `@document-intake/web` is both the dev harness and the control's shell, so
  // MSW is one bad import away from shipping. In the control it would install a
  // service worker over the host's own requests.
  { name: 'MSW mock transport', re: /mockServiceWorker|\[MSW\]/g },
];

const failures = [];

for (const { name, re } of FORBIDDEN) {
  const matches = code.match(re);
  if (matches) failures.push(`${matches.length}x ${name}`);
}

// One copy of react-query, identified by an error string it always ships.
const reactQueryCopies = (
  code.match(/No QueryClient set, use QueryClientProvider to set one/g) ?? []
).length;
if (reactQueryCopies !== 1) {
  failures.push(
    `expected exactly 1 copy of @tanstack/react-query, found ${reactQueryCopies}. ` +
      'Two copies give two provider contexts and break every hook.',
  );
}

// The scoped stylesheet must be inlined - it is the only styling the control gets.
if (!code.includes('di-root')) {
  failures.push('the .di-root scoped stylesheet is not present in the bundle');
}

if (failures.length > 0) {
  console.error('check-bundle: bundle violates PCF host constraints:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

const sizeKb = statSync(BUNDLE).size / 1024;
console.log(
  `check-bundle: OK (${sizeKb.toFixed(0)} kB, single chunk, 1x react-query, ` +
    'no dynamic import / process.env / axios / worker)',
);
