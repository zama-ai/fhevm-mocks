import { inspectGenerationParity, parityRefOverrides } from '../base/checks/generation-parity.ts';
import type { CheckCommand } from '../base/command.ts';

export const checkGenerationParity: CheckCommand = (context) => {
  // The one thing this command reads from the environment; the check itself stays pure, so a test
  // supplies overrides directly instead of mutating `process.env`.
  const inspection = inspectGenerationParity(
    context.workspaceRoot,
    context.manifest,
    undefined,
    parityRefOverrides(process.env),
  );
  return {
    command: 'check generation-parity',
    checkedPackageKeys: inspection.checkedKeys,
    checkedItemLabel: 'previous generation(s)',
    verboseSuccesses: inspection.successes,
    // An overridden baseline is a NOTE, not a verbose success: it must be visible on every run, or a
    // green result reads as parity with a release branch this run never looked at.
    notes: [...inspection.overridden, ...inspection.skipped],
    violations: inspection.violations,
  };
};
