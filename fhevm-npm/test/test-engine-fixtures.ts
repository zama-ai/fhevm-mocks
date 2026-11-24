import { type ChildProcess, spawn } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import type { TestContext } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';

import {
  CHAIN_RUNTIMES,
  type Chain,
  type Inventory,
  type NodeChain,
  type Test,
} from '../base/test-engine/inventory.ts';
import type { Report } from '../base/test-engine/report.ts';
import { testEngineCommand } from '../commands/test-engine.ts';

/**
 * A small schema for these unit tests only. The real schema of the inventory lives outside this
 * repository, with the specification, and the engine holds no copy of it. This one keeps enough of its
 * shape to exercise the loader: the test ID pattern, the required fields, and one enumeration.
 */
export const FIXTURE_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: { $schema: { type: 'string' } },
  propertyNames: { pattern: '^(\\$schema|test-[a-z0-9]+(-[a-z0-9]+)*)$' },
  additionalProperties: {
    type: 'object',
    required: ['command', 'package', 'ci', 'chains'],
    additionalProperties: false,
    properties: {
      command: { type: 'string', minLength: 1 },
      package: { type: 'string', minLength: 1 },
      duration: { enum: ['fast', 'slow', 'very-slow'] },
      ci: { type: 'boolean' },
      skipped: { const: true },
      read: { type: 'array', items: { type: 'string', minLength: 1 } },
      write: { type: 'array', items: { type: 'string', minLength: 1 } },
      chains: {
        type: 'array',
        items: {
          type: 'object',
          required: ['chainid', 'fhevm', 'runtime'],
          properties: {
            chainid: { type: 'integer', minimum: 1 },
            runtime: { enum: CHAIN_RUNTIMES },
            port: { type: ['integer', 'string'] },
          },
        },
      },
    },
  },
} as const;

export type FixtureRepository = {
  readonly root: string;
  readonly inventoryFile: string;
  readonly schemaFile: string;
};

export type FixtureRepositoryInput = {
  /** The test that owns the directory: the directory is removed when it ends. */
  readonly context: TestContext;
  readonly inventory: Readonly<Record<string, unknown>>;
};

/** Writes an inventory and the fixture schema to a new temporary directory. */
export function writeFixtureRepository(input: FixtureRepositoryInput): FixtureRepository {
  const root = mkdtempSync(join(tmpdir(), 'fhevm-npm-test-engine-'));
  const inventoryFile = join(root, 'ALL_TESTS.json');
  const schemaFile = join(root, 'ALL_TESTS.schema.json');

  input.context.after(() => rmSync(root, { recursive: true, force: true }));

  writeFileSync(schemaFile, JSON.stringify(FIXTURE_SCHEMA));
  writeFileSync(inventoryFile, JSON.stringify(input.inventory));

  return { root, inventoryFile, schemaFile };
}

/** A test entry that passes the schema, with the given fields replaced. */
export function fixtureTest(overrides: Partial<Test> = {}): Test {
  return { command: 'true', package: 'fixture', ci: true, chains: [], ...overrides };
}

export const ANVIL_CHAIN: NodeChain = {
  chainid: 31337,
  fhevm: 'local',
  runtime: 'anvil',
  startedBy: 'runner',
  fresh: true,
  // The system assigns the port: the tests of this file never fix one, so they can run beside each other.
  port: 0,
};

export const SEPOLIA_CHAIN: Chain = { chainid: 11155111, fhevm: 'testnet', runtime: 'remote', wallet: false };

/** An inventory built in memory, for the tests that need no file. */
export function fixtureInventory(tests: Readonly<Record<string, Test>>): Inventory {
  return { file: 'ALL_TESTS.json', schemaFile: 'ALL_TESTS.schema.json', tests: new Map(Object.entries(tests)) };
}

////////////////////////////////////////////////////////////////////////////////
// Running the engine
////////////////////////////////////////////////////////////////////////////////

const CLI = join(import.meta.dirname, '..', 'fhevm-npm.ts');

/** How long a test waits for something the engine must do, before it fails with what it waited for. */
const WAIT_LIMIT_MILLISECONDS = 20_000;

export type EngineInput = {
  readonly context: TestContext;
  /** The arguments after `test-engine`. */
  readonly argv: readonly string[];
};

export type CapturedEngine = {
  readonly status: number;
  readonly stdout: readonly string[];
  /** What the engine and commander wrote as errors and warnings, joined. */
  readonly stderr: string;
};

/** Runs the engine in this process, with its output captured instead of printed. */
export async function captureEngine(input: EngineInput): Promise<CapturedEngine> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const { mock } = input.context;

  mock.method(console, 'log', (line: string) => stdout.push(line));
  mock.method(console, 'warn', (line: string) => stderr.push(line));
  mock.method(console, 'error', (line: string) => stderr.push(line));
  mock.method(process.stderr, 'write', (text: string) => stderr.push(text) > 0);

  try {
    const status = await testEngineCommand(input.argv);

    return { status, stdout, stderr: stderr.join('\n') };
  } finally {
    mock.restoreAll();
  }
}

export type SpawnedEngine = {
  readonly process: ChildProcess;
  /** Resolves with the exit status, or with the name of the signal that ended the engine. */
  readonly exited: Promise<number | NodeJS.Signals | null>;
  /** Everything the engine printed so far, for a failure message. */
  readonly output: () => string;
};

/**
 * Starts the engine as a process of its own, for the tests that send it a signal. The process is
 * killed when the test ends, whatever the test did.
 */
export function spawnEngine(input: EngineInput): SpawnedEngine {
  // Without NODE_TEST_CONTEXT: with it, the child is a part of this test run, which ends it on SIGINT.
  const { NODE_TEST_CONTEXT: _unused, ...env } = process.env;
  const engine = spawn(process.execPath, [CLI, 'test-engine', ...input.argv], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const chunks: string[] = [];

  engine.stdout.on('data', (chunk: Buffer) => chunks.push(chunk.toString('utf8')));
  engine.stderr.on('data', (chunk: Buffer) => chunks.push(chunk.toString('utf8')));
  input.context.after(() => engine.kill('SIGKILL'));

  return {
    process: engine,
    exited: new Promise((resolveExit) => engine.once('close', (code, signal) => resolveExit(code ?? signal))),
    output: () => chunks.join(''),
  };
}

export type WaitUntilInput = {
  readonly condition: () => boolean | Promise<boolean>;
  /** What the test waits for, for the failure message. */
  readonly what: string;
  /** More to say when the wait fails, such as the output of the engine. */
  readonly details?: (() => string) | undefined;
};

/** Waits until the condition holds. Fails when it does not hold within the limit: it never hangs. */
export async function waitUntil(input: WaitUntilInput): Promise<void> {
  const deadline = performance.now() + WAIT_LIMIT_MILLISECONDS;

  while (!(await input.condition())) {
    if (performance.now() >= deadline) {
      throw new Error(`Waited too long for ${input.what}.\n${input.details?.() ?? ''}`);
    }

    await sleep(25);
  }
}

/** True when a process with this ID exists. */
export function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
}

export type ReadPidInput = {
  readonly repository: FixtureRepository;
  /** The file, relative to the root, that a test command wrote a process ID to. */
  readonly file: string;
};

/** The process ID that a test command wrote to a file, or undefined while the file is missing or empty. */
export function readPid(input: ReadPidInput): number | undefined {
  const path = join(input.repository.root, input.file);
  const text = existsSync(path) ? readFileSync(path, 'utf8').trim() : '';

  return text === '' ? undefined : Number(text);
}

////////////////////////////////////////////////////////////////////////////////
// Reading what a run left
////////////////////////////////////////////////////////////////////////////////

export type RepositoryInput = {
  readonly context: TestContext;
  readonly repository: FixtureRepository;
};

export type EngineRun = CapturedEngine & {
  readonly report: Report;
  /** The state of each test in the report, by ID. */
  readonly states: Readonly<Record<string, string>>;
};

/** Runs `run` on a fixture repository in this process, and reads the report it wrote at the default place. */
export async function runEngine(input: RepositoryInput & { readonly argv?: readonly string[] }): Promise<EngineRun> {
  const argv = ['run', '--max-lanes', '4', '--root', input.repository.root, ...(input.argv ?? [])];
  const captured = await captureEngine({ context: input.context, argv });
  const report = readReport(input.repository);

  return { ...captured, report, states: reportStates(report) };
}

export function reportFileOf(repository: FixtureRepository): string {
  return join(repository.root, 'test-report.json');
}

export function readReport(repository: FixtureRepository): Report {
  return JSON.parse(readFileSync(reportFileOf(repository), 'utf8')) as Report;
}

export function reportStates(report: Report): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.entries(report.tests).map(([id, entry]) => [id, entry.state]));
}

export type ReadLogInput = {
  readonly repository: FixtureRepository;
  readonly id: string;
};

/** The log of one test, at the default place. */
export function readLog(input: ReadLogInput): string {
  return readFileSync(join(input.repository.root, 'test-logs', `${input.id}.log`), 'utf8');
}

/** The log of the node that the engine started for one test, at the default place. */
export function readNodeLog(input: ReadLogInput): string {
  return readFileSync(join(input.repository.root, 'test-logs', `${input.id}.node.log`), 'utf8');
}

export type EnvironmentInput = {
  readonly context: TestContext;
  readonly variables: Readonly<Record<string, string>>;
};

/** Sets environment variables of this process for the rest of the test, and restores them after. */
export function withEnvironment(input: EnvironmentInput): void {
  for (const [name, value] of Object.entries(input.variables)) {
    const before = process.env[name];

    process.env[name] = value;
    input.context.after(() => {
      if (before === undefined) delete process.env[name];
      else process.env[name] = before;
    });
  }
}

////////////////////////////////////////////////////////////////////////////////
// Stand-in nodes
////////////////////////////////////////////////////////////////////////////////

/**
 * A program that stands in for `anvil`, and for `npx hardhat node`, in these unit tests: the real ones
 * are not installed where the unit tests run. It listens on `--port` and answers every call with its
 * chain id, as a node answers `eth_chainId`. It records its process ID and its FHEVM_GUID in
 * `node-<port>.json`, in the directory it starts from.
 * - FAKE_NODE_FAILS: the node prints this reason and exits instead of listening.
 * - FAKE_NODE_CHAIN_ID: the node answers with this chain id, whatever it was asked for.
 * - FAKE_NODE_LIFETIME_MILLISECONDS: the node exits with status 9 after this time.
 * - FAKE_NODE_START_DELAY_MILLISECONDS: the node waits this long before it listens, as a slow node does.
 * - FAKE_NODE_PRINTS_LINES: the node prints this many numbered lines when it starts, as a talkative node does.
 */
const FAKE_NODE_SOURCE = `#!/usr/bin/env node
const http = require('node:http');
const fs = require('node:fs');

const args = process.argv.slice(2);
const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const port = Number(valueOf('--port'));
const chainId = Number(process.env.FAKE_NODE_CHAIN_ID ?? valueOf('--chain-id') ?? 31337);

for (let line = 1; line <= Number(process.env.FAKE_NODE_PRINTS_LINES ?? 0); line += 1) {
  console.log('node line ' + line);
}

if (process.env.FAKE_NODE_FAILS !== undefined) {
  console.error('fake node: ' + process.env.FAKE_NODE_FAILS);
  process.exit(7);
}

if (process.env.FAKE_NODE_LIFETIME_MILLISECONDS !== undefined) {
  setTimeout(() => process.exit(9), Number(process.env.FAKE_NODE_LIFETIME_MILLISECONDS));
}

setTimeout(() => {
  fs.writeFileSync('node-' + port + '.json', JSON.stringify({ pid: process.pid, guid: process.env.FHEVM_GUID }));

  http
    .createServer((request, response) => {
      request.resume();
      request.on('end', () => response.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x' + chainId.toString(16) })));
    })
    .listen(port, '127.0.0.1');
}, Number(process.env.FAKE_NODE_START_DELAY_MILLISECONDS ?? 0));
`;

/** A script for a test command: it prints the chain id that the node of `ANVIL_RPC_URL` answers with. */
const ASK_CHAIN_ID_SOURCE = `
const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] });

fetch(process.env.ANVIL_RPC_URL, { method: 'POST', body })
  .then((response) => response.json())
  .then((answer) => console.log('chain id ' + Number.parseInt(answer.result, 16)));
`;

/** The command that runs the script above from the root of a fixture repository. */
export const ASK_CHAIN_ID_COMMAND = 'node ask-chain-id.cjs';

/**
 * Makes `anvil` and `npx` the stand-in node for the rest of the test, for the engine that runs in this
 * process and for an engine that the test spawns. Writes the chain id script to the repository.
 */
export function installFakeNodes(input: RepositoryInput): void {
  const bin = join(input.repository.root, 'fake-bin');

  mkdirSync(bin);

  for (const name of ['anvil', 'npx']) {
    writeFileSync(join(bin, name), FAKE_NODE_SOURCE);
    chmodSync(join(bin, name), 0o755);
  }

  writeFileSync(join(input.repository.root, 'ask-chain-id.cjs'), ASK_CHAIN_ID_SOURCE);

  withEnvironment({
    context: input.context,
    variables: { PATH: `${bin}${delimiter}${process.env['PATH'] ?? ''}` },
  });
}

/** What a stand-in node recorded about itself. */
export type FakeNodeRecord = {
  readonly port: number;
  readonly pid: number;
  readonly guid: string | undefined;
};

/** The record of every stand-in node that started from the root of the repository. */
export function fakeNodeRecords(repository: FixtureRepository): readonly FakeNodeRecord[] {
  return readdirSync(repository.root).flatMap((name) => {
    const port = /^node-(\d+)\.json$/.exec(name)?.[1];
    const text = port === undefined ? '' : readFileSync(join(repository.root, name), 'utf8');

    // A record that its node is still writing is read at the next look.
    return text === '' ? [] : [{ port: Number(port), ...(JSON.parse(text) as Omit<FakeNodeRecord, 'port'>) }];
  });
}
