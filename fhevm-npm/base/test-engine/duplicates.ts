import { spawnSync } from 'node:child_process';

import { TestEngineError } from './errors.ts';
import type { InventoryEntry } from './inventory.ts';
import { formatDuration } from './output.ts';

/**
 * The test cases that more than one test of the inventory selects. A test names its cases with the
 * command of its `list` field, which prints one case per line and runs none of them. The engine knows
 * nothing of what a case is: two tests select the same case when their commands print the same line.
 */

/** The largest output that one list command may print. */
const MAXIMUM_LIST_OUTPUT_BYTES = 64 * 1024 * 1024;

/** The cases that a test selects, as its list command printed them. */
export type ListedTest = {
  readonly id: string;
  readonly cases: readonly string[];
};

/** A case that several tests select, with the IDs of those tests. */
export type DuplicateCase = {
  readonly testCase: string;
  readonly ids: readonly string[];
};

export type ListCasesInput = {
  readonly entries: readonly InventoryEntry[];
  /** The directory each list command runs from. */
  readonly root: string;
  /** Called once a test's list command has ended, with what it listed and how long it took. */
  readonly onListed: (listed: ListedTest & { readonly durationMilliseconds: number }) => void;
};

/**
 * Runs the list command of each test, one after the other. Two list commands at the same time could
 * build the same package at the same time. A list command that fails stops the check: a test that
 * cannot say what it selects cannot be checked.
 */
export function listCases(input: ListCasesInput): readonly ListedTest[] {
  const listed: ListedTest[] = [];

  for (const { id, test } of input.entries) {
    if (test.list === undefined) continue;

    const startedAt = performance.now();
    const cases = casesOfListCommand({ id, command: test.list, root: input.root });
    const durationMilliseconds = performance.now() - startedAt;

    input.onListed({ id, cases, durationMilliseconds });
    listed.push({ id, cases });
  }

  return listed;
}

type ListCommandInput = {
  readonly id: string;
  readonly command: string;
  readonly root: string;
};

/** The lines that a list command prints, without empty lines and without repeats. */
function casesOfListCommand(input: ListCommandInput): readonly string[] {
  const result = spawnSync(input.command, {
    shell: true,
    cwd: input.root,
    encoding: 'utf8',
    maxBuffer: MAXIMUM_LIST_OUTPUT_BYTES,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error !== undefined) {
    throw new TestEngineError(`The list command of ${input.id} did not run: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const errorLines = result.stderr.trimEnd().split('\n').slice(-20).join('\n');

    throw new TestEngineError(
      `The list command of ${input.id} exited with status ${String(result.status ?? result.signal)}:\n` +
        `$ ${input.command}\n${errorLines}`,
    );
  }

  const lines = result.stdout.split('\n').map((line) => line.trim());

  return [...new Set(lines.filter((line) => line !== ''))];
}

/** Each case that more than one test lists, sorted by case, with the tests in the order of the inventory. */
export function duplicateCases(listed: readonly ListedTest[]): readonly DuplicateCase[] {
  const testsOfCase = new Map<string, string[]>();

  for (const { id, cases } of listed) {
    for (const testCase of cases) testsOfCase.set(testCase, [...(testsOfCase.get(testCase) ?? []), id]);
  }

  return [...testsOfCase]
    .filter(([, ids]) => ids.length > 1)
    .map(([testCase, ids]) => ({ testCase, ids }))
    .sort((a, b) => a.testCase.localeCompare(b.testCase));
}

/** The line that a check prints for a test once its list command has ended. */
export function listedLine(listed: ListedTest & { readonly durationMilliseconds: number }): string {
  return `listed  ${listed.id}  ${listed.cases.length} case(s)  ${formatDuration(listed.durationMilliseconds)}`;
}
