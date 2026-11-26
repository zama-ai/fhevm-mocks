import { resolve } from 'node:path';

import { Command, CommanderError, InvalidArgumentError, Option } from 'commander';

import { listEngineNodes, stopEngineNodes } from '../base/test-engine/engine-processes.ts';
import { ENV_FILE_OPTION_DEFAULT, applyEnvFile, envFileLines } from '../base/test-engine/env-file.ts';
import { TestEngineError } from '../base/test-engine/errors.ts';
import { FAILURE_EXIT_STATUS, RUN_FAILURE_EXIT_STATUS, SUCCESS_EXIT_STATUS } from '../base/test-engine/exit-status.ts';
import { duplicateCases, listCases, listedLine } from '../base/test-engine/duplicates.ts';
import { CHAIN_RUNTIMES, type ChainRuntime, type Inventory, loadInventory } from '../base/test-engine/inventory.ts';
import {
  DEFAULT_LIVE_CHAIN_LANES,
  LIVE_CHAIN_LANES_VARIABLE,
  type Shard,
  WHOLE_SELECTION,
  checkPorts,
  generateLanes,
  laneLines,
  parseShard,
  shardLines,
  shardsOfSelection,
} from '../base/test-engine/lanes.ts';
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
import { checkReport, checkShardReports } from '../base/test-engine/report-check.ts';
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
  readonly live?: boolean | undefined;
  readonly wallet?: boolean | undefined;
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
    readonly liveChainLanes?: number | undefined;
    readonly shard?: Shard | undefined;
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
    const program = testEngineProgram(reportingStatus);

    requireCommandFirst({ argv, program });
    await program.parseAsync([...argv], { from: 'user' });
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

type CommandFirstInput = {
  readonly argv: readonly string[];
  readonly program: Command;
};

/**
 * Fails when the command line starts with an option, as in `test-engine --ci --max-lanes 4`. Every
 * option belongs to a command, so commander would only say that the option is unknown. This says what
 * is missing: the command. Asking for help needs no command.
 */
function requireCommandFirst(input: CommandFirstInput): void {
  const [first] = input.argv;

  if (first === undefined || !first.startsWith('-') || first === '-h' || first === '--help') return;

  const commands = input.program.commands.map((command) => command.name()).filter((name) => name !== 'help');

  throw new TestEngineError(
    `'${first}' is an option, and no command is named before it. Name the command first, as in ` +
      `'test-engine run ${first} ...'. The commands are: ${commands.join(', ')}.`,
  );
}

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
    .description('Print each test that the selection holds, with its selection state and its chains. Runs nothing.')
    .action(reportingStatus(listSelection));

  addSelectionOptions(addLocationOptions(program.command('lanes [ids...]')))
    .description(
      'Print the lanes of the selected tests. Tests that state the same port share a lane, and run one after the other.',
    )
    .requiredOption(...MAX_LANES_OPTION)
    .option(...LIVE_CHAIN_LANES_OPTION)
    .option(...SHARD_OPTION)
    .option('--json', 'print the lanes as JSON', false)
    .action(reportingStatus(printLanes));

  addSelectionOptions(addLocationOptions(program.command('shards <n> [ids...]')))
    .description('Print the shards of the selected tests, for n machines: which tests each machine runs. Runs nothing.')
    .option(...LIVE_CHAIN_LANES_OPTION)
    .option('--json', 'print the shards as JSON', false)
    .action(reportingStatus(printShards));

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
    .option(...LIVE_CHAIN_LANES_OPTION)
    .option(...SHARD_OPTION)
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

  addSelectionOptions(addLocationOptions(program.command('duplicates [ids...]')))
    .description(
      'Run the list command of each selected test, and report each test case that two tests select. Runs no test.',
    )
    .action(reportingStatus(checkDuplicates));

  program
    .command('check-report <reports...>')
    .description(
      'Check that a final report gives every test one state, and every test that ran a duration. ' +
        'Given the reports of all the shards of a selection, also check that together they ran every selected test once.',
    )
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
    .addOption(new Option('--runtime <runtime>', 'only the tests with a chain of this runtime').choices(CHAIN_RUNTIMES))
    .option('--live', 'only the tests with a live chain: a fork, or the remote chain itself')
    .option('--no-live', 'only the tests with no live chain')
    .option('--wallet', 'only the tests with a chain that needs a wallet: a funded account on a remote chain')
    .option('--no-wallet', 'only the tests with no chain that needs a wallet');
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

/**
 * The shard that a run is. A selection that several machines run is split into as many shards, and each
 * machine is given the same selection with its own shard.
 */
const SHARD_OPTION = [
  '--shard <k/n>',
  'run shard k of the n shards of the selection, as in 2/3: the share of one machine (default: 1/1, the whole selection)',
  parseShard,
] as const;

/**
 * How many lanes can hold tests that use a live chain. The provider of an RPC limits the requests of
 * one key, so by default one lane holds them all. A run with a plan that allows more names a number.
 */
const LIVE_CHAIN_LANES_OPTION = [
  '--live-chain-lanes <n>',
  `how many lanes can hold tests that use a live chain: 1 keeps every such test apart from the others ` +
    `(default: the variable ${LIVE_CHAIN_LANES_VARIABLE}, then ${DEFAULT_LIVE_CHAIN_LANES})`,
  parseLiveChainLanes,
] as const;

function parseLiveChainLanes(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new InvalidArgumentError('A number of lanes for live chains is a whole number, 1 or more.');
  }

  return Number(value);
}

/** The lanes for live chains: the option, then the variable, then the default. */
function liveChainLanes(options: { readonly liveChainLanes?: number | undefined }): number {
  const fromVariable = process.env[LIVE_CHAIN_LANES_VARIABLE];

  if (options.liveChainLanes !== undefined) return options.liveChainLanes;

  if (fromVariable === undefined || fromVariable === '') return DEFAULT_LIVE_CHAIN_LANES;

  if (!/^[1-9]\d*$/.test(fromVariable)) {
    throw new TestEngineError(
      `${LIVE_CHAIN_LANES_VARIABLE} is '${fromVariable}', and must be a whole number, 1 or more.`,
    );
  }

  return Number(fromVariable);
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

  const held = resolved.filter((entry) => entry.state !== 'not-selected');

  for (const line of selectionLines(held)) console.log(line);

  return SUCCESS_EXIT_STATUS;
}

/**
 * The tests that the check reads: those of the selection that can run, available or not. A test that is
 * unavailable here runs where its variables are set, so its cases count.
 */
function checkDuplicates(ids: readonly string[], options: LocationOptions & SelectionOptions): number {
  const inventory = loadInventoryAt(options);
  const resolved = resolveSelection({
    inventory,
    request: selectionRequest({ ids, options }),
    environment: process.env,
  });
  const entries = resolved.filter((entry) => entry.state === 'selected' || entry.state === 'unavailable');
  const unlisted = entries.filter((entry) => entry.test.list === undefined).map((entry) => entry.id);

  console.log(`▶ Listing the cases of ${entries.length - unlisted.length} test(s), from ${resolve(options.root)}.`);

  const listed = listCases({ entries, root: resolve(options.root), onListed: (one) => console.log(listedLine(one)) });
  const duplicates = duplicateCases(listed);
  const caseCount = new Set(listed.flatMap((one) => one.cases)).size;

  for (const { testCase, ids: owners } of duplicates)
    console.error(`❌ ${testCase}  is selected by ${owners.join(', ')}`);

  if (unlisted.length > 0) console.log(`${unlisted.length} test(s) have no list command, and are not checked.`);

  if (duplicates.length > 0) {
    console.error(`❌ ${duplicates.length} of ${caseCount} case(s) are selected by more than one test.`);

    return FAILURE_EXIT_STATUS;
  }

  console.log(`✅ ${caseCount} case(s), listed by ${listed.length} test(s): none is selected by two tests.`);

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
    liveChainLanes: liveChainLanes(options),
    shard: options.shard ?? WHOLE_SELECTION,
    strict: options.strict,
    progressIntervalSeconds: options.progress === 0 ? undefined : options.progress,
    nodeLogLines: nodeLogLines(options),
  };

  const report = options.dryRun ? dryRunSelection(input) : await runSelection(input);

  return countStates(report).failed > 0 ? FAILURE_EXIT_STATUS : SUCCESS_EXIT_STATUS;
}

function checkFinalReport(reportFiles: readonly string[], options: CheckReportOptions): number {
  const inventory = inventoryOfReportCheck(options);
  const reports = reportFiles.map((file) => ({ file, report: readJsonObject(resolve(file)) }));
  const several = reports.length > 1;
  const problems = [
    ...reports.flatMap(({ file, report }) => {
      const found = checkReport({ report, inventory, ci: options.ci });

      // With one report, the problems read as before. With several, each one names its file.
      return several ? found.map((problem) => `${file}: ${problem}`) : found;
    }),
    // Several reports are those of the shards of one selection.
    ...(several ? checkShardReports(reports) : []),
  ];

  for (const problem of problems) console.error(`❌ ${problem}`);

  if (problems.length > 0) return FAILURE_EXIT_STATUS;

  console.log(`✅ ${reportFiles.join(', ')}: no problem found.`);

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

type LanesOptions = LocationOptions &
  SelectionOptions & {
    readonly json: boolean;
    readonly maxLanes: number;
    readonly liveChainLanes?: number | undefined;
    readonly shard?: Shard | undefined;
  };

function printLanes(ids: readonly string[], options: LanesOptions): number {
  const inventory = loadInventoryAt(options);

  checkPorts(inventory);

  const resolved = resolveSelection({
    inventory,
    request: selectionRequest({ ids, options }),
    environment: process.env,
  });
  const entries = resolved.filter((entry) => entry.state === 'selected');
  const lanes = generateLanes({
    entries,
    maximum: options.maxLanes,
    liveChainLanes: liveChainLanes(options),
    shard: options.shard,
  });

  if (options.json) {
    const plan = lanes.map((lane) => {
      return { lane: lane.number, ports: lane.ports, liveChains: lane.liveChains, ids: lane.entries.map((e) => e.id) };
    });

    console.log(JSON.stringify(plan, undefined, 2));
  } else {
    for (const line of laneLines(lanes)) console.log(line);
  }

  return SUCCESS_EXIT_STATUS;
}

type ShardsOptions = LocationOptions &
  SelectionOptions & {
    readonly json: boolean;
    readonly liveChainLanes?: number | undefined;
  };

function printShards(count: string, ids: readonly string[], options: ShardsOptions): number {
  if (!/^[1-9]\d*$/.test(count)) {
    throw new TestEngineError(`The number of shards is a whole number, 1 or more: '${count}' is not.`);
  }

  const inventory = loadInventoryAt(options);

  checkPorts(inventory);

  const resolved = resolveSelection({
    inventory,
    request: selectionRequest({ ids, options }),
    environment: process.env,
  });
  const entries = resolved.filter((entry) => entry.state === 'selected');
  const shards = shardsOfSelection({ entries, liveChainLanes: liveChainLanes(options), count: Number(count) });

  if (options.json) {
    const plan = shards.map((tests, index) => ({ shard: index + 1, ids: tests.map((entry) => entry.id) }));

    console.log(JSON.stringify(plan, undefined, 2));
  } else {
    for (const line of shardLines(shards)) console.log(line);
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
      live: input.options.live,
      wallet: input.options.wallet,
    },
  };
}
