// Drives the v13->v14 upgrade end-to-end test.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { PACKAGE_ROOT_ABS_PATH } from '../constants.ts';

////////////////////////////////////////////////////////////////////////////////

/**
 * Runs the v13->v14 upgrade e2e end to end.
 *
 * IT CANNOT SKIP, and that is the point. It used to: v13 had to be present, installed, built and
 * packed into an aliased consumer fixture before the test could import it, and each of those could
 * fail in a way that printed a line and exited 0. A publish-contract test that can silently not run
 * is worse than not having it — it reports success for work it never did.
 *
 * What removed the skip was not a stricter check but a simpler dependency. v13 is a WORKSPACE MEMBER,
 * so `npm install` links it and the test imports it like any other package
 * (`@fhevm/host-contracts-cleartext-v13-dev/pkg/ts/index.ts`). There is no build, no pack, no install
 * and therefore no "v13 unavailable" state left to detect. If that specifier does not resolve, the
 * workspace itself is broken, and vitest fails loudly — which is the correct outcome.
 *
 * The v14 side reads `pkg/ts` directly. Consuming the PUBLISHED artifact is the test-consumer
 * fixtures' job, and they do it against a physically installed copy rather than an extracted tarball.
 *
 * Calls process.exit directly rather than returning a status: a failed child process's code has to
 * reach the caller unchanged.
 */
export function runUpgradeE2e(): void {
  function run(command: string, args: readonly string[]): void {
    const result = spawnSync(command, args, { cwd: PACKAGE_ROOT_ABS_PATH, encoding: 'utf8', stdio: 'inherit' });
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }

  // Generation is a separate flow (`make generate`), never a step of a test: it rewrites tracked files
  // that are build inputs, which leaves every build stamp stale. Compiled output only, from here —
  // `compile`, not `build`, which is the fmt+lint sweep.
  run('npm', ['run', 'compile']);

  const SUITE = join(PACKAGE_ROOT_ABS_PATH, 'test', 'ts', 'upgrade');
  run('tsc', ['--project', join(SUITE, 'tsconfig.json'), '--noEmit']);
  run('vitest', ['run', '--config', join(SUITE, 'vitest.config.ts')]);
}
