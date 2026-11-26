import { TestEngineError } from './errors.ts';
import type { ChainRuntime, InventoryEntry, Test } from './inventory.ts';
import { type BlockMode, blockModeOf, isLiveChain } from './live-chains.ts';
import { errorMessage } from './utils.ts';

/** The filters of a selection. A test must match every filter that is given. */
export type SelectionFilters = {
  /** A regular expression that the test ID must match. */
  readonly match?: string | undefined;
  /** Only tests with a chain on this chain id. */
  readonly chainId?: number | undefined;
  /** Only tests with a chain of this runtime. */
  readonly runtime?: ChainRuntime | undefined;
  /** True: only tests with a live chain, a fork or a remote chain. False: only tests with none. */
  readonly live?: boolean | undefined;
  /** True: only tests with a chain that needs a wallet. False: only tests with none. */
  readonly wallet?: boolean | undefined;
  /** Only tests whose live chains are all at pinned blocks, or only tests with one at its latest block. */
  readonly block?: BlockMode | undefined;
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

  if (filters.live !== undefined) {
    const live = filters.live;
    predicates.push(({ test }) => test.chains.some(isLiveChain) === live);
  }

  if (filters.wallet !== undefined) {
    const wallet = filters.wallet;
    predicates.push(({ test }) => needsWallet(test) === wallet);
  }

  if (filters.block !== undefined) {
    const block = filters.block;
    predicates.push(({ test }) => blockModeOf(test) === block);
  }

  return predicates;
}

/** True when a chain of the test needs a funded account, because the test sends transactions to it. */
function needsWallet(test: Test): boolean {
  return test.chains.some((chain) => chain.runtime === 'remote' && chain.wallet);
}

function compilePattern(source: string): RegExp {
  try {
    return new RegExp(source);
  } catch (error) {
    throw new TestEngineError(`'${source}' is not a valid regular expression: ${errorMessage(error)}`);
  }
}
