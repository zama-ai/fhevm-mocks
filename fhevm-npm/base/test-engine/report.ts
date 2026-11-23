import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { BuildOutcome } from './build.ts';
import type { Inventory } from './inventory.ts';
import type { ResolvedTest } from './selection.ts';
import type { TestOutcome } from './test-lifecycle.ts';

export const REPORT_VERSION = 1;

/** The four states of the specification. Every test of the inventory gets one. */
export const REPORT_STATES = ['passed', 'failed', 'skipped', 'not-selected'] as const;
export type ReportState = (typeof REPORT_STATES)[number];

export type ReportEntry = {
  readonly state: ReportState;
  /** Present for a test that ran, and only then. */
  readonly durationMilliseconds?: number | undefined;
  /** For a test that ran: the number of its lane, and its place in the lane, both from 1. */
  readonly lane?: number | undefined;
  readonly position?: number | undefined;
};

/** The final report of a run, as written to its JSON file. */
export type Report = {
  readonly version: typeof REPORT_VERSION;
  readonly inventory: string;
  readonly dryRun: boolean;
  /** The build of the run, when the engine was given a build command and ran it. */
  readonly build?: { readonly command: string; readonly durationMilliseconds: number } | undefined;
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
};

export function buildReport(input: BuildReportInput): Report {
  const tests = input.resolved.map((entry) => [entry.id, reportEntry({ ...input, entry })] as const);

  return {
    version: REPORT_VERSION,
    inventory: input.inventory.file,
    dryRun: input.dryRun,
    ...(input.build === undefined ? {} : { build: roundedBuild(input.build) }),
    tests: Object.fromEntries(tests),
  };
}

function roundedBuild(build: BuildOutcome): BuildOutcome {
  return { command: build.command, durationMilliseconds: Math.round(build.durationMilliseconds) };
}

type ReportEntryInput = Pick<BuildReportInput, 'dryRun' | 'outcomes'> & {
  readonly entry: ResolvedTest;
};

function reportEntry(input: ReportEntryInput): ReportEntry {
  const { entry } = input;

  if (entry.state !== 'selected') return { state: entry.state };

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
  const counts: Record<ReportState, number> = { passed: 0, failed: 0, skipped: 0, 'not-selected': 0 };

  for (const entry of Object.values(report.tests)) counts[entry.state] += 1;

  return counts;
}
