import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { loadInventory } from '../base/test-engine/inventory.ts';
import { ANVIL_CHAIN, fixtureTest, writeFixtureRepository } from './test-engine-fixtures.ts';

test('loads the tests in the order of the file, and leaves $schema out', (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: './ALL_TESTS.schema.json',
      'test-b': fixtureTest({ chains: [ANVIL_CHAIN] }),
      'test-a': fixtureTest({ ci: false, skipped: true }),
    },
  });

  const inventory = loadInventory({ inventoryFile: repository.inventoryFile, schemaFile: undefined });

  assert.deepEqual([...inventory.tests.keys()], ['test-b', 'test-a']);
  assert.deepEqual(inventory.tests.get('test-b')?.chains, [ANVIL_CHAIN]);
  assert.equal(inventory.tests.get('test-a')?.skipped, true);
  assert.equal(inventory.schemaFile, repository.schemaFile);
});

test('an explicit schema file replaces the one that $schema names', (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: { $schema: './missing.schema.json', 'test-a': fixtureTest() },
  });

  const inventory = loadInventory({ inventoryFile: repository.inventoryFile, schemaFile: repository.schemaFile });

  assert.equal(inventory.tests.size, 1);
});

test('an inventory that names no schema is rejected, unless a schema file is given', (context) => {
  const repository = writeFixtureRepository({ context, inventory: { 'test-a': fixtureTest() } });

  assert.throws(
    () => loadInventory({ inventoryFile: repository.inventoryFile, schemaFile: undefined }),
    /names no schema/,
  );
  assert.equal(
    loadInventory({ inventoryFile: repository.inventoryFile, schemaFile: repository.schemaFile }).tests.size,
    1,
  );
});

test('every schema violation is reported, with the place of each one', (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: './ALL_TESTS.schema.json',
      'test-a': { command: 'true', package: 'fixture', chains: [] },
      'test-b': fixtureTest({ chains: [{ ...ANVIL_CHAIN, runtime: 'docker' as never }] }),
      'test-c': { ...fixtureTest(), retries: 3 },
      Not_An_Id: fixtureTest(),
    },
  });

  assert.throws(
    () => loadInventory({ inventoryFile: repository.inventoryFile, schemaFile: undefined }),
    (error: Error) => {
      assert.match(error.message, /\/test-a: missing required property 'ci'/);
      assert.match(error.message, /\/test-b\/chains\/0\/runtime: must be equal to one of the allowed values/);
      assert.match(error.message, /\/test-c: unknown property 'retries'/);
      assert.match(error.message, /invalid test ID 'Not_An_Id'/);
      assert.doesNotMatch(error.message, /must match pattern/);
      return true;
    },
  );
});

test('a missing inventory, invalid JSON, and a non-object root are rejected with the path', (context) => {
  const repository = writeFixtureRepository({ context, inventory: {} });
  const missing = join(repository.root, 'missing.json');
  const broken = join(repository.root, 'broken.json');
  const list = join(repository.root, 'list.json');

  writeFileSync(broken, '{');
  writeFileSync(list, '[]');

  assert.throws(() => loadInventory({ inventoryFile: missing, schemaFile: undefined }), /missing\.json does not exist/);
  assert.throws(
    () => loadInventory({ inventoryFile: broken, schemaFile: undefined }),
    /broken\.json is not valid JSON/,
  );
  assert.throws(() => loadInventory({ inventoryFile: list, schemaFile: undefined }), /list\.json is not a JSON object/);
});

test('a schema that is not a valid JSON Schema is rejected', (context) => {
  const repository = writeFixtureRepository({ context, inventory: { 'test-a': fixtureTest() } });
  const schemaFile = join(repository.root, 'bad.schema.json');

  writeFileSync(schemaFile, JSON.stringify({ type: 'no-such-type' }));

  assert.throws(
    () => loadInventory({ inventoryFile: repository.inventoryFile, schemaFile }),
    /bad\.schema\.json is not a valid JSON Schema/,
  );
});

test('a schema named by a URL is rejected, with the way out', (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: { $schema: 'https://example.com/ALL_TESTS.schema.json', 'test-a': fixtureTest() },
  });

  assert.throws(
    () => loadInventory({ inventoryFile: repository.inventoryFile, schemaFile: undefined }),
    /names its schema by a URL.*Pass --schema/,
  );
});

test('a command that names the RPC URL variable of a live chain the test does not declare is rejected', (context) => {
  const mainnetFork = { chainid: 1, fhevm: 'mainnet', runtime: 'forge-fork' };
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: './ALL_TESTS.schema.json',
      // Needs Arbitrum, and declares mainnet only.
      'test-a': fixtureTest({ command: 'ARBITRUM_RPC_URL=${ARBITRUM_RPC_URL:?} run', chains: [mainnetFork] as never }),
      // Declares the chain, but as a local node: not a live chain.
      'test-b': fixtureTest({ command: 'run $SEPOLIA_RPC_URL', chains: [{ ...ANVIL_CHAIN, chainid: 11155111 }] }),
      // Declares the chain it names.
      'test-c': fixtureTest({ command: 'run $MAINNET_RPC_URL', chains: [mainnetFork] as never }),
      // Names a longer variable, which is another one.
      'test-d': fixtureTest({ command: 'run $MY_SEPOLIA_RPC_URL_2' }),
    },
  });

  assert.throws(
    () => loadInventory({ inventoryFile: repository.inventoryFile, schemaFile: undefined }),
    (error: Error) => {
      assert.match(error.message, /2 command\(s\) that need a live chain the test does not declare/);
      assert.match(error.message, /test-a: the command names ARBITRUM_RPC_URL, and the test declares no chain 42161 /);
      assert.match(
        error.message,
        /test-b: the command names SEPOLIA_RPC_URL, and the test declares no chain 11155111 /,
      );
      assert.doesNotMatch(error.message, /test-c|test-d/);
      return true;
    },
  );
});

test('a test that forks one chain at two different blocks is rejected', (context) => {
  const at = (block: number | null | undefined) => ({
    chainid: 1,
    fhevm: 'mainnet',
    runtime: 'forge-fork',
    ...(block === undefined ? {} : { block }),
  });
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: './ALL_TESTS.schema.json',
      // Two forks of mainnet, at two blocks: one MAINNET_FORK_BLOCK cannot say both.
      'test-a': fixtureTest({ chains: [at(100), at(200)] as never }),
      // A pinned fork and an unpinned one of the same chain: the same.
      'test-b': fixtureTest({ chains: [at(100), at(undefined)] as never }),
      // Two forks at the same block, and a fork whose block is still to find: accepted.
      'test-c': fixtureTest({ chains: [at(100), at(100)] as never }),
      'test-d': fixtureTest({ chains: [at(null)] as never }),
    },
  });

  assert.throws(
    () => loadInventory({ inventoryFile: repository.inventoryFile, schemaFile: undefined }),
    (error: Error) => {
      assert.match(error.message, /2 test\(s\) that fork one chain at more than one block/);
      assert.match(error.message, /test-a: forks chain 1 at blocks 100 and 200/);
      assert.match(error.message, /test-b: forks chain 1 at blocks 100 and latest/);
      assert.doesNotMatch(error.message, /test-c|test-d/);
      return true;
    },
  );
});

test('a CI test that reaches a live chain at its latest block is rejected, with why', (context) => {
  const fork = (block?: number | null) => ({
    chainid: 1,
    fhevm: 'mainnet',
    runtime: 'forge-fork',
    ...(block === undefined ? {} : { block }),
  });
  const remote = { chainid: 11155111, fhevm: 'testnet', runtime: 'remote', wallet: false };
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: './ALL_TESTS.schema.json',
      'test-unpinned': fixtureTest({ chains: [fork()] as never }),
      'test-to-find': fixtureTest({ chains: [fork(null)] as never }),
      'test-remote': fixtureTest({ chains: [fork(100), remote] as never }),
      // Accepted: pinned forks only, no live chain, or a latest chain in a test that CI does not run.
      'test-pinned': fixtureTest({ chains: [fork(100)] as never }),
      'test-plain': fixtureTest(),
      'test-nightly': fixtureTest({ ci: false, chains: [fork(), remote] as never }),
    },
  });

  assert.throws(
    () => loadInventory({ inventoryFile: repository.inventoryFile, schemaFile: undefined }),
    (error: Error) => {
      assert.match(error.message, /3 test\(s\) with "ci": true that reach a live chain at its latest block/);
      assert.match(error.message, /test-unpinned: chain 1 is a fork with no pinned block\./);
      assert.match(error.message, /test-to-find: chain 1 is a fork whose block is still to find\./);
      assert.match(error.message, /test-remote: chain 11155111 is a remote chain\./);
      assert.match(error.message, /Pin each fork's "block", or set "ci": false/);
      assert.doesNotMatch(error.message, /test-pinned|test-plain|test-nightly/);
      return true;
    },
  );
});
