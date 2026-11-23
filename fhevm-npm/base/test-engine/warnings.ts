import { TestEngineError } from './errors.ts';
import type { ResolvedTest } from './selection.ts';

/**
 * What the engine finds doubtful in a run, before any test starts. It is not known to be wrong, so a
 * run only says it. A strict run treats it as wrong, and does not start.
 */
export type RunWarningsInput = {
  /** How many tests the selection selects and can run, over all its shards. */
  readonly selectedCount: number;
  /** The tests that the selection holds and that cannot run, for lack of the RPC URL of a live chain. */
  readonly unavailable: readonly ResolvedTest[];
  /** True: a warning fails the run. */
  readonly strict: boolean;
};

/**
 * Reports the warnings of a run. In a strict run, fails with all of them, so that the run does not
 * start. Otherwise prints each one, and the run goes on.
 */
export function reportRunWarnings(input: RunWarningsInput): void {
  const warnings = [...emptySelectionWarnings(input.selectedCount), ...unavailableWarnings(input.unavailable)];

  if (warnings.length === 0) return;

  if (input.strict) {
    throw new TestEngineError(['The run is strict, and does not start:', ...warnings.map((w) => `  ${w}`)].join('\n'));
  }

  for (const warning of warnings) console.warn(`⚠️  ${warning}`);
}

/** A run that would run no test is doubtful: a filter with a typing mistake selects nothing, and would pass. */
function emptySelectionWarnings(selectedCount: number): readonly string[] {
  return selectedCount === 0 ? ['The run runs no test: its selection selects none, or only skipped ones.'] : [];
}

/**
 * A test that cannot run is not a test that passed. One warning for each set of variables that is not
 * set, with the tests that it stops.
 */
function unavailableWarnings(unavailable: readonly ResolvedTest[]): readonly string[] {
  const idsOfVariables = new Map<string, string[]>();

  for (const entry of unavailable) {
    const variables = (entry.missingVariables ?? []).join(', ');

    idsOfVariables.set(variables, [...(idsOfVariables.get(variables) ?? []), entry.id]);
  }

  return [...idsOfVariables].map(([variables, ids]) => {
    const verb = variables.includes(',') ? 'are' : 'is';

    return `${ids.length} test(s) cannot run, because ${variables} ${verb} not set: ${ids.join(', ')}.`;
  });
}
