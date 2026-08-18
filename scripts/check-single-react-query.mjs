/**
 * Install-time counterpart to `check-bundle.mjs`.
 *
 * Catches a duplicated peer dependency before it ever reaches a bundle, which
 * gives a far clearer error than "No QueryClient set" at runtime. React and
 * react-dom are checked for the same reason: two Reacts means two hook
 * dispatchers.
 */
import { execFileSync } from 'node:child_process';

const PACKAGES = ['@tanstack/react-query', 'react', 'react-dom'];

let failed = false;

for (const name of PACKAGES) {
  let output;
  try {
    output = execFileSync('pnpm', ['ls', name, '--recursive', '--depth', '0', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    console.error(`check-single-react-query: could not resolve ${name}`);
    failed = true;
    continue;
  }

  const projects = JSON.parse(output);
  const versions = new Set();
  for (const project of projects) {
    for (const group of ['dependencies', 'devDependencies']) {
      const entry = project[group]?.[name];
      if (entry?.version) versions.add(entry.version);
    }
  }

  if (versions.size > 1) {
    console.error(
      `check-single-react-query: ${name} resolves to ${versions.size} versions ` +
        `(${[...versions].join(', ')}). The control bundle must contain exactly one.`,
    );
    failed = true;
  } else {
    console.log(
      `check-single-react-query: ${name} @ ${[...versions][0] ?? 'unresolved'} (1 version)`,
    );
  }
}

process.exit(failed ? 1 : 0);
