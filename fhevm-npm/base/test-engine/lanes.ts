import { TestEngineError } from './errors.ts';
import type { Chain, Inventory, InventoryEntry, Test } from './inventory.ts';
import { needsLiveChain } from './live-chains.ts';
import { resourcesOfTest } from './locks.ts';
import { fixedPortsOfSpec, portsOfSpec } from './port-spec.ts';

/**
 * A lane: tests that run one after the other, in the order of the inventory, with the tests that write a
 * resource last. The lanes of a run go side by side. Two tests that conflict are always in the same
 * lane: they state a common fixed port, each of them uses a live chain, they send transactions with the
 * same funded account, or they write the same resource. The heaviest reader of a written resource joins
 * its writers too: see `writersJoinedByReader`.
 */
export type Lane = {
  /** The number of the lane, from 1. */
  readonly number: number;
  /** The fixed ports that the tests of the lane state, in increasing order. Empty when they state none. */
  readonly ports: readonly number[];
  /** True when the lane holds tests that use a live chain. */
  readonly liveChains: boolean;
  /** The tests of the lane, in the order they run: see `laneOrder`. */
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
 * - A resource that the test writes, by the name that the inventory gives it. Two tests that write one
 *   resource never run at the same time, so they share a lane. In a run, the heaviest test that reads
 *   the resource shares it too, so it is in the lane of the writers: see `writersJoinedByReader`. The
 *   other readers stay in their own lanes: the engine makes them and the writers wait for each other
 *   while the run goes.
 */
type Resource = number | string;

const LIVE_CHAINS = 'live chains';

function liveChainsShare(share: number): Resource {
  return `${LIVE_CHAINS} ${share}`;
}

function isLiveChainsShare(resource: Resource): boolean {
  return typeof resource === 'string' && resource.startsWith(LIVE_CHAINS);
}

const WRITTEN_RESOURCE = 'written resource ';

function writtenResourcesOfTest(test: Test): readonly Resource[] {
  return resourcesOfTest(test).write.map((name) => `${WRITTEN_RESOURCE}${name}`);
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

      return [
        entry.id,
        [
          ...fixedPortsOfTest(entry.test),
          ...liveChains,
          ...fundedAccountsOfTest(entry.test),
          ...writtenResourcesOfTest(entry.test),
        ],
      ];
    }),
  );
}

/**
 * The written resource that each reader shares with its writers, by the ID of the reader. A test that
 * writes a resource waits for every test that reads it, and while it waits, every later reader waits
 * behind it. So each written resource goes to the group of its heaviest reader, and the writer runs after
 * that reader, in its lane: it asks for the resource when the longest use of it has ended. At equal
 * weight, the reader that comes first in the inventory gets it.
 *
 * Give the tests of one shard only: each machine has its own copy of the workspace, so a reader of another
 * shard never meets the writer. Some readers are left out, and their writers keep a lane of their own:
 * - A reader that uses a live chain, or a funded account: it would take the writers into the lanes of the
 *   live chains, whose tests run one after the other on every machine.
 * - A reader that already got a resource: it would put the writers of two resources in one lane.
 *
 * A resource that no reader can take, as one that no test reads, goes to no reader.
 */
function writersJoinedByReader(entries: readonly InventoryEntry[]): ReadonlyMap<string, Resource> {
  const written = new Set(entries.flatMap((entry) => resourcesOfTest(entry.test).write));
  const joined = new Map<string, Resource>();
  const canJoin = (entry: InventoryEntry): boolean => {
    return !joined.has(entry.id) && !needsLiveChain(entry.test) && fundedAccountsOfTest(entry.test).length === 0;
  };

  // The resources in the order the inventory first writes them, so the result depends on the inventory alone.
  for (const name of written) {
    const readers = entries.filter((entry) => resourcesOfTest(entry.test).read.includes(name) && canJoin(entry));
    // The first of the heaviest: a later reader replaces it only when it weighs more.
    const heaviest = readers.reduce<InventoryEntry | undefined>((best, entry) => {
      return best === undefined || weightOfTest(entry.test) > weightOfTest(best.test) ? entry : best;
    }, undefined);

    if (heaviest !== undefined) {
      joined.set(heaviest.id, `${WRITTEN_RESOURCE}${name}`);
    }
  }

  return joined;
}

/** Tests that conflicts link, directly or through other tests of the same list. */
type Group = {
  readonly resources: Set<Resource>;
  /** In the order of the inventory. The first one is the first test of the group. */
  readonly entries: InventoryEntry[];
};

type GroupsInput = {
  readonly entries: readonly InventoryEntry[];
  /** What each test shares, by test ID. A test that the map does not hold shares nothing. */
  readonly resourcesOf: ReadonlyMap<string, readonly Resource[]>;
};

/**
 * Forms the groups of the given tests, from these tests alone. A test joins the group of every test it
 * shares a resource with: when A and B share one port, and B and C another, the three are in one
 * group. A test that uses no shared resource is a group of its own.
 */
function groupsOf(input: GroupsInput): readonly Group[] {
  const { entries, resourcesOf } = input;
  const position = new Map(entries.map((entry, index) => [entry.id, index]));
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
// Filling
////////////////////////////////////////////////////////////////////////////////

/** What one lane, or one shard, holds while it is filled. */
type Bucket = {
  readonly resources: Set<Resource>;
  readonly entries: InventoryEntry[];
};

type FillInput = {
  /** The groups, from the heaviest to the lightest. */
  readonly groups: readonly Group[];
  /** How many buckets there are. */
  readonly count: number;
};

/**
 * Fills buckets with groups, for the lanes of a run and for the shards of a selection alike. Each group
 * goes, whole, into the bucket that holds the lowest weight so far, and at equal weight into the first
 * one. A bucket can stay empty.
 */
function fill(input: FillInput): readonly Bucket[] {
  const buckets: Bucket[] = Array.from({ length: input.count }, () => ({ resources: new Set(), entries: [] }));

  for (const group of input.groups) {
    const lowest = Math.min(...buckets.map((bucket) => weightOf(bucket.entries)));
    const bucket = buckets.find((candidate) => weightOf(candidate.entries) === lowest);

    if (bucket === undefined) throw new Error('No bucket can take the group.');

    bucket.entries.push(...group.entries);
    group.resources.forEach((resource) => bucket.resources.add(resource));
  }

  return buckets;
}

////////////////////////////////////////////////////////////////////////////////
// Shards
////////////////////////////////////////////////////////////////////////////////

/** The share of a selection that one machine runs: shard `number` of `count`, both from 1. */
export type Shard = {
  readonly number: number;
  readonly count: number;
};

/** A run that is given no shard runs the whole selection. */
export const WHOLE_SELECTION: Shard = { number: 1, count: 1 };

/**
 * True for a resource that every machine shares: a share of the live chains, since the key of an RPC
 * provider is the same on all of them, and a funded account. A fixed port is of one machine only, and
 * so is a resource that a test writes: each machine has its own copy of the workspace.
 */
function isSharedByMachines(resource: Resource): boolean {
  return typeof resource === 'string' && !resource.startsWith(WRITTEN_RESOURCE);
}

type ShardsInput = GroupsInput & {
  /** How many shards the selection is split into. */
  readonly count: number;
};

/**
 * Gives each test its shard, from 1. Tests that share a resource of every machine stay in one shard:
 * two shards would use it at the same time. Tests that share a port only can go to two shards, since
 * each machine has its own ports. The shards are filled as the lanes are, by weight.
 */
function shardByTest(input: ShardsInput): ReadonlyMap<string, number> {
  const acrossMachines = new Map(
    [...input.resourcesOf].map(([id, resources]) => [id, resources.filter(isSharedByMachines)]),
  );
  const groups = groupsOf({ entries: input.entries, resourcesOf: acrossMachines });
  const shards = fill({ groups, count: input.count });

  return new Map(shards.flatMap((shard, index) => shard.entries.map((entry) => [entry.id, index + 1] as const)));
}

////////////////////////////////////////////////////////////////////////////////
// Lanes
////////////////////////////////////////////////////////////////////////////////

export type GenerateLanesInput = {
  /** The tests that the selection selects and that can run, in the order of the inventory. */
  readonly entries: readonly InventoryEntry[];
  /** The most lanes the run may have. A whole number, 1 or more. */
  readonly maximum: number;
  /**
   * How many lanes can hold tests that use a live chain. A whole number, 1 or more. Undefined: one, so
   * that no two such tests run at the same time.
   */
  readonly liveChainLanes?: number | undefined;
  /** The shard that the run is. Undefined: the whole selection. */
  readonly shard?: Shard | undefined;
};

/** What a run does with the tests of a selection. */
export type RunPlan = {
  /** The lanes of the run: those of its shard. */
  readonly lanes: readonly Lane[];
  /** The shard of each test of the selection, from 1, by test ID. */
  readonly shardOf: ReadonlyMap<string, number>;
};

/**
 * Splits a selection into shards, and builds the lanes of one shard. The result depends on the tests,
 * their order and the numbers given alone, so every machine that is given the same ones finds the same
 * shards and the same lanes, with the same numbers.
 *
 * The groups are taken from the heaviest to the lightest. Each one goes, whole, into the lane that holds
 * the lowest weight so far, and at equal weight into the lane with the lowest number. A lane that got no
 * group does not exist. With a maximum of 1, every test is in one lane, in the order of the inventory,
 * with the tests that write a resource last.
 */
export function planRun(input: GenerateLanesInput): RunPlan {
  const { entries, maximum } = input;
  const liveChainLanes = input.liveChainLanes ?? DEFAULT_LIVE_CHAIN_LANES;
  const shard = input.shard ?? WHOLE_SELECTION;

  requireWholeNumber({ value: maximum, name: 'The maximum number of lanes' });
  requireWholeNumber({ value: liveChainLanes, name: 'The number of lanes for live chains' });
  requireShard(shard);

  // The shares of the live chains are those of the whole selection, so that the shards agree on them.
  const resourcesOf = resourcesByTest({ entries, liveChainLanes });
  const shardOf = shardByTest({ entries, resourcesOf, count: shard.count });
  const ofShard = entries.filter((entry) => shardOf.get(entry.id) === shard.number);
  // The readers that join writers are those of the shard: see `writersJoinedByReader`.
  const joined = writersJoinedByReader(ofShard);
  const laneResourcesOf = new Map(
    [...resourcesOf].map(([id, resources]) => {
      const written = joined.get(id);

      return [id, written === undefined ? resources : [...resources, written]];
    }),
  );
  const lanes = fill({ groups: groupsOf({ entries: ofShard, resourcesOf: laneResourcesOf }), count: maximum });
  const inLaneOrder = laneOrder({ entries, joinedReaders: new Set(joined.keys()) });

  return {
    shardOf,
    lanes: lanes
      .filter((lane) => lane.entries.length > 0)
      .map((lane, index) => ({
        number: index + 1,
        ports: [...lane.resources].filter((resource) => typeof resource === 'number').sort((a, b) => a - b),
        liveChains: [...lane.resources].some(isLiveChainsShare),
        entries: [...lane.entries].sort(inLaneOrder),
      })),
  };
}

type LaneOrderInput = {
  /** The tests of the selection, in the order of the inventory. */
  readonly entries: readonly InventoryEntry[];
  /** The IDs of the readers that joined writers: see `writersJoinedByReader`. */
  readonly joinedReaders: ReadonlySet<string>;
};

/**
 * The order of the tests of a lane: the tests that write a resource come last, and the order of the
 * inventory decides otherwise. A reader that joined writers comes before them, even when it writes a
 * resource too. A test that writes a resource waits for every test that reads it, and its lane waits with
 * it. Last, it waits only for what is left of those readers, while the tests before it run. The order
 * depends on the inventory alone, so the lanes stay the same on every machine.
 */
function laneOrder(input: LaneOrderInput): (a: InventoryEntry, b: InventoryEntry) => number {
  const position = new Map(input.entries.map((entry, index) => [entry.id, index]));
  const last = (entry: InventoryEntry): number => {
    const writes = resourcesOfTest(entry.test).write.length > 0;

    return writes && !input.joinedReaders.has(entry.id) ? 1 : 0;
  };

  return (a, b) => last(a) - last(b) || (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0);
}

export type ShardsOfSelectionInput = Pick<GenerateLanesInput, 'entries' | 'liveChainLanes'> & {
  /** How many shards the selection is split into. A whole number, 1 or more. */
  readonly count: number;
};

/** The tests of each shard of a selection, in the order of the inventory. The first list is shard 1. */
export function shardsOfSelection(input: ShardsOfSelectionInput): readonly (readonly InventoryEntry[])[] {
  // The split does not depend on the lanes, so any maximum gives it.
  const { shardOf } = planRun({ ...input, maximum: 1, shard: { number: 1, count: input.count } });

  return Array.from({ length: input.count }, (_, index) => {
    return input.entries.filter((entry) => shardOf.get(entry.id) === index + 1);
  });
}

/** One line per shard: its number, how many tests it holds, and their IDs in the order of the inventory. */
export function shardLines(shards: readonly (readonly InventoryEntry[])[]): readonly string[] {
  return shards.map((entries, index) => {
    const tests =
      entries.length === 0 ? 'no test' : `${entries.length} test(s)  ${entries.map((e) => e.id).join(', ')}`;

    return `shard ${index + 1} of ${shards.length}  ${tests}`;
  });
}

/** The lanes of a run: see `planRun`. */
export function generateLanes(input: GenerateLanesInput): readonly Lane[] {
  return planRun(input).lanes;
}

type WholeNumberInput = {
  readonly value: number;
  /** What the number is, as the start of a sentence. */
  readonly name: string;
};

function requireWholeNumber(input: WholeNumberInput): void {
  if (!Number.isInteger(input.value) || input.value < 1) {
    throw new TestEngineError(`${input.name} is a whole number, 1 or more: '${String(input.value)}' is not.`);
  }
}

function requireShard(shard: Shard): void {
  requireWholeNumber({ value: shard.count, name: 'The number of shards' });

  if (!Number.isInteger(shard.number) || shard.number < 1 || shard.number > shard.count) {
    throw new TestEngineError(
      `The number of the shard is a whole number from 1 to ${shard.count}: '${String(shard.number)}' is not.`,
    );
  }
}

/** Reads a shard as a command line writes it: `2/3` is shard 2 of 3. */
export function parseShard(text: string): Shard {
  const match = /^(\d+)\/(\d+)$/.exec(text);

  if (match === null) throw new TestEngineError(`A shard is written k/n, as in 2/3: '${text}' is not.`);

  const shard = { number: Number(match[1]), count: Number(match[2]) };

  requireShard(shard);

  return shard;
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
