import { inspectGenerationParity } from '../base/checks/generation-parity.ts';
import type { CheckCommand } from '../base/command.ts';

export const checkGenerationParity: CheckCommand = (context) => {
  const inspection = inspectGenerationParity(context.workspaceRoot, context.manifest);
  return {
    command: 'check generation-parity',
    checkedPackageKeys: inspection.checkedKeys,
    checkedItemLabel: 'previous generation(s)',
    verboseSuccesses: inspection.successes,
    notes: inspection.skipped,
    violations: inspection.violations,
  };
};
