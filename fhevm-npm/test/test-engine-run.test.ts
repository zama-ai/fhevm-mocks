import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';

import type { Chain } from '../base/test-engine/inventory.ts';
import { RUN_FAILURE_EXIT_STATUS } from '../base/test-engine/open-questions.ts';
import {
  type FixtureRepository,
  captureEngine,
  fixtureTest,
  processExists,
  readLog,
  readPid,
  readReport,
  reportFileOf,
  reportStates,
  runEngine,
  spawnEngine,
  waitUntil,
  withEnvironment,
  writeFixtureRepository,
} from './test-engine-fixtures.ts';

const SCHEMA = './ALL_TESTS.schema.json';

/**
 * A command that passes only when it runs at the same time as the others: it marks its own start, then
 * waits for the start of each other one. Run one after the other, the first one would give up and fail.
 */
function meetingCommand(input: { readonly own: string; readonly others: readonly string[] }): string {
  const { own, others } = input;
  const othersStarted = others.map((other) => `[ -f ${other}.started ]`).join(' && ');

  return `touch ${own}.started; for i in $(seq 1 200); do if ${othersStarted}; then exit 0; fi; sleep 0.05; done; exit 1`;
}

////////////////////////////////////////////////////////////////////////////////
// Running
////////////////////////////////////////////////////////////////////////////////

test('tests run in parallel: each one sees the others running', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      'test-a': fixtureTest({ command: meetingCommand({ own: 'a', others: ['b', 'c'] }) }),
      'test-b': fixtureTest({ command: meetingCommand({ own: 'b', others: ['a', 'c'] }) }),
      'test-c': fixtureTest({ command: meetingCommand({ own: 'c', others: ['a', 'b'] }) }),
    },
  });

  const run = await runEngine({ context, repository });

  assert.equal(run.status, 0);
  assert.deepEqual(run.states, { 'test-a': 'passed', 'test-b': 'passed', 'test-c': 'passed' });
});

test('a failing test does not stop the others, and the exit status shows it', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      'test-fails-first': fixtureTest({ command: 'echo boom >&2; exit 3' }),
      'test-passes-later': fixtureTest({ command: 'sleep 0.5 && echo done' }),
    },
  });

  const run = await runEngine({ context, repository });

  assert.equal(run.status, 1);
  assert.deepEqual(run.states, { 'test-fails-first': 'failed', 'test-passes-later': 'passed' });
  assert.match(readLog({ repository, id: 'test-fails-first' }), /boom\n\nThe command exited with status 3\./);
  assert.match(readLog({ repository, id: 'test-passes-later' }), /^\$ sleep 0\.5 && echo done\ndone\n/);
});

test('each command runs from the root', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: { $schema: SCHEMA, 'test-pwd': fixtureTest({ command: 'test -f ALL_TESTS.json && pwd' }) },
  });

  const run = await runEngine({ context, repository });

  assert.equal(run.status, 0);
  assert.match(readLog({ repository, id: 'test-pwd' }), new RegExp(`${repository.root}\n`));
});

test('a test has the duration that the engine measured', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: { $schema: SCHEMA, 'test-sleeps': fixtureTest({ command: 'sleep 0.3' }) },
  });

  const duration = (await runEngine({ context, repository })).report.tests['test-sleeps']?.durationMilliseconds;

  assert.ok(duration !== undefined && duration >= 300, `the duration is ${String(duration)}ms`);
});

test('a test whose command runs no test case passes: only the exit status counts', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: { $schema: SCHEMA, 'test-empty': fixtureTest({ command: 'echo "0 tests"' }) },
  });

  assert.deepEqual((await runEngine({ context, repository })).states, { 'test-empty': 'passed' });
});

test('a test ends when its command exits, and what the command left running is stopped', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      // The background process keeps the output of the command open: the test must not wait for it.
      'test-leaves-pass': fixtureTest({ command: 'sleep 60 & echo $! > pass.pid; exit 0' }),
      'test-leaves-fail': fixtureTest({ command: 'sleep 60 & echo $! > fail.pid; exit 4' }),
    },
  });

  const run = await runEngine({ context, repository });

  assert.deepEqual(run.states, { 'test-leaves-pass': 'passed', 'test-leaves-fail': 'failed' });

  for (const file of ['pass.pid', 'fail.pid']) {
    const pid = readPid({ repository, file });

    assert.ok(pid !== undefined && !processExists(pid), `${file}: the process is gone`);
  }
});

test('the engine drops no output of a command that writes more than a pipe holds', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      'test-loud': fixtureTest({ command: "head -c 5000000 /dev/zero | tr '\\0' x; echo; echo the-end" }),
    },
  });

  await runEngine({ context, repository });

  const log = readLog({ repository, id: 'test-loud' });

  assert.ok(log.length > 5_000_000);
  assert.match(log, /x\nthe-end\n\nThe command exited with status 0\.\n$/);
});

////////////////////////////////////////////////////////////////////////////////
// The report
////////////////////////////////////////////////////////////////////////////////

test('the report gives every test of the inventory one of the four states', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      'test-pass': fixtureTest(),
      'test-fail': fixtureTest({ command: 'false' }),
      'test-skipped': fixtureTest({ command: 'false', skipped: true }),
      'test-local-only': fixtureTest({ ci: false }),
    },
  });

  const { report } = await runEngine({ context, repository, argv: ['--ci'] });

  assert.deepEqual(reportStates(report), {
    'test-pass': 'passed',
    'test-fail': 'failed',
    'test-skipped': 'skipped',
    'test-local-only': 'not-selected',
  });
  assert.deepEqual(
    Object.entries(report.tests).map(([id, entry]) => [id, typeof entry.durationMilliseconds]),
    [
      ['test-pass', 'number'],
      ['test-fail', 'number'],
      ['test-skipped', 'undefined'],
      ['test-local-only', 'undefined'],
    ],
  );
  assert.equal(report.dryRun, false);
});

test('a dry run runs no command, says what it would run, and writes the report', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      'test-would-run': fixtureTest({ command: 'touch ran-a' }),
      'test-would-fail': fixtureTest({ command: 'touch ran-b; false' }),
      'test-skipped': fixtureTest({ skipped: true }),
    },
  });

  const run = await runEngine({ context, repository, argv: ['--dry-run'] });

  assert.equal(run.status, 0);
  assert.equal(run.report.dryRun, true);
  assert.deepEqual(run.report.tests, {
    'test-would-run': { state: 'passed' },
    'test-would-fail': { state: 'passed' },
    'test-skipped': { state: 'skipped' },
  });
  assert.ok(run.stdout.includes('would run  lane 1  test-would-run  $ touch ran-a'));
  assert.equal(existsSync(join(repository.root, 'ran-a')), false);
  assert.equal(existsSync(join(repository.root, 'ran-b')), false);
  assert.equal(existsSync(join(repository.root, 'test-logs')), false);
});

test('--report and --logs choose where the report and the logs go', async (context) => {
  const repository = writeFixtureRepository({ context, inventory: { $schema: SCHEMA, 'test-a': fixtureTest() } });
  const report = join(repository.root, 'out', 'report.json');
  const logs = join(repository.root, 'out', 'logs');

  const run = await captureEngine({
    context,
    argv: ['run', '--max-lanes', '4', '--root', repository.root, '--report', report, '--logs', logs],
  });

  assert.equal(run.status, 0);
  assert.equal(existsSync(report), true);
  assert.equal(existsSync(join(logs, 'test-a.log')), true);
  assert.equal(existsSync(reportFileOf(repository)), false);
});

test('the report and the logs go where a variable says, and an option wins over the variable', async (context) => {
  const repository = writeFixtureRepository({ context, inventory: { $schema: SCHEMA, 'test-a': fixtureTest() } });
  const fromVariable = join(repository.root, 'from-variable');
  const fromOption = join(repository.root, 'from-option');
  const argv = ['run', '--max-lanes', '4', '--root', repository.root];

  withEnvironment({
    context,
    variables: { FHEVM_TEST_REPORT: join(fromVariable, 'report.json'), FHEVM_TEST_LOGS: join(fromVariable, 'logs') },
  });

  await captureEngine({ context, argv });

  assert.equal(existsSync(join(fromVariable, 'report.json')), true);
  assert.equal(existsSync(join(fromVariable, 'logs', 'test-a.log')), true);
  assert.equal(existsSync(reportFileOf(repository)), false, 'nothing is written under the root');
  assert.equal(existsSync(join(repository.root, 'test-logs')), false);

  await captureEngine({
    context,
    argv: [...argv, '--report', join(fromOption, 'report.json'), '--logs', join(fromOption, 'logs')],
  });

  assert.equal(existsSync(join(fromOption, 'report.json')), true);
  assert.equal(existsSync(join(fromOption, 'logs', 'test-a.log')), true);
});

test('--verbose prints each line of output with the test ID in front, each stream on its own', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      'test-talks': fixtureTest({ command: 'echo one; printf two; echo oops >&2' }),
    },
  });

  const run = await runEngine({ context, repository, argv: ['--verbose'] });

  for (const line of ['[test-talks] one', '[test-talks] two', '[test-talks] oops']) {
    assert.ok(run.stdout.includes(line), `prints '${line}'`);
  }
});

////////////////////////////////////////////////////////////////////////////////
// A run that fails
////////////////////////////////////////////////////////////////////////////////

test('a run that fails leaves no report, not even the report of an earlier run', async (context) => {
  const repository = writeFixtureRepository({ context, inventory: { $schema: SCHEMA, 'test-a': fixtureTest() } });
  const logs = join(repository.root, 'test-logs');

  await runEngine({ context, repository });
  assert.equal(existsSync(reportFileOf(repository)), true);

  chmodSync(logs, 0o555);

  const failed = await captureEngine({ context, argv: ['run', '--max-lanes', '4', '--root', repository.root] });

  // Restored here, and not in a hook: the hook that removes the directory runs first.
  chmodSync(logs, 0o755);

  assert.equal(failed.status, RUN_FAILURE_EXIT_STATUS);
  assert.match(failed.stderr, /The logs directory .* is not writable/);
  assert.equal(existsSync(reportFileOf(repository)), false);
});

test('a run that fails before it starts also removes the report of an earlier run', async (context) => {
  const repository = writeFixtureRepository({ context, inventory: { $schema: SCHEMA, 'test-a': fixtureTest() } });

  for (const failing of [['test-unknown'], ['--inventory', join(repository.root, 'missing.json')]]) {
    await runEngine({ context, repository });
    assert.equal(existsSync(reportFileOf(repository)), true);

    const failed = await captureEngine({
      context,
      argv: ['run', '--max-lanes', '4', '--root', repository.root, ...failing],
    });

    assert.equal(failed.status, RUN_FAILURE_EXIT_STATUS, failing.join(' '));
    assert.equal(existsSync(reportFileOf(repository)), false, failing.join(' '));
  }
});

test('an invalid inventory and a root that is no directory fail the run, not each test', async (context) => {
  const invalid = writeFixtureRepository({ context, inventory: { $schema: SCHEMA, 'test-a': { command: 'true' } } });
  const valid = writeFixtureRepository({ context, inventory: { $schema: SCHEMA, 'test-a': fixtureTest() } });
  const noRoot = ['run', '--max-lanes', '4', '--root', join(valid.root, 'nope'), '--inventory', valid.inventoryFile];

  const invalidRun = await captureEngine({ context, argv: ['run', '--max-lanes', '4', '--root', invalid.root] });
  const noRootRun = await captureEngine({ context, argv: noRoot });

  assert.equal(invalidRun.status, RUN_FAILURE_EXIT_STATUS);
  assert.equal(existsSync(reportFileOf(invalid)), false);
  assert.equal(noRootRun.status, RUN_FAILURE_EXIT_STATUS);
  assert.match(noRootRun.stderr, /The root .*nope is not a directory/);
});

test('a log that cannot be written does not fail or block its test', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      'test-loud': fixtureTest({ command: "head -c 2000000 /dev/zero | tr '\\0' x" }),
      'test-other': fixtureTest(),
    },
  });

  // A directory where the log file of the test goes: the file cannot be opened.
  mkdirSync(join(repository.root, 'test-logs', 'test-loud.log'), { recursive: true });

  const run = await runEngine({ context, repository });

  assert.equal(run.status, 0);
  assert.deepEqual(run.states, { 'test-loud': 'passed', 'test-other': 'passed' });
  assert.match(run.stderr, /The log of test-loud cannot be written/);
});

////////////////////////////////////////////////////////////////////////////////
// Lanes
////////////////////////////////////////////////////////////////////////////////

/** A chain whose test starts its own node on a fixed port. No node is started for it here: only its port counts. */
function ownNodeOn(port: number): Chain {
  return { chainid: 31337, fhevm: 'local', runtime: 'anvil', startedBy: 'test', fresh: true, port };
}

test('two tests that state a common fixed port never run at the same time, and the others still do', async (context) => {
  // Each test of port 9001 takes a lock for its whole time, and fails when the lock is taken.
  const exclusive = 'mkdir lock-9001 || exit 1; sleep 0.4; rmdir lock-9001';
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      'test-a': fixtureTest({ command: exclusive, chains: [ownNodeOn(9001)] }),
      'test-b': fixtureTest({ command: exclusive, chains: [ownNodeOn(9001)] }),
      'test-c': fixtureTest({ command: exclusive, chains: [ownNodeOn(9001)] }),
      'test-free-a': fixtureTest({ command: meetingCommand({ own: 'free-a', others: ['free-b'] }) }),
      'test-free-b': fixtureTest({ command: meetingCommand({ own: 'free-b', others: ['free-a'] }) }),
    },
  });

  const run = await runEngine({ context, repository });
  const { tests } = run.report;

  assert.equal(run.status, 0, run.stdout.join('\n'));
  assert.deepEqual(
    ['test-a', 'test-b', 'test-c'].map((id) => [tests[id]?.lane, tests[id]?.position]),
    [
      [1, 1],
      [1, 2],
      [1, 3],
    ],
    'the three tests of the port are one lane, in the order of the inventory',
  );
  assert.deepEqual([tests['test-free-a']?.lane, tests['test-free-b']?.lane], [2, 3]);
});

test('a maximum of 1 runs every test one after the other, in the order of the inventory', async (context) => {
  const record = (name: string): string => `echo ${name}-starts >> order; sleep 0.2; echo ${name}-ends >> order`;
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      'test-c': fixtureTest({ command: record('c') }),
      'test-a': fixtureTest({ command: `${record('a')}; exit 1` }),
      'test-b': fixtureTest({ command: record('b') }),
    },
  });

  const run = await captureEngine({ context, argv: ['run', '--max-lanes', '1', '--root', repository.root] });
  const order = readFileSync(join(repository.root, 'order'), 'utf8').trim().split('\n');

  // A failing test does not stop its lane: the next test still runs.
  assert.equal(run.status, 1);
  assert.deepEqual(order, ['c-starts', 'c-ends', 'a-starts', 'a-ends', 'b-starts', 'b-ends']);
  assert.deepEqual(reportStates(readReport(repository)), {
    'test-c': 'passed',
    'test-a': 'failed',
    'test-b': 'passed',
  });
});

////////////////////////////////////////////////////////////////////////////////
// A strict run
////////////////////////////////////////////////////////////////////////////////

test('a selection that selects no test is a warning, and fails a strict run', async (context) => {
  const repository = writeFixtureRepository({ context, inventory: { $schema: SCHEMA, 'test-a': fixtureTest() } });
  const argv = ['run', '--max-lanes', '4', '--root', repository.root, '--match', 'no-such-test'];

  const plain = await captureEngine({ context, argv });

  assert.equal(plain.status, 0);
  assert.match(plain.stderr, /The run runs no test/);
  assert.equal(existsSync(reportFileOf(repository)), true, 'the run that only warns still writes its report');

  const strict = await captureEngine({ context, argv: [...argv, '--strict'] });

  assert.equal(strict.status, RUN_FAILURE_EXIT_STATUS);
  assert.match(strict.stderr, /The run is strict, and does not start:\n  The run runs no test/);
});

test('tests that share a funded account in two lanes are a warning, and fail a strict run', async (context) => {
  const wallet: Chain = { chainid: 11155111, fhevm: 'testnet', runtime: 'remote', wallet: true };
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      'test-wallet-a': fixtureTest({ command: 'touch ran-a', chains: [wallet] }),
      'test-wallet-b': fixtureTest({ command: 'touch ran-b', chains: [wallet] }),
      'test-reads': fixtureTest({ chains: [{ ...wallet, wallet: false }] }),
    },
  });
  const argv = ['run', '--root', repository.root, '--max-lanes'];

  withEnvironment({ context, variables: { SEPOLIA_RPC_URL: 'https://sepolia.example.invalid' } });

  const parallel = await captureEngine({ context, argv: [...argv, '4'] });
  const serial = await captureEngine({ context, argv: [...argv, '1', '--strict'] });
  const strict = await captureEngine({ context, argv: [...argv, '4', '--strict'] });

  assert.equal(parallel.status, 0);
  assert.match(parallel.stderr, /2 tests need a funded account on chain 11155111 and are in 2 lanes/);
  assert.match(parallel.stderr, /test-wallet-a, test-wallet-b/);
  // In one lane they cannot use the account at the same time, so a strict run accepts them.
  assert.equal(serial.status, 0);
  assert.doesNotMatch(serial.stderr, /funded account/);
  assert.equal(strict.status, RUN_FAILURE_EXIT_STATUS);
  assert.match(strict.stderr, /The run is strict, and does not start:\n  2 tests need a funded account/);
});

test('a test whose live chain has no RPC URL set does not start, is unavailable, and fails a strict run', async (context) => {
  const sepolia: Chain = { chainid: 11155111, fhevm: 'testnet', runtime: 'forge-fork' };
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      'test-local': fixtureTest({ command: 'touch ran-local' }),
      'test-fork-a': fixtureTest({ command: 'touch ran-fork-a', chains: [sepolia] }),
      'test-fork-b': fixtureTest({ command: 'touch ran-fork-b', chains: [sepolia] }),
    },
  });
  const argv = ['run', '--root', repository.root, '--max-lanes', '2'];

  withEnvironment({ context, variables: { SEPOLIA_RPC_URL: '' } });

  const run = await captureEngine({ context, argv });
  const report = readReport(repository);

  assert.equal(run.status, 0, 'an unavailable test does not fail the run');
  assert.match(run.stderr, /2 test\(s\) cannot run, because SEPOLIA_RPC_URL is not set: test-fork-a, test-fork-b\./);
  assert.match(run.stdout.join('\n'), /Run: 1 passed, 0 failed, 0 skipped, 2 unavailable, 0 not selected\./);
  assert.deepEqual(reportStates(report), {
    'test-local': 'passed',
    'test-fork-a': 'unavailable',
    'test-fork-b': 'unavailable',
  });
  assert.deepEqual(report.tests['test-fork-a'], { state: 'unavailable', missingVariables: ['SEPOLIA_RPC_URL'] });
  assert.equal(existsSync(join(repository.root, 'ran-fork-a')), false, 'the command of an unavailable test never runs');

  const dry = await captureEngine({ context, argv: [...argv, '--dry-run'] });

  assert.equal(reportStates(readReport(repository))['test-fork-a'], 'unavailable');
  assert.doesNotMatch(dry.stdout.join('\n'), /would run .* test-fork-a/);

  const strict = await captureEngine({ context, argv: [...argv, '--strict'] });

  assert.equal(strict.status, RUN_FAILURE_EXIT_STATUS);
  assert.match(
    strict.stderr,
    /The run is strict, and does not start:\n  2 test\(s\) cannot run, because SEPOLIA_RPC_URL/,
  );

  withEnvironment({ context, variables: { SEPOLIA_RPC_URL: 'https://sepolia.example.invalid' } });

  const available = await captureEngine({ context, argv: [...argv, '--strict'] });

  assert.equal(available.status, 0);
  assert.equal(reportStates(readReport(repository))['test-fork-a'], 'passed');
  assert.equal(existsSync(join(repository.root, 'ran-fork-a')), true);
});

////////////////////////////////////////////////////////////////////////////////
// The build
////////////////////////////////////////////////////////////////////////////////

test('the build command runs once, from the root, before any test', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      // Each test passes only when the build has ended before it starts.
      'test-a': fixtureTest({ command: 'test "$(cat built)" = "built once"' }),
      'test-b': fixtureTest({ command: 'test "$(cat built)" = "built once"' }),
    },
  });
  // The build appends, so a build that ran twice would leave two lines.
  const build = 'test -f ALL_TESTS.json && sleep 0.3 && echo "built once" >> built && echo "the build says hello"';

  const run = await runEngine({ context, repository, argv: ['--build', build] });

  assert.equal(run.status, 0);
  assert.deepEqual(run.states, { 'test-a': 'passed', 'test-b': 'passed' });
  assert.equal(run.report.build?.command, build);
  assert.ok((run.report.build?.durationMilliseconds ?? 0) >= 300);
  assert.match(readLog({ repository, id: 'build' }), /the build says hello\n\nThe build exited with status 0\./);
});

test('a build that fails fails the run: no test runs, and no report is written', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: { $schema: SCHEMA, 'test-a': fixtureTest({ command: 'touch test-ran' }) },
  });

  const run = await captureEngine({
    context,
    argv: ['run', '--max-lanes', '4', '--root', repository.root, '--build', 'echo "the compiler says no" >&2; exit 3'],
  });

  assert.equal(run.status, RUN_FAILURE_EXIT_STATUS);
  assert.match(run.stderr, /The build exited with status 3\. No test was run\./);
  assert.match(readLog({ repository, id: 'build' }), /the compiler says no/);
  assert.equal(existsSync(join(repository.root, 'test-ran')), false);
  assert.equal(existsSync(reportFileOf(repository)), false);
});

test('a dry run does not build, and a run without a build command builds nothing', async (context) => {
  const repository = writeFixtureRepository({ context, inventory: { $schema: SCHEMA, 'test-a': fixtureTest() } });

  const dry = await runEngine({ context, repository, argv: ['--dry-run', '--build', 'touch built'] });
  const plain = await runEngine({ context, repository });

  assert.ok(dry.stdout.includes('would build  $ touch built'));
  assert.equal(existsSync(join(repository.root, 'built')), false);
  assert.equal(dry.report.build, undefined);
  assert.equal(plain.report.build, undefined);
});

////////////////////////////////////////////////////////////////////////////////
// A time limit
////////////////////////////////////////////////////////////////////////////////

test('a test that reaches its time limit is stopped and failed, and the others are not', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      'test-never-ends': fixtureTest({ command: 'echo $$ > shell.pid; sleep 60 & echo $! > child.pid; wait' }),
      'test-ends': fixtureTest({ command: 'sleep 0.2' }),
    },
  });

  const run = await runEngine({ context, repository, argv: ['--timeout', '1'] });
  const duration = run.report.tests['test-never-ends']?.durationMilliseconds ?? 0;

  assert.equal(run.status, 1);
  assert.deepEqual(run.states, { 'test-never-ends': 'failed', 'test-ends': 'passed' });
  assert.ok(duration >= 1000 && duration < 30_000, `the test was stopped at its limit: ${duration}ms`);
  assert.match(
    readLog({ repository, id: 'test-never-ends' }),
    /The test reached its time limit of 1\.0s, and was stopped\./,
  );
  assert.doesNotMatch(readLog({ repository, id: 'test-ends' }), /time limit/);

  for (const file of ['shell.pid', 'child.pid']) {
    const pid = readPid({ repository, file });

    assert.ok(pid !== undefined && !processExists(pid), `${file}: the process is gone`);
  }
});

test('--timeout 0 sets no limit, and a time limit that is no number fails the run', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: { $schema: SCHEMA, 'test-sleeps': fixtureTest({ command: 'sleep 1.2' }) },
  });

  const unlimited = await runEngine({ context, repository, argv: ['--timeout', '0'] });
  const invalid = await captureEngine({
    context,
    argv: ['run', '--max-lanes', '4', '--root', repository.root, '--timeout', 'soon'],
  });

  assert.deepEqual(unlimited.states, { 'test-sleeps': 'passed' });
  assert.equal(invalid.status, RUN_FAILURE_EXIT_STATUS);
  assert.match(invalid.stderr, /A time limit is a number of seconds, or 0\./);
});

////////////////////////////////////////////////////////////////////////////////
// An interrupted run
////////////////////////////////////////////////////////////////////////////////

type InterruptedRunInput = {
  readonly context: TestContext;
  readonly signal: NodeJS.Signals;
  /** The command of the long test. It writes the IDs of its processes to `shell.pid` and `child.pid`. */
  readonly longCommand: string;
};

/** Starts a run with one long test, interrupts it once the long test runs, and waits for the engine to end. */
async function interruptRun(input: InterruptedRunInput): Promise<FixtureRepository> {
  const { context } = input;
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      'test-long': fixtureTest({ command: input.longCommand }),
      'test-short': fixtureTest({ command: 'true' }),
    },
  });
  const engine = spawnEngine({ context, argv: ['run', '--max-lanes', '4', '--root', repository.root] });
  const shortLog = join(repository.root, 'test-logs', 'test-short.log');

  // The interruption comes once the short test has ended: a test that is still running is stopped too.
  await waitUntil({
    what: 'the long test to start and the short test to end',
    details: engine.output,
    condition: () => {
      const longStarted = readPid({ repository, file: 'child.pid' }) !== undefined;
      const shortEnded = existsSync(shortLog) && readFileSync(shortLog, 'utf8').includes('exited with status 0');

      return longStarted && shortEnded;
    },
  });

  engine.process.kill(input.signal);

  assert.equal(await engine.exited, 1, engine.output());

  return repository;
}

function assertLongTestStopped(repository: FixtureRepository): void {
  assert.deepEqual(reportStates(readReport(repository)), { 'test-long': 'failed', 'test-short': 'passed' });

  for (const file of ['shell.pid', 'child.pid']) {
    const pid = readPid({ repository, file });

    assert.ok(pid !== undefined && !processExists(pid), `${file}: the process is gone`);
  }
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  test(`on ${signal}, the run stops every command with what it started, and writes the report`, async (context) => {
    const longCommand = 'echo $$ > shell.pid; sleep 60 & echo $! > child.pid; wait';

    assertLongTestStopped(await interruptRun({ context, signal, longCommand }));
  });
}

test('an interrupted run also stops a process that ignores the request to end', async (context) => {
  // The child ignores SIGTERM and writes nothing: only SIGKILL, after the grace period, ends it.
  const stubborn = `sh -c 'trap "" TERM; echo $$ > child.pid; exec sleep 60'`;
  const longCommand = `echo $$ > shell.pid; ${stubborn} > /dev/null 2>&1 & wait`;
  const startedAt = performance.now();
  const repository = await interruptRun({ context, signal: 'SIGINT', longCommand });

  assertLongTestStopped(repository);
  assert.ok(performance.now() - startedAt >= 5000, 'the engine waited for the grace period before SIGKILL');
});

test('a second run can use the place of the first one', async (context) => {
  const repository = writeFixtureRepository({ context, inventory: { $schema: SCHEMA, 'test-a': fixtureTest() } });

  writeFileSync(reportFileOf(repository), 'left by an earlier run');

  assert.deepEqual((await runEngine({ context, repository })).states, { 'test-a': 'passed' });
  assert.deepEqual((await runEngine({ context, repository })).states, { 'test-a': 'passed' });
});
