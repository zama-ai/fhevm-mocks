import { inspectForgeStdParity } from '../base/checks/forge-fhevm-std-parity.ts';
import type { CheckCommand } from '../base/command.ts';

export const checkForgeFhevmStdParity: CheckCommand = (context) => {
  const inspection = inspectForgeStdParity(context.workspaceRoot);
  return {
    command: 'check forge-fhevm-std-parity',
    checkedPackageKeys: inspection.checkedKeys,
    checkedItemLabel: 'package tree(s)',
    verboseSuccesses: inspection.successes,
    notes: inspection.skipped,
    violations: inspection.violations,
  };
};
