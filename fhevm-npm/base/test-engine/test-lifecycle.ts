import type { InventoryEntry } from './inventory.ts';
import type { Lane } from './lanes.ts';
import { type NodeLog, openNodeLog } from './node-log.ts';
import { type RunningNode, needsRunnerNode, runnerNodeChain, startNode } from './nodes.ts';
import type { NodeAddress } from './open-questions.ts';
import { formatDuration } from './output.ts';
import { describeExit, isSuccess, startInGroup } from './process.ts';
import type { StartedTest } from './progress.ts';
import { type TestLog, openTestLog } from './test-log.ts';
import { errorMessage } from './utils.ts';

/** The two states of a test that the engine ran. */
export type RunState = 'passed' | 'failed';

/** What happened to one test that the engine ran. */
export type TestOutcome = {
  readonly id: string;
  readonly state: RunState;
  /** From the moment the engine took the test to the moment everything of it was stopped. */
  readonly durationMilliseconds: number;
  readonly logFile: string;
  /** The number of the lane the test ran in, and its place in that lane, both from 1. */
  readonly lane: number;
  readonly position: number;
};

export type RunTestsInput = {
  /** The directory each command runs from. */
  readonly root: string;
  /** The lanes to run. They go side by side, and the tests of one lane run one after the other. */
  readonly lanes: readonly Lane[];
  readonly logFileOf: (id: string) => string;
  /** The file that gets the output of the node the engine started for a test. */
  readonly nodeLogFileOf: (id: string) => string;
  /** The most lines of a node's output that the engine keeps. */
  readonly nodeLogLines: number;
  /** The environment of a command whose test has a node of the engine. */
  readonly environmentWithNode: (node: NodeAddress) => NodeJS.ProcessEnv;
  /** True: each line of a test's output is also printed, with the test ID in front. */
  readonly verbose: boolean;
  /** Aborted when the run is interrupted: every running command is stopped. */
  readonly interruption: AbortSignal;
  /** How long one test may take, from its start to its end. Undefined: as long as it takes. */
  readonly timeLimitMilliseconds: number | undefined;
  /** Called when a test starts, before anything of it runs. */
  readonly onStart: (test: StartedTest) => void;
  readonly onOutcome: (outcome: TestOutcome) => void;
};

/**
 * Runs every lane, side by side, and resolves with the outcome of each test by ID when all have ended.
 * Inside a lane, a test starts only when the test before it has ended, with its node and everything it
 * started. A failing test stops nothing: the next test of its lane still runs, and none is run again.
 */
export async function runTests(input: RunTestsInput): Promise<ReadonlyMap<string, TestOutcome>> {
  const outcomes = await Promise.all(input.lanes.map((lane) => runLane({ ...input, lane })));

  return new Map(outcomes.flat().map((outcome) => [outcome.id, outcome]));
}

type RunLaneInput = Omit<RunTestsInput, 'lanes'> & {
  readonly lane: Lane;
};

async function runLane(input: RunLaneInput): Promise<readonly TestOutcome[]> {
  const outcomes: TestOutcome[] = [];

  for (const [index, entry] of input.lane.entries.entries()) {
    input.onStart({ id: entry.id, lane: input.lane.number });

    const outcome = await runTest({ ...input, entry, lane: input.lane.number, position: index + 1 });

    input.onOutcome(outcome);
    outcomes.push(outcome);
  }

  return outcomes;
}

type RunTestInput = Omit<RunTestsInput, 'lanes' | 'onStart' | 'onOutcome'> & {
  readonly entry: InventoryEntry;
  readonly lane: number;
  readonly position: number;
};

/**
 * Runs one test from start to end, and never rejects: whatever goes wrong while the engine prepares or
 * runs the test makes that test failed, with the reason in its log. The node that the engine started
 * for the test is stopped when the test ends, however it ends. A node that died before that fails the
 * test, and so does a test that reaches its time limit.
 */
async function runTest(input: RunTestInput): Promise<TestOutcome> {
  const { id } = input.entry;
  const startedAt = performance.now();
  const log = openTestLog({ file: input.logFileOf(id), id, verbose: input.verbose });
  const timeLimit = testTimeLimit(input);
  // What stops the test: an interruption of the run, or its own time limit.
  const step = { ...input, log, interruption: timeLimit.stopSignal };
  // Only a test whose node the engine starts has a node log.
  const nodeLog = needsRunnerNode(input.entry.test)
    ? openNodeLog({ file: input.nodeLogFileOf(id), maximumLines: input.nodeLogLines })
    : undefined;
  let node: RunningNode | undefined;
  let state: RunState = 'failed';

  try {
    node = await startNodeOfTest({ ...step, nodeLog });
    state = await runCommand({ ...step, node });
  } catch (error) {
    log.line(`The engine could not run the test: ${errorMessage(error)}`);
  }

  // A node that died during its test fails the test, whatever its command did.
  const nodeDied = await stopNodeOfTest({ node, log });

  // The node has stopped, or never came up: its last lines are all there is to keep.
  if (nodeLog !== undefined) {
    nodeLog.close();
    log.line(`The last lines of the node's output are in ${nodeLog.file}.`);
  }
  const timedOut = timeLimit.isReached();

  if (timedOut) log.line(`The test reached its time limit of ${timeLimit.description}, and was stopped.`);

  await log.close();

  return {
    id,
    state: nodeDied || timedOut ? 'failed' : state,
    durationMilliseconds: performance.now() - startedAt,
    logFile: log.file,
    lane: input.lane,
    position: input.position,
  };
}

type TestTimeLimit = {
  /** Aborted when the run is interrupted, or when the test reaches its time limit. */
  readonly stopSignal: AbortSignal;
  readonly isReached: () => boolean;
  /** The limit, for a person to read. */
  readonly description: string;
};

/** Starts the clock of one test. A test without a limit is stopped by an interruption of the run only. */
function testTimeLimit(input: Pick<RunTestInput, 'interruption' | 'timeLimitMilliseconds'>): TestTimeLimit {
  const { interruption, timeLimitMilliseconds } = input;

  if (timeLimitMilliseconds === undefined) {
    return { stopSignal: interruption, isReached: () => false, description: 'none' };
  }

  const limit = AbortSignal.timeout(timeLimitMilliseconds);

  return {
    stopSignal: AbortSignal.any([interruption, limit]),
    isReached: () => limit.aborted,
    description: formatDuration(timeLimitMilliseconds),
  };
}

type TestStepInput = RunTestInput & {
  readonly log: TestLog;
};

type StartNodeOfTestInput = TestStepInput & {
  readonly nodeLog: NodeLog | undefined;
};

/** Starts the new node of a test whose chain has `"startedBy": "runner"`. Other tests get no node. */
async function startNodeOfTest(input: StartNodeOfTestInput): Promise<RunningNode | undefined> {
  const { nodeLog } = input;
  const chain = runnerNodeChain(input.entry.test);

  if (chain === undefined || nodeLog === undefined || input.interruption.aborted) return undefined;

  return startNode({ chain, root: input.root, log: input.log, nodeLog, interruption: input.interruption });
}

type StopNodeInput = {
  readonly node: RunningNode | undefined;
  readonly log: TestLog;
};

/**
 * Stops the node of a test when the test ends, however it ends: see `stoppingTheNodesTheEngineStarted`.
 * Returns true when the node had died before that, and says so in the log, with how the node ended.
 */
async function stopNodeOfTest(input: StopNodeInput): Promise<boolean> {
  const { node, log } = input;

  if (node === undefined) return false;

  const diedAs = node.diedAs();

  await node.stop();

  log.line(
    diedAs === undefined
      ? `Node ${node.guid} is stopped.`
      : `Node ${node.guid} died during its test, so the test is failed. ${diedAs}`,
  );

  return diedAs !== undefined;
}

type RunCommandInput = TestStepInput & {
  /** The node that the engine started for the test, if any. */
  readonly node: RunningNode | undefined;
};

/** Runs the command of a test. The test passed when the command succeeded, and only then. */
async function runCommand(input: RunCommandInput): Promise<RunState> {
  const { log, entry, node } = input;

  if (input.interruption.aborted) {
    log.line('The test was stopped before its command started.');

    return 'failed';
  }

  log.line(`$ ${entry.test.command}`);

  const command = startInGroup({
    command: entry.test.command,
    cwd: input.root,
    env: node === undefined ? undefined : input.environmentWithNode(node),
    onStream: log.attach,
    interruption: input.interruption,
  });
  const exit = await command.ended;

  log.line(`\n${describeExit({ exit, subject: 'The command' })}`);

  return isSuccess(exit) ? 'passed' : 'failed';
}
