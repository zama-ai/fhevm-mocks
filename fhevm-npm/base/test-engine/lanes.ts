import { TestEngineError } from './errors.ts';
import type { Chain, Inventory, InventoryEntry, Test } from './inventory.ts';
import { needsLiveChain } from './live-chains.ts';
import { fixedPortsOfSpec, portsOfSpec } from './port-spec.ts';

/**
 * A lane: tests that run one after the other, in the order of the inventory. The lanes of a run go side
 * by side. Two tests that conflict are always in the same lane: they state a common fixed port, or each
 * of them uses a live chain.
 */
export type Lane = {
  /** The number of the lane, from 1. */
  readonly number: number;
  /** The fixed ports that the tests of the lane state, in increasing order. Empty when they state none. */
  readonly ports: readonly number[];
  /** True when the lane holds tests that use a live chain. */
  readonly liveChains: boolean;
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

/** How many lanes can hold tests that use a live chain, when the run names no number. */
export const DEFAULT_LIVE_CHAIN_LANES = 1;

/** The variable that says how many lanes can hold tests that use a live chain, when no option does. */
export const LIVE_CHAIN_LANES_VARIABLE = 'FHEVM_TEST_LIVE_CHAIN_LANES';

/**
 * What two tests cannot use at the same time. Two tests that share a resource conflict.
 * - A fixed port, as a number: one process listens on it.
 * - A share of the live chains. The tests that use a live chain reach it through an RPC provider, which
 *   limits the requests that one key may send. The engine does not know which provider serves which
 *   chain, and one key often serves all of them, so it takes the live chains as one resource. The run
 *   says in how many shares that resource can be used at the same time: one, unless the plan of the
 *   provider allows more.
 * - The funded account of a live chain. The tests that send transactions on one chain sign with one
 *   account, whose transactions are numbered: two of them at the same time would use the same number.
 */
type Resource = number | string;

const LIVE_CHAINS = 'live chains';

function liveChainsShare(share: number): Resource {
  return `${LIVE_CHAINS} ${share}`;
}

function isLiveChainsShare(resource: Resource): boolean {
  return typeof resource === 'string' && resource.startsWith(LIVE_CHAINS);
}

function fundedAccountsOfTest(test: Test): readonly Resource[] {
  return test.chains.flatMap((chain) => {
    return chain.runtime === 'remote' && chain.wallet ? [`funded account ${chain.chainid}`] : [];
  });
}

type ResourcesInput = {
  readonly entries: readonly InventoryEntry[];
  /** In how many shares the live chains can be used at the same time. */
  readonly liveChainLanes: number;
};

/**
 * What each test shares, by test ID. The tests that use a live chain are dealt over the shares of the
 * live chains in the order of the inventory: the first one to the first share, the second one to the
 * second, and so on, then again from the first.
 */
function resourcesByTest(input: ResourcesInput): ReadonlyMap<string, readonly Resource[]> {
  const onLiveChains = input.entries.filter((entry) => needsLiveChain(entry.test));
  const shareOf = new Map(onLiveChains.map((entry, index) => [entry.id, index % input.liveChainLanes]));

  return new Map(
    input.entries.map((entry) => {
      const share = shareOf.get(entry.id);
      const liveChains = share === undefined ? [] : [liveChainsShare(share)];

      return [entry.id, [...fixedPortsOfTest(entry.test), ...liveChains, ...fundedAccountsOfTest(entry.test)]];
    }),
  );
}

/** Tests that conflicts link, directly or through other tests of the same list. */
type Group = {
  readonly resources: Set<Resource>;
  /** In the order of the inventory. The first one is the first test of the group. */
  readonly entries: InventoryEntry[];
};

/**
 * Forms the groups of the given tests, from these tests alone. A test joins the group of every test it
 * shares a resource with: when A and B share one port, and B and C another, the three are in one
 * group. A test that uses no shared resource is a group of its own.
 */
function groupsOf(input: ResourcesInput): readonly Group[] {
  const { entries } = input;
  const position = new Map(entries.map((entry, index) => [entry.id, index]));
  const resourcesOf = resourcesByTest(input);
  const groups = new Set<Group>();
  const groupOfResource = new Map<Resource, Group>();

  for (const entry of entries) {
    const resources = resourcesOf.get(entry.id) ?? [];
    const joined = [...new Set(resources.flatMap((resource) => groupOfResource.get(resource) ?? []))];
    const group: Group = { resources: new Set(resources), entries: [entry] };

    // The test links groups that were apart so far: they become one, with the test.
    for (const other of joined) {
      group.entries.push(...other.entries);
      other.resources.forEach((resource) => group.resources.add(resource));
      groups.delete(other);
    }

    groups.add(group);
    group.resources.forEach((resource) => groupOfResource.set(resource, group));
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
  /**
   * How many lanes can hold tests that use a live chain. A whole number, 1 or more. Undefined: one, so
   * that no two such tests run at the same time.
   */
  readonly liveChainLanes?: number | undefined;
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
  const liveChainLanes = input.liveChainLanes ?? DEFAULT_LIVE_CHAIN_LANES;

  if (!Number.isInteger(maximum) || maximum < 1) {
    throw new TestEngineError(`The maximum number of lanes is a whole number, 1 or more: '${String(maximum)}' is not.`);
  }

  if (!Number.isInteger(liveChainLanes) || liveChainLanes < 1) {
    throw new TestEngineError(
      `The number of lanes for live chains is a whole number, 1 or more: '${String(liveChainLanes)}' is not.`,
    );
  }

  const position = new Map(entries.map((entry, index) => [entry.id, index]));
  const lanes = Array.from({ length: maximum }, () => {
    return { resources: new Set<Resource>(), entries: [] as InventoryEntry[] };
  });

  for (const group of groupsOf({ entries, liveChainLanes })) {
    // Among the lanes with the lowest weight, the first one of the list has the lowest number.
    const lowest = Math.min(...lanes.map((lane) => weightOf(lane.entries)));
    const lane = lanes.find((candidate) => weightOf(candidate.entries) === lowest);

    if (lane === undefined) throw new Error('No lane can take the group.');

    lane.entries.push(...group.entries);
    group.resources.forEach((resource) => lane.resources.add(resource));
  }

  return lanes
    .filter((lane) => lane.entries.length > 0)
    .map((lane, index) => ({
      number: index + 1,
      ports: [...lane.resources].filter((resource) => typeof resource === 'number').sort((a, b) => a - b),
      liveChains: [...lane.resources].some(isLiveChainsShare),
      entries: [...lane.entries].sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0)),
    }));
}

/** One line per lane: its number, what its tests share, and its tests in the order they run. */
export function laneLines(lanes: readonly Lane[]): readonly string[] {
  return lanes.map((lane) => {
    const shared = [
      ...(lane.ports.length === 0 ? [] : [`port ${describePorts(lane.ports)}`]),
      ...(lane.liveChains ? [LIVE_CHAINS] : []),
    ];
    const resources = shared.length === 0 ? 'no shared resource' : shared.join(', ');

    return `lane ${lane.number}  ${resources}  ${lane.entries.map((entry) => entry.id).join(' -> ')}`;
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
