import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';

import { loadInventory } from '../base/test-engine/inventory.ts';
import { generateLanes } from '../base/test-engine/lanes.ts';
import { type Locks, type Release, createLocks } from '../base/test-engine/locks.ts';
import { fixtureTest, runEngine, writeFixtureRepository } from './test-engine-fixtures.ts';

const SCHEMA = './ALL_TESTS.schema.json';

type Asked = {
  /** Resolves with what gives the resources back, once the test has them. */
  readonly release: Promise<Release>;
  /** True once the test has its resources. */
  readonly has: () => boolean;
  /** The tests that the test was told it waits for. Undefined: it never had to wait. */
  readonly heldBy: () => readonly string[] | undefined;
};

type AskInput = {
  readonly locks: Locks;
  readonly id: string;
  readonly read?: readonly string[];
  readonly write?: readonly string[];
  readonly interruption?: AbortSignal;
};

/** Asks for the resources of one test, and records what happens. */
function ask(input: AskInput): Asked {
  let has = false;
  let heldBy: readonly string[] | undefined;
  const release = input.locks
    .acquire({
      id: input.id,
      lane: 1,
      resources: { read: input.read ?? [], write: input.write ?? [] },
      interruption: input.interruption ?? new AbortController().signal,
      onWait: (holders) => (heldBy = holders),
    })
    .then((given) => {
      has = true;

      return given;
    });

  return { release, has: () => has, heldBy: () => heldBy };
}

/** Lets every promise that is already settled run its continuation. */
async function settle(): Promise<void> {
  await sleep(0);
}

////////////////////////////////////////////////////////////////////////////////
// The locks
////////////////////////////////////////////////////////////////////////////////

test('several tests read one resource at the same time', async () => {
  const locks = createLocks();
  const first = ask({ locks, id: 'test-a', read: ['foo'] });
  const second = ask({ locks, id: 'test-b', read: ['foo'] });

  await settle();

  assert.deepEqual([first.has(), second.has()], [true, true]);
  assert.equal(second.heldBy(), undefined, 'a reader does not wait for a reader');
});

test('a test that writes a resource waits for every reader, and has it alone', async () => {
  const locks = createLocks();
  const readerA = ask({ locks, id: 'test-a', read: ['foo'] });
  const readerB = ask({ locks, id: 'test-b', read: ['foo'] });
  const writer = ask({ locks, id: 'test-w', write: ['foo'] });
  const late = ask({ locks, id: 'test-late', read: ['foo'] });

  await settle();

  assert.equal(writer.has(), false);
  assert.deepEqual(writer.heldBy(), ['test-a', 'test-b']);
  // The late reader could read with the two others, and waits behind the writer that came first.
  assert.equal(late.has(), false);
  assert.deepEqual(late.heldBy(), ['test-w']);

  (await readerA.release)();
  await settle();

  assert.equal(writer.has(), false, 'one reader is left');

  (await readerB.release)();
  await settle();

  assert.deepEqual([writer.has(), late.has()], [true, false]);

  (await writer.release)();
  await settle();

  assert.equal(late.has(), true);
});

test('two tests that write one resource never have it together, and other resources stay free', async () => {
  const locks = createLocks();
  const first = ask({ locks, id: 'test-a', write: ['foo'] });
  const second = ask({ locks, id: 'test-b', write: ['foo'] });
  const elsewhere = ask({ locks, id: 'test-c', write: ['bar'], read: ['baz'] });
  const noResource = ask({ locks, id: 'test-d' });

  await settle();

  assert.deepEqual([first.has(), second.has(), elsewhere.has(), noResource.has()], [true, false, true, true]);

  const release = await first.release;

  release();
  // Giving back twice gives nothing more: the second writer keeps the resource for itself.
  release();
  await settle();

  assert.equal(second.has(), true);

  const third = ask({ locks, id: 'test-e', write: ['foo'] });

  await settle();

  assert.equal(third.has(), false);
});

test('a test takes all its resources in one step, and holds none while it waits', async () => {
  const locks = createLocks();
  const holdsBar = ask({ locks, id: 'test-a', write: ['bar'] });
  // Needs foo and bar: bar is taken, so it must not take foo meanwhile.
  const needsBoth = ask({ locks, id: 'test-b', write: ['foo', 'bar'] });

  await settle();

  assert.equal(needsBoth.has(), false);

  // A test that came later waits behind the one that wants foo first.
  const needsFoo = ask({ locks, id: 'test-c', read: ['foo'] });

  await settle();

  assert.deepEqual(needsFoo.heldBy(), ['test-b']);

  (await holdsBar.release)();
  await settle();

  assert.deepEqual([needsBoth.has(), needsFoo.has()], [true, false]);
});

test('an interrupted run frees the tests that wait, without their resources', async () => {
  const locks = createLocks();
  const interruption = new AbortController();
  const writer = ask({ locks, id: 'test-w', write: ['foo'] });
  const waits = ask({ locks, id: 'test-a', write: ['foo'], interruption: interruption.signal });
  const behind = ask({ locks, id: 'test-b', read: ['foo'] });

  await settle();
  interruption.abort();
  await settle();

  assert.equal(waits.has(), true, 'it no longer waits');
  assert.equal(behind.has(), false, 'the writer still holds the resource');

  // What the interrupted test was given gives nothing back: the writer still has the resource.
  (await waits.release)();
  await settle();

  assert.equal(behind.has(), false);

  (await writer.release)();
  await settle();

  assert.equal(behind.has(), true, 'the test that gave up no longer stands in front');
});

////////////////////////////////////////////////////////////////////////////////
// The inventory and the lanes
////////////////////////////////////////////////////////////////////////////////

test('a name in both lists, and a name that is read and never written, are rejected', (context) => {
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      'test-a': fixtureTest({ read: ['foo'], write: ['foo'] }),
      'test-b': fixtureTest({ read: ['foo', 'fooo'] }),
      'test-c': fixtureTest({ read: [], write: [] }),
    },
  });

  assert.throws(
    () => loadInventory({ inventoryFile: repository.inventoryFile, schemaFile: undefined }),
    (error: Error) => {
      assert.match(error.message, /test-a: "foo" is in "read" and in "write"/);
      assert.match(error.message, /test-b: reads "fooo", which no test writes/);
      assert.doesNotMatch(error.message, /test-b: reads "foo",|test-c/);
      return true;
    },
  );
});

test('two tests that write one resource share a lane, and a test that reads it does not join them', () => {
  const entries = [
    { id: 'test-writes-a', test: fixtureTest({ write: ['foo'] }) },
    { id: 'test-reads-a', test: fixtureTest({ read: ['foo'] }) },
    { id: 'test-writes-b', test: fixtureTest({ write: ['foo'] }) },
    { id: 'test-reads-b', test: fixtureTest({ read: ['foo'] }) },
  ];
  const lanes = generateLanes({ entries, maximum: 4 }).map((lane) => lane.entries.map((entry) => entry.id));

  assert.deepEqual(lanes, [['test-writes-a', 'test-writes-b'], ['test-reads-a'], ['test-reads-b']]);

  // Each machine has its own copy of the workspace: two shards take the two writers apart.
  const writers = entries.filter((entry) => entry.id.startsWith('test-writes'));
  const shards = [1, 2].map((number) => {
    return generateLanes({ entries: writers, maximum: 4, shard: { number, count: 2 } }).flatMap((lane) => lane.entries);
  });

  assert.deepEqual(
    shards.map((shard) => shard.map((entry) => entry.id)),
    [['test-writes-a'], ['test-writes-b']],
  );
});

////////////////////////////////////////////////////////////////////////////////
// A run
////////////////////////////////////////////////////////////////////////////////

test('in a run, a test that writes a resource never runs beside a test that reads it', async (context) => {
  // The writer alters the resource for its whole time, and fails when a reader is at work.
  const writer = 'ls reading-* >/dev/null 2>&1 && exit 1; mkdir altered || exit 1; sleep 0.4; rmdir altered';
  // A reader fails when the resource is altered, at its start or at its end. The two readers also wait
  // for each other: they pass only when they run at the same time.
  const reader = (own: string, other: string): string => {
    const meets = `for i in $(seq 1 200); do [ -d reading-${other} ] && break; sleep 0.05; done; [ -d reading-${other} ] || exit 1`;

    return `[ -d altered ] && exit 1; mkdir reading-${own}; ${meets}; sleep 0.2; [ -d altered ] && exit 1; rmdir reading-${own}`;
  };
  const repository = writeFixtureRepository({
    context,
    inventory: {
      $schema: SCHEMA,
      // The two readers come first: a reader that comes after a writer that waits would wait behind it.
      'test-reads-a': fixtureTest({ command: reader('a', 'b'), read: ['foo'] }),
      'test-reads-b': fixtureTest({ command: reader('b', 'a'), read: ['foo'] }),
      'test-writes': fixtureTest({ command: writer, write: ['foo'] }),
    },
  });

  const run = await runEngine({ context, repository });
  const { tests } = run.report;

  assert.equal(run.status, 0, run.stdout.join('\n'));
  assert.deepEqual(run.states, { 'test-reads-a': 'passed', 'test-reads-b': 'passed', 'test-writes': 'passed' });
  assert.equal(new Set(Object.values(tests).map((entry) => entry.lane)).size, 3, 'the three tests have three lanes');
  assert.match(
    run.stdout.join('\n'),
    /⏸ waiting  lane 3  test-writes  for a resource that test-reads-a, test-reads-b use$/m,
  );
});
