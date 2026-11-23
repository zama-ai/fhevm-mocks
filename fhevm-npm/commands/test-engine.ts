import { resolve } from 'node:path';

import { Command, CommanderError, InvalidArgumentError, Option } from 'commander';

import { listEngineNodes, stopEngineNodes } from '../base/test-engine/engine-processes.ts';
import { ENV_FILE_OPTION_DEFAULT, applyEnvFile, envFileLines } from '../base/test-engine/env-file.ts';
import { TestEngineError } from '../base/test-engine/errors.ts';
import { FAILURE_EXIT_STATUS, RUN_FAILURE_EXIT_STATUS, SUCCESS_EXIT_STATUS } from '../base/test-engine/exit-status.ts';
import { CHAIN_RUNTIMES, type ChainRuntime, type Inventory, loadInventory } from '../base/test-engine/inventory.ts';
import { checkPorts, generateLanes, laneLines } from '../base/test-engine/lanes.ts';
import { selectionLines } from '../base/test-engine/listing.ts';
import {
  INVENTORY_OPTION_DEFAULT,
  LOGS_OPTION_DEFAULT,
  LOGS_VARIABLE,
  type LocationOptions,
  type Locations,
  REPORT_OPTION_DEFAULT,
  REPORT_VARIABLE,
  resolveLocations,
} from '../base/test-engine/locations.ts';
import { readJsonObject } from '../base/test-engine/json.ts';
import { DEFAULT_NODE_LOG_LINES, NODE_LOG_LINES_VARIABLE } from '../base/test-engine/node-log.ts';
import { checkReport } from '../base/test-engine/report-check.ts';
import { countStates } from '../base/test-engine/report.ts';
import { dryRunSelection, removeEarlierReport, runSelection } from '../base/test-engine/run.ts';
import { type SelectionRequest, resolveSelection } from '../base/test-engine/selection.ts';

/** The name of the command inside `fhevm-npm`. */
export const TEST_ENGINE_COMMAND = 'test-engine';

/** How long one test may take when the run names no limit: one hour. */
const DEFAULT_TIME_LIMIT_SECONDS = 3600;

/** How often a run prints the tests that are still running, when the run names no interval. */
const DEFAULT_PROGRESS_INTERVAL_SECONDS = 30;

type SelectionOptions = {
  readonly match?: string | undefined;
  readonly ci: boolean;
  readonly chain?: number | undefined;
  readonly runtime?: ChainRuntime | undefined;
};

type RunOptions = LocationOptions &
  SelectionOptions & {
    readonly dryRun: boolean;
    readonly verbose: boolean;
    /** In seconds. 0 means no limit. */
    readonly timeout: number;
    /** In seconds. 0 means that the run never prints the tests that are still running. */
    readonly progress: number;
    readonly build?: string | undefined;
    readonly maxLanes: number;
    readonly strict: boolean;
    readonly nodeLogLines?: number | undefined;
  };

type CheckReportOptions = {
  readonly inventory?: string | undefined;
  readonly schema?: string | undefined;
  readonly ci: boolean;
};

/** What a subcommand does once its command line is parsed. It returns the exit status. */
type Handler<Arguments extends readonly unknown[]> = (...parsed: Arguments) => number | Promise<number>;

/**
 * Runs the test engine with its own arguments, and returns its exit status. The engine parses its own
 * command line: it shares no option with the other commands of `fhevm-npm`, and reads no file of the
 * repository that holds it.
 */
export async function testEngineCommand(argv: readonly string[]): Promise<number> {
  let exitStatus = SUCCESS_EXIT_STATUS;

  // Every subcommand reports its exit status through this one wrapper.
  const reportingStatus = <Arguments extends readonly unknown[]>(handler: Handler<Arguments>) => {
    return async (...parsed: Arguments): Promise<void> => {
      exitStatus = await handler(...parsed);
    };
  };

  try {
    await testEngineProgram(reportingStatus).parseAsync([...argv], { from: 'user' });
  } catch (error) {
    // Commander asked to stop without a failure, as after --help.
    if (error instanceof CommanderError && error.exitCode === 0) return SUCCESS_EXIT_STATUS;

    // Anything else is a defect of the engine: it keeps its stack.
    if (!(error instanceof CommanderError) && !(error instanceof TestEngineError)) throw error;

    // Commander already printed its own errors, such as an unknown option.
    if (error instanceof TestEngineError) console.error(`❌ ${error.message}`);

    return RUN_FAILURE_EXIT_STATUS;
  }

  return exitStatus;
}

////////////////////////////////////////////////////////////////////////////////
// Command line
////////////////////////////////////////////////////////////////////////////////

type ActionWrapper = <Arguments extends readonly unknown[]>(
  handler: Handler<Arguments>,
) => (...parsed: Arguments) => Promise<void>;

function testEngineProgram(reportingStatus: ActionWrapper): Command {
  // exitOverride comes first: the commands created below inherit it, so no parse error exits the process.
  const program = new Command(`fhevm-npm ${TEST_ENGINE_COMMAND}`)
    .description('Run the tests that an inventory lists, from any repository.')
    .exitOverride();

  addLocationOptions(program.command('validate'))
    .description('Check the inventory against its schema.')
    .action(reportingStatus(validateInventory));

  addSelectionOptions(addLocationOptions(program.command('list [ids...]')))
    .description('Print each test of the inventory with its selection state and its chains. Runs nothing.')
    .action(reportingStatus(listSelection));

  addSelectionOptions(addLocationOptions(program.command('lanes [ids...]')))
    .description(
      'Print the lanes of the selected tests. Tests that state the same port share a lane, and run one after the other.',
    )
    .requiredOption(...MAX_LANES_OPTION)
    .option('--json', 'print the lanes as JSON', false)
    .action(reportingStatus(printLanes));

  addSelectionOptions(addLocationOptions(program.command('run [ids...]')))
    .description('Run the selected tests in parallel, and write the final report.')
    .option(
      '--report <file>',
      `where the final report goes (default: the variable ${REPORT_VARIABLE}, then ${REPORT_OPTION_DEFAULT})`,
    )
    .option(
      '--logs <dir>',
      `the directory that gets one log per test (default: the variable ${LOGS_VARIABLE}, then ${LOGS_OPTION_DEFAULT})`,
    )
    .requiredOption(...MAX_LANES_OPTION)
    .option(
      '--node-log-lines <n>',
      `how many of the last lines of a node's output to keep, in a file apart from the test's log ` +
        `(default: the variable ${NODE_LOG_LINES_VARIABLE}, then ${DEFAULT_NODE_LOG_LINES})`,
      parseLineCount,
    )
    .option('--strict', 'fail the run, before any test starts, on what the engine only warns about otherwise', false)
    .option('--dry-run', 'print what the run would run, run no test, and write the final report', false)
    .option('--verbose', "print each test's output as it runs, with the test ID in front", false)
    .option(
      '--build <command>',
      'a command that builds the workspace: run once from the root before any test; when it fails, no test runs',
    )
    .option(
      '--timeout <seconds>',
      'how long one test may take before it is stopped and failed; 0 for no limit',
      parseTimeLimit,
      DEFAULT_TIME_LIMIT_SECONDS,
    )
    .option(
      '--progress <seconds>',
      'how often to print the tests that are still running, with the time since each started; 0 for never',
      parseProgressInterval,
      DEFAULT_PROGRESS_INTERVAL_SECONDS,
    )
    .action(reportingStatus(runTestsOfSelection));

  program
    .command('check-report <report>')
    .description('Check that a final report gives every test one state, and every test that ran a duration.')
    .option('--inventory <file>', "also check the report against this inventory: its tests, and their 'skipped' values")
    .option('--schema <file>', "with --inventory: its schema (default: the file its '$schema' key names)")
    .option('--ci', 'with --inventory: also check that the run was a CI run, of the tests with "ci": true only', false)
    .action(reportingStatus(checkFinalReport));

  program
    .command('ps')
    .description('List the running processes of the nodes that the engine started, found by their FHEVM_GUID.')
    .action(reportingStatus(listNodes));

  program
    .command('kill [guids...]')
    .description('Stop the nodes with the given GUIDs, as ps lists them. Stops no other process.')
    .option('--all', 'stop every node of the engine that ps lists, on the whole machine', false)
    .action(reportingStatus(killNodes));

  return program;
}

function addLocationOptions(command: Command): Command {
  return command
    .option('--root <dir>', 'the directory each test command runs from', process.cwd())
    .option('--inventory <file>', `the inventory (default: ${INVENTORY_OPTION_DEFAULT})`)
    .option('--schema <file>', "the schema of the inventory (default: the file its '$schema' key names)")
    .option(
      '--env-file <file>',
      `a file of environment variables, as NAME=value lines, for what the environment does not set (default: ${ENV_FILE_OPTION_DEFAULT})`,
    );
}

function addSelectionOptions(command: Command): Command {
  return command
    .option('--match <regex>', 'only the tests whose ID matches this regular expression')
    .option('--ci', 'only the tests with "ci": true', false)
    .option('--chain <chainid>', 'only the tests with a chain on this chain id', parseChainId)
    .addOption(
      new Option('--runtime <runtime>', 'only the tests with a chain of this runtime').choices(CHAIN_RUNTIMES),
    );
}

/**
 * The most lanes a run may have. It is required, and has no default: the lanes must be the same on
 * every machine, so nothing about the machine may choose it.
 */
const MAX_LANES_OPTION = [
  '--max-lanes <n>',
  'the most lanes the run may have: tests of one lane run one after the other; 1 gives a serial run',
  parseMaximumLanes,
] as const;

function parseMaximumLanes(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) throw new InvalidArgumentError('A maximum of lanes is a whole number, 1 or more.');

  return Number(value);
}

function parseLineCount(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) throw new InvalidArgumentError('A number of lines is a whole number, 1 or more.');

  return Number(value);
}

/** The lines of a node's output to keep: the option, then the variable, then the default. */
function nodeLogLines(options: Pick<RunOptions, 'nodeLogLines'>): number {
  const fromVariable = process.env[NODE_LOG_LINES_VARIABLE];

  if (options.nodeLogLines !== undefined) return options.nodeLogLines;

  if (fromVariable === undefined || fromVariable === '') return DEFAULT_NODE_LOG_LINES;

  if (!/^[1-9]\d*$/.test(fromVariable)) {
    throw new TestEngineError(
      `${NODE_LOG_LINES_VARIABLE} is '${fromVariable}', and must be a whole number, 1 or more.`,
    );
  }

  return Number(fromVariable);
}

function parseTimeLimit(value: string): number {
  if (!/^\d+(\.\d+)?$/.test(value)) throw new InvalidArgumentError('A time limit is a number of seconds, or 0.');

  return Number(value);
}

function parseProgressInterval(value: string): number {
  if (!/^\d+(\.\d+)?$/.test(value)) throw new InvalidArgumentError('An interval is a number of seconds, or 0.');

  return Number(value);
}

function parseChainId(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) throw new InvalidArgumentError('A chain id is a positive integer.');

  return Number(value);
}

////////////////////////////////////////////////////////////////////////////////
// Subcommands
////////////////////////////////////////////////////////////////////////////////

function validateInventory(options: LocationOptions): number {
  const inventory = loadInventoryAt(options);

  checkPorts(inventory);

  console.log(`✅ ${inventory.file}: ${inventory.tests.size} test(s) match ${inventory.schemaFile}.`);

  return SUCCESS_EXIT_STATUS;
}

function listSelection(ids: readonly string[], options: LocationOptions & SelectionOptions): number {
  const inventory = loadInventoryAt(options);
  const resolved = resolveSelection({
    inventory,
    request: selectionRequest({ ids, options }),
    environment: process.env,
  });

  for (const line of selectionLines(resolved)) console.log(line);

  return SUCCESS_EXIT_STATUS;
}

async function runTestsOfSelection(ids: readonly string[], options: RunOptions): Promise<number> {
  const locations = locationsWithEnvFile(options);

  removeEarlierReport(locations);

  const inventory = loadInventory(locations);

  checkPorts(inventory);

  const resolved = resolveSelection({
    inventory,
    request: selectionRequest({ ids, options }),
    environment: process.env,
  });
  const timeLimitSeconds = options.timeout === 0 ? undefined : options.timeout;
  const input = {
    locations,
    inventory,
    resolved,
    verbose: options.verbose,
    timeLimitSeconds,
    buildCommand: options.build,
    maximumLanes: options.maxLanes,
    strict: options.strict,
    progressIntervalSeconds: options.progress === 0 ? undefined : options.progress,
    nodeLogLines: nodeLogLines(options),
  };

  const report = options.dryRun ? dryRunSelection(input) : await runSelection(input);

  return countStates(report).failed > 0 ? FAILURE_EXIT_STATUS : SUCCESS_EXIT_STATUS;
}

function checkFinalReport(reportFile: string, options: CheckReportOptions): number {
  const inventory = inventoryOfReportCheck(options);
  const problems = checkReport({ report: readJsonObject(resolve(reportFile)), inventory, ci: options.ci });

  for (const problem of problems) console.error(`❌ ${problem}`);

  if (problems.length > 0) return FAILURE_EXIT_STATUS;

  console.log(`✅ ${reportFile}: no problem found.`);

  return SUCCESS_EXIT_STATUS;
}

function inventoryOfReportCheck(options: CheckReportOptions): Inventory | undefined {
  if (options.inventory === undefined) {
    if (options.ci || options.schema !== undefined) throw new TestEngineError('--ci and --schema need --inventory.');

    return undefined;
  }

  return loadInventory({
    inventoryFile: resolve(options.inventory),
    schemaFile: options.schema === undefined ? undefined : resolve(options.schema),
  });
}

async function listNodes(): Promise<number> {
  for (const node of await listEngineNodes()) {
    console.log(`${node.guid}  group ${node.groupId}  pid ${node.pids.join(',')}`);
  }

  return SUCCESS_EXIT_STATUS;
}

async function killNodes(guids: readonly string[], options: { readonly all: boolean }): Promise<number> {
  // Stopping every node also stops the nodes of another run on the machine, so it is never a default.
  if (options.all === guids.length > 0) {
    throw new TestEngineError('Give the GUIDs of the nodes to stop, or --all to stop every node of the engine.');
  }

  const wanted = options.all ? (await listEngineNodes()).map((node) => node.guid) : guids;
  const stopped = await stopEngineNodes({ guids: wanted });

  for (const guid of wanted) {
    console.log(stopped.has(guid) ? `Stopped ${guid}.` : `No running node has the GUID ${guid}.`);
  }

  return SUCCESS_EXIT_STATUS;
}

type LanesOptions = LocationOptions & SelectionOptions & { readonly json: boolean; readonly maxLanes: number };

function printLanes(ids: readonly string[], options: LanesOptions): number {
  const inventory = loadInventoryAt(options);

  checkPorts(inventory);

  const resolved = resolveSelection({
    inventory,
    request: selectionRequest({ ids, options }),
    environment: process.env,
  });
  const entries = resolved.filter((entry) => entry.state === 'selected');
  const lanes = generateLanes({ entries, maximum: options.maxLanes });

  if (options.json) {
    const plan = lanes.map((lane) => ({ lane: lane.number, ports: lane.ports, ids: lane.entries.map((e) => e.id) }));

    console.log(JSON.stringify(plan, undefined, 2));
  } else {
    for (const line of laneLines(lanes)) console.log(line);
  }

  return SUCCESS_EXIT_STATUS;
}

function loadInventoryAt(options: LocationOptions): Inventory {
  return loadInventory(locationsWithEnvFile(options));
}

/**
 * Reads the env file of the run, then resolves its locations. The file comes first: it can set the
 * variables that say where the report and the logs go, and those that say which live chains a test
 * can reach. What the engine says about the file goes to the standard error, so that the standard
 * output of a command stays what the command prints.
 */
function locationsWithEnvFile(options: LocationOptions): Locations {
  const applied = applyEnvFile({ root: resolve(options.root), file: options.envFile, environment: process.env });

  if (applied !== undefined) for (const line of envFileLines(applied)) console.warn(`📄 ${line}`);

  return resolveLocations(options);
}

type SelectionRequestInput = {
  readonly ids: readonly string[];
  readonly options: SelectionOptions;
};

function selectionRequest(input: SelectionRequestInput): SelectionRequest {
  return {
    ids: input.ids,
    ci: input.options.ci,
    filters: {
      match: input.options.match,
      chainId: input.options.chain,
      runtime: input.options.runtime,
    },
  };
}
