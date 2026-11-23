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
