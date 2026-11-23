import assert from 'node:assert/strict';
import { relative } from 'node:path';
import test from 'node:test';

import { selectionLines } from '../base/test-engine/listing.ts';
import { RUN_FAILURE_EXIT_STATUS } from '../base/test-engine/exit-status.ts';
import {
  ANVIL_CHAIN,
  SEPOLIA_CHAIN,
  captureEngine,
  fixtureTest,
  writeFixtureRepository,
} from './test-engine-fixtures.ts';

const INVENTORY = {
  $schema: './ALL_TESTS.schema.json',
  'test-plain': fixtureTest(),
  'test-anvil': fixtureTest({ chains: [ANVIL_CHAIN] }),
  'test-sepolia': fixtureTest({ ci: false, chains: [SEPOLIA_CHAIN] }),
};

test('validate passes on a valid inventory', async (context) => {
  const repository = writeFixtureRepository({ context, inventory: INVENTORY });

  const result = await captureEngine({ context, argv: ['validate', '--root', repository.root] });

  assert.equal(result.status, 0);
  assert.match(result.stdout.join('\n'), /3 test\(s\) match/);
});

test('validate fails the run on an invalid inventory, and says what is wrong', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: { ...INVENTORY, 'test-bad': { command: 'true' } },
  });

  const result = await captureEngine({ context, argv: ['validate', '--root', repository.root] });

  assert.equal(result.status, RUN_FAILURE_EXIT_STATUS);
  assert.match(result.stderr, /\/test-bad: missing required property 'ci'/);
});

test('list prints one line per test of the inventory, with its state', async (context) => {
  const repository = writeFixtureRepository({ context, inventory: INVENTORY });

  const result = await captureEngine({ context, argv: ['list', '--root', repository.root, '--ci'] });

  assert.equal(result.status, 0);
  assert.deepEqual(result.stdout, [
    'selected      test-plain    no chain',
    'selected      test-anvil    31337/local/anvil startedBy=runner fresh=true',
    'not-selected  test-sepolia  11155111/testnet/remote wallet=false',
  ]);
});

test('an option with no command before it says that the command is missing, and names the commands', async (context) => {
  const result = await captureEngine({ context, argv: ['--ci', '--match', 'anvil', '--max-lanes', '3'] });
  const help = await captureEngine({ context, argv: ['--help'] }).catch(() => undefined);

  assert.equal(result.status, RUN_FAILURE_EXIT_STATUS);
  assert.match(result.stderr, /'--ci' is an option, and no command is named before it\./);
  assert.match(result.stderr, /as in 'test-engine run --ci \.\.\.'/);
  assert.match(result.stderr, /The commands are: validate, list, lanes, shards, run, check-report, ps, kill\./);
  // Asking for help is not a mistake.
  assert.notEqual(help?.status, RUN_FAILURE_EXIT_STATUS);
});

test('a command that only reads the inventory prints nothing but its answer', async (context) => {
  const repository = writeFixtureRepository({ context, inventory: INVENTORY });

  const filtered = await captureEngine({ context, argv: ['list', '--root', repository.root, '--match', 'anvil'] });
  const unfiltered = await captureEngine({ context, argv: ['list', '--root', repository.root, '--ci'] });

  assert.equal(filtered.stderr, '');
  assert.equal(unfiltered.stderr, '');
});

test('--inventory and --schema are relative to the current directory, not to --root', async (context) => {
  const repository = writeFixtureRepository({ context, inventory: { 'test-plain': fixtureTest() } });

  const result = await captureEngine({
    context,
    argv: [
      'list',
      'test-plain',
      '--root',
      '/',
      '--inventory',
      relative(process.cwd(), repository.inventoryFile),
      '--schema',
      relative(process.cwd(), repository.schemaFile),
    ],
  });

  assert.equal(result.status, 0);
  assert.deepEqual(result.stdout, ['selected  test-plain  no chain']);
});

test('each invalid request fails the run for its own reason', async (context) => {
  const repository = writeFixtureRepository({ context, inventory: INVENTORY });
  const cases: readonly (readonly [readonly string[], RegExp])[] = [
    [['test-nope'], /holds no test with ID 'test-nope'/],
    [['--bogus'], /unknown option '--bogus'/],
    [['--chain', '0'], /A chain id is a positive integer/],
    [['--runtime', 'docker'], /Allowed choices are forge,/],
    [['--match', '('], /is not a valid regular expression/],
  ];

  for (const [extra, reason] of cases) {
    const result = await captureEngine({ context, argv: ['list', '--root', repository.root, ...extra] });

    assert.equal(result.status, RUN_FAILURE_EXIT_STATUS, extra.join(' '));
    assert.match(result.stderr, reason);
  }
});

test('--help succeeds', async (context) => {
  context.mock.method(process.stdout, 'write', () => true);

  assert.equal((await captureEngine({ context, argv: ['--help'] })).status, 0);
});

test('selectionLines shows a fixed block that is still to find', () => {
  const lines = selectionLines([
    {
      id: 'test-fork',
      state: 'skipped',
      test: fixtureTest({ chains: [{ chainid: 1, fhevm: 'mainnet', runtime: 'forge-fork', block: null }] }),
    },
  ]);

  assert.deepEqual(lines, ['skipped  test-fork  1/mainnet/forge-fork block=null']);
});
