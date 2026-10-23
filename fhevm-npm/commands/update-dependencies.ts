import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

import { defaultLockfileReader } from '../base/checks/pinned-dependencies.ts';
import type { CommandReport, Violation } from '../base/diagnostics.ts';
import { loadPackages, readPackageJson } from '../base/npm.ts';
import { type PackumentFetch, fetchPackument, fetchPackuments, hoursAgo } from '../base/registry-age.ts';
import { applyPinnedEdits } from '../base/sync-pinned.ts';
import { type NpmRunner, regenerateTestConsumerPackageLocks, runNpm } from '../base/test-consumer.ts';
import {
  type UpdateTarget,
  floorLockMismatches,
  planFloorUpdates,
  updatableNames,
  updateTargets,
} from '../base/update-dependencies.ts';
import type { Verbosity } from '../base/verbosity.ts';
import type { NpmManifest } from '../manifest.ts';

export async function updateDependenciesCommand(
  options: {
    readonly workspaceRoot: string;
    readonly manifest: NpmManifest;
    readonly minAgeHours: number;
    readonly dryRun: boolean;
    readonly verbosity: Verbosity;
  },
  fetchOne: PackumentFetch = fetchPackument,
  runner: NpmRunner = runNpm,
): Promise<CommandReport> {
  const cutoff = hoursAgo(options.minAgeHours);
  const before = `--before=${cutoff.toISOString()}`;
  const targets = loadTargets(options.workspaceRoot, options.manifest);
  const packuments = await fetchPackuments(updatableNames(options.manifest, targets), fetchOne);
  const plan = planFloorUpdates(options.manifest, targets, packuments, cutoff);
  const command = options.dryRun ? 'update dependencies --dry-run' : 'update dependencies';
  const base = {
    command,
    checkedPackageKeys: targets.map((target) => target.key),
    checkedItemLabel: 'package.json file(s)',
  };

  console.log(`📅 Newest in-range versions published before ${cutoff.toISOString()} (${options.minAgeHours}h ago)`);
  for (const edit of plan.edits) {
    console.log(`✏️  ${edit.packageKey}: '${edit.name}' in '${edit.field}' "${edit.from}" -> "${edit.to}"`);
  }
  const notes = plan.held.map(
    (hold) => `${hold.packageKey}: '${hold.name}' "${hold.spec}" in '${hold.field}' left as is: ${hold.reason}`,
  );
  if (options.dryRun) return { ...base, notes, violations: [] };

  if (plan.edits.length > 0) notes.push("lockfiles regenerated: review the diff, then run 'make install-ci'");
  applyPinnedEdits(plan.edits);

  // npm locks what the new floors reach, and nothing younger than the cutoff: a locked version that still
  // satisfies its range stays, so only the moved floors and their new subtrees are resolved.
  const installArgs = ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund', before];
  const roots = [...new Set(plan.edits.filter((edit) => !edit.isolatedConsumer).map((edit) => edit.lockRoot))];
  for (const root of roots.sort()) {
    console.log(`🔒 npm install --package-lock-only ${before} (${relative(options.workspaceRoot, root) || '.'})`);
    runner(root, installArgs, options.verbosity);
  }
  // A consumer fixture is locked by fhevm-npm, never by `npm install` in place; its install gets the same cutoff.
  const beforeRunner: NpmRunner = (directory, args, verbosity) =>
    runner(directory, args[0] === 'install' ? [...args, before] : args, verbosity);
  const consumers = [...new Set(plan.edits.filter((edit) => edit.isolatedConsumer).map((edit) => edit.packageKey))].map(
    (packageKey) => packageKey.slice(0, -'/package.json'.length),
  );
  for (const consumer of consumers.sort()) {
    regenerateTestConsumerPackageLocks(
      {
        workspaceRoot: options.workspaceRoot,
        manifest: options.manifest,
        packageSelector: consumer,
        verbosity: options.verbosity,
      },
      beforeRunner,
    );
  }

  // The pass that makes the edit honest: every in-scope floor now names the version its lockfile installs.
  const violations: Violation[] = floorLockMismatches(
    options.manifest,
    loadTargets(options.workspaceRoot, options.manifest),
    defaultLockfileReader,
  ).map((mismatch) => ({
    rule: 'update',
    packageKey: mismatch.packageKey,
    message: `'${mismatch.name}' in '${mismatch.field}' is "${mismatch.spec}" but the lockfile installs ${mismatch.locked}: a version locked earlier is younger than ${options.minAgeHours}h. Run again once it is older, or with a lower --min-age-hours`,
  }));
  return { ...base, notes, violations };
}

/** Every package.json the update covers, fhevm-npm's own included, read fresh from disk. */
function loadTargets(workspaceRoot: string, manifest: NpmManifest): readonly UpdateTarget[] {
  const toolDirectory = join(workspaceRoot, 'fhevm-npm');
  const toolPackage = existsSync(join(toolDirectory, 'package-lock.json'))
    ? { directory: toolDirectory, packageJson: readPackageJson(join(toolDirectory, 'package.json')) }
    : undefined;
  return updateTargets(loadPackages(workspaceRoot, manifest), toolPackage);
}
