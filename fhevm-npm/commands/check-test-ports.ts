import { inspectTestPorts } from '../base/checks/test-ports.ts';
import type { CheckCommand } from '../base/command.ts';

/**
 * NR-92: test-ports.config.json gives every test the port of the node it starts. Each group keeps to a
 * range of its own, the file reads in increasing order, and the test sources of each owner use exactly
 * the ports of its group.
 * Read-only, like every check.
 */
export const checkTestPorts: CheckCommand = (context) => {
  const inspection = inspectTestPorts(context.workspaceRoot, context.manifest);
  return {
    command: 'check test-ports',
    checkedPackageKeys: inspection.checkedKeys,
    checkedItemLabel: 'port(s)',
    violations: inspection.violations,
  };
};
