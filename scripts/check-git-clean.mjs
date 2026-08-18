/**
 * Fails when regeneration changed a committed file.
 *
 * `src/generated/` is committed so that `pnpm build` never has to run orval -
 * pcf-scripts must not depend on codegen. The trade-off is that the committed
 * output can drift from `openapi.json`, so CI regenerates and calls this.
 */
import { execFileSync } from 'node:child_process';

const status = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();

if (status !== '') {
  console.error('check-git-clean: regeneration changed committed files:\n');
  console.error(status);
  console.error('\nRun `pnpm generate` and commit the result.');
  process.exit(1);
}

console.log('check-git-clean: working tree is clean after regeneration');
