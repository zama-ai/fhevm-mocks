import assert from 'node:assert/strict';
import test from 'node:test';

import type { Chain, InventoryEntry, NodeChain, Test } from '../base/test-engine/inventory.ts';
import { type Lane, checkPorts, generateLanes, laneLines } from '../base/test-engine/lanes.ts';
import { RUN_FAILURE_EXIT_STATUS } from '../base/test-engine/open-questions.ts';
import { fixedPortsOfSpec, portsOfSpec } from '../base/test-engine/port-spec.ts';
import {
  ANVIL_CHAIN,
  captureEngine,
  fixtureInventory,
  fixtureTest,
  writeFixtureRepository,
} from './test-engine-fixtures.ts';

/** A test with one node chain for each given port. `undefined` is a chain that states 0. */
function entry(id: string, ...ports: readonly (number | string | undefined)[]): InventoryEntry {
  const chains = ports.map((port): NodeChain => (port === undefined ? ANVIL_CHAIN : { ...ANVIL_CHAIN, port }));

  return { id, test: fixtureTest({ chains }) };
}

type Duration = NonNullable<Test['duration']>;

/** A test that states a duration, and the given ports. */
function timed(id: string, duration: Duration, ...ports: readonly number[]): InventoryEntry {
  const { test } = entry(id, ...ports);

  return { id, test: { ...test, duration } };
}

type LanesInput = {
  readonly entries: readonly InventoryEntry[];
  readonly maximum: number;
};

/** The IDs of each lane, in the order of the lanes. */
function lanesOf(input: LanesInput): readonly (readonly string[])[] {
  return generateLanes(input).map(idsOf);
}

function idsOf(lane: Lane): readonly string[] {
  return lane.entries.map((item) => item.id);
}

////////////////////////////////////////////////////////////////////////////////
// Groups
////////////////////////////////////////////////////////////////////////////////

test('tests that state the same fixed port share a lane, in the order of the inventory', () => {
  const entries = [entry('test-a', 8545), entry('test-b', 8546), entry('test-c', 8545)];

  assert.deepEqual(lanesOf({ entries, maximum: 10 }), [['test-a', 'test-c'], ['test-b']]);
});

test('a test that states no fixed port has a group of its own, also with 0', () => {
  const entries = [entry('test-a'), entry('test-b', undefined), entry('test-c', 8545), entry('test-d', '0,0')];

  assert.deepEqual(lanesOf({ entries, maximum: 10 }), [['test-a'], ['test-b'], ['test-c'], ['test-d']]);
});

test('a test with two ports links the tests of both: they all share one lane', () => {
  const entries = [entry('test-a', 8545), entry('test-b', 8546), entry('test-both', 8546, 8545), entry('test-c', 8547)];

  assert.deepEqual(lanesOf({ entries, maximum: 10 }), [['test-a', 'test-b', 'test-both'], ['test-c']]);
});

test('a later test of a linked group joins the same lane, whichever port it states', () => {
  const entries = [
    entry('test-a', 1),
    entry('test-b', 2),
    entry('test-link', 1, 2),
    entry('test-c', 2),
    entry('test-d', 1),
  ];

  assert.deepEqual(lanesOf({ entries, maximum: 10 }), [['test-a', 'test-b', 'test-link', 'test-c', 'test-d']]);
});

test('a range and a list state every port they name', () => {
  const entries = [
    entry('test-range', '8550-8699'),
    entry('test-inside', 8600),
    entry('test-list', '8700,8545'),
    entry('test-shared', 8545),
    entry('test-apart', 8546),
  ];

  assert.deepEqual(lanesOf({ entries, maximum: 10 }), [
    ['test-range', 'test-inside'],
    ['test-list', 'test-shared'],
    ['test-apart'],
  ]);
});

////////////////////////////////////////////////////////////////////////////////
// The maximum
////////////////////////////////////////////////////////////////////////////////

test('with no more groups than the maximum, each group is a lane, and the heaviest is lane 1', () => {
  const entries = [entry('test-d'), entry('test-a', 1), entry('test-b', 1), entry('test-c', 1), entry('test-e')];
  const lanes = generateLanes({ entries, maximum: 5 });

  assert.deepEqual(lanes.map(idsOf), [['test-a', 'test-b', 'test-c'], ['test-d'], ['test-e']]);
  assert.deepEqual(
    lanes.map((lane) => lane.number),
    [1, 2, 3],
    'the lanes that got no group do not exist',
  );
});

test('with more groups than the maximum, each group goes whole into the lane with the lowest weight', () => {
  // The example of the specification: A, B and C state one port, and D, E, F, G state none.
  const entries = [entry('A', 1), entry('B', 1), entry('C', 1), entry('D'), entry('E'), entry('F'), entry('G')];

  assert.deepEqual(lanesOf({ entries, maximum: 2 }), [
    ['A', 'B', 'C', 'G'],
    ['D', 'E', 'F'],
  ]);
});

test('at equal weight, the group whose first test comes earlier goes first', () => {
  const entries = [entry('E'), entry('C', 2), entry('A', 1), entry('D', 2), entry('B', 1), entry('F'), entry('G')];

  // The groups {C, D} and {A, B} have two tests each, and C comes before A in the inventory.
  assert.deepEqual(lanesOf({ entries, maximum: 2 }), [
    ['E', 'C', 'D', 'G'],
    ['A', 'B', 'F'],
  ]);
});

////////////////////////////////////////////////////////////////////////////////
// Weights
////////////////////////////////////////////////////////////////////////////////

test('a slow test weighs 20 fast ones, and a very slow test 60', () => {
  const fast = Array.from({ length: 21 }, (_, index) => timed(`fast-${index + 1}`, 'fast'));

  // The slow test is the heaviest group, so it is lane 1. Twenty fast tests bring lane 2 to its weight,
  // and at equal weight the next one goes to the lane with the lowest number.
  const [first, second] = lanesOf({ entries: [...fast, timed('slow', 'slow')], maximum: 2 });
  assert.deepEqual(first, ['fast-21', 'slow']);
  assert.equal(second?.length, 20);

  // Three slow tests bring lane 2 to the weight of the very slow one, so the last test goes to lane 1.
  const entries = [timed('very-slow', 'very-slow'), timed('a', 'slow'), timed('b', 'slow'), timed('c', 'slow')];
  assert.deepEqual(lanesOf({ entries: [...entries, timed('last', 'fast')], maximum: 2 }), [
    ['very-slow', 'last'],
    ['a', 'b', 'c'],
  ]);
});

test('a test that states no duration weighs as much as a slow one', () => {
  const entries = [entry('unknown'), timed('slow', 'slow'), timed('fast-1', 'fast'), timed('fast-2', 'fast')];

  // Both heavy tests weigh 20: the earlier one is lane 1. The fast ones then fill lane 1, then lane 2.
  assert.deepEqual(lanesOf({ entries, maximum: 2 }), [
    ['unknown', 'fast-1'],
    ['slow', 'fast-2'],
  ]);
});

test('a group weighs the sum of its tests: a heavy group goes before a larger light one', () => {
  const light = [timed('l-1', 'fast', 1), timed('l-2', 'fast', 1), timed('l-3', 'fast', 1)];
  const heavy = [timed('h-1', 'slow', 2), timed('h-2', 'fast', 2)];

  // The heavy group has fewer tests and weighs 21 against 3, so it is lane 1.
  assert.deepEqual(lanesOf({ entries: [...light, ...heavy], maximum: 2 }), [
    ['h-1', 'h-2'],
    ['l-1', 'l-2', 'l-3'],
  ]);
});

test('a maximum of 1 gives one lane, with every test in the order of the inventory', () => {
  const entries = [entry('test-c'), entry('test-a', 9), entry('test-d', 8), entry('test-b', 9), entry('test-e')];

  assert.deepEqual(lanesOf({ entries, maximum: 1 }), [['test-c', 'test-a', 'test-d', 'test-b', 'test-e']]);
});

test('the lanes depend on the tests, their order and the maximum alone', () => {
  const entries = [entry('E'), entry('C', 2), entry('A', 1), entry('D', 2), entry('B', 1), entry('F'), entry('G', '0')];

  for (const maximum of [1, 2, 3, 4, 7, 20]) {
    const lanes = generateLanes({ entries, maximum });
    const ids = lanes.flatMap(idsOf);

    assert.deepEqual(generateLanes({ entries, maximum }), lanes, `maximum ${maximum}: the same lanes, each time`);
    assert.ok(lanes.length <= maximum, `maximum ${maximum}: no more lanes than the maximum`);
    assert.deepEqual([...ids].sort(), ['A', 'B', 'C', 'D', 'E', 'F', 'G'], `maximum ${maximum}: each test once`);
  }
});

test('no test runs, no lane; and a maximum that is no whole number from 1 is rejected', () => {
  assert.deepEqual(generateLanes({ entries: [], maximum: 4 }), []);

  for (const maximum of [0, -1, 1.5, Number.NaN]) {
    assert.throws(() => generateLanes({ entries: [entry('test-a')], maximum }), /whole number, 1 or more/);
  }
});

test('laneLines shows the number of a lane, its ports, and the order of its tests', () => {
  const lanes = generateLanes({
    entries: [entry('test-a', '8550-8699'), entry('test-b'), entry('test-c', 8600), entry('test-d', '8700,8545')],
    maximum: 10,
  });

  assert.deepEqual(laneLines(lanes), [
    'lane 1  port 8550-8699  test-a -> test-c',
    'lane 2  no fixed port  test-b',
    'lane 3  port 8545,8700  test-d',
  ]);
});

////////////////////////////////////////////////////////////////////////////////
// Port texts
////////////////////////////////////////////////////////////////////////////////

test('portsOfSpec reads the three formats, with 0 as one port or as an entry of a list', () => {
  assert.deepEqual(portsOfSpec(8545), [8545]);
  assert.deepEqual(portsOfSpec('8545-8548'), [8545, 8546, 8547, 8548]);
  assert.deepEqual(portsOfSpec('8545,9000,8547'), [8545, 9000, 8547]);
  assert.deepEqual(portsOfSpec(0), [0]);
  assert.deepEqual(portsOfSpec('0,0,0'), [0, 0, 0]);
  assert.deepEqual(portsOfSpec('8545,0'), [8545, 0]);
  assert.deepEqual(portsOfSpec(32767), [32767]);
  assert.deepEqual(fixedPortsOfSpec('8545,0,0,8546'), [8545, 8546]);
});

test('a list can hold ranges, and its ports keep the order of the text', () => {
  assert.deepEqual(portsOfSpec('8545,0,8550-8552'), [8545, 0, 8550, 8551, 8552]);
  assert.deepEqual(portsOfSpec('8716-8718,8701-8702'), [8716, 8717, 8718, 8701, 8702], 'never sorted');
  assert.equal(portsOfSpec('8701-8713,8716-8726').length, 24);
});

test('portsOfSpec rejects a range with 0, a fixed port named twice or too high, and anything else', () => {
  const invalid = ['', '0-5', '8545-0', '8548-8545', '8545,8545', '32768', '8545,40000', '8545-', 'a-b', '1-2-3'];
  const twice = ['8545-8550,8548', '8545-8550,8550-8555', '8600,8545-8700'];

  for (const spec of [...invalid, ...twice, '8545,0-5', '8545,,8546', '8545, 8546', -1, 1.5]) {
    assert.throws(() => portsOfSpec(spec), /port/, String(spec));
  }
});

test('checkPorts names every test whose ports break a rule that the schema cannot check', () => {
  // A chain whose test starts its own nodes can state several ports. A chain whose node the engine starts cannot.
  const own = (port: number | string): Chain => ({ ...ANVIL_CHAIN, startedBy: 'test', port });
  const inventory = fixtureInventory({
    'test-sound': fixtureTest({ chains: [own(8545), own('0,0'), { ...ANVIL_CHAIN, port: 8600 }] }),
    'test-twice': fixtureTest({ chains: [own(8545), own('8540-8550')] }),
    'test-several': fixtureTest({ chains: [{ ...ANVIL_CHAIN, startedBy: 'runner', port: '8600-8601' }] }),
    'test-reversed': fixtureTest({ chains: [own('8550-8540')] }),
  });

  assert.throws(
    () => checkPorts(inventory),
    (error: Error) => {
      assert.match(error.message, /test-twice: the fixed port 8545 comes twice across its chains/);
      assert.match(error.message, /test-several: a chain with "startedBy": "runner" states several ports/);
      assert.match(error.message, /test-reversed: .*is not a range/);
      assert.doesNotMatch(error.message, /test-sound/);
      return true;
    },
  );
});

////////////////////////////////////////////////////////////////////////////////
// The lanes command
////////////////////////////////////////////////////////////////////////////////

test('the lanes command prints the lanes of the selection, as text and as JSON', async (context) => {
  const withPort = (port: number): NodeChain => ({ ...ANVIL_CHAIN, port });
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: './ALL_TESTS.schema.json',
      'test-free': fixtureTest(),
      'test-a': fixtureTest({ chains: [withPort(8545)] }),
      'test-b': fixtureTest({ chains: [withPort(8545)] }),
      'test-local': fixtureTest({ ci: false, chains: [withPort(8545)] }),
      'test-skipped': fixtureTest({ skipped: true, chains: [withPort(8545)] }),
    },
  });
  const argv = ['lanes', '--root', repository.root, '--ci', '--max-lanes'];

  const text = await captureEngine({ context, argv: [...argv, '4'] });
  const json = await captureEngine({ context, argv: [...argv, '4', '--json'] });
  const serial = await captureEngine({ context, argv: [...argv, '1'] });

  // A test that the run would not run, skipped or not selected, is in no lane.
  assert.equal(text.status, 0);
  assert.deepEqual(text.stdout, ['lane 1  port 8545  test-a -> test-b', 'lane 2  no fixed port  test-free']);
  assert.deepEqual(JSON.parse(json.stdout.join('\n')), [
    { lane: 1, ports: [8545], ids: ['test-a', 'test-b'] },
    { lane: 2, ports: [], ids: ['test-free'] },
  ]);
  assert.deepEqual(serial.stdout, ['lane 1  port 8545  test-free -> test-a -> test-b']);
});

test('the maximum of lanes is required, and must be a whole number from 1', async (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: { $schema: './ALL_TESTS.schema.json', 'test-a': fixtureTest() },
  });

  for (const command of ['lanes', 'run']) {
    const without = await captureEngine({ context, argv: [command, '--root', repository.root] });
    const zero = await captureEngine({ context, argv: [command, '--root', repository.root, '--max-lanes', '0'] });

    assert.equal(without.status, RUN_FAILURE_EXIT_STATUS, command);
    assert.match(without.stderr, /required option '--max-lanes <n>' not specified/);
    assert.equal(zero.status, RUN_FAILURE_EXIT_STATUS, command);
    assert.match(zero.stderr, /A maximum of lanes is a whole number, 1 or more/);
  }
});
