import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { packageJsonKey } from '../base/checks/package-names.ts';
import { versionOfPin } from '../base/checks/pinned-dependencies.ts';
import type { CommandReport, Violation } from '../base/diagnostics.ts';
import { loadPackages } from '../base/npm.ts';
import {
  applyPinnedEdits,
  planPinRaises,
  planPinnedSync,
  renderPinRaises,
  withRaisedPins,
} from '../base/sync-pinned.ts';
import type { NpmManifest } from '../manifest.ts';

const MANIFEST_KEY = './npm-manifest.json';

export function syncPinnedCommand(options: {
  readonly workspaceRoot: string;
  readonly manifest: NpmManifest;
  readonly check: boolean;
}): CommandReport {
  const packages = loadPackages(options.workspaceRoot, options.manifest);
  // A pin behind what the lockfiles resolve is raised first; the package.json plan then follows the raised pins.
  const raises = planPinRaises(options.manifest, packages);
  const edits = planPinnedSync(withRaisedPins(options.manifest, raises), packages);
  const command = options.check ? 'sync pinned --check' : 'sync pinned';
  const base = { command, checkedPackageKeys: packages.map(packageJsonKey), checkedItemLabel: 'package.json file(s)' };

  if (options.check) {
    const violations: Violation[] = [
      ...raises.map((raise) => ({
        rule: '3.3.4',
        packageKey: MANIFEST_KEY,
        message: `pin '${raise.name}' is "${raise.from}", but a lockfile resolves ${versionOfPin(raise.to)}: the pin is behind what is installed and must move to "${raise.to}". Run 'fhevm-npm sync pinned'`,
      })),
      ...edits.map((edit) => ({
        rule: '3.3.4',
        packageKey: edit.packageKey,
        message: `'${edit.name}' in '${edit.field}' is "${edit.from}"; npm-manifest.json#dependencies.pinned requires "${edit.to}". Run 'fhevm-npm sync pinned'`,
      })),
    ];
    return { ...base, violations };
  }

  if (raises.length > 0) {
    const file = join(options.workspaceRoot, 'npm-manifest.json');
    writeFileSync(file, renderPinRaises(file, readFileSync(file, 'utf8'), raises));
    for (const raise of raises)
      console.log(`✏️  ${MANIFEST_KEY}: pin '${raise.name}' "${raise.from}" -> "${raise.to}"`);
  }
  applyPinnedEdits(edits);
  for (const edit of edits) {
    console.log(`✏️  ${edit.packageKey}: '${edit.name}' in '${edit.field}' "${edit.from}" -> "${edit.to}"`);
  }
  return {
    ...base,
    // Writing package.json leaves every lockfile that copies these specs stale until npm regenerates it.
    notes:
      raises.length + edits.length > 0
        ? ["lockfiles are not touched: run 'make install', then 'fhevm-npm test-consumer-regenerate-package-lock'"]
        : [],
    violations: [],
  };
}
