import { TestEngineError } from './errors.ts';
import type { ChainRuntime, InventoryEntry } from './inventory.ts';
import { errorMessage } from './utils.ts';

/** The filters of a selection. A test must match every filter that is given. */
export type SelectionFilters = {
  /** A regular expression that the test ID must match. */
  readonly match?: string | undefined;
  /** Only tests with a chain on this chain id. */
  readonly chainId?: number | undefined;
  /** Only tests with a chain of this runtime. */
  readonly runtime?: ChainRuntime | undefined;
};

export type EntryPredicate = (entry: InventoryEntry) => boolean;

/** One predicate for each filter that is given. A selection keeps the tests that satisfy all of them. */
export function filterPredicates(filters: SelectionFilters): readonly EntryPredicate[] {
  const predicates: EntryPredicate[] = [];

  if (filters.match !== undefined) {
    const pattern = compilePattern(filters.match);
    predicates.push(({ id }) => pattern.test(id));
  }

  if (filters.chainId !== undefined) {
    const chainId = filters.chainId;
    predicates.push(({ test }) => test.chains.some((chain) => chain.chainid === chainId));
  }

  if (filters.runtime !== undefined) {
    const runtime = filters.runtime;
    predicates.push(({ test }) => test.chains.some((chain) => chain.runtime === runtime));
  }

  return predicates;
}

function compilePattern(source: string): RegExp {
  try {
    return new RegExp(source);
  } catch (error) {
    throw new TestEngineError(`'${source}' is not a valid regular expression: ${errorMessage(error)}`);
  }
}
