import type { Inventory, Test } from './inventory.ts';
import { needsLiveChain } from './live-chains.ts';
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
 * - On its own: the report has the expected shape, every test has one of the five states, and a test
 *   has a duration when it ran, and only then.
 * - With the inventory: the report holds every test of it and no other, each state agrees with the
 *   test's `skipped` value, and only a test that needs a live chain is unavailable.
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

  const shard = isPlainObject(entry) ? entry['shard'] : undefined;

  if (shard !== undefined && state !== 'not-selected') return [`${id}: it is ${state}, and names another shard`];

  if (shard !== undefined && !(typeof shard === 'number' && Number.isInteger(shard) && shard >= 1)) {
    return [`${id}: the shard it names is not a whole number, 1 or more`];
  }

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

    // A test that another shard runs is not selected in this report, whatever its `ci` value.
    const entry = tests[id];
    const ofAnotherShard = isPlainObject(entry) && entry['shard'] !== undefined;

    // A state that is not one of the five is already a problem of the report on its own.
    if (state !== undefined) problems.push(...stateProblems({ id, test, state, ci, ofAnotherShard }));
  }

  return problems;
}

type StateProblemsInput = {
  readonly id: string;
  readonly test: Test;
  readonly state: ReportState;
  readonly ci: boolean;
  /** True when the report says that another shard runs the test. */
  readonly ofAnotherShard: boolean;
};

function stateProblems(input: StateProblemsInput): readonly string[] {
  const { id, test, state, ci } = input;
  const isSkipped = test.skipped === true;
  const ran = state === 'passed' || state === 'failed';

  if (isSkipped && ran) return [`${id}: it has "skipped": true, and is ${state}`];

  if (!isSkipped && state === 'skipped') return [`${id}: it is skipped, and has no "skipped": true`];

  if (isSkipped && state === 'unavailable') return [`${id}: it has "skipped": true, and is unavailable`];

  if (state === 'unavailable' && !needsLiveChain(test)) return [`${id}: it is unavailable, and needs no live chain`];

  if (!ci) return [];

  if (!test.ci && state !== 'not-selected') return [`${id}: it has "ci": false, and is ${state} in a CI run`];

  if (test.ci && state === 'not-selected' && !input.ofAnotherShard) {
    return [`${id}: it has "ci": true, and is not selected in a CI run`];
  }

  return [];
}

////////////////////////////////////////////////////////////////////////////////
// The reports of the shards of one selection
////////////////////////////////////////////////////////////////////////////////

export type ShardReport = {
  /** The file of the report, for the messages. */
  readonly file: string;
  /** The report, as read from its file. Nothing about its shape is assumed. */
  readonly report: JsonObject;
};

/** What a report says its shards and its lanes were built from, read without trusting its shape. */
type ReadSettings = {
  readonly file: string;
  readonly tests: JsonObject;
  /** Everything but the number of the shard, as one text: equal for the shards of one selection. */
  readonly common: string;
  readonly selected: readonly string[];
  readonly shardNumber: number;
  readonly shardCount: number;
};

/**
 * Checks the reports of the shards of one selection together, and returns the problems found. The
 * reports must come from the same inventory, selection and numbers, hold one report for each shard, and
 * together have run every test that the selection selects exactly once.
 */
export function checkShardReports(reports: readonly ShardReport[]): readonly string[] {
  const read = reports.map(readSettings);
  const unreadable = read.filter((settings): settings is string => typeof settings === 'string');

  if (unreadable.length > 0) return unreadable;

  const settings = read.filter((one): one is ReadSettings => typeof one !== 'string');
  const [first] = settings;

  if (first === undefined) return [];

  const others = settings.filter((one) => one.common !== first.common);

  if (others.length > 0) {
    return others.map((one) => {
      return `${one.file}: it was not built from the same inventory, selection and numbers as ${first.file}`;
    });
  }

  const shardProblems = missingAndRepeatedShards(settings);

  // Without one report for each shard, every test of a missing shard would be reported too.
  return shardProblems.length > 0 ? shardProblems : testsNotRunOnce(settings);
}

function readSettings(input: ShardReport): ReadSettings | string {
  const { file, report } = input;
  const run = report['run'];
  const shard = isPlainObject(run) ? run['shard'] : undefined;
  const tests = report['tests'];
  const selected = isPlainObject(run) ? run['selected'] : undefined;

  if (!isPlainObject(run) || !isPlainObject(shard) || !isPlainObject(tests) || !Array.isArray(selected)) {
    return `${file}: the report does not say what its shards and its lanes were built from`;
  }

  const { number, count } = shard;

  if (typeof number !== 'number' || typeof count !== 'number') return `${file}: the report names no shard`;

  return {
    file,
    tests,
    common: JSON.stringify({ ...run, shard: { count }, dryRun: report['dryRun'] }),
    selected: selected.filter((id): id is string => typeof id === 'string'),
    shardNumber: number,
    shardCount: count,
  };
}

/** Every shard from 1 to the number of shards has one report. */
function missingAndRepeatedShards(settings: readonly ReadSettings[]): readonly string[] {
  const count = settings[0]?.shardCount ?? 0;
  const numbers = Array.from({ length: count }, (_, index) => index + 1);

  return numbers.flatMap((number) => {
    const files = settings.filter((one) => one.shardNumber === number).map((one) => one.file);

    if (files.length === 1) return [];

    return files.length === 0
      ? [`shard ${number} of ${count} has no report`]
      : [`shard ${number} of ${count} has ${files.length} reports: ${files.join(', ')}`];
  });
}

/** Every test that the selection selects ran in exactly one shard, and the other shards say which one. */
function testsNotRunOnce(settings: readonly ReadSettings[]): readonly string[] {
  const selected = settings[0]?.selected ?? [];
  const dryRun = settings.some((one) => one.common.includes('"dryRun":true'));

  return selected.flatMap((id) => {
    // In a dry run, passed means that the shard would run the test.
    const ranIn = settings.filter((one) => {
      const state = stateOf(one.tests[id]);

      return state === 'passed' || state === 'failed';
    });
    const [ranOnce] = ranIn;

    if (ranIn.length !== 1 || ranOnce === undefined) {
      return [`${id}: ${dryRun ? 'it is' : 'it ran'} in ${ranIn.length} shards, and must be in exactly one`];
    }

    const disagreeing = settings.filter((one) => {
      const entry = one.tests[id];

      return one !== ranOnce && !(isPlainObject(entry) && entry['shard'] === ranOnce.shardNumber);
    });

    return disagreeing.map((one) => `${one.file}: it does not say that shard ${ranOnce.shardNumber} runs ${id}`);
  });
}
