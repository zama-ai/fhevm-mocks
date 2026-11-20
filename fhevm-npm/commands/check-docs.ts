import type { CheckCommand } from '../base/command.ts';
import { inspectDocs } from '../base/checks/docs.ts';

export const checkDocs: CheckCommand = (context) => {
  const inspection = inspectDocs(context.workspaceRoot, context.manifest);
  return {
    command: 'check docs',
    checkedPackageKeys: inspection.checkedPaths,
    checkedItemLabel: 'docs folder(s)',
    violations: inspection.violations,
  };
};
