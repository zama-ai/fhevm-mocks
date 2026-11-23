import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { checkReport } from '../base/test-engine/report-check.ts';
import { captureEngine, fixtureInventory, fixtureTest, writeFixtureRepository } from './test-engine-fixtures.ts';

const INVENTORY = fixtureInventory({
  'test-ci': fixtureTest(),
  'test-local': fixtureTest({ ci: false }),
  'test-off': fixtureTest({ skipped: true }),
});

/** A report of a run, with the given states by test ID. A test that ran gets a duration. */
function reportWith(states: Readonly<Record<string, string>>): Record<string, unknown> {
  const tests = Object.entries(states).map(([id, state]) => {
    const ran = state === 'passed' || state === 'failed';

    return [id, ran ? { state, durationMilliseconds: 12 } : { state }];
  });

  return { version: 1, dryRun: false, tests: Object.fromEntries(tests) };
}

const SOUND = reportWith({ 'test-ci': 'passed', 'test-local': 'failed', 'test-off': 'skipped' });

test('a sound report has no problem, on its own and against the inventory', () => {
  assert.deepEqual(checkReport({ report: SOUND, ci: false }), []);
  assert.deepEqual(checkReport({ report: SOUND, inventory: INVENTORY, ci: false }), []);
});

test('a report of another shape is a problem', () => {
  assert.deepEqual(checkReport({ report: { ...SOUND, version: 2 }, ci: false }), ['the report is not of version 1']);
  assert.deepEqual(checkReport({ report: { version: 1, tests: {} }, ci: false }), [
    "the report holds no boolean 'dryRun'",
  ]);
  assert.deepEqual(checkReport({ report: { version: 1, dryRun: false }, ci: false }), [
    "the report holds no 'tests' object",
  ]);
});

test('an unknown state, a missing or invalid duration, and a duration on a test that did not run are problems', () => {
  const report = {
    version: 1,
    dryRun: false,
    tests: {
      'test-a': { state: 'running' },
      'test-b': { state: 'failed' },
      'test-c': { state: 'passed', durationMilliseconds: -1 },
      'test-d': { state: 'skipped', durationMilliseconds: 3 },
      'test-e': 'passed',
    },
  };

  assert.deepEqual(checkReport({ report, ci: false }), [
    'test-a: its state is not one of passed, failed, skipped, not-selected',
    'test-b: it ran, and has no valid duration',
    'test-c: it ran, and has no valid duration',
    'test-d: it did not run, and has a duration',
    'test-e: its state is not one of passed, failed, skipped, not-selected',
  ]);
});

test('a dry-run report has passed tests without a duration, and no failed test', () => {
  const tests = { 'test-a': { state: 'passed' }, 'test-b': { state: 'failed' } };

  assert.deepEqual(checkReport({ report: { version: 1, dryRun: true, tests }, ci: false }), [
    'test-b: it is failed in a dry run, which runs no test',
  ]);
});

test('against the inventory, a test without a state and a test the inventory does not hold are problems', () => {
  const report = reportWith({ 'test-ci': 'passed', 'test-off': 'skipped', 'test-zz': 'not-selected' });

  assert.deepEqual(checkReport({ report, inventory: INVENTORY, ci: false }), [
    'test-zz: the inventory holds no such test',
    'test-local: the report gives it no state',
  ]);
  assert.deepEqual(checkReport({ report, ci: false }), []);
});

test("against the inventory, a state that contradicts the test's skipped value is a problem", () => {
  const report = reportWith({ 'test-ci': 'skipped', 'test-local': 'not-selected', 'test-off': 'passed' });

  assert.deepEqual(checkReport({ report, inventory: INVENTORY, ci: false }), [
    'test-ci: it is skipped, and has no "skipped": true',
    'test-off: it has "skipped": true, and is passed',
  ]);
});

test('a CI run selects every test with "ci": true, and no other', () => {
  const ciRun = reportWith({ 'test-ci': 'failed', 'test-local': 'not-selected', 'test-off': 'skipped' });
  const filtered = reportWith({ 'test-ci': 'not-selected', 'test-local': 'passed', 'test-off': 'not-selected' });

  assert.deepEqual(checkReport({ report: ciRun, inventory: INVENTORY, ci: true }), []);
  assert.deepEqual(checkReport({ report: filtered, inventory: INVENTORY, ci: false }), []);
  assert.deepEqual(checkReport({ report: filtered, inventory: INVENTORY, ci: true }), [
    'test-ci: it has "ci": true, and is not selected in a CI run',
    'test-local: it has "ci": false, and is passed in a CI run',
    'test-off: it has "ci": true, and is not selected in a CI run',
  ]);
});

test('check-report accepts the report of a real run, and exits with 1 on a problem', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: './ALL_TESTS.schema.json',
      'test-ci': fixtureTest(),
      'test-local': fixtureTest({ ci: false }),
      'test-off': fixtureTest({ skipped: true }),
    },
  });
  const report = join(repository.root, 'test-report.json');
  const check = ['check-report', report, '--inventory', repository.inventoryFile];

  await captureEngine({ context, argv: ['run', '--max-lanes', '4', '--root', repository.root, '--ci'] });

  assert.equal((await captureEngine({ context, argv: [...check, '--ci'] })).status, 0);

  await captureEngine({ context, argv: ['run', '--max-lanes', '4', '--root', repository.root, 'test-local'] });

  const notCi = await captureEngine({ context, argv: [...check, '--ci'] });

  assert.equal((await captureEngine({ context, argv: check })).status, 0);
  assert.equal(notCi.status, 1);
  assert.match(notCi.stderr, /test-ci: it has "ci": true, and is not selected in a CI run/);
});

test('check-report fails the run on a report that is not JSON, and on --ci without --inventory', async (context) => {
  const repository = writeFixtureRepository({ context, inventory: {} });
  const report = join(repository.root, 'test-report.json');

  writeFileSync(report, 'not json');

  assert.equal((await captureEngine({ context, argv: ['check-report', report] })).status, 2);

  writeFileSync(report, JSON.stringify(SOUND));

  const withoutInventory = await captureEngine({ context, argv: ['check-report', report, '--ci'] });

  assert.equal(withoutInventory.status, 2);
  assert.match(withoutInventory.stderr, /--ci and --schema need --inventory/);
});
