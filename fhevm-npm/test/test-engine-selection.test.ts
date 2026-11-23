import assert from 'node:assert/strict';
import test from 'node:test';

import type { CandidateFilters } from '../base/test-engine/open-questions.ts';
import { type SelectionRequest, resolveSelection } from '../base/test-engine/selection.ts';
import { ANVIL_CHAIN, SEPOLIA_CHAIN, fixtureInventory, fixtureTest } from './test-engine-fixtures.ts';

const INVENTORY = fixtureInventory({
  'test-plain': fixtureTest(),
  'test-anvil': fixtureTest({ chains: [ANVIL_CHAIN] }),
  'test-sepolia': fixtureTest({ ci: false, chains: [SEPOLIA_CHAIN] }),
  'test-skipped': fixtureTest({ skipped: true, chains: [ANVIL_CHAIN] }),
});

type RequestParts = Partial<Pick<SelectionRequest, 'ids' | 'ci'>> & CandidateFilters;

function states(parts: RequestParts): Record<string, string> {
  const { ids = [], ci = false, ...candidateFilters } = parts;
  const resolved = resolveSelection({ inventory: INVENTORY, request: { ids, ci, candidateFilters } });

  return Object.fromEntries(resolved.map((entry) => [entry.id, entry.state]));
}

test('an empty request selects every test, and a skipped test is skipped', () => {
  assert.deepEqual(states({}), {
    'test-plain': 'selected',
    'test-anvil': 'selected',
    'test-sepolia': 'selected',
    'test-skipped': 'skipped',
  });
});

test('every test of the inventory gets a state, in the order of the inventory', () => {
  assert.deepEqual(Object.keys(states({ ids: ['test-sepolia'] })), [...INVENTORY.tests.keys()]);
});

test('exact IDs select those tests only', () => {
  assert.deepEqual(states({ ids: ['test-anvil', 'test-plain'] }), {
    'test-plain': 'selected',
    'test-anvil': 'selected',
    'test-sepolia': 'not-selected',
    'test-skipped': 'not-selected',
  });
});

test('a skipped test is never selected, even when an ID names it', () => {
  assert.equal(states({ ids: ['test-skipped'] })['test-skipped'], 'skipped');
});

test('a skipped test that the selection leaves out is not selected', () => {
  assert.equal(states({ ids: ['test-plain'] })['test-skipped'], 'not-selected');
});

test('the CI selection leaves out the tests with "ci": false', () => {
  assert.deepEqual(states({ ci: true }), {
    'test-plain': 'selected',
    'test-anvil': 'selected',
    'test-sepolia': 'not-selected',
    'test-skipped': 'skipped',
  });
});

test('a regular expression selects the tests whose ID matches', () => {
  assert.deepEqual(states({ match: '^test-(plain|sep)' }), {
    'test-plain': 'selected',
    'test-anvil': 'not-selected',
    'test-sepolia': 'selected',
    'test-skipped': 'not-selected',
  });
});

test('a chain id and a runtime select the tests with such a chain', () => {
  assert.equal(states({ chainId: 11155111 })['test-sepolia'], 'selected');
  assert.equal(states({ chainId: 11155111 })['test-anvil'], 'not-selected');
  assert.equal(states({ runtime: 'anvil' })['test-anvil'], 'selected');
  assert.equal(states({ runtime: 'anvil' })['test-plain'], 'not-selected');
});

test('filters combine: a test must match all of them', () => {
  assert.deepEqual(states({ ci: true, runtime: 'anvil', match: 'anvil' }), {
    'test-plain': 'not-selected',
    'test-anvil': 'selected',
    'test-sepolia': 'not-selected',
    'test-skipped': 'not-selected',
  });
  assert.equal(states({ ids: ['test-sepolia'], ci: true })['test-sepolia'], 'not-selected');
});

test('an ID that the inventory does not hold is rejected', () => {
  assert.throws(() => states({ ids: ['test-plain', 'test-nope'] }), /holds no test with ID 'test-nope'/);
});

test('an invalid regular expression is rejected', () => {
  assert.throws(() => states({ match: '(' }), /'\(' is not a valid regular expression/);
});
