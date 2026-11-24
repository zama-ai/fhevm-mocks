import { TestEngineError } from './errors.ts';
import type { Inventory, InventoryEntry, Test } from './inventory.ts';

/**
 * The resources that a test names in the inventory, by their names. The engine does not interpret a
 * name: two tests share a resource when they state the same name.
 * - `write`: while the test runs, it puts the resource in a state that no other test can use. When the
 *   test ends, the resource is back as it was.
 * - `read`: the test needs the resource in its normal state from its start to its end.
 */
export type ResourcesOfTest = {
  readonly read: readonly string[];
  readonly write: readonly string[];
};

export function resourcesOfTest(test: Test): ResourcesOfTest {
  return { read: test.read ?? [], write: test.write ?? [] };
}

////////////////////////////////////////////////////////////////////////////////
// The inventory
////////////////////////////////////////////////////////////////////////////////

/**
 * Checks the resources that the tests of the inventory name, and fails with every problem found: a name
 * that one test both reads and writes, and a name that a test reads and that no test writes. Such a
 * name protects nothing, and is most often a typing mistake.
 */
export function checkResources(inventory: Inventory): void {
  const entries = [...inventory.tests].map(([id, test]) => ({ id, test }));
  const written = new Set(entries.flatMap((entry) => resourcesOfTest(entry.test).write));
  const problems = entries.flatMap((entry) => resourceProblems({ entry, written }));

  if (problems.length === 0) return;

  throw new TestEngineError([`${inventory.file} names resources that break a rule:`, ...problems].join('\n  '));
}

type ResourceProblemsInput = {
  readonly entry: InventoryEntry;
  /** The names that at least one test of the inventory writes. */
  readonly written: ReadonlySet<string>;
};

function resourceProblems(input: ResourceProblemsInput): readonly string[] {
  const { id, test } = input.entry;
  const { read, write } = resourcesOfTest(test);
  const both = read.filter((name) => write.includes(name));
  const neverWritten = read.filter((name) => !input.written.has(name));

  return [
    ...both.map(
      (name) => `${id}: "${name}" is in "read" and in "write". A test that writes a resource names it in "write" only.`,
    ),
    ...neverWritten.map((name) => `${id}: reads "${name}", which no test writes.`),
  ];
}

////////////////////////////////////////////////////////////////////////////////
// The locks of a run
////////////////////////////////////////////////////////////////////////////////

/** A test that waits for a resource, or that holds one. */
export type LockHolder = {
  readonly id: string;
  /** The number of the lane the test is in, from 1. */
  readonly lane: number;
};

export type AcquireInput = LockHolder & {
  readonly resources: ResourcesOfTest;
  /** Aborted when the run is interrupted: the test stops waiting, and gets no resource. */
  readonly interruption: AbortSignal;
  /** Called once, when the test cannot have its resources at once, with the tests that hold them. */
  readonly onWait: (heldBy: readonly string[]) => void;
};

/** Gives back the resources of a test. Calling it again changes nothing. */
export type Release = () => void;

/**
 * The resources of one run, on one machine. A test takes all its resources in one step, before it
 * starts, and gives them back when it has ended.
 * - Several tests can read one resource at the same time.
 * - A test that writes a resource has it alone: no other test reads it or writes it meanwhile.
 * - A test that cannot have all its resources waits, and holds none while it waits. So two tests never
 *   wait for each other.
 * - The tests that wait are served in the order they came. A test does not pass in front of an earlier
 *   one that waits for the same resource, when one of the two writes it: a test that writes is not kept
 *   waiting by readers that keep coming.
 */
export type Locks = {
  readonly acquire: (input: AcquireInput) => Promise<Release>;
};

type Held = {
  readonly readers: Set<string>;
  writer: string | undefined;
};

type Waiter = AcquireInput & {
  readonly grant: () => void;
};

export function createLocks(): Locks {
  const held = new Map<string, Held>();
  const waiting: Waiter[] = [];

  const stateOf = (name: string): Held => {
    const state = held.get(name) ?? { readers: new Set<string>(), writer: undefined };

    held.set(name, state);

    return state;
  };

  /** The tests that hold a resource in a way that keeps the given test from having its own. */
  const holdersAgainst = (resources: ResourcesOfTest): readonly string[] => {
    const againstRead = resources.read.flatMap((name) => stateOf(name).writer ?? []);
    const againstWrite = resources.write.flatMap((name) => {
      const state = stateOf(name);

      return [...state.readers, ...(state.writer === undefined ? [] : [state.writer])];
    });

    return [...new Set([...againstRead, ...againstWrite])];
  };

  /** True when the given test and an earlier one that waits cannot have a common resource together. */
  const waitsBehind = (waiter: Waiter): boolean => {
    const earlier = waiting.slice(0, waiting.indexOf(waiter));

    return earlier.some((other) => excludeEachOther({ first: other.resources, second: waiter.resources }));
  };

  const take = (waiter: AcquireInput): Release => {
    for (const name of waiter.resources.read) stateOf(name).readers.add(waiter.id);
    for (const name of waiter.resources.write) stateOf(name).writer = waiter.id;

    let released = false;

    return () => {
      if (released) return;

      released = true;

      for (const name of waiter.resources.read) stateOf(name).readers.delete(waiter.id);
      for (const name of waiter.resources.write) stateOf(name).writer = undefined;

      serveWaiting();
    };
  };

  /** Gives their resources to the tests that wait and that can now have them, in the order they came. */
  const serveWaiting = (): void => {
    for (const waiter of [...waiting]) {
      if (holdersAgainst(waiter.resources).length > 0 || waitsBehind(waiter)) continue;

      waiter.grant();
    }
  };

  return {
    acquire: (input) => {
      const heldBy = holdersAgainst(input.resources);
      const earlier = waiting.filter((other) => excludeEachOther({ first: other.resources, second: input.resources }));

      if (input.interruption.aborted) return Promise.resolve(() => undefined);
      if (heldBy.length === 0 && earlier.length === 0) return Promise.resolve(take(input));

      input.onWait([...new Set([...heldBy, ...earlier.map((other) => other.id)])]);

      return new Promise<Release>((resolve) => {
        const leave = (): void => {
          waiting.splice(waiting.indexOf(waiter), 1);
          input.interruption.removeEventListener('abort', giveUp);
        };
        // An interrupted run starts no more command: the test goes on without its resources, and ends at once.
        const giveUp = (): void => {
          leave();
          resolve(() => undefined);
          serveWaiting();
        };
        const waiter: Waiter = {
          ...input,
          grant: () => {
            leave();
            resolve(take(input));
          },
        };

        waiting.push(waiter);
        input.interruption.addEventListener('abort', giveUp, { once: true });
      });
    },
  };
}

type TwoTests = {
  readonly first: ResourcesOfTest;
  readonly second: ResourcesOfTest;
};

/** True when the two tests name a common resource that at least one of them writes. */
export function excludeEachOther(input: TwoTests): boolean {
  const { first, second } = input;
  const usedBySecond = new Set([...second.read, ...second.write]);
  const usedByFirst = new Set([...first.read, ...first.write]);

  return first.write.some((name) => usedBySecond.has(name)) || second.write.some((name) => usedByFirst.has(name));
}
