import { isolatedConsumerKeys, validateConsumerLockfiles } from '../base/checks/consumer-lockfiles.ts';
import type { CheckCommand } from '../base/command.ts';
import { loadPackages } from '../base/npm.ts';
import { loadVersions } from '../base/versions.ts';

/** `check consumer-lockfiles`: every isolated consumer lock pins the published payloads versions.json declares. */
export const checkConsumerLockfiles: CheckCommand = (context) => {
  const packages = loadPackages(context.workspaceRoot, context.manifest);
  const violations = validateConsumerLockfiles(context.workspaceRoot, packages, loadVersions(context.workspaceRoot));
  return {
    command: 'check consumer-lockfiles',
    checkedPackageKeys: [...isolatedConsumerKeys(packages)],
    checkedItemLabel: 'consumer lockfile(s)',
    violations,
  };
};
