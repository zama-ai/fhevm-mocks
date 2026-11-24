import { TestEngineError } from './errors.ts';
import type { Inventory, InventoryEntry, Test } from './inventory.ts';
import { type Environment, missingRpcVariables } from './live-chains.ts';
import { type EntryPredicate, type SelectionFilters, filterPredicates } from './filters.ts';

/** What a run is asked for. An empty request selects every test. A test must match every part. */
export type SelectionRequest = {
  /** Exact test IDs. Empty: no restriction by ID. */
  readonly ids: readonly string[];
  /** True: only tests with `"ci": true`. The engine never detects CI: the CI job asks for it. */
  readonly ci: boolean;
  /** The filters of the selection. */
  readonly filters: SelectionFilters;
};

/**
 * What the selection decides for one test, before anything runs.
 * - `selected`: the run runs it.
 * - `skipped`: the selection holds it, but it has `"skipped": true`, so the run does not run it.
 * - `unavailable`: the selection holds it, but it needs a live chain whose RPC URL variable is not set,
 *   so the run cannot run it.
 * - `not-selected`: the selection leaves it out.
 */
export type SelectionState = 'selected' | 'skipped' | 'unavailable' | 'not-selected';

export type ResolvedTest = InventoryEntry & {
  readonly state: SelectionState;
  /** For an unavailable test: the RPC URL variables that it needs and that are not set. */
  readonly missingVariables?: readonly string[] | undefined;
};

export type ResolveSelectionInput = {
  readonly inventory: Inventory;
  readonly request: SelectionRequest;
  /** The environment the engine was launched with. It says which live chains a test can reach. */
  readonly environment: Environment;
};

/** Gives every test of the inventory its selection state, in the order of the inventory. */
export function resolveSelection(input: ResolveSelectionInput): readonly ResolvedTest[] {
  const { inventory, request } = input;

  rejectUnknownIds({ inventory, ids: request.ids });

  const predicates = [...requestPredicates(request), ...filterPredicates(request.filters)];

  return [...inventory.tests].map(([id, test]) => {
    const isInSelection = predicates.every((predicate) => predicate({ id, test }));

    return resolvedTest({ entry: { id, test }, isInSelection, environment: input.environment });
  });
}

type UnknownIdsInput = {
  readonly inventory: Inventory;
  readonly ids: readonly string[];
};

function rejectUnknownIds(input: UnknownIdsInput): void {
  const unknown = input.ids.filter((id) => !input.inventory.tests.has(id));

  if (unknown.length > 0) {
    throw new TestEngineError(
      `${input.inventory.file} holds no test with ID ${unknown.map((id) => `'${id}'`).join(', ')}.`,
    );
  }
}

/** The parts of a request that are no filter: exact IDs, and the CI selection. */
function requestPredicates(request: SelectionRequest): readonly EntryPredicate[] {
  const predicates: EntryPredicate[] = [];

  if (request.ids.length > 0) {
    const ids = new Set(request.ids);
    predicates.push(({ id }) => ids.has(id));
  }

  if (request.ci) predicates.push(({ test }) => test.ci);

  return predicates;
}

type ResolvedTestInput = {
  readonly entry: InventoryEntry;
  readonly isInSelection: boolean;
  readonly environment: Environment;
};

function resolvedTest(input: ResolvedTestInput): ResolvedTest {
  const { entry } = input;

  // Not selected comes first: for this run the test does not exist, so there is nothing to skip.
  if (!input.isInSelection) return { ...entry, state: 'not-selected' };

  // Skipped comes before unavailable: the run would not run the test, whatever its chains.
  if (isSkipped(entry.test)) return { ...entry, state: 'skipped' };

  const missingVariables = missingRpcVariables({ entry, environment: input.environment });

  if (missingVariables.length > 0) return { ...entry, state: 'unavailable', missingVariables };

  return { ...entry, state: 'selected' };
}

function isSkipped(test: Test): boolean {
  return test.skipped === true;
}
