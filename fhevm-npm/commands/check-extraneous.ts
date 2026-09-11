import { validateLockfileExtraneous } from '../base/checks/extraneous.ts';
import type { CheckCommand } from '../base/command.ts';
import { loadPackages } from '../base/npm.ts';

export const checkExtraneous: CheckCommand = (context) => {
  const packages = loadPackages(context.workspaceRoot, context.manifest);
  return {
    command: 'check extraneous',
    checkedPackageKeys: packages.map((pkg) => pkg.key),
    violations: validateLockfileExtraneous(packages),
  };
};
