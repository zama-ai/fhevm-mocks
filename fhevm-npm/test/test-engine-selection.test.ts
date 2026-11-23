import assert from 'node:assert/strict';
import test from 'node:test';

import type { CandidateFilters } from '../base/test-engine/open-questions.ts';
import type { Chain, Test } from '../base/test-engine/inventory.ts';
import type { Environment } from '../base/test-engine/live-chains.ts';
import { type ResolvedTest, type SelectionRequest, resolveSelection } from '../base/test-engine/selection.ts';
import { ANVIL_CHAIN, SEPOLIA_CHAIN, fixtureInventory, fixtureTest } from './test-engine-fixtures.ts';

const INVENTORY = fixtureInventory({
  'test-plain': fixtureTest(),
  'test-anvil': fixtureTest({ chains: [ANVIL_CHAIN] }),
  'test-sepolia': fixtureTest({ ci: false, chains: [SEPOLIA_CHAIN] }),
  'test-skipped': fixtureTest({ skipped: true, chains: [ANVIL_CHAIN] }),
});

type RequestParts = Partial<Pick<SelectionRequest, 'ids' | 'ci'>> & CandidateFilters;

/** An environment that sets the RPC URL of Sepolia, so that the tests on that chain can run. */
const WITH_SEPOLIA = { SEPOLIA_RPC_URL: 'https://sepolia.example.invalid' };

function states(parts: RequestParts, environment: Environment = WITH_SEPOLIA): Record<string, string> {
  const { ids = [], ci = false, ...candidateFilters } = parts;
  const resolved = resolveSelection({ inventory: INVENTORY, request: { ids, ci, candidateFilters }, environment });

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

////////////////////////////////////////////////////////////////////////////////
// Live chains
////////////////////////////////////////////////////////////////////////////////

const FORK_OF_TWO: Chain[] = [
  { chainid: 11155111, fhevm: 'testnet', runtime: 'remote', wallet: false },
  { chainid: 1, fhevm: 'mainnet', runtime: 'forge-fork' },
  { chainid: 11155111, fhevm: 'testnet', runtime: 'forge-fork' },
];

function resolveLive(tests: Readonly<Record<string, Test>>, environment: Environment): readonly ResolvedTest[] {
  const request = { ids: [], ci: false, candidateFilters: {} };

  return resolveSelection({ inventory: fixtureInventory(tests), request, environment });
}

test('a test whose live chain has no RPC URL variable set is unavailable, and names the variable', () => {
  assert.equal(states({}, {})['test-sepolia'], 'unavailable');
  assert.equal(states({}, { SEPOLIA_RPC_URL: '  ' })['test-sepolia'], 'unavailable', 'an empty value is not set');
  assert.equal(states({}, {})['test-anvil'], 'selected', 'a local chain needs no RPC URL variable');

  const [sepolia] = resolveLive({ 'test-sepolia': fixtureTest({ chains: [SEPOLIA_CHAIN] }) }, {});

  assert.deepEqual(sepolia?.missingVariables, ['SEPOLIA_RPC_URL']);
});

test('a test needs the variable of each of its live chains, a fork included, each named once', () => {
  const tests = { 'test-two': fixtureTest({ chains: FORK_OF_TWO }) };
  const [none] = resolveLive(tests, {});
  const [one] = resolveLive(tests, WITH_SEPOLIA);
  const [both] = resolveLive(tests, { ...WITH_SEPOLIA, MAINNET_RPC_URL: 'https://mainnet.example.invalid' });

  assert.deepEqual(none?.missingVariables, ['SEPOLIA_RPC_URL', 'MAINNET_RPC_URL']);
  assert.deepEqual([one?.state, one?.missingVariables], ['unavailable', ['MAINNET_RPC_URL']]);
  assert.deepEqual([both?.state, both?.missingVariables], ['selected', undefined]);
});

test('not selected and skipped come before unavailable', () => {
  assert.equal(states({ ci: true }, {})['test-sepolia'], 'not-selected');

  const [skipped] = resolveLive({ 'test-off': fixtureTest({ skipped: true, chains: [SEPOLIA_CHAIN] }) }, {});

  assert.equal(skipped?.state, 'skipped');
});

test('a live chain whose variable the engine does not know fails the run, for a test that would run', () => {
  const unknown: Chain = { chainid: 5, fhevm: 'none', runtime: 'remote', wallet: false };

  assert.throws(
    () => resolveLive({ 'test-unknown': fixtureTest({ chains: [unknown] }) }, {}),
    /test-unknown needs the live chain 5, and the engine knows no RPC URL variable for that chain/,
  );
  assert.equal(resolveLive({ 'test-off': fixtureTest({ skipped: true, chains: [unknown] }) }, {})[0]?.state, 'skipped');
});
