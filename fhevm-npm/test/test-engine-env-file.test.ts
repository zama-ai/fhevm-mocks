import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';

import { applyEnvFile, envFileLines } from '../base/test-engine/env-file.ts';
import type { Chain } from '../base/test-engine/inventory.ts';
import { RUN_FAILURE_EXIT_STATUS } from '../base/test-engine/open-questions.ts';
import {
  captureEngine,
  fixtureTest,
  readReport,
  reportStates,
  withEnvironment,
  writeFixtureRepository,
} from './test-engine-fixtures.ts';

const SCHEMA = './ALL_TESTS.schema.json';
const SEPOLIA_URL = 'https://sepolia.example.invalid/key-in-the-file';
const SEPOLIA_FORK: Chain = { chainid: 11155111, fhevm: 'testnet', runtime: 'forge-fork' };

function temporaryRoot(context: TestContext): string {
  const root = mkdtempSync(join(tmpdir(), 'test-engine-env-file-'));

  context.after(() => rmSync(root, { recursive: true, force: true }));

  return root;
}

////////////////////////////////////////////////////////////////////////////////
// The file
////////////////////////////////////////////////////////////////////////////////

test('the env file sets what the environment does not set, and keeps what it sets', (context) => {
  const root = temporaryRoot(context);
  const environment: NodeJS.ProcessEnv = { KEPT: 'from the environment', EMPTY: '' };

  writeFileSync(
    join(root, '.env'),
    ['# a comment', 'NEW=from the file', 'KEPT=from the file', 'EMPTY="filled"', 'BLANK=', 'export QUOTED="a b"'].join(
      '\n',
    ),
  );

  const applied = applyEnvFile({ root, file: undefined, environment });

  assert.deepEqual(applied, { file: join(root, '.env'), set: ['EMPTY', 'NEW', 'QUOTED'], kept: ['KEPT'] });
  assert.deepEqual(environment, {
    KEPT: 'from the environment',
    EMPTY: 'filled',
    NEW: 'from the file',
    QUOTED: 'a b',
  });
});

test('the default env file is optional, and a file that an option names must exist', (context) => {
  const root = temporaryRoot(context);

  assert.equal(applyEnvFile({ root, file: undefined, environment: {} }), undefined);
  assert.throws(
    () => applyEnvFile({ root, file: join(root, 'other.env'), environment: {} }),
    /The env file .*other\.env does not exist\./,
  );
});

test('what the engine says about an env file names the variables, and never a value', () => {
  const lines = envFileLines({ file: '/root/.env', set: ['SEPOLIA_RPC_URL'], kept: ['MAINNET_RPC_URL'] });

  assert.deepEqual(lines, [
    '/root/.env sets SEPOLIA_RPC_URL.',
    'The environment already sets MAINNET_RPC_URL: the file does not change them.',
  ]);
  assert.deepEqual(envFileLines({ file: '/root/.env', set: [], kept: [] }), ['/root/.env sets no variable.']);
});

////////////////////////////////////////////////////////////////////////////////
// A run
////////////////////////////////////////////////////////////////////////////////

test('a run reads .env at the root: a test on a live chain runs, and gets the URL of the file', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      'test-fork': fixtureTest({ command: 'printf "%s" "$SEPOLIA_RPC_URL" > seen-url', chains: [SEPOLIA_FORK] }),
    },
  });
  const argv = ['run', '--root', repository.root, '--max-lanes', '1'];

  // Empty counts as not set. The variable is restored after the test, whatever the engine sets.
  withEnvironment({ context, variables: { SEPOLIA_RPC_URL: '' } });

  const without = await captureEngine({ context, argv });

  assert.equal(reportStates(readReport(repository))['test-fork'], 'unavailable');
  assert.doesNotMatch(without.stderr, /\.env/);

  writeFileSync(join(repository.root, '.env'), `SEPOLIA_RPC_URL=${SEPOLIA_URL}\n`);

  const withFile = await captureEngine({ context, argv });
  const output = [...withFile.stdout, withFile.stderr].join('\n');

  assert.equal(withFile.status, 0);
  assert.equal(reportStates(readReport(repository))['test-fork'], 'passed');
  assert.match(withFile.stderr, /\.env sets SEPOLIA_RPC_URL\./);
  assert.doesNotMatch(output, /key-in-the-file/, 'the engine never prints a value of the file');
});

test('the environment wins over the env file, and --env-file names another file', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: { $schema: SCHEMA, 'test-fork': fixtureTest({ chains: [SEPOLIA_FORK] }) },
  });
  const other = join(repository.root, 'other.env');
  const argv = ['list', '--root', repository.root, '--env-file', other];

  writeFileSync(other, `SEPOLIA_RPC_URL=${SEPOLIA_URL}\n`);
  withEnvironment({ context, variables: { SEPOLIA_RPC_URL: 'https://from.the.environment.invalid' } });

  const listed = await captureEngine({ context, argv });

  assert.match(listed.stdout.join('\n'), /^selected +test-fork/);
  assert.match(listed.stderr, /The environment already sets SEPOLIA_RPC_URL: the file does not change them\./);
  assert.equal(process.env['SEPOLIA_RPC_URL'], 'https://from.the.environment.invalid');

  const missing = await captureEngine({
    context,
    argv: ['list', '--root', repository.root, '--env-file', 'nowhere.env'],
  });

  assert.equal(missing.status, RUN_FAILURE_EXIT_STATUS);
  assert.match(missing.stderr, /The env file .*nowhere\.env does not exist\./);
});
