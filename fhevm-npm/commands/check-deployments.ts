import {
  type DeploymentsGit,
  inspectDeploymentRecords,
  inspectFrozenRecords,
  realDeploymentsGit,
} from '../base/checks/deployments.ts';
import type { CommandReport } from '../base/diagnostics.ts';

// Manifest-free: it reads deployments/, fhevm-chains.config.json and, with a base, git history.
export function checkDeployments(options: {
  readonly workspaceRoot: string;
  readonly base?: string;
  readonly git?: DeploymentsGit;
}): CommandReport {
  const consistency = inspectDeploymentRecords(options.workspaceRoot);
  if (options.base === undefined) {
    return {
      command: 'check deployments',
      checkedPackageKeys: consistency.checkedRecordKeys,
      checkedItemLabel: 'deployment record(s)',
      violations: consistency.violations,
    };
  }

  const frozen = inspectFrozenRecords(options.base, options.git ?? realDeploymentsGit(options.workspaceRoot));
  return {
    command: `check deployments --base ${options.base}`,
    checkedPackageKeys: [...new Set([...consistency.checkedRecordKeys, ...frozen.checkedRecordKeys])].sort(),
    checkedItemLabel: 'deployment record(s)',
    notes:
      frozen.checkedRecordKeys.length === 0
        ? [`no deployment record exists at the merge base ${frozen.mergeBase.slice(0, 12)}: nothing is frozen yet`]
        : undefined,
    violations: [...consistency.violations, ...frozen.violations],
  };
}
