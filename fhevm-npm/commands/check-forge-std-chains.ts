import type { CheckCommand } from '../base/command.ts';
import { inspectForgeStdChains } from '../base/checks/forge-std-chains.ts';

// Reads StdFhevmChains.sol and fhevm-chains.config.json only; the manifest in the context is not used.
export const checkForgeStdChains: CheckCommand = (context) => {
  const inspection = inspectForgeStdChains(context.workspaceRoot);
  return {
    command: 'check forge-std-chains',
    checkedPackageKeys: inspection.checkedKeys,
    checkedItemLabel: 'chain(s)',
    violations: inspection.violations,
  };
};
