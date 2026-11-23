import assert from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import { connect, createServer } from 'node:net';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';

import { portListener } from '../base/test-engine/engine-processes.ts';
import { GUID_PREFIX, engineGuidAmong, isEngineGuid, newGuid } from '../base/test-engine/guid.ts';
import type { NodeChain } from '../base/test-engine/inventory.ts';
import { openNodeLog } from '../base/test-engine/node-log.ts';
import { type RunningNode, startNode } from '../base/test-engine/nodes.ts';
import { RUN_FAILURE_EXIT_STATUS } from '../base/test-engine/exit-status.ts';
import { openTestLog } from '../base/test-engine/test-log.ts';
import {
  ANVIL_CHAIN,
  ASK_CHAIN_ID_COMMAND,
  type FixtureRepository,
  type SpawnedEngine,
  captureEngine,
  fakeNodeRecords,
  fixtureTest,
  installFakeNodes,
  processExists,
  readLog,
  readNodeLog,
  readPid,
  runEngine,
  spawnEngine,
  waitUntil,
  withEnvironment,
  writeFixtureRepository,
} from './test-engine-fixtures.ts';

const HARDHAT_CHAIN: NodeChain = { ...ANVIL_CHAIN, runtime: 'hardhat-node' };
const OWN_NODE_CHAIN: NodeChain = { ...ANVIL_CHAIN, startedBy: 'test' };

type NodeRepositoryInput = {
  readonly context: TestContext;
  readonly inventory: Readonly<Record<string, unknown>>;
};

/** A fixture repository where `anvil` and `npx hardhat node` are the stand-in node. */
function nodeRepository(input: NodeRepositoryInput): FixtureRepository {
  const { context } = input;
  const repository = writeFixtureRepository({
    context,
    inventory: { $schema: './ALL_TESTS.schema.json', ...input.inventory },
  });

  installFakeNodes({ context, repository });

  return repository;
}

/** The GUIDs that `ps` lists now. */
async function listedGuids(context: TestContext): Promise<readonly string[]> {
  const listing = await captureEngine({ context, argv: ['ps'] });

  return listing.stdout.map((line) => line.split('  ')[0] ?? '');
}

////////////////////////////////////////////////////////////////////////////////
// GUIDs
////////////////////////////////////////////////////////////////////////////////

test('a GUID has the prefix of the engine, and no two are the same', () => {
  const [first, second] = [newGuid(), newGuid()];

  assert.match(first, new RegExp(`^${GUID_PREFIX}-[0-9a-f-]{36}$`));
  assert.notEqual(first, second);
  assert.equal(isEngineGuid(first), true);
});

test('only a whole GUID of the engine is read from an environment', () => {
  const guid = newGuid();

  assert.equal(engineGuidAmong(['PATH=/bin', `FHEVM_GUID=${guid}`]), guid);
  assert.equal(engineGuidAmong(['PATH=/bin']), undefined);
  assert.equal(engineGuidAmong([`FHEVM_GUID=${guid.slice(0, -4)}`]), undefined, 'a value that was cut off');
  assert.equal(engineGuidAmong([`FHEVM_GUID=other-${guid}`]), undefined, 'the GUID of another tool');
  assert.equal(engineGuidAmong([`NOT_FHEVM_GUID=${guid}`]), undefined);
});

////////////////////////////////////////////////////////////////////////////////
// The node of a test
////////////////////////////////////////////////////////////////////////////////

test('a test with a runner chain finds its own new node running, with a GUID, and the node is stopped after', async (context) => {
  const repository = nodeRepository({
    context,
    inventory: {
      'test-passes': fixtureTest({ command: ASK_CHAIN_ID_COMMAND, chains: [{ ...ANVIL_CHAIN, chainid: 4242 }] }),
      'test-fails': fixtureTest({ command: `${ASK_CHAIN_ID_COMMAND}; exit 1`, chains: [ANVIL_CHAIN] }),
    },
  });

  const run = await runEngine({ context, repository });
  const nodes = fakeNodeRecords(repository);
  const passedLog = readLog({ repository, id: 'test-passes' });

  assert.deepEqual(run.states, { 'test-passes': 'passed', 'test-fails': 'failed' });
  assert.match(passedLog, /answers at http.*\n\$ node ask-chain-id\.cjs\nchain id 4242\n/s);
  assert.match(passedLog, /Node fhevm-test-engine-\S+ is stopped\.\nThe last lines of the node's output are in \S+\n$/);
  assert.match(readLog({ repository, id: 'test-fails' }), /chain id 31337\n/);
  assert.equal(nodes.length, 2);

  for (const node of nodes) {
    assert.equal(isEngineGuid(node.guid ?? ''), true, 'the node carries a GUID of the engine');
    assert.equal(processExists(node.pid), false, 'the node is stopped, whether its test passed or failed');
  }
});

test('two tests that run at the same time never share a node', async (context) => {
  // Each command waits for the other one, so both nodes are up at the same time.
  const meet = (names: { readonly own: string; readonly other: string }): string =>
    `echo $ANVIL_PORT > ${names.own}.port; ` +
    `for i in $(seq 1 200); do [ -f ${names.other}.port ] && exit 0; sleep 0.05; done; exit 1`;
  const repository = nodeRepository({
    context,
    inventory: {
      'test-a': fixtureTest({ command: meet({ own: 'a', other: 'b' }), chains: [ANVIL_CHAIN] }),
      'test-b': fixtureTest({ command: meet({ own: 'b', other: 'a' }), chains: [ANVIL_CHAIN] }),
    },
  });

  const run = await runEngine({ context, repository });
  const ports = ['a.port', 'b.port'].map((file) => readPid({ repository, file }));
  const nodes = fakeNodeRecords(repository);

  assert.deepEqual(run.states, { 'test-a': 'passed', 'test-b': 'passed' });
  assert.notEqual(ports[0], ports[1]);
  assert.deepEqual(nodes.map((node) => node.port).sort(), [...ports].sort());
  assert.notEqual(nodes[0]?.guid, nodes[1]?.guid);
});

test('the output of a node is kept apart from the log of its test, and only its last lines are kept', async (context) => {
  const repository = nodeRepository({
    context,
    inventory: {
      'test-with-node': fixtureTest({ command: 'echo "the test speaks"', chains: [ANVIL_CHAIN] }),
      'test-without-node': fixtureTest({ command: 'echo "no node here"' }),
    },
  });

  withEnvironment({ context, variables: { FAKE_NODE_PRINTS_LINES: '40' } });

  await runEngine({ context, repository, argv: ['--node-log-lines', '5'] });

  const log = readLog({ repository, id: 'test-with-node' });
  const nodeLog = readNodeLog({ repository, id: 'test-with-node' });

  assert.match(log, /the test speaks/);
  assert.doesNotMatch(log, /node line/, 'no line of the node is in the log of the test');
  assert.deepEqual(nodeLog.trimEnd().split('\n'), [
    '[The node printed 35 line(s) before these. Only its last 5 are kept.]',
    'node line 36',
    'node line 37',
    'node line 38',
    'node line 39',
    'node line 40',
  ]);
  // A test without a node of the engine has no node log.
  assert.throws(() => readNodeLog({ repository, id: 'test-without-node' }), { code: 'ENOENT' });
});

test('the number of lines kept comes from the option, then from the variable, then is 500', async (context) => {
  const repository = nodeRepository({
    context,
    inventory: { 'test-with-node': fixtureTest({ chains: [ANVIL_CHAIN] }) },
  });
  const linesKept = (): number => readNodeLog({ repository, id: 'test-with-node' }).trimEnd().split('\n').length - 1;

  withEnvironment({ context, variables: { FAKE_NODE_PRINTS_LINES: '700' } });
  await runEngine({ context, repository });
  assert.equal(linesKept(), 500, 'the default');

  withEnvironment({ context, variables: { FHEVM_TEST_NODE_LOG_LINES: '20' } });
  await runEngine({ context, repository });
  assert.equal(linesKept(), 20, 'the variable');

  await runEngine({ context, repository, argv: ['--node-log-lines', '3'] });
  assert.equal(linesKept(), 3, 'the option wins over the variable');

  const invalid = await captureEngine({
    context,
    argv: ['run', '--max-lanes', '4', '--root', repository.root, '--node-log-lines', '0'],
  });

  assert.equal(invalid.status, RUN_FAILURE_EXIT_STATUS);
  assert.match(invalid.stderr, /A number of lines is a whole number, 1 or more/);
});

test('a Hardhat node is started for a hardhat-node chain', async (context) => {
  const repository = nodeRepository({
    context,
    inventory: { 'test-hardhat': fixtureTest({ command: ASK_CHAIN_ID_COMMAND, chains: [HARDHAT_CHAIN] }) },
  });

  const run = await runEngine({ context, repository });

  assert.deepEqual(run.states, { 'test-hardhat': 'passed' });
  assert.match(readLog({ repository, id: 'test-hardhat' }), /\$ npx --no-install hardhat node .*--port \d+\n/);
});

/** The fixed ports that this file already used: no two tests of it get the same one. */
const usedFixedPorts = new Set<number>();

/**
 * A fixed port that is free now: one below the ports that the system assigns by itself, which is where
 * a fixed port must be. The system cannot be asked for one, so this tries ports until one can be bound.
 */
async function freeFixedPort(): Promise<number> {
  for (;;) {
    const port = 20_000 + Math.floor(Math.random() * 10_000);
    const canBind = await new Promise<boolean>((resolveBind) => {
      const server = createServer();

      server.once('error', () => resolveBind(false));
      server.listen({ port, host: '127.0.0.1' }, () => server.close(() => resolveBind(true)));
    });

    if (canBind && !usedFixedPorts.has(port)) {
      usedFixedPorts.add(port);

      return port;
    }
  }
}

/** True when a process accepts connections on the port. */
function isListening(port: number): Promise<boolean> {
  return new Promise((resolveListening) => {
    const socket = connect({ port, host: '127.0.0.1' });

    socket.once('connect', () => {
      socket.destroy();
      resolveListening(true);
    });
    socket.once('error', () => resolveListening(false));
  });
}

test('a runner chain with a fixed port gets its node on that port, and nowhere else', async (context) => {
  const free = await freeFixedPort();
  const taken = await freeFixedPort();
  const repository = nodeRepository({
    context,
    inventory: {
      'test-fixed': fixtureTest({ command: 'echo "port: $ANVIL_PORT"', chains: [{ ...ANVIL_CHAIN, port: free }] }),
      'test-taken': fixtureTest({ command: 'touch command-ran', chains: [{ ...ANVIL_CHAIN, port: taken }] }),
    },
  });

  // Another process holds the second port before the run starts.
  startProcessWithGuid({ context, guid: newGuid(), port: taken });
  await waitUntil({ what: 'the second port to be taken', condition: () => isListening(taken) });

  const run = await runEngine({ context, repository });

  assert.deepEqual(run.states, { 'test-fixed': 'passed', 'test-taken': 'failed' });
  assert.match(readLog({ repository, id: 'test-fixed' }), new RegExp(`port: ${free}\n`));
  // The stand-in node records its port before it binds it, so the node of the taken port is recorded too.
  assert.deepEqual(
    fakeNodeRecords(repository)
      .map((node) => node.port)
      .sort(),
    [free, taken].sort(),
    'each node was started on the port of its chain, and on no other',
  );
  // The engine never moves a node to another port: a fixed port that is taken fails the test.
  assert.match(readLog({ repository, id: 'test-taken' }), /The engine could not run the test: /);
  assert.equal(readPid({ repository, file: 'command-ran' }), undefined, 'the command did not run');
});

test('an inventory where a runner chain states several ports fails the run: the engine starts one node', async (context) => {
  const repository = nodeRepository({
    context,
    inventory: { 'test-several': fixtureTest({ chains: [{ ...ANVIL_CHAIN, port: '8600-8601' }] }) },
  });

  const run = await captureEngine({ context, argv: ['run', '--max-lanes', '4', '--root', repository.root] });

  assert.equal(run.status, RUN_FAILURE_EXIT_STATUS);
  assert.match(run.stderr, /test-several: a chain with "startedBy": "runner" states several ports, for one node/);
  assert.deepEqual(fakeNodeRecords(repository), []);
});

test('a test that starts its own node, and a test with no node chain, get no node', async (context) => {
  const command = 'echo "node: ${ANVIL_RPC_URL:-none}"';
  const repository = nodeRepository({
    context,
    inventory: {
      'test-own-node': fixtureTest({ command, chains: [OWN_NODE_CHAIN] }),
      'test-no-chain': fixtureTest({ command }),
    },
  });

  const run = await runEngine({ context, repository });

  assert.deepEqual(run.states, { 'test-own-node': 'passed', 'test-no-chain': 'passed' });
  assert.match(readLog({ repository, id: 'test-own-node' }), /node: none/);
  assert.deepEqual(fakeNodeRecords(repository), []);
});

test('a command never carries a GUID, even when the engine inherited one', async (context) => {
  const repository = nodeRepository({
    context,
    inventory: {
      'test-with-node': fixtureTest({ command: 'echo "guid: ${FHEVM_GUID:-none}"', chains: [ANVIL_CHAIN] }),
      'test-without-node': fixtureTest({ command: 'echo "guid: ${FHEVM_GUID:-none}"' }),
    },
  });

  withEnvironment({ context, variables: { FHEVM_GUID: newGuid() } });

  await runEngine({ context, repository });

  assert.match(readLog({ repository, id: 'test-with-node' }), /guid: none/);
  assert.match(readLog({ repository, id: 'test-without-node' }), /guid: none/);
  assert.notEqual(fakeNodeRecords(repository)[0]?.guid, process.env['FHEVM_GUID'], 'the node has a GUID of its own');
});

////////////////////////////////////////////////////////////////////////////////
// A node that does not come up, or does not stay up
////////////////////////////////////////////////////////////////////////////////

test('a node that cannot start makes its test failed, the log says why, and the other tests run', async (context) => {
  const repository = nodeRepository({
    context,
    inventory: {
      'test-needs-node': fixtureTest({ command: 'touch command-ran', chains: [ANVIL_CHAIN] }),
      'test-other': fixtureTest(),
    },
  });

  withEnvironment({ context, variables: { FAKE_NODE_FAILS: 'the port is taken' } });

  const run = await runEngine({ context, repository });
  const log = readLog({ repository, id: 'test-needs-node' });

  assert.equal(run.status, 1);
  assert.deepEqual(run.states, { 'test-needs-node': 'failed', 'test-other': 'passed' });
  // What the node printed is in the log of the node, and the log of the test says where that is.
  assert.match(readNodeLog({ repository, id: 'test-needs-node' }), /fake node: the port is taken/);
  assert.match(log, /The last lines of the node's output are in .*test-needs-node\.node\.log\./);
  assert.match(log, /The engine could not run the test: The node did not come up\. The node exited with status 7\./);
  assert.equal(readPid({ repository, file: 'command-ran' }), undefined, 'the command did not run');
});

test('a node that answers with another chain id makes its test failed, and is stopped', async (context) => {
  const repository = nodeRepository({
    context,
    inventory: { 'test-needs-node': fixtureTest({ command: 'true', chains: [ANVIL_CHAIN] }) },
  });

  withEnvironment({ context, variables: { FAKE_NODE_CHAIN_ID: '5' } });

  const run = await runEngine({ context, repository });

  assert.deepEqual(run.states, { 'test-needs-node': 'failed' });
  assert.match(
    readLog({ repository, id: 'test-needs-node' }),
    /The node answers with chain id 5, and the test needs chain id 31337\./,
  );
  assert.equal(processExists(fakeNodeRecords(repository)[0]?.pid ?? 0), false);
});

test('a node that dies during its test fails the test, even when the command succeeds', async (context) => {
  const repository = nodeRepository({
    context,
    inventory: { 'test-outlives-node': fixtureTest({ command: 'sleep 1.5', chains: [ANVIL_CHAIN] }) },
  });

  withEnvironment({ context, variables: { FAKE_NODE_LIFETIME_MILLISECONDS: '700' } });

  const run = await runEngine({ context, repository });
  const log = readLog({ repository, id: 'test-outlives-node' });

  assert.equal(run.status, 1);
  assert.deepEqual(run.states, { 'test-outlives-node': 'failed' });
  assert.match(log, /The command exited with status 0\./);
  assert.match(log, /Node \S+ died during its test, so the test is failed\. The node exited with status 9\./);
});

test('a node that is not up within the time limit of its test is stopped, and the test is failed', async (context) => {
  const repository = nodeRepository({
    context,
    inventory: { 'test-slow-node': fixtureTest({ command: 'touch command-ran', chains: [ANVIL_CHAIN] }) },
  });

  withEnvironment({ context, variables: { FAKE_NODE_START_DELAY_MILLISECONDS: '30000' } });

  const run = await runEngine({ context, repository, argv: ['--timeout', '1'] });
  const log = readLog({ repository, id: 'test-slow-node' });

  assert.deepEqual(run.states, { 'test-slow-node': 'failed' });
  assert.match(log, /The engine could not run the test: The node was stopped before it came up\./);
  assert.match(log, /The test reached its time limit of 1\.0s, and was stopped\./);
  assert.equal(readPid({ repository, file: 'command-ran' }), undefined, 'the command did not run');
});

test('a test with two runner chains is failed: the engine gives a test one node at most', async (context) => {
  const repository = nodeRepository({
    context,
    inventory: { 'test-two-nodes': fixtureTest({ chains: [ANVIL_CHAIN, HARDHAT_CHAIN] }) },
  });

  const run = await runEngine({ context, repository });

  assert.deepEqual(run.states, { 'test-two-nodes': 'failed' });
  assert.match(readLog({ repository, id: 'test-two-nodes' }), /has 2 chains with "startedBy": "runner"/);
  assert.deepEqual(fakeNodeRecords(repository), []);
});

////////////////////////////////////////////////////////////////////////////////
// An engine that ends before its tests
////////////////////////////////////////////////////////////////////////////////

type LongRun = {
  readonly repository: FixtureRepository;
  readonly engine: SpawnedEngine;
  readonly node: { readonly pid: number; readonly guid: string };
};

/** Starts a run whose one test holds a node for a long time, and waits until the command runs. */
async function startLongRun(context: TestContext, command = 'exec sleep 60'): Promise<LongRun> {
  const repository = nodeRepository({
    context,
    inventory: {
      'test-long': fixtureTest({ command: `echo $$ > command.pid; ${command}`, chains: [ANVIL_CHAIN] }),
    },
  });
  const engine = spawnEngine({ context, argv: ['run', '--max-lanes', '4', '--root', repository.root] });

  await waitUntil({
    what: 'the command of the long test to start',
    details: engine.output,
    condition: () => readPid({ repository, file: 'command.pid' }) !== undefined,
  });

  const record = fakeNodeRecords(repository)[0];

  assert.ok(record?.guid !== undefined, 'the node recorded its GUID');

  // Whatever the test does, nothing it started outlives it. The process IDs are read now: the hook that
  // removes the repository, with the files that hold them, runs before this one.
  const started = [record.pid, readPid({ repository, file: 'command.pid' })];

  context.after(() => {
    for (const pid of started) {
      if (pid !== undefined && processExists(pid)) process.kill(pid, 'SIGKILL');
    }
  });

  return { repository, engine, node: { pid: record.pid, guid: record.guid } };
}

type OutsiderInput = {
  readonly context: TestContext;
  /** Arguments after the script: they show on the command line of the process. */
  readonly argv?: readonly string[] | undefined;
  /** What the process carries as FHEVM_GUID. Undefined: nothing. */
  readonly guid?: string | undefined;
};

/** Starts a process that is not a node of the engine, and that lives until the test ends. */
function startOutsider(input: OutsiderInput): ChildProcess {
  const { FHEVM_GUID: _unused, ...environment } = process.env;
  const env = input.guid === undefined ? environment : { ...environment, FHEVM_GUID: input.guid };
  const outsider = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)', ...(input.argv ?? [])], {
    env,
    stdio: 'ignore',
  });

  input.context.after(() => outsider.kill('SIGKILL'));

  return outsider;
}

/** A port that is free now, as the engine asks for one. */
function freePortNow(): Promise<number> {
  return new Promise((resolvePort) => {
    const server = createServer().listen({ port: 0, host: '127.0.0.1' }, () => {
      const { port } = server.address() as { port: number };

      server.close(() => resolvePort(port));
    });
  });
}

type ListenerInput = {
  readonly context: TestContext;
  /** The GUID that the process carries. */
  readonly guid: string;
  /** The port the process listens on. Undefined: it listens on none. */
  readonly port?: number | undefined;
};

/** Starts a process that carries a GUID, and that may listen on a port. It lives until the test ends. */
function startProcessWithGuid(input: ListenerInput): ChildProcess {
  const { FHEVM_GUID: _unused, ...environment } = process.env;
  const script =
    input.port === undefined
      ? 'setTimeout(() => {}, 60000)'
      : `require('node:http').createServer().listen(${input.port}, '127.0.0.1')`;
  const child = spawn(process.execPath, ['-e', script], {
    env: { ...environment, FHEVM_GUID: input.guid },
    stdio: 'ignore',
  });

  input.context.after(() => child.kill('SIGKILL'));

  return child;
}

test('the engine tells its own node from another process that listens on the port', async (context) => {
  const guid = newGuid();
  const port = await freePortNow();
  const listenerIs = async (expected: string): Promise<boolean> => (await portListener({ port, guid })) === expected;

  assert.equal(await portListener({ port, guid }), 'unknown', 'nobody listens');

  // A process of another tool takes the port. The engine sees no process of the node: it cannot tell.
  const foreign = startProcessWithGuid({ context, guid: newGuid(), port });

  await waitUntil({ what: 'the process of another tool to start', condition: () => foreign.pid !== undefined });
  assert.equal(await portListener({ port, guid }), 'unknown');

  // The node of the engine runs, and does not hold the port: another process does.
  const starting = startProcessWithGuid({ context, guid });

  await waitUntil({
    what: 'the engine to see another process on the port',
    condition: () => listenerIs('another-process'),
  });

  foreign.kill('SIGKILL');
  starting.kill('SIGKILL');
  await waitUntil({ what: 'the port to be free again', condition: () => listenerIs('unknown') });

  // The node of the engine takes the port: it carries the expected GUID.
  startProcessWithGuid({ context, guid, port });

  await waitUntil({ what: 'the engine to see its node on the port', condition: () => listenerIs('the-node') });
});

test('a node is not accepted when another process answers on its port', async (context) => {
  const repository = nodeRepository({ context, inventory: {} });
  const port = await freePortNow();
  const { FHEVM_GUID: _unused, ...environment } = process.env;
  // A node of another tool takes the port, and answers with the same chain id.
  const foreign = spawn(join(repository.root, 'fake-bin', 'anvil'), ['--port', String(port)], {
    cwd: repository.root,
    env: { ...environment, FHEVM_GUID: `some-other-tool-${newGuid()}` },
    stdio: 'ignore',
  });

  context.after(() => foreign.kill('SIGKILL'));
  await waitUntil({
    what: 'the node of another tool to listen',
    condition: () => fakeNodeRecords(repository).some((node) => node.port === port),
  });

  // The node of the engine is slow to start, so only the other node answers meanwhile.
  withEnvironment({ context, variables: { FAKE_NODE_START_DELAY_MILLISECONDS: '20000' } });

  const log = openTestLog({ file: join(repository.root, 'test.log'), id: 'test-node', verbose: false });
  const nodeLog = openNodeLog({ file: join(repository.root, 'node.log'), maximumLines: 10 });
  const starting = startNode({
    chain: ANVIL_CHAIN,
    root: repository.root,
    log,
    nodeLog,
    interruption: new AbortController().signal,
    pickPort: async () => port,
  });

  // An engine that wrongly accepts the other node must fail this test, not leave a node behind.
  const outcome = await starting.then(
    (node) => node,
    (error: unknown) => error,
  );

  if (!(outcome instanceof Error)) await (outcome as RunningNode).stop();

  await log.close();

  assert.ok(outcome instanceof Error, 'the node is not accepted');
  assert.match(outcome.message, /Another process listens on port \d+, and answers in the place of the node\./);

  assert.equal(processExists(foreign.pid ?? 0), true, 'the node of another tool is not stopped');
});

test('kill needs the GUIDs of the nodes to stop, or an explicit --all, and not both', async (context) => {
  const needsOne = /Give the GUIDs of the nodes to stop, or --all to stop every node of the engine\./;
  const withNeither = await captureEngine({ context, argv: ['kill'] });
  const withBoth = await captureEngine({ context, argv: ['kill', newGuid(), '--all'] });

  // Neither call stops anything: each one fails before it looks for a node.
  for (const result of [withNeither, withBoth]) {
    assert.equal(result.status, RUN_FAILURE_EXIT_STATUS);
    assert.match(result.stderr, needsOne);
  }
});

test('an interrupted run stops the node of a running test', async (context) => {
  const { engine, node } = await startLongRun(context);

  assert.equal(processExists(node.pid), true);

  engine.process.kill('SIGINT');

  assert.equal(await engine.exited, 1, engine.output());
  assert.equal(processExists(node.pid), false);
  assert.equal((await listedGuids(context)).includes(node.guid), false);
});

test('a node that the engine stops on an interruption is not a node that died', async (context) => {
  // The command takes a moment to end, so its node is gone well before the command has ended.
  const slowToEnd = `trap 'sleep 1; exit 0' TERM; sleep 60 & wait`;
  const { engine, repository } = await startLongRun(context, slowToEnd);

  engine.process.kill('SIGINT');
  await engine.exited;

  const log = readLog({ repository, id: 'test-long' });

  assert.match(log, /Node \S+ is stopped\./);
  assert.doesNotMatch(log, /died during its test/);
});

test('ps lists the node of an engine that was killed, and kill stops that node and nothing else', async (context) => {
  const { engine, node } = await startLongRun(context);
  const other = await startLongRun(context);
  const foreignGuid = `some-other-tool-${newGuid()}`;
  const quotedGuid = newGuid();
  const outsiders = [
    startOutsider({ context, guid: foreignGuid }),
    startOutsider({ context }),
    // A process that only names a GUID of the engine among its arguments, as a `grep` for it would.
    startOutsider({ context, argv: [`FHEVM_GUID=${quotedGuid}`] }),
  ];

  // The engines die without a chance to stop anything: their nodes are left running.
  engine.process.kill('SIGKILL');
  other.engine.process.kill('SIGKILL');
  await Promise.all([engine.exited, other.engine.exited]);

  const listed = await listedGuids(context);

  assert.equal(listed.includes(node.guid), true, 'ps lists the node that was left');
  assert.equal(listed.includes(other.node.guid), true);
  assert.equal(listed.includes(foreignGuid), false, 'ps does not list a process of another tool');
  assert.equal(listed.includes(quotedGuid), false, 'ps does not list a process that only names a GUID');

  const killed = await captureEngine({ context, argv: ['kill', node.guid, quotedGuid] });

  assert.equal(killed.status, 0);
  assert.deepEqual(killed.stdout, [`Stopped ${node.guid}.`, `No running node has the GUID ${quotedGuid}.`]);
  assert.equal(processExists(node.pid), false, 'the node with the given GUID is stopped');
  assert.equal(processExists(other.node.pid), true, 'a node with another GUID is not');

  await captureEngine({ context, argv: ['kill', other.node.guid] });

  assert.equal(processExists(other.node.pid), false);
  assert.deepEqual(
    outsiders.map((outsider) => processExists(outsider.pid ?? 0)),
    [true, true, true],
    'the processes that are not nodes of the engine still run',
  );
});
