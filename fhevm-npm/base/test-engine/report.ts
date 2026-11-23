import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { BuildOutcome } from './build.ts';
import type { Inventory } from './inventory.ts';
import type { Shard } from './lanes.ts';
import type { ResolvedTest } from './selection.ts';
import type { TestOutcome } from './test-lifecycle.ts';

export const REPORT_VERSION = 1;

/** The five states of the specification. Every test of the inventory gets one. */
export const REPORT_STATES = ['passed', 'failed', 'skipped', 'unavailable', 'not-selected'] as const;
export type ReportState = (typeof REPORT_STATES)[number];

export type ReportEntry = {
  readonly state: ReportState;
  /** Present for a test that ran, and only then. */
  readonly durationMilliseconds?: number | undefined;
  /** For a test that ran: the number of its lane, and its place in the lane, both from 1. */
  readonly lane?: number | undefined;
  readonly position?: number | undefined;
  /** For an unavailable test, and only then: the RPC URL variables that it needs and that were not set. */
  readonly missingVariables?: readonly string[] | undefined;
  /** For a test that the selection selects and that another shard runs: the number of that shard. */
  readonly shard?: number | undefined;
};

/**
 * What the shards and the lanes of a run were built from. The reports of the shards of one selection
 * hold the same values, except the number of the shard: that is how they are checked together.
 */
export type RunSettings = {
  /** The SHA-256 of the inventory file, so that two machines can tell that they read the same one. */
  readonly inventoryFingerprint: string;
  /** The tests that the selection selects and that can run, in the order of the inventory. */
  readonly selected: readonly string[];
  readonly maximumLanes: number;
  readonly liveChainLanes: number;
  readonly shard: Shard;
};

/** How long one lane took: its tests run one after the other, so it is the sum of their durations. */
export type LaneTiming = {
  /** The number of the lane, from 1. */
  readonly lane: number;
  /** How many tests the lane ran. */
  readonly tests: number;
  readonly durationMilliseconds: number;
};

/** How long a run took, in milliseconds. */
export type RunTiming = {
  /** From the start of the first test to the end of the last one: the lanes go side by side. */
  readonly testsMilliseconds: number;
  /** The build, when the engine ran one, and the tests. */
  readonly totalMilliseconds: number;
  /** One entry per lane that ran a test, in the order of the lanes. */
  readonly lanes: readonly LaneTiming[];
};

/** The final report of a run, as written to its JSON file. */
export type Report = {
  readonly version: typeof REPORT_VERSION;
  readonly inventory: string;
  readonly dryRun: boolean;
  readonly run: RunSettings;
  /** The build of the run, when the engine was given a build command and ran it. */
  readonly build?: { readonly command: string; readonly durationMilliseconds: number } | undefined;
  /** How long the run took. Present for a run that ran its tests, and absent for a dry run. */
  readonly timing?: RunTiming | undefined;
  /** Every test of the inventory by ID, in the order of the inventory. */
  readonly tests: Readonly<Record<string, ReportEntry>>;
};

export type BuildReportInput = {
  readonly inventory: Inventory;
  readonly resolved: readonly ResolvedTest[];
  readonly dryRun: boolean;
  /** The outcome of every selected test, by ID. Empty in a dry run: no test ran. */
  readonly outcomes: ReadonlyMap<string, TestOutcome>;
  /** The build that the engine ran before the tests, if any. */
  readonly build: BuildOutcome | undefined;
  readonly maximumLanes: number;
  readonly liveChainLanes: number;
  /** The shard that the run is. */
  readonly shard: Shard;
  /** The shard of each test that the selection selects and that can run, by test ID. */
  readonly shardOf: ReadonlyMap<string, number>;
  /** From the start of the first test to the end of the last one. Undefined in a dry run: no test ran. */
  readonly testsMilliseconds?: number | undefined;
};

export function buildReport(input: BuildReportInput): Report {
  const tests = input.resolved.map((entry) => [entry.id, reportEntry({ ...input, entry })] as const);

  return {
    version: REPORT_VERSION,
    inventory: input.inventory.file,
    dryRun: input.dryRun,
    run: {
      inventoryFingerprint: fingerprintOf(input.inventory.file),
      selected: input.resolved.filter((entry) => entry.state === 'selected').map((entry) => entry.id),
      maximumLanes: input.maximumLanes,
      liveChainLanes: input.liveChainLanes,
      shard: input.shard,
    },
    ...(input.build === undefined ? {} : { build: roundedBuild(input.build) }),
    ...(input.testsMilliseconds === undefined
      ? {}
      : { timing: timingOf({ ...input, testsMilliseconds: input.testsMilliseconds }) }),
    tests: Object.fromEntries(tests),
  };
}

type TimingInput = Pick<BuildReportInput, 'outcomes' | 'build'> & {
  readonly testsMilliseconds: number;
};

function timingOf(input: TimingInput): RunTiming {
  const byLane = new Map<number, { tests: number; durationMilliseconds: number }>();

  for (const outcome of input.outcomes.values()) {
    const lane = byLane.get(outcome.lane) ?? { tests: 0, durationMilliseconds: 0 };

    byLane.set(outcome.lane, {
      tests: lane.tests + 1,
      durationMilliseconds: lane.durationMilliseconds + outcome.durationMilliseconds,
    });
  }

  // The total is the sum of the two rounded times, so that the report adds up as it reads.
  const testsMilliseconds = Math.round(input.testsMilliseconds);
  const buildMilliseconds = input.build === undefined ? 0 : roundedBuild(input.build).durationMilliseconds;

  return {
    testsMilliseconds,
    totalMilliseconds: testsMilliseconds + buildMilliseconds,
    lanes: [...byLane]
      .sort(([a], [b]) => a - b)
      .map(([lane, timing]) => ({
        lane,
        tests: timing.tests,
        durationMilliseconds: Math.round(timing.durationMilliseconds),
      })),
  };
}

function fingerprintOf(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function roundedBuild(build: BuildOutcome): BuildOutcome {
  return { command: build.command, durationMilliseconds: Math.round(build.durationMilliseconds) };
}

type ReportEntryInput = Pick<BuildReportInput, 'dryRun' | 'outcomes' | 'shard' | 'shardOf'> & {
  readonly entry: ResolvedTest;
};

function reportEntry(input: ReportEntryInput): ReportEntry {
  const { entry } = input;

  if (entry.state === 'unavailable') return { state: entry.state, missingVariables: entry.missingVariables ?? [] };

  if (entry.state !== 'selected') return { state: entry.state };

  const shardOfEntry = input.shardOf.get(entry.id);

  // Another shard runs the test: for this run it is not selected, and the report says which shard has it.
  if (shardOfEntry !== undefined && shardOfEntry !== input.shard.number) {
    return { state: 'not-selected', shard: shardOfEntry };
  }

  // In a dry run, passed means that the run selected the test and would run it.
  if (input.dryRun) return { state: 'passed' };

  const outcome = input.outcomes.get(entry.id);

  // A defect of the engine, not a failure of the run: every selected test is run.
  if (outcome === undefined) throw new Error(`The run selected ${entry.id}, and holds no outcome for it.`);

  return {
    state: outcome.state,
    durationMilliseconds: Math.round(outcome.durationMilliseconds),
    lane: outcome.lane,
    position: outcome.position,
  };
}

export type WriteReportInput = {
  readonly report: Report;
  readonly file: string;
};

export function writeReport(input: WriteReportInput): void {
  mkdirSync(dirname(input.file), { recursive: true });
  writeFileSync(input.file, `${JSON.stringify(input.report, undefined, 2)}\n`);
}

/** How many tests of a report are in each state. */
export function countStates(report: Report): Readonly<Record<ReportState, number>> {
  const counts: Record<ReportState, number> = { passed: 0, failed: 0, skipped: 0, unavailable: 0, 'not-selected': 0 };

  for (const entry of Object.values(report.tests)) counts[entry.state] += 1;

  return counts;
}
