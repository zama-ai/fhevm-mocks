import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EXEMPT,
  EXEMPT_PREFIX,
  type GitRunner,
  PACKAGE_PATHSPEC,
  REF_VAR,
  inspectForgeStdParity,
} from '../base/checks/forge-fhevm-std-parity.ts';

const REPO_ROOT = '/repo';
const WORKSPACE_ROOT = '/repo/sdk';

/**
 * A git that answers the four things the check asks: where the repository root is, whether a ref
 * resolves, what the diff says, and what is tracked. `resolves` decides which refs exist.
 */
function fakeGit(options: { readonly diff?: string; readonly resolves?: readonly string[] }): GitRunner {
  const resolves = options.resolves ?? ['other-branch'];
  return (args) => {
    if (args[1] === '--show-toplevel') return `${REPO_ROOT}\n`;
    if (args[0] === 'rev-parse') {
      const ref = String(args[3]).replace('^{commit}', '');
      if (!resolves.includes(ref)) throw new Error(`unknown revision ${ref}`);
      return `${ref}\n`;
    }
    if (args[0] === 'ls-tree') return 'a\nb\nc\n';
    return options.diff ?? '';
  };
}

void test('an unset ref skips, and says nothing was compared', () => {
  const inspection = inspectForgeStdParity(WORKSPACE_ROOT, {}, fakeGit({}));

  assert.equal(inspection.violations.length, 0);
  assert.equal(inspection.checkedKeys.length, 0, 'nothing may be reported as checked');
  assert.equal(inspection.skipped.length, 1);
  assert.match(inspection.skipped[0] ?? '', /proves nothing/);
});

void test('a blank ref is treated as unset, not as a comparison against nothing', () => {
  const inspection = inspectForgeStdParity(WORKSPACE_ROOT, { [REF_VAR]: '   ' }, fakeGit({}));

  assert.equal(inspection.skipped.length, 1);
  assert.equal(inspection.violations.length, 0);
});

void test('a ref that does not resolve FAILS rather than skipping', () => {
  // The skip above is for a check nobody asked to run. A ref someone typed is one they expect to exist,
  // so silently passing would hide the typo.
  const inspection = inspectForgeStdParity(WORKSPACE_ROOT, { [REF_VAR]: 'typo/branch' }, fakeGit({ resolves: [] }));

  assert.equal(inspection.skipped.length, 0);
  assert.equal(inspection.violations.length, 1);
  assert.match(inspection.violations[0]?.message ?? '', /resolves neither locally nor as 'origin\/typo\/branch'/);
});

void test('a ref resolves through its remote-tracking copy when the local branch is absent', () => {
  const inspection = inspectForgeStdParity(
    WORKSPACE_ROOT,
    { [REF_VAR]: 'other-branch' },
    fakeGit({ resolves: ['origin/other-branch'] }),
  );

  assert.equal(inspection.violations.length, 0);
  assert.equal(inspection.checkedKeys.length, 1);
  assert.match(inspection.successes[0] ?? '', /compared with origin\/other-branch/);
});

void test('a file that differs is a violation, whichever direction it is', () => {
  const diff =
    `M\t${PACKAGE_PATHSPEC}/src/StdFhevmCheats.sol\n` +
    `A\t${PACKAGE_PATHSPEC}/src/OnlyHere.sol\n` +
    `D\t${PACKAGE_PATHSPEC}/src/OnlyThere.sol\n`;
  const inspection = inspectForgeStdParity(WORKSPACE_ROOT, { [REF_VAR]: 'other-branch' }, fakeGit({ diff }));

  assert.equal(inspection.violations.length, 3, 'both directions count: neither branch owns this package');
  const messages = inspection.violations.map((violation) => violation.message).join('\n');
  assert.match(messages, /differs from other-branch/);
  assert.match(messages, /is here but not on other-branch/);
  assert.match(messages, /is on other-branch but not here/);
});

void test('the exempt files are the only ones allowed to differ', () => {
  const diff = EXEMPT.map((entry) => `M\t${entry.path}`).join('\n');
  const inspection = inspectForgeStdParity(WORKSPACE_ROOT, { [REF_VAR]: 'other-branch' }, fakeGit({ diff }));

  assert.equal(inspection.violations.length, 0);
  assert.match(inspection.successes[0] ?? '', new RegExp(`${String(EXEMPT.length)} exempt`));
});

void test('the vendored payload is exempt wholesale, being this generation own contracts', () => {
  const diff = `M\t${EXEMPT_PREFIX}LibForgeFhevmUpgrade.sol\nM\t${EXEMPT_PREFIX}_internal/LocalHostBytecode.sol\n`;
  const inspection = inspectForgeStdParity(WORKSPACE_ROOT, { [REF_VAR]: 'other-branch' }, fakeGit({ diff }));

  assert.equal(inspection.violations.length, 0);
});

void test('every exemption states why it cannot be closed', () => {
  // An exemption is a hole in the only thing holding the two SDKs together. The reason is what makes
  // adding one a reviewable act rather than a way to make a red check green.
  for (const entry of EXEMPT) {
    assert.ok(entry.because.length > 20, `${entry.path} must say why it is exempt`);
    assert.ok(entry.path.startsWith(PACKAGE_PATHSPEC), `${entry.path} must be inside the package`);
  }
});
