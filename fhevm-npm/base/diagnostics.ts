import type { RuleId } from '../enforced-rules.ts';

/**
 * What a violation is tagged with, printed as `❌ [<tag>]`: the ID of the rule it breaks, or, for a check
 * that no rule of rules/fhevm-npm/rules/ covers, the name of that check. Never an old section number:
 * the rule books replaced them with IDs, and an `old` field keeps the number on the rule.
 */
export type ViolationTag = RuleId | UnruledCheck;

/** The checks that no rule covers. A check moves to a RuleId once a rule covers it. */
export type UnruledCheck =
  | 'cleartext-config-face'
  | 'commit-scope'
  | 'dependencies-order'
  | 'deployments'
  | 'fhevm-chains-origin'
  | 'forge-fhevm-std-parity'
  | 'forge-scripts'
  | 'json-schema-coverage'
  | 'json-schema-document'
  | 'json-schema-reference'
  | 'lint-policy'
  | 'member-of'
  | 'mirror'
  | 'package-json'
  | 'package-name'
  | 'rehearse'
  | 'safe-chain'
  | 'scripts-order'
  | 'update'
  | 'vendored-origin'
  | 'vendored-bump'
  | 'vendored-sync';

export type Violation = {
  readonly rule: ViolationTag;
  readonly packageKey: string;
  readonly message: string;
};

/** One measured cost, printed at `-vv` or above so an expensive check can say where its time went. */
export type Timing = { readonly label: string; readonly milliseconds: number };

export type CommandReport = {
  readonly command: string;
  readonly checkedPackageKeys: readonly string[];
  readonly checkedItemLabel?: string;
  readonly verboseSuccesses?: readonly string[];
  /**
   * Things the check could not do, as opposed to things it found wrong. Printed at every verbosity —
   * a check that quietly did nothing is indistinguishable from one that passed, which is the whole
   * failure mode a note exists to prevent — and never affects the exit code.
   */
  readonly notes?: readonly string[];
  /**
   * What the check leaves out on purpose, by its rules, as a frozen folder. Not a finding and not a
   * warning: printed only with detailed output, so a reader can still see the scope.
   */
  readonly skipped?: readonly string[];
  readonly violations: readonly Violation[];
  readonly timings?: readonly Timing[];
};

export function printReport(report: CommandReport, verbosity: Verbosity): void {
  const violations = [...report.violations].sort(
    (left, right) =>
      left.packageKey.localeCompare(right.packageKey) ||
      left.rule.localeCompare(right.rule) ||
      left.message.localeCompare(right.message),
  );

  for (const violation of violations) {
    console.error(`❌ [${violation.rule}] ${violation.packageKey}: ${violation.message}`);
  }

  for (const note of report.notes ?? []) console.warn(`⚠️  ${note}`);

  if (hasDetailedOutput(verbosity) && report.timings !== undefined) {
    for (const timing of report.timings) {
      console.log(`⏱️  ${timing.label}: ${timing.milliseconds.toFixed(0)}ms`);
    }
  }

  if (hasDetailedOutput(verbosity)) {
    for (const skipped of report.skipped ?? []) console.log(`⏭️  not checked: ${skipped}`);
    if (report.verboseSuccesses !== undefined) {
      for (const success of report.verboseSuccesses) console.log(`✅ ${success}`);
    } else {
      const failedPackageKeys = new Set(violations.map((violation) => violation.packageKey));
      for (const packageKey of report.checkedPackageKeys) {
        if (!failedPackageKeys.has(packageKey)) console.log(`✅ ${packageKey}`);
      }
    }
  }

  if (violations.length > 0) {
    console.error(
      `❌ ${report.command}: ${violations.length} violation(s) across ${report.checkedPackageKeys.length} ${report.checkedItemLabel ?? 'package(s)'}.`,
    );
  } else if (hasProgress(verbosity)) {
    console.log(
      `✅ ${report.command}: ${report.checkedPackageKeys.length} ${report.checkedItemLabel ?? 'package(s)'} checked.`,
    );
  }
}
import { hasDetailedOutput, hasProgress, type Verbosity } from './verbosity.ts';
