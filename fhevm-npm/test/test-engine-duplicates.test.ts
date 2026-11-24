import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { duplicateCases } from '../base/test-engine/duplicates.ts';
import { captureEngine, fixtureTest, writeFixtureRepository } from './test-engine-fixtures.ts';

const SCHEMA = './ALL_TESTS.schema.json';

/** A list command that prints the given cases, one per line. */
function printing(cases: readonly string[]): string {
  return `printf '${cases.map((one) => `${one}\\n`).join('')}'`;
}

////////////////////////////////////////////////////////////////////////////////

test('a case that two tests list is a duplicate, with both tests, and a case that one test lists twice is not', () => {
  const duplicates = duplicateCases([
    { id: 'test-a', cases: ['x', 'y'] },
    { id: 'test-b', cases: ['y', 'z'] },
    { id: 'test-c', cases: ['z', 'w'] },
  ]);

  assert.deepEqual(duplicates, [
    { testCase: 'y', ids: ['test-a', 'test-b'] },
    { testCase: 'z', ids: ['test-b', 'test-c'] },
  ]);
  assert.deepEqual(duplicateCases([{ id: 'test-a', cases: ['x'] }]), []);
});

test('duplicates names each case that two tests select, runs no test, and fails', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      'test-whole': fixtureTest({ command: 'touch ran-whole', list: printing(['a.t.sol:A.one', 'a.t.sol:A.two']) }),
      'test-part': fixtureTest({ command: 'touch ran-part', list: printing(['a.t.sol:A.two']) }),
      'test-other': fixtureTest({ command: 'touch ran-other' }),
    },
  });

  const run = await captureEngine({ context, argv: ['duplicates', '--root', repository.root] });

  assert.equal(run.status, 1, run.stdout.join('\n'));
  assert.match(run.stderr, /^❌ a\.t\.sol:A\.two {2}is selected by test-whole, test-part$/m);
  assert.doesNotMatch(run.stderr, /A\.one/);
  assert.match(run.stdout.join('\n'), /^listed {2}test-whole {2}2 case\(s\)/m);
  assert.match(run.stdout.join('\n'), /^1 test\(s\) have no list command, and are not checked\.$/m);

  // No test ran.
  for (const file of ['ran-whole', 'ran-part', 'ran-other']) {
    assert.equal(existsSync(join(repository.root, file)), false, file);
  }
});

test('duplicates passes when each case has one test, and reads only the selected tests', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      'test-a': fixtureTest({ list: printing(['one', '', 'two', 'two']) }),
      'test-b': fixtureTest({ list: printing(['three']) }),
      'test-local': fixtureTest({ ci: false, list: printing(['one']) }),
      'test-later': fixtureTest({ skipped: true, list: printing(['three']) }),
    },
  });

  const run = await captureEngine({ context, argv: ['duplicates', '--ci', '--root', repository.root] });

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout.join('\n'), /^✅ 3 case\(s\), listed by 2 test\(s\): none is selected by two tests\.$/m);

  const all = await captureEngine({ context, argv: ['duplicates', '--root', repository.root] });

  assert.equal(all.status, 1, 'without --ci, the test that CI never runs is read too');
  assert.match(all.stderr, /^❌ one {2}is selected by test-a, test-local$/m);
});

test('a list command that fails stops the check, with its status and its error', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      'test-broken': fixtureTest({ list: 'echo "no such filter" >&2; exit 4' }),
    },
  });

  const run = await captureEngine({ context, argv: ['duplicates', '--root', repository.root] });

  assert.equal(run.status, 2);
  assert.match(run.stderr, /The list command of test-broken exited with status 4:/);
  assert.match(run.stderr, /no such filter/);
});
