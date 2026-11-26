import { validateInstalledOptionals } from '../base/checks/installed-optionals.ts';
import type { CheckCommand } from '../base/command.ts';
import { loadPackages } from '../base/npm.ts';

export const checkInstalledOptionals: CheckCommand = (context) => {
  const packages = loadPackages(context.workspaceRoot, context.manifest);
  return {
    command: 'check installed-optionals',
    checkedPackageKeys: packages.map((pkg) => pkg.key),
    violations: validateInstalledOptionals(packages),
  };
};
