import { inspectEnvVars } from '../base/checks/env-vars.ts';
import type { CheckCommand } from '../base/command.ts';

/**
 * R-10: npm-manifest.json lists every environment variable of the workspace. A variable that a file
 * reads or sets is listed, a listed variable is used, and fhevm-npm reads no variable by a computed
 * name.
 * Read-only, like every check.
 */
export const checkEnvVars: CheckCommand = (context) => {
  const inspection = inspectEnvVars({ workspaceRoot: context.workspaceRoot, manifest: context.manifest });

  return {
    command: 'check env-vars',
    checkedPackageKeys: inspection.checkedKeys,
    checkedItemLabel: 'variable(s)',
    violations: inspection.violations,
  };
};
