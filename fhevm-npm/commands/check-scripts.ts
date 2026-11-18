import {
  validateConfigContainment,
  validateEslintConfigs,
  validateEslintLayoutModules,
  validatePrettierConfigs,
  validateScripts,
} from '../base/checks/scripts.ts';
import type { CheckCommand } from '../base/command.ts';
import { loadPackages } from '../base/npm.ts';
import { packageDirectory, toolRoot } from '../base/paths.ts';
import { gitVisibleFiles } from '../base/repository.ts';

export const checkScripts: CheckCommand = (context) => {
  const packages = loadPackages(context.workspaceRoot, context.manifest);
  const excludedRoots = [
    toolRoot,
    ...(context.manifest.inventory?.exclude ?? []).map((key) => packageDirectory(context.workspaceRoot, key)),
  ];
  return {
    command: 'check scripts',
    checkedPackageKeys: packages.map((pkg) => pkg.key),
    violations: [
      ...validateScripts(packages),
      ...validatePrettierConfigs(context.workspaceRoot, packages),
      ...validateEslintConfigs(packages),
      ...validateEslintLayoutModules(
        context.workspaceRoot,
        packages,
        gitVisibleFiles(context.workspaceRoot),
        excludedRoots,
      ),
      ...validateConfigContainment(packages),
    ],
  };
};
