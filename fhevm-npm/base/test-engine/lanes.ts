import { TestEngineError } from './errors.ts';
import type { Chain, Inventory, InventoryEntry, Test } from './inventory.ts';
import { fixedPortsOfSpec, portsOfSpec } from './port-spec.ts';

/**
 * A lane: tests that run one after the other, in the order of the inventory. The lanes of a run go side
 * by side. Two tests that conflict, because they state a common fixed port, are always in the same lane.
 */
export type Lane = {
  /** The number of the lane, from 1. */
  readonly number: number;
  /** The fixed ports that the tests of the lane state, in increasing order. Empty when they state none. */
  readonly ports: readonly number[];
  /** The tests of the lane, in the order of the inventory. */
  readonly entries: readonly InventoryEntry[];
};

////////////////////////////////////////////////////////////////////////////////
// Ports
////////////////////////////////////////////////////////////////////////////////

/** The fixed ports that a chain states. A port that the system assigns, written 0, can never be shared. */
function fixedPortsOfChain(chain: Chain): readonly number[] {
  return 'port' in chain && chain.port !== undefined ? fixedPortsOfSpec(chain.port) : [];
}

function fixedPortsOfTest(test: Test): readonly number[] {
  return test.chains.flatMap(fixedPortsOfChain);
}

/**
 * Checks the ports of every test of the inventory, which the schema cannot check, and fails with every
 * problem found: a port text that breaks a format rule, a fixed port that comes twice across the chains
 * of one test, and a chain whose node the engine starts that states several ports.
 */
export function checkPorts(inventory: Inventory): void {
  const problems = [...inventory.tests].flatMap(([id, test]) => portProblems({ id, test }));

  if (problems.length > 0) {
    throw new TestEngineError([`${inventory.file} states ports that break a rule:`, ...problems].join('\n'));
  }
}

function portProblems(entry: InventoryEntry): readonly string[] {
  const { id, test } = entry;

  try {
    const fixed = fixedPortsOfTest(test);
    const repeated = [...new Set(fixed.filter((port, index) => fixed.indexOf(port) !== index))];
    const severalForOneNode = test.chains.some(startsOneNodeOnSeveralPorts);

    return [
      ...repeated.map((port) => `  ${id}: the fixed port ${port} comes twice across its chains.`),
      ...(severalForOneNode ? [`  ${id}: a chain with "startedBy": "runner" states several ports, for one node.`] : []),
    ];
  } catch (error) {
    if (error instanceof TestEngineError) return [`  ${id}: ${error.message}`];

    throw error;
  }
}

function startsOneNodeOnSeveralPorts(chain: Chain): boolean {
  const startedByRunner = 'startedBy' in chain && chain.startedBy === 'runner';

  return startedByRunner && chain.port !== undefined && portsOfSpec(chain.port).length !== 1;
}

////////////////////////////////////////////////////////////////////////////////
// Weights
////////////////////////////////////////////////////////////////////////////////

/** The weight of a test, by the `duration` that the inventory states for it. */
const WEIGHT_OF_DURATION = { fast: 1, slow: 20, 'very-slow': 60 } as const;

/** The weight of a test whose `duration` the inventory does not state. */
const WEIGHT_WITHOUT_DURATION = 20;

function weightOfTest(test: Test): number {
  return test.duration === undefined ? WEIGHT_WITHOUT_DURATION : WEIGHT_OF_DURATION[test.duration];
}

/** The weight of a group, and of a lane: the sum of the weights of its tests. */
function weightOf(entries: readonly InventoryEntry[]): number {
  return entries.reduce((sum, entry) => sum + weightOfTest(entry.test), 0);
}

////////////////////////////////////////////////////////////////////////////////
// Groups
////////////////////////////////////////////////////////////////////////////////

/** Tests that conflicts link, directly or through other tests of the same list. */
type Group = {
  readonly ports: Set<number>;
  /** In the order of the inventory. The first one is the first test of the group. */
  readonly entries: InventoryEntry[];
};

/**
 * Forms the groups of the given tests, from these tests alone. A test joins the group of every test it
 * shares a fixed port with: when A and B share one port, and B and C another, the three are in one
 * group. A test that states no fixed port is a group of its own.
 */
function groupsOf(entries: readonly InventoryEntry[]): readonly Group[] {
  const position = new Map(entries.map((entry, index) => [entry.id, index]));
  const groups = new Set<Group>();
  const groupOfPort = new Map<number, Group>();

  for (const entry of entries) {
    const ports = fixedPortsOfTest(entry.test);
    const joined = [...new Set(ports.flatMap((port) => groupOfPort.get(port) ?? []))];
    const group: Group = { ports: new Set(ports), entries: [entry] };

    // The test links groups that were apart so far: they become one, with the test.
    for (const other of joined) {
      group.entries.push(...other.entries);
      other.ports.forEach((port) => group.ports.add(port));
      groups.delete(other);
    }

    groups.add(group);
    group.ports.forEach((port) => groupOfPort.set(port, group));
  }

  const inInventoryOrder = (a: InventoryEntry, b: InventoryEntry): number => {
    return (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0);
  };

  for (const group of groups) group.entries.sort(inInventoryOrder);

  // From the heaviest to the lightest, and at equal weight the group whose first test comes earlier.
  return [...groups].sort((a, b) => {
    return weightOf(b.entries) - weightOf(a.entries) || inInventoryOrder(firstOf(a), firstOf(b));
  });
}

function firstOf(group: Group): InventoryEntry {
  const first = group.entries[0];

  if (first === undefined) throw new Error('A group holds no test.');

  return first;
}

////////////////////////////////////////////////////////////////////////////////
// Lanes
////////////////////////////////////////////////////////////////////////////////

export type GenerateLanesInput = {
  /** The tests that the run runs, in the order of the inventory. */
  readonly entries: readonly InventoryEntry[];
  /** The most lanes the run may have. A whole number, 1 or more. */
  readonly maximum: number;
};

/**
 * Builds the lanes of a run. The result depends on the tests, their order and the maximum alone, so
 * every machine that is given the same ones builds the same lanes, with the same numbers.
 *
 * The groups are taken from the heaviest to the lightest. Each one goes, whole, into the lane that holds
 * the lowest weight so far, and at equal weight into the lane with the lowest number. A lane that got no
 * group does not exist. With a maximum of 1, every test is in one lane, in the order of the inventory.
 */
export function generateLanes(input: GenerateLanesInput): readonly Lane[] {
  const { entries, maximum } = input;

  if (!Number.isInteger(maximum) || maximum < 1) {
    throw new TestEngineError(`The maximum number of lanes is a whole number, 1 or more: '${String(maximum)}' is not.`);
  }

  const position = new Map(entries.map((entry, index) => [entry.id, index]));
  const lanes = Array.from({ length: maximum }, () => ({ ports: new Set<number>(), entries: [] as InventoryEntry[] }));

  for (const group of groupsOf(entries)) {
    // Among the lanes with the lowest weight, the first one of the list has the lowest number.
    const lowest = Math.min(...lanes.map((lane) => weightOf(lane.entries)));
    const lane = lanes.find((candidate) => weightOf(candidate.entries) === lowest);

    if (lane === undefined) throw new Error('No lane can take the group.');

    lane.entries.push(...group.entries);
    group.ports.forEach((port) => lane.ports.add(port));
  }

  return lanes
    .filter((lane) => lane.entries.length > 0)
    .map((lane, index) => ({
      number: index + 1,
      ports: [...lane.ports].sort((a, b) => a - b),
      entries: [...lane.entries].sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0)),
    }));
}

/** One line per lane: its number, its fixed ports, and its tests in the order they run. */
export function laneLines(lanes: readonly Lane[]): readonly string[] {
  return lanes.map((lane) => {
    const ports = lane.ports.length === 0 ? 'no fixed port' : `port ${describePorts(lane.ports)}`;

    return `lane ${lane.number}  ${ports}  ${lane.entries.map((entry) => entry.id).join(' -> ')}`;
  });
}

/** Ports for a person to read: a run of neighbours is shown as a range. */
function describePorts(ports: readonly number[]): string {
  const runs: number[][] = [];

  for (const port of ports) {
    const run = runs.at(-1);

    if (run !== undefined && port === (run.at(-1) ?? 0) + 1) run.push(port);
    else runs.push([port]);
  }

  return runs.map((run) => (run.length > 2 ? `${run[0]}-${run.at(-1)}` : run.join(','))).join(',');
}
