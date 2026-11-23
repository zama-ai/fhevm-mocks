import { TestEngineError } from './errors.ts';
import type { Inventory, InventoryEntry, Test } from './inventory.ts';
import { type CandidateFilters, type EntryPredicate, filtersOfTheSelection } from './open-questions.ts';

/** What a run is asked for. An empty request selects every test. A test must match every part. */
export type SelectionRequest = {
  /** Exact test IDs. Empty: no restriction by ID. */
  readonly ids: readonly string[];
  /** True: only tests with `"ci": true`. The engine never detects CI: the CI job asks for it. */
  readonly ci: boolean;
  /** The filters that the specification has not defined yet. */
  readonly candidateFilters: CandidateFilters;
};

/**
 * What the selection decides for one test, before anything runs.
 * - `selected`: the run runs it.
 * - `skipped`: the selection holds it, but it has `"skipped": true`, so the run does not run it.
 * - `not-selected`: the selection leaves it out.
 */
export type SelectionState = 'selected' | 'skipped' | 'not-selected';

export type ResolvedTest = InventoryEntry & {
  readonly state: SelectionState;
};

export type ResolveSelectionInput = {
  readonly inventory: Inventory;
  readonly request: SelectionRequest;
};

/** Gives every test of the inventory its selection state, in the order of the inventory. */
export function resolveSelection(input: ResolveSelectionInput): readonly ResolvedTest[] {
  const { inventory, request } = input;

  rejectUnknownIds({ inventory, ids: request.ids });

  const predicates = [...settledPredicates(request), ...filtersOfTheSelection(request.candidateFilters)];

  return [...inventory.tests].map(([id, test]) => {
    const isInSelection = predicates.every((predicate) => predicate({ id, test }));

    return { id, test, state: selectionState({ isInSelection, test }) };
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

/** The parts of a request that the specification defines: exact IDs, and the CI selection. */
function settledPredicates(request: SelectionRequest): readonly EntryPredicate[] {
  const predicates: EntryPredicate[] = [];

  if (request.ids.length > 0) {
    const ids = new Set(request.ids);
    predicates.push(({ id }) => ids.has(id));
  }

  if (request.ci) predicates.push(({ test }) => test.ci);

  return predicates;
}

type SelectionStateInput = {
  readonly isInSelection: boolean;
  readonly test: Test;
};

function selectionState(input: SelectionStateInput): SelectionState {
  // Not selected comes first: for this run the test does not exist, so there is nothing to skip.
  if (!input.isInSelection) return 'not-selected';

  return input.test.skipped === true ? 'skipped' : 'selected';
}
