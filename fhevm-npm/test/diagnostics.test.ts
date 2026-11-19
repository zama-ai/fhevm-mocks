import assert from 'node:assert/strict';
import test from 'node:test';

import { type CommandReport, printReport } from '../base/diagnostics.ts';

/** Runs printReport and returns what it wrote, by stream. */
function printed(report: CommandReport, verbosity: 0 | 1 | 2): { log: string[]; warn: string[]; error: string[] } {
  const out = { log: [] as string[], warn: [] as string[], error: [] as string[] };
  const saved = { log: console.log, warn: console.warn, error: console.error };
  console.log = (line: string) => out.log.push(line);
  console.warn = (line: string) => out.warn.push(line);
  console.error = (line: string) => out.error.push(line);
  try {
    printReport(report, verbosity);
  } finally {
    Object.assign(console, saved);
  }
  return out;
}

const report: CommandReport = {
  command: 'check example',
  checkedPackageKeys: ['a.md'],
  checkedItemLabel: 'file(s)',
  skipped: ['frozen/: 2 file(s) of a vendored copy'],
  violations: [],
};

test('what a check skips on purpose is never a warning, and prints only with detailed output', () => {
  const quiet = printed(report, 0);
  assert.deepEqual([...quiet.log, ...quiet.warn, ...quiet.error], []);
  const detailed = printed(report, 2);
  assert.deepEqual(detailed.warn, []);
  assert.ok(detailed.log.includes('⏭️  not checked: frozen/: 2 file(s) of a vendored copy'), detailed.log.join('\n'));
});
