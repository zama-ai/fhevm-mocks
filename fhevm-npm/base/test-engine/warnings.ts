import { TestEngineError } from './errors.ts';
import type { Lane } from './lanes.ts';

/**
 * What the engine finds doubtful in a run, before any test starts. It is not known to be wrong, so a
 * run only says it. A strict run treats it as wrong, and does not start.
 */
export type RunWarningsInput = {
  /** The lanes of the run. */
  readonly lanes: readonly Lane[];
  /** True: a warning fails the run. */
  readonly strict: boolean;
};

/**
 * Reports the warnings of a run. In a strict run, fails with all of them, so that the run does not
 * start. Otherwise prints each one, and the run goes on.
 */
export function reportRunWarnings(input: RunWarningsInput): void {
  const warnings = [...emptySelectionWarnings(input.lanes), ...sharedWalletWarnings(input.lanes)];

  if (warnings.length === 0) return;

  if (input.strict) {
    throw new TestEngineError(['The run is strict, and does not start:', ...warnings.map((w) => `  ${w}`)].join('\n'));
  }

  for (const warning of warnings) console.warn(`⚠️  ${warning}`);
}

/** A run that would run no test is doubtful: a filter with a typing mistake selects nothing, and would pass. */
function emptySelectionWarnings(lanes: readonly Lane[]): readonly string[] {
  return lanes.length === 0 ? ['The run runs no test: its selection selects none, or only skipped ones.'] : [];
}

/**
 * Tests that need a funded account on the same live chain share that account. The engine does not
 * record it as a conflict yet, so such tests can be in two lanes, and use the account at the same time.
 */
function sharedWalletWarnings(lanes: readonly Lane[]): readonly string[] {
  const lanesOfChain = new Map<number, Map<number, string[]>>();

  for (const lane of lanes) {
    for (const { id, test } of lane.entries) {
      for (const chain of test.chains) {
        if (chain.runtime !== 'remote' || !chain.wallet) continue;

        const byLane = lanesOfChain.get(chain.chainid) ?? new Map<number, string[]>();

        byLane.set(lane.number, [...(byLane.get(lane.number) ?? []), id]);
        lanesOfChain.set(chain.chainid, byLane);
      }
    }
  }

  return [...lanesOfChain].flatMap(([chainId, byLane]) => {
    if (byLane.size < 2) return [];

    const ids = [...byLane.values()].flat();

    return [
      `${ids.length} tests need a funded account on chain ${chainId} and are in ${byLane.size} lanes, so they can ` +
        `use it at the same time: ${ids.join(', ')}. A maximum of 1 lane keeps them apart.`,
    ];
  });
}
