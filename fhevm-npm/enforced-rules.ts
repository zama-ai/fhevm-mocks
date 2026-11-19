/**
 * The rules of rules/fhevm-npm/rules/ that each command enforces, keyed by the command path as typed
 * after `fhevm-npm`. `<command> --rule-id <ID>` answers from this table: exit 0 when the command lists
 * the ID, 1 otherwise. A rule's `checked-by` names one of these commands, and the registry script
 * proves the link by asking that command.
 *
 * A command that is not a key enforces no rule. List a rule only where the command checks the core of
 * it, or one of the parts it is split into, not where it merely touches the same files.
 */
export const ENFORCED_RULES: Readonly<Record<string, readonly RuleId[]>> = {
  'check names': ['NR-01', 'NR-40'],
  'check workspaces': ['NR-02', 'NR-04', 'NR-05'],
  'check ownership': ['NR-03', 'NR-55'],
  'check package-json': ['NR-08', 'NR-09', 'NR-10', 'NR-11', 'NR-13', 'NR-53'],
  'check package-json-paths': ['NR-07'],
  'check tsconfig-paths': ['NR-06'],
  'check tsc-mode': ['NR-14'],
  'check dependencies': ['NR-15', 'NR-16', 'NR-18', 'NR-20', 'NR-31', 'NR-34'],
  'check generations': ['NR-22', 'NR-23', 'NR-24', 'NR-25'],
  'check generation-parity': ['NR-27'],
  'check foundry': ['NR-29', 'NR-30'],
  // NR-55: the conventional scripts of each dev owner; `check ownership` checks that there is one owner.
  'check scripts': ['NR-42', 'NR-43', 'NR-43b', 'NR-43c', 'NR-44', 'NR-45', 'NR-47', 'NR-55'],
  'check lockfiles': ['NR-64'],
  'check extraneous': ['NR-65'],
  'check consumer-lockfiles': ['NR-66'],
  'check manifest-coverage': ['NR-70', 'NR-71', 'NR-72', 'NR-73'],
  'check json-schemas': ['NR-74', 'NR-87'],
  // NR-53: README.md and LICENSE in `files`; `check package-json` checks the license and the LICENSE file.
  'check published-files': ['NR-52', 'NR-53'],
  'check deployments': ['NR-76', 'NR-77', 'NR-78', 'NR-79', 'NR-80', 'NR-81', 'NR-82', 'NR-83', 'NR-84', 'NR-85'],
  'sync vendored': ['NR-42a'],
  'version check': ['NR-36', 'NR-37'],
  'publish check': ['NR-38', 'NR-63'],
  'test-consumer': ['NR-17', 'NR-56', 'NR-57', 'NR-59', 'NR-60'],
};

/** The ID of a rule of rules/fhevm-npm/rules/, as `NR-01` or `NR-42a`. */
export type RuleId = `NR-${string}`;
