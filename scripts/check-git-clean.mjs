/**
 * Fails when regeneration changed the committed generated client.
 *
 * `src/generated/` is committed so that `pnpm build` never has to run orval -
 * pcf-scripts must not depend on codegen. The trade-off is that the committed
 * output can drift from `openapi.json`, so CI regenerates and calls this.
 *
 * Only the generated tree is a failure: that is the invariant being guarded.
 * Other uncommitted work is reported but not fatal, so this stays useful to run
 * locally mid-change. In CI the checkout is clean, so the distinction is moot.
 */
import { execFileSync } from 'node:child_process';

const GENERATED = 'packages/api-client/src/generated';

const status = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line !== '');

const drifted = status.filter((line) => line.includes(GENERATED));
const other = status.filter((line) => !line.includes(GENERATED));

if (drifted.length > 0) {
  console.error('check-git-clean: the committed generated client is out of date:\n');
  for (const line of drifted) console.error(`  ${line}`);
  console.error('\nRun `pnpm generate` and commit the result.');
  process.exit(1);
}

if (other.length > 0) {
  console.log(
    `check-git-clean: ${GENERATED} is up to date ` +
      `(${other.length} unrelated uncommitted change${other.length === 1 ? '' : 's'} ignored)`,
  );
} else {
  console.log('check-git-clean: working tree is clean after regeneration');
}
