import { accessSync, constants, mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { type BuildOutcome, runBuild } from './build.ts';

import { TestEngineError } from './errors.ts';
import type { Inventory } from './inventory.ts';
import { type RunPlan, type Shard, planRun } from './lanes.ts';
import { type Locations, outputFilesIn } from './locations.ts';
import { environmentOfTest } from './nodes.ts';
import {
  interruptedRun,
  measuredDurationsAndTheDurationField,
  resourcesThatIsolationNeeds,
  timeLimitOfATest,
} from './open-questions.ts';
import { formatDuration } from './output.ts';
import { watchProgress } from './progress.ts';
import { type BuildReportInput, type Report, buildReport, countStates, writeReport } from './report.ts';
import type { ResolvedTest } from './selection.ts';
import { type TestOutcome, runTests } from './test-lifecycle.ts';
import { reportRunWarnings } from './warnings.ts';
import { errorMessage } from './utils.ts';

/** The log of the build, in the logs directory. No test has this name: the ID of a test starts with `test-`. */
const BUILD_LOG_NAME = 'build.log';

/** The signals that interrupt a run: Ctrl-C, a request to end, and a closed terminal. */
const INTERRUPTION_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;

export type RunSelectionInput = {
  readonly locations: Locations;
  readonly inventory: Inventory;
  readonly resolved: readonly ResolvedTest[];
  readonly verbose: boolean;
  /** How long one test may take, in seconds. Undefined: as long as it takes. */
  readonly timeLimitSeconds: number | undefined;
  /** The command that builds the workspace before the tests. Undefined: the workspace is built already. */
  readonly buildCommand: string | undefined;
  /** The most lanes the run may have. */
  readonly maximumLanes: number;
  /** How many lanes can hold tests that use a live chain. */
  readonly liveChainLanes: number;
  /** The shard that the run is: its share of the selection. */
  readonly shard: Shard;
  /** The most lines of a node's output that the engine keeps. */
  readonly nodeLogLines: number;
  /** True: what the engine finds doubtful in the run fails it before any test starts. */
  readonly strict: boolean;
  /** How often, in seconds, the run prints the tests that are still running. Undefined: never. */
  readonly progressIntervalSeconds: number | undefined;
};

/** Builds the workspace when the run was given a build command, runs the selected tests, then writes the final report. */
export async function runSelection(input: RunSelectionInput): Promise<Report> {
  const { locations } = input;
  const plan = planOfRun(input);
  const { lanes } = plan;
  const entries = lanes.flatMap((lane) => lane.entries);

  requireRoot(locations);
  prepareLogsDirectory(locations.logsDirectory);

  const interruption = watchForInterruption();
  const closedOutput = tolerateClosedOutput();
  const progress = watchProgress({
    intervalMilliseconds:
      input.progressIntervalSeconds === undefined ? undefined : input.progressIntervalSeconds * 1000,
    write: (line) => console.log(line),
  });

  try {
    const build = await buildOfRun({ ...input, interruption: interruption.signal });

    console.log(
      `▶ Running ${entries.length} test(s) in ${lanes.length} lane(s)${describeShard(input.shard)}, from ${locations.root}.`,
    );

    resourcesThatIsolationNeeds();

    const outcomes = await runTests({
      root: locations.root,
      lanes,
      ...outputFilesIn(locations.logsDirectory),
      environmentOfTest,
      timeLimitMilliseconds: timeLimitOfATest(input.timeLimitSeconds),
      nodeLogLines: input.nodeLogLines,
      verbose: input.verbose,
      interruption: interruption.signal,
      onStart: progress.started,
      onOutcome: (outcome) => {
        progress.ended(outcome.id);
        printOutcome(outcome);
      },
    });

    measuredDurationsAndTheDurationField();

    return finishRun({
      locations,
      report: buildReport({ ...reportInput({ input, plan }), dryRun: false, outcomes, build }),
    });
  } finally {
    progress.stop();
    interruption.stopWatching();
    closedOutput.stopTolerating();
  }
}

type BuildOfRunInput = RunSelectionInput & {
  readonly interruption: AbortSignal;
};

/** Builds the workspace once, before any test, when the run was given a build command. */
async function buildOfRun(input: BuildOfRunInput): Promise<BuildOutcome | undefined> {
  if (input.buildCommand === undefined) return undefined;

  return runBuild({
    command: input.buildCommand,
    root: input.locations.root,
    logFile: join(input.locations.logsDirectory, BUILD_LOG_NAME),
    verbose: input.verbose,
    interruption: input.interruption,
  });
}

/**
 * The shards of the selection and the lanes of the run, known before anything starts. Reports what the
 * engine finds doubtful in the selection, and fails there when the run is strict.
 */
function planOfRun(input: RunSelectionInput): RunPlan {
  const entries = input.resolved.filter((entry) => entry.state === 'selected');
  const unavailable = input.resolved.filter((entry) => entry.state === 'unavailable');
  const plan = planRun({
    entries,
    maximum: input.maximumLanes,
    liveChainLanes: input.liveChainLanes,
    shard: input.shard,
  });

  // The whole selection is judged, not the shard: a shard that got no test is valid.
  reportRunWarnings({ selectedCount: entries.length, unavailable, strict: input.strict });

  return plan;
}

type ReportInputInput = {
  readonly input: RunSelectionInput;
  readonly plan: RunPlan;
};

/** What a report holds of a run, whether the run was a dry run or not. */
function reportInput(
  given: ReportInputInput,
): Pick<BuildReportInput, 'inventory' | 'resolved' | 'maximumLanes' | 'liveChainLanes' | 'shard' | 'shardOf'> {
  const { input, plan } = given;

  return {
    inventory: input.inventory,
    resolved: input.resolved,
    maximumLanes: input.maximumLanes,
    liveChainLanes: input.liveChainLanes,
    shard: input.shard,
    shardOf: plan.shardOf,
  };
}

/** The shard of a run, for a person to read. Nothing for a run that is the whole selection. */
function describeShard(shard: Shard): string {
  return shard.count === 1 ? '' : `, shard ${shard.number} of ${shard.count}`;
}

/** Prints what a run would run, lane by lane, runs no test, and writes the final report. */
export function dryRunSelection(input: RunSelectionInput): Report {
  const { locations } = input;
  const plan = planOfRun(input);
  const { lanes } = plan;

  requireRoot(locations);

  // A dry run builds nothing: it only says what the run would build.
  if (input.buildCommand !== undefined) console.log(`would build  $ ${input.buildCommand}`);

  for (const lane of lanes) {
    for (const entry of lane.entries)
      console.log(`would run  lane ${lane.number}  ${entry.id}  $ ${entry.test.command}`);
  }

  return finishRun({
    locations,
    report: buildReport({ ...reportInput({ input, plan }), dryRun: true, outcomes: new Map(), build: undefined }),
  });
}

////////////////////////////////////////////////////////////////////////////////
// Before the run
////////////////////////////////////////////////////////////////////////////////

/**
 * Removes the report of an earlier run. A run does this first, before anything that can fail: a run
 * that ends without a report of its own must not leave the report of another run in its place.
 */
export function removeEarlierReport(locations: Locations): void {
  try {
    rmSync(locations.reportFile, { force: true });
  } catch (error) {
    throw new TestEngineError(`The earlier report ${locations.reportFile} cannot be removed: ${errorMessage(error)}`);
  }
}

/** Checks what every test needs, so that a problem of the run fails the run and not each test. */
function requireRoot(locations: Locations): void {
  if (statSync(locations.root, { throwIfNoEntry: false })?.isDirectory() !== true) {
    throw new TestEngineError(`The root ${locations.root} is not a directory.`);
  }
}

function prepareLogsDirectory(directory: string): void {
  try {
    mkdirSync(directory, { recursive: true });
    accessSync(directory, constants.W_OK | constants.X_OK);
  } catch (error) {
    throw new TestEngineError(`The logs directory ${directory} is not writable: ${errorMessage(error)}`);
  }
}

////////////////////////////////////////////////////////////////////////////////
// During the run
////////////////////////////////////////////////////////////////////////////////

type Interruption = {
  readonly signal: AbortSignal;
  readonly stopWatching: () => void;
};

/**
 * Turns the first interruption signal that the engine receives into an abort of the run. Later signals
 * change nothing: stopping the commands takes a bounded time, and the engine then writes its report.
 */
function watchForInterruption(): Interruption {
  const controller = new AbortController();
  const onSignal = (): void => {
    if (controller.signal.aborted) return;

    interruptedRun();
    controller.abort();
  };

  for (const signal of INTERRUPTION_SIGNALS) process.on(signal, onSignal);

  return {
    signal: controller.signal,
    stopWatching: () => {
      for (const signal of INTERRUPTION_SIGNALS) process.off(signal, onSignal);
    },
  };
}

type ClosedOutputTolerance = {
  readonly stopTolerating: () => void;
};

/**
 * Keeps the run alive when nobody reads the engine's output any more, as in `run | head`. The tests
 * still end, and the report is still written.
 */
function tolerateClosedOutput(): ClosedOutputTolerance {
  const streams = [process.stdout, process.stderr];
  const ignoreClosedPipe = (error: NodeJS.ErrnoException): void => {
    if (error.code !== 'EPIPE') throw error;
  };

  for (const stream of streams) stream.on('error', ignoreClosedPipe);

  return {
    stopTolerating: () => {
      for (const stream of streams) stream.off('error', ignoreClosedPipe);
    },
  };
}

function printOutcome(outcome: TestOutcome): void {
  const duration = formatDuration(outcome.durationMilliseconds);

  if (outcome.state === 'passed') {
    console.log(`✅ passed  lane ${outcome.lane}  ${outcome.id}  ${duration}`);
  } else {
    console.log(`❌ failed  lane ${outcome.lane}  ${outcome.id}  ${duration}  log: ${outcome.logFile}`);
  }
}

////////////////////////////////////////////////////////////////////////////////
// After the run
////////////////////////////////////////////////////////////////////////////////

type FinishRunInput = {
  readonly locations: Locations;
  readonly report: Report;
};

function finishRun(input: FinishRunInput): Report {
  const { locations, report } = input;
  const counts = countStates(report);

  writeReport({ report, file: locations.reportFile });

  console.log(
    `${report.dryRun ? 'Dry run' : 'Run'}: ${counts.passed} passed, ${counts.failed} failed, ` +
      `${counts.skipped} skipped, ${counts.unavailable} unavailable, ${counts['not-selected']} not selected. ` +
      `Report: ${locations.reportFile}`,
  );

  return report;
}
