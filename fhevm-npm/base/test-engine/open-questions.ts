/**
 * The questions that the specification of the test engine leaves open. Each question has one function
 * here. The function logs that the behavior is to be implemented, and does the least that lets the run
 * continue. No other file of the engine answers an open question.
 */
import { join } from 'node:path';

import { TestEngineError } from './errors.ts';
import { environmentWithoutGuid } from './guid.ts';
import type { ChainRuntime, InventoryEntry } from './inventory.ts';
import { errorMessage } from './utils.ts';

function logToBeImplemented(question: string): void {
  console.warn(`🚧 To be implemented: ${question}`);
}

////////////////////////////////////////////////////////////////////////////////
// Selecting tests: the filters
////////////////////////////////////////////////////////////////////////////////

/** The filters that the specification names as candidates only. A test must match all of them. */
export type CandidateFilters = {
  /** A regular expression that the test ID must match. */
  readonly match?: string | undefined;
  /** Only tests with a chain on this chain id. */
  readonly chainId?: number | undefined;
  /** Only tests with a chain of this runtime. */
  readonly runtime?: ChainRuntime | undefined;
};

export type EntryPredicate = (entry: InventoryEntry) => boolean;

/**
 * Open question, "Selecting tests": the filters are to be defined. The specification names two
 * candidates: a regular expression on the test ID, and the chains a test uses. Until the filters are
 * defined, the engine applies those candidates, and this function is the only place that knows them.
 */
export function filtersOfTheSelection(filters: CandidateFilters): readonly EntryPredicate[] {
  const predicates: EntryPredicate[] = [];

  if (filters.match !== undefined) {
    const pattern = compilePattern(filters.match);
    predicates.push(({ id }) => pattern.test(id));
  }

  if (filters.chainId !== undefined) {
    const chainId = filters.chainId;
    predicates.push(({ test }) => test.chains.some((chain) => chain.chainid === chainId));
  }

  if (filters.runtime !== undefined) {
    const runtime = filters.runtime;
    predicates.push(({ test }) => test.chains.some((chain) => chain.runtime === runtime));
  }

  if (predicates.length > 0) {
    logToBeImplemented('the filters of the selection. The engine applies the candidate filters for now.');
  }

  return predicates;
}

function compilePattern(source: string): RegExp {
  try {
    return new RegExp(source);
  } catch (error) {
    throw new TestEngineError(`'${source}' is not a valid regular expression: ${errorMessage(error)}`);
  }
}

////////////////////////////////////////////////////////////////////////////////
// Failures: the exit status of a failed run
////////////////////////////////////////////////////////////////////////////////

/** The exit status the engine uses today when the run itself fails. */
export const RUN_FAILURE_EXIT_STATUS = 2;

/**
 * Open question, "Failures": how the exit status reflects a failure of the run itself, such as an
 * invalid inventory. The engine returns one fixed status, different from the status of a failed test,
 * until the question is answered.
 */
export function exitStatusOfAFailedRun(): number {
  logToBeImplemented(
    `how the exit status reflects a failure of the run itself. The engine exits with ${RUN_FAILURE_EXIT_STATUS} for now.`,
  );

  return RUN_FAILURE_EXIT_STATUS;
}

/**
 * Open question, "Dry run": what makes a dry run fail. The specification says only that a test never
 * does. Until the question is answered, a dry run checks nothing of its own: it fails only where any
 * run fails, as on an invalid inventory.
 */
export function whatMakesADryRunFail(): void {
  logToBeImplemented('what makes a dry run fail. The dry run checks nothing of its own for now.');
}

////////////////////////////////////////////////////////////////////////////////
// To be defined
////////////////////////////////////////////////////////////////////////////////

/**
 * Open question 3, "To be defined": whether a test can have a time limit of its own. Until the question
 * is answered, one limit applies to every test of a run: the one the run was launched with. Returns that
 * limit in milliseconds, or undefined when the run has none.
 */
export function timeLimitOfATest(runLimitSeconds: number | undefined): number | undefined {
  logToBeImplemented('a time limit for each test. One limit applies to every test of the run for now.');

  return runLimitSeconds === undefined ? undefined : runLimitSeconds * 1000;
}

/**
 * Open question 4, "To be defined": how the measured durations relate to the `duration` field of the
 * inventory. Until the question is answered, the report holds the measured durations, and the engine
 * reads the field for one thing only: the weight of a test, when it builds the lanes.
 */
export function measuredDurationsAndTheDurationField(): void {
  logToBeImplemented(
    "how the measured durations relate to the inventory's 'duration' field. The engine reads the field to build the lanes only, for now.",
  );
}

/**
 * Open question 5, "To be defined": stopping the nodes the engine started, after success, failure, or
 * interruption. Until the question is answered, the engine follows its implementation rules: it stops
 * each node, with its whole process group, when the test of the node ends.
 */
export function stoppingTheNodesTheEngineStarted(): void {
  logToBeImplemented('stopping the nodes the engine started. The engine stops each node when its test ends for now.');
}

/**
 * Open question 6, "To be defined": whether a test's result must be independent of the order and of
 * the degree of parallelism. Until the question is answered, the engine starts every test at once and
 * checks no such independence.
 */
export function independenceFromOrderAndParallelism(): void {
  logToBeImplemented(
    "whether a test's result must be independent of the order and of the degree of parallelism. The engine does not check it for now.",
  );
}

/**
 * Open question 7, "To be defined": how the output of each test is kept apart from the others. Until
 * the question is answered, each test writes to one file of its own, named by its ID, and the node that
 * the engine started for it to another. Returns the functions that give a test its two files.
 */
export function outputOfEachTest(logsDirectory: string): OutputFiles {
  logToBeImplemented(
    'how the output of each test is kept apart. Each test has one log file, and its node another, for now.',
  );

  return {
    logFileOf: (id) => join(logsDirectory, `${id}.log`),
    nodeLogFileOf: (id) => join(logsDirectory, `${id}.node.log`),
  };
}

/**
 * Open question 9, "To be defined": how the inventory records the resources that isolation needs,
 * other than ports. No field records one yet. Until the question is answered, the engine keeps no two
 * tests apart: every test may run at the same time as any other.
 */
export function resourcesThatIsolationNeeds(): void {
  logToBeImplemented(
    'how the inventory records the resources that isolation needs. The engine keeps no two tests apart for now.',
  );
}

/**
 * Open question 11, "To be defined": what happens to a run that is interrupted, which state its tests
 * get, and what the report contains. Until the question is answered, the engine stops every running
 * command, lets each test end as failed, and writes the report as for any run.
 */
export function interruptedRun(): void {
  logToBeImplemented(
    'what happens to an interrupted run. The engine stops every command, and each stopped test is failed, for now.',
  );
}

////////////////////////////////////////////////////////////////////////////////
// Nodes
////////////////////////////////////////////////////////////////////////////////

/**
 * Open question, "Nodes": a chain with `"startedBy": "test"` is a node the test starts itself. Such a
 * test is to be rewritten to accept a node that the engine gives it. How the engine gives that node,
 * and what the chain's `startedBy` becomes, is left open. Until the question is answered, the engine
 * starts no node for such a chain, and gives the test none.
 */
export function nodeOfATestThatStartsItsOwn(): void {
  logToBeImplemented(
    'how the engine gives a node to a test with "startedBy": "test". The engine starts no node for such a test for now.',
  );
}

/** Where the output of a test goes, and where the output of its node goes. */
export type OutputFiles = {
  readonly logFileOf: (id: string) => string;
  readonly nodeLogFileOf: (id: string) => string;
};

/** What a test command needs to find the node that the engine started for it. */
export type NodeAddress = {
  readonly url: string;
  readonly port: number;
};

/**
 * Open question: how a test command learns where the node that the engine started for it is. The
 * specification does not say. Until it does, the engine sets the two variables that the draft of its
 * implementation rules names, for an anvil node and for a Hardhat node alike. Returns the function
 * that gives a command its environment.
 */
export function howACommandFindsItsNode(): (node: NodeAddress) => NodeJS.ProcessEnv {
  logToBeImplemented(
    'how a test command finds the node that the engine started for it. The engine sets ANVIL_RPC_URL and ANVIL_PORT for now.',
  );

  return (node) => ({ ...environmentWithoutGuid(), ANVIL_RPC_URL: node.url, ANVIL_PORT: String(node.port) });
}
