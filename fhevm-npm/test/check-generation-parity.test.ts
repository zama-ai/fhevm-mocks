import assert from 'node:assert/strict';
import test from 'node:test';

import { type GitRunner, inspectGenerationParity, releaseBranchOf } from '../base/checks/generation-parity.ts';
import { printReport } from '../base/diagnostics.ts';
import { parseTestNpmManifest } from './helpers.ts';

const FAMILY = 'host-contracts-cleartext';
const CURRENT = `./${FAMILY}/v14`;
const PREVIOUS = `./${FAMILY}/v13`;
const REPO_ROOT = '/repo';
const WORKSPACE_ROOT = '/repo/sdk';
/** Where V(N-1) sits from the repository root — what git speaks, workspace prefix included. */
const PREFIX = `sdk/${FAMILY}/v13`;

const dev = (gen: string) => ({
  kind: 'dev',
  name: `@fhevm/${FAMILY}-${gen}-dev`,
  private: true,
  member: true,
  publishedRelPath: `./${FAMILY}/${gen}/pkg`,
});

function manifest(
  generations: Record<string, unknown> | null = { [FAMILY]: { current: CURRENT, previous: PREVIOUS } },
) {
  return parseTestNpmManifest({
    ...(generations === null ? {} : { generations }),
    packageJson: { published: { required: ['name'], excluded: ['private'] } },
    packages: {
      '.': { kind: 'workspace-root', name: 'workspace', private: true, member: false },
      [PREVIOUS]: dev('v13'),
      [CURRENT]: dev('v14'),
      // Registered so the schema accepts it as a `previous`; its NAME is what the check rejects.
      [`./${FAMILY}/legacy`]: dev('legacy'),
    },
  });
}

/**
 * A git that answers from a script rather than a repository: which refs exist, what HEAD tracks, and
 * what the diff against the release branch reports. Anything unscripted throws, so a test cannot pass
 * by accident on a call the check was not supposed to make.
 */
function fakeGit(options: {
  readonly refs?: readonly string[];
  readonly tracked?: readonly string[];
  readonly diff?: readonly string[];
}): GitRunner & { readonly calls: string[][] } {
  const refs = options.refs ?? ['release/0.13.x'];
  const calls: string[][] = [];
  const git = (args: readonly string[]): string => {
    calls.push([...args]);
    if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') return `${REPO_ROOT}\n`;
    if (args[0] === 'rev-parse' && args[1] === '--verify') {
      const ref = String(args[3]).replace('^{commit}', '');
      if (!refs.includes(ref)) throw new Error(`fatal: Needed a single revision: ${ref}`);
      return 'deadbeef\n';
    }
    if (args[0] === 'ls-tree') return (options.tracked ?? []).join('\n');
    if (args[0] === 'diff') return (options.diff ?? []).join('\n');
    throw new Error(`unscripted git call: git ${args.join(' ')}`);
  };
  return Object.assign(git, { calls });
}

test('the release branch comes from the generation number, so a rotation needs no edit', () => {
  assert.equal(releaseBranchOf('v13'), 'release/0.13.x');
  assert.equal(releaseBranchOf('v14'), 'release/0.14.x');
  assert.equal(releaseBranchOf('v9'), 'release/0.9.x');
  assert.equal(releaseBranchOf('v100'), 'release/0.100.x');
  // Nothing else names a branch: no version is hardcoded anywhere, so an unparseable name has none.
  assert.equal(releaseBranchOf('legacy'), undefined);
  assert.equal(releaseBranchOf('v13-rc'), undefined);
  assert.equal(releaseBranchOf('13'), undefined);
});

test('a previous generation matching its release branch passes, and says how much it compared', () => {
  const git = fakeGit({ tracked: [`${PREFIX}/package.json`, `${PREFIX}/pkg/ts/index.ts`], diff: [] });
  const inspection = inspectGenerationParity(WORKSPACE_ROOT, manifest(), git);

  assert.deepEqual(inspection.violations, []);
  assert.deepEqual(inspection.checkedKeys, [PREVIOUS]);
  assert.deepEqual(inspection.successes, [`${PREVIOUS}: 2 tracked file(s) compared with release/0.13.x`]);
  // It compared V(N-1) only: V(N)'s release branch is the branch you are on, so it proves nothing.
  assert.equal(
    inspection.successes.some((line) => line.includes('v14')),
    false,
  );
});

test('a file that differs from the release branch is a violation', () => {
  const git = fakeGit({ diff: [`M\t${PREFIX}/pkg/ts/deploy.ts`] });
  const [violation, ...rest] = inspectGenerationParity(WORKSPACE_ROOT, manifest(), git).violations;

  assert.deepEqual(rest, []);
  assert.equal(violation?.rule, '3.4.6');
  assert.equal(violation?.packageKey, `./${PREFIX}/pkg/ts/deploy.ts`);
  assert.match(violation?.message ?? '', /differs from release\/0\.13\.x/);
  assert.match(violation?.message ?? '', /not a fork/);
});

test('a file here that the release branch never had is a violation — V(N-1) may only lose files', () => {
  const git = fakeGit({ diff: [`A\t${PREFIX}/pkg/ts/invented.ts`] });
  const [violation, ...rest] = inspectGenerationParity(WORKSPACE_ROOT, manifest(), git).violations;

  assert.deepEqual(rest, []);
  assert.equal(violation?.packageKey, `./${PREFIX}/pkg/ts/invented.ts`);
  assert.match(violation?.message ?? '', /absent from release\/0\.13\.x/);
});

test('the rule is one-directional: files the release branch has and this branch does not are fine', () => {
  // Exactly what a rotation leaves behind — ROTATION.md deletes V(N-1)'s six `upgrade` folders.
  const git = fakeGit({
    diff: [
      `D\t${PREFIX}/create2-deploy/upgrade/RUNBOOK.md`,
      `D\t${PREFIX}/internal/upgrade/runUpgradeE2e.ts`,
      `D\t${PREFIX}/test/upgrade/Create2UpgradeOrdinals.t.sol`,
    ],
  });

  assert.deepEqual(inspectGenerationParity(WORKSPACE_ROOT, manifest(), git).violations, []);
});

test('a rename reports as a deletion plus an addition, so only the new path is a violation', () => {
  const git = fakeGit({ diff: [`D\t${PREFIX}/internal/old.ts`, `A\t${PREFIX}/internal/new.ts`] });
  const violations = inspectGenerationParity(WORKSPACE_ROOT, manifest(), git).violations;

  assert.deepEqual(
    violations.map((violation) => violation.packageKey),
    [`./${PREFIX}/internal/new.ts`],
  );
});

test("the generation's own package.json is exempt, but a nested one is not", () => {
  // A rotation MUST edit it: § 3.4.5 forbids `test:upgrade` on V(N-1) and § 3.4.1 forbids the
  // dependency on the generation it upgraded from, and both are still present on the release branch.
  const git = fakeGit({
    diff: [`M\t${PREFIX}/package.json`, `M\t${PREFIX}/pkg/package.json`, `M\t${PREFIX}/test-consumer/esm/package.json`],
  });
  const violations = inspectGenerationParity(WORKSPACE_ROOT, manifest(), git).violations;

  assert.deepEqual(
    violations.map((violation) => violation.packageKey),
    [`./${PREFIX}/pkg/package.json`, `./${PREFIX}/test-consumer/esm/package.json`],
  );
});

test('the remote-tracking copy is used when the local branch is absent', () => {
  const git = fakeGit({ refs: ['origin/release/0.13.x'], diff: [`M\t${PREFIX}/a.ts`] });
  const [violation] = inspectGenerationParity(WORKSPACE_ROOT, manifest(), git).violations;

  assert.match(violation?.message ?? '', /differs from origin\/release\/0\.13\.x/);
});

test('a release branch that resolves neither way is skipped out loud, not failed', () => {
  // v12 has no release/0.12.x and never will — the practice began later. Failing would make this
  // file impossible to keep identical across branches, which is the one thing fhevm-npm must be.
  const git = fakeGit({ refs: [] });
  const inspection = inspectGenerationParity(WORKSPACE_ROOT, manifest(), git);

  assert.deepEqual(inspection.violations, []);
  // Not counted as checked: nothing about it was verified, and the summary must not imply otherwise.
  assert.deepEqual(inspection.checkedKeys, []);
  assert.equal(inspection.skipped.length, 1);
  assert.match(inspection.skipped[0] ?? '', /^\.\/host-contracts-cleartext\/v13: skipped/);
  assert.match(inspection.skipped[0] ?? '', /git fetch origin release\/0\.13\.x/);
  // It stopped there rather than diffing against a ref it does not have.
  assert.equal(
    git.calls.some((call) => call[0] === 'diff'),
    false,
  );
});

test('a family with no previous generation has nothing older to hold still', () => {
  const git = fakeGit({});
  const inspection = inspectGenerationParity(WORKSPACE_ROOT, manifest({ [FAMILY]: { current: CURRENT } }), git);

  assert.deepEqual(inspection.violations, []);
  assert.deepEqual(inspection.checkedKeys, []);
});

test('a generation directory that names no version is a violation, not a silent skip', () => {
  const git = fakeGit({});
  const generations = { [FAMILY]: { current: CURRENT, previous: `./${FAMILY}/legacy` } };
  const [violation, ...rest] = inspectGenerationParity(WORKSPACE_ROOT, manifest(generations), git).violations;

  assert.deepEqual(rest, []);
  assert.equal(violation?.packageKey, './npm-manifest.json');
  assert.match(violation?.message ?? '', /is not named 'v<number>'/);
});

test('no generations block at all checks nothing', () => {
  assert.deepEqual(inspectGenerationParity(WORKSPACE_ROOT, manifest(null), fakeGit({})).checkedKeys, []);
});

test('a skip is never silent: notes print even at the quietest verbosity, and do not fail the run', () => {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (message: string) => warnings.push(message);
  try {
    printReport(
      {
        command: 'check generation-parity',
        checkedPackageKeys: [],
        checkedItemLabel: 'previous generation(s)',
        notes: [`${PREVIOUS}: skipped — neither 'release/0.13.x' nor 'origin/release/0.13.x' resolves`],
        violations: [],
      },
      0,
    );
  } finally {
    console.warn = original;
  }

  assert.equal(warnings.length, 1);
  assert.match(warnings[0] ?? '', /^⚠️ {2}\.\/host-contracts-cleartext\/v13: skipped/);
});
