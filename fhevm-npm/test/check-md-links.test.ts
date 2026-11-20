import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { parseCliOptions } from '../cli-options.ts';
import { checkMdLinks, type MdLinksTools, type MlcIssue, realMdLinksTools } from '../commands/check-md-links.ts';

const ROOT = '/repo';

function tools(
  files: readonly string[],
  issues: readonly MlcIssue[] | undefined,
  previous: readonly string[] = [],
  vendored: readonly string[] = [],
): MdLinksTools & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    listMarkdownFiles: () => files,
    previousGenerations: () => previous,
    vendoredFolders: () => vendored,
    runMlc: (root, given, options) => {
      calls.push({ root, given, options });
      return issues;
    },
  };
}

const issue = (severity: string, source: string, target: string): MlcIssue => ({
  severity,
  source,
  line: 3,
  column: 5,
  target,
  message: 'Target filename not found.',
});

test('check md-links: parses, with and without --offline', () => {
  const plain = parseCliOptions(['--root', ROOT, 'check', 'md-links']);
  assert.equal(plain.command, 'check-md-links');
  assert.equal(plain.command === 'check-md-links' && plain.offline, false);
  const offline = parseCliOptions(['--root', ROOT, 'check', 'md-links', '--offline']);
  assert.equal(offline.command === 'check-md-links' && offline.offline, true);
});

test('check md-links: mlc missing is a warning, never a failure', () => {
  const report = checkMdLinks({ workspaceRoot: ROOT, tools: tools(['README.md'], undefined) });
  assert.deepEqual(report.violations, []);
  assert.match(report.notes?.[0] ?? '', /mlc is not on PATH/);
});

test('check md-links: an mlc error is a violation, a warning is not', () => {
  const fake = tools(
    ['README.md', 'guides/guide.md'],
    [issue('error', `${ROOT}/guides/guide.md`, '../missing.md'), issue('warning', `${ROOT}/README.md`, '!NOTE')],
  );
  const report = checkMdLinks({ workspaceRoot: ROOT, offline: true, tools: fake });
  assert.deepEqual(fake.calls, [{ root: ROOT, given: ['README.md', 'guides/guide.md'], options: { offline: true } }]);
  assert.deepEqual(report.violations, [
    { rule: 'R-07', packageKey: 'guides/guide.md', message: '3:5 ../missing.md: Target filename not found.' },
  ]);
  assert.deepEqual(report.checkedPackageKeys, ['README.md', 'guides/guide.md']);
});

test('check md-links: a file name with a comma is reported as unchecked, not passed to mlc', () => {
  const fake = tools(['a,b.md', 'ok.md'], []);
  const report = checkMdLinks({ workspaceRoot: ROOT, tools: fake });
  assert.deepEqual((fake.calls[0] as { given: string[] }).given, ['ok.md']);
  assert.match(report.notes?.[0] ?? '', /^a,b\.md: not checked/);
});

test('check md-links: git-ignored files are not listed', () => {
  const root = mkdtempSync(join(tmpdir(), 'fhevm-npm-md-links-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    mkdirSync(join(root, 'node_modules/dep'), { recursive: true });
    mkdirSync(join(root, 'guides'));
    writeFileSync(join(root, '.gitignore'), 'node_modules\nignored.md\n');
    writeFileSync(join(root, 'README.md'), '[guide](guides/guide.md)\n');
    writeFileSync(join(root, 'guides/guide.md'), '[broken](../missing.md)\n');
    writeFileSync(join(root, 'ignored.md'), '[broken](nowhere.md)\n');
    writeFileSync(join(root, 'node_modules/dep/README.md'), '[broken](nowhere.md)\n');
    assert.deepEqual(realMdLinksTools.listMarkdownFiles(root), ['README.md', 'guides/guide.md']);

    // The end-to-end run needs the real binary; without it the check must skip, which the test above covers.
    const mlcPresent = spawnSync('mlc', ['--version']).error === undefined;
    if (!mlcPresent) return;
    const report = checkMdLinks({ workspaceRoot: root, offline: true });
    assert.deepEqual(report.violations, [
      {
        rule: 'R-07',
        packageKey: 'guides/guide.md',
        message: '1:1 ../missing.md: Target filename not found.',
      },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check md-links: the previous generation is not checked, since its links are fixed on its release branch', () => {
  const fake = tools(['README.md', 'gen/v13/GUIDE.md', 'gen/v13/sub/NOTES.md', 'gen/v14/GUIDE.md'], [], ['gen/v13']);
  const report = checkMdLinks({ workspaceRoot: ROOT, offline: true, tools: fake });
  assert.deepEqual(fake.calls, [{ root: ROOT, given: ['README.md', 'gen/v14/GUIDE.md'], options: { offline: true } }]);
  // Skipping a frozen folder is a choice, not a finding: no note, so nothing prints as a warning.
  assert.equal(report.notes, undefined);
  assert.deepEqual(report.skipped, ['gen/v13: 2 markdown file(s) of the previous generation (R-04)']);
});

test('check md-links: the previous generations come from npm-manifest.json, and none without one', () => {
  const root = mkdtempSync(join(tmpdir(), 'fhevm-npm-md-links-generations-'));
  try {
    assert.deepEqual(realMdLinksTools.previousGenerations(root), []);
    writeFileSync(
      join(root, 'npm-manifest.json'),
      JSON.stringify({
        generations: {
          'host-contracts-cleartext': {
            current: './host-contracts-cleartext/v14',
            previous: './host-contracts-cleartext/v13',
          },
          other: { current: './other/v2', previous: './other/v1' },
        },
      }),
    );
    assert.deepEqual(realMdLinksTools.previousGenerations(root), ['host-contracts-cleartext/v13', 'other/v1']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check md-links: a vendored copy is not checked, since its links are fixed at its source', () => {
  const fake = tools(
    ['README.md', 'lib/pkg/src/vendored/README.md', 'lib/pkg/src/other.md'],
    [],
    [],
    ['lib/pkg/src/vendored'],
  );
  const report = checkMdLinks({ workspaceRoot: ROOT, offline: true, tools: fake });
  assert.deepEqual(fake.calls, [
    { root: ROOT, given: ['README.md', 'lib/pkg/src/other.md'], options: { offline: true } },
  ]);
  assert.equal(report.notes, undefined);
  assert.deepEqual(report.skipped, ['lib/pkg/src/vendored: 1 markdown file(s) of a vendored copy (R-07)']);
});

test('check md-links: a docs folder is not checked, since no tool of the workspace reads it', () => {
  const fake = tools(['README.md', 'lib/plugin/docs/skills/setup/SKILL.md', 'lib/plugin/other.md'], []);
  const report = checkMdLinks({ workspaceRoot: ROOT, offline: true, tools: fake });
  assert.deepEqual(fake.calls, [
    { root: ROOT, given: ['README.md', 'lib/plugin/other.md'], options: { offline: true } },
  ]);
  assert.deepEqual(report.skipped, ['docs folders: 1 markdown file(s) that no tool reads (R-09)']);
});

test('check md-links: the vendored folders come from npm-manifest.json, and none without one', () => {
  const root = mkdtempSync(join(tmpdir(), 'fhevm-npm-md-links-vendored-'));
  try {
    assert.deepEqual(realMdLinksTools.vendoredFolders(root), []);
    writeFileSync(
      join(root, 'npm-manifest.json'),
      JSON.stringify({
        packages: {
          './lib/pkg': { vendored: [{ relPath: './src/vendored', source: './common/src' }] },
          './gen/v14': { vendored: [{ relPath: './internal/config/', source: { repository: 'x' } }] },
          './other': {},
        },
      }),
    );
    assert.deepEqual(realMdLinksTools.vendoredFolders(root), ['gen/v14/internal/config', 'lib/pkg/src/vendored']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
