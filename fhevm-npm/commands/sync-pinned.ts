import { packageJsonKey } from '../base/checks/package-names.ts';
import type { CommandReport } from '../base/diagnostics.ts';
import { loadPackages } from '../base/npm.ts';
import { applyPinnedEdits, planPinnedSync } from '../base/sync-pinned.ts';
import type { NpmManifest } from '../manifest.ts';

export function syncPinnedCommand(options: {
  readonly workspaceRoot: string;
  readonly manifest: NpmManifest;
  readonly check: boolean;
}): CommandReport {
  const packages = loadPackages(options.workspaceRoot, options.manifest);
  const edits = planPinnedSync(options.manifest, packages);
  const command = options.check ? 'sync pinned --check' : 'sync pinned';
  const base = { command, checkedPackageKeys: packages.map(packageJsonKey), checkedItemLabel: 'package.json file(s)' };

  if (options.check) {
    return {
      ...base,
      violations: edits.map((edit) => ({
        rule: '3.3.4',
        packageKey: edit.packageKey,
        message: `'${edit.name}' in '${edit.field}' is "${edit.from}"; npm-manifest.json#dependencies.pinned requires "${edit.to}". Run 'fhevm-npm sync pinned'`,
      })),
    };
  }

  applyPinnedEdits(edits);
  for (const edit of edits) {
    console.log(`✏️  ${edit.packageKey}: '${edit.name}' in '${edit.field}' "${edit.from}" -> "${edit.to}"`);
  }
  return {
    ...base,
    // Writing package.json leaves every lockfile that copies these specs stale until npm regenerates it.
    notes:
      edits.length > 0
        ? ["lockfiles are not touched: run 'make install', then 'fhevm-npm test-consumer-regenerate-package-lock'"]
        : [],
    violations: [],
  };
}
