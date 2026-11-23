import type { Inventory, Test } from './inventory.ts';
import { type JsonObject, isPlainObject } from './json.ts';
import { REPORT_STATES, REPORT_VERSION, type ReportState } from './report.ts';

export type CheckReportInput = {
  /** The report, as read from its file. Nothing about its shape is assumed. */
  readonly report: JsonObject;
  /** The inventory the run was given. Undefined: the report is checked on its own. */
  readonly inventory?: Inventory | undefined;
  /**
   * True: the report is that of a CI run, which selects the tests with `"ci": true` and no other. Needs
   * the inventory.
   */
  readonly ci: boolean;
};

/**
 * Checks a final report without running anything, and returns the problems found.
 * - On its own: the report has the expected shape, every test has one of the four states, and a test
 *   has a duration when it ran, and only then.
 * - With the inventory: the report holds every test of it and no other, and each state agrees with the
 *   test's `skipped` value.
 * - For a CI run: every test with `"ci": true` that is not skipped is passed or failed, and no test
 *   with `"ci": false` ran.
 */
export function checkReport(input: CheckReportInput): readonly string[] {
  const { report, inventory } = input;
  const tests = report['tests'];
  const dryRun = report['dryRun'];

  if (report['version'] !== REPORT_VERSION) return [`the report is not of version ${REPORT_VERSION}`];

  if (typeof dryRun !== 'boolean') return ["the report holds no boolean 'dryRun'"];

  if (!isPlainObject(tests)) return ["the report holds no 'tests' object"];

  const problems = Object.entries(tests).flatMap(([id, entry]) => entryProblems({ id, entry, dryRun }));

  if (inventory !== undefined) problems.push(...inventoryProblems({ tests, inventory, ci: input.ci }));

  return problems;
}

////////////////////////////////////////////////////////////////////////////////
// The report on its own
////////////////////////////////////////////////////////////////////////////////

type EntryProblemsInput = {
  readonly id: string;
  readonly entry: unknown;
  readonly dryRun: boolean;
};

function entryProblems(input: EntryProblemsInput): readonly string[] {
  const { id, entry, dryRun } = input;
  const state = stateOf(entry);

  if (state === undefined) return [`${id}: its state is not one of ${REPORT_STATES.join(', ')}`];

  if (dryRun && state === 'failed') return [`${id}: it is failed in a dry run, which runs no test`];

  const ran = !dryRun && (state === 'passed' || state === 'failed');
  const duration = isPlainObject(entry) ? entry['durationMilliseconds'] : undefined;

  if (ran && !(typeof duration === 'number' && duration >= 0)) return [`${id}: it ran, and has no valid duration`];

  if (!ran && duration !== undefined) return [`${id}: it did not run, and has a duration`];

  return [];
}

function stateOf(entry: unknown): ReportState | undefined {
  const state = isPlainObject(entry) ? entry['state'] : undefined;

  return REPORT_STATES.find((candidate) => candidate === state);
}

////////////////////////////////////////////////////////////////////////////////
// The report against the inventory
////////////////////////////////////////////////////////////////////////////////

type InventoryProblemsInput = {
  readonly tests: JsonObject;
  readonly inventory: Inventory;
  readonly ci: boolean;
};

function inventoryProblems(input: InventoryProblemsInput): readonly string[] {
  const { tests, inventory, ci } = input;
  const unknown = Object.keys(tests).filter((id) => !inventory.tests.has(id));
  const problems = unknown.map((id) => `${id}: the inventory holds no such test`);

  for (const [id, test] of inventory.tests) {
    const state = stateOf(tests[id]);

    if (!(id in tests)) problems.push(`${id}: the report gives it no state`);

    // A state that is not one of the four is already a problem of the report on its own.
    if (state !== undefined) problems.push(...stateProblems({ id, test, state, ci }));
  }

  return problems;
}

type StateProblemsInput = {
  readonly id: string;
  readonly test: Test;
  readonly state: ReportState;
  readonly ci: boolean;
};

function stateProblems(input: StateProblemsInput): readonly string[] {
  const { id, test, state, ci } = input;
  const isSkipped = test.skipped === true;
  const ran = state === 'passed' || state === 'failed';

  if (isSkipped && ran) return [`${id}: it has "skipped": true, and is ${state}`];

  if (!isSkipped && state === 'skipped') return [`${id}: it is skipped, and has no "skipped": true`];

  if (!ci) return [];

  if (!test.ci && state !== 'not-selected') return [`${id}: it has "ci": false, and is ${state} in a CI run`];

  if (test.ci && state === 'not-selected') return [`${id}: it has "ci": true, and is not selected in a CI run`];

  return [];
}
