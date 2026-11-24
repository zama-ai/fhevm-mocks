import assert from 'node:assert/strict';
import test from 'node:test';

import type { NpmManifest } from '../manifest.ts';
import { type DocsTools, type ToolReads, inspectDocs } from '../base/checks/docs.ts';

const ROOT = '/repo';
const manifest = { packages: { './lib/plugin/pkg': { kind: 'published' } } } as unknown as NpmManifest;

function tools(overrides: Partial<DocsTools> & { folders: readonly string[] }): DocsTools {
  return {
    findDocsFolders: () => overrides.folders,
    listFiles: overrides.listFiles ?? (() => ['docs/skills/setup/SKILL.md']),
    isDirectory: overrides.isDirectory ?? (() => true),
    gitIgnores: overrides.gitIgnores ?? (() => false),
    toolReads:
      overrides.toolReads ??
      ((_folder, files): readonly ToolReads[] => files.map((file) => ({ file, prettier: false, eslint: false }))),
  };
}

test('check docs: a docs folder next to a published pkg/, with skills/, that no tool reads, passes', () => {
  const inspection = inspectDocs(ROOT, manifest, tools({ folders: ['lib/plugin/docs'] }));
  assert.deepEqual(inspection.violations, []);
  assert.deepEqual(inspection.checkedPaths, ['lib/plugin/docs']);
});

test('check docs: a docs folder anywhere else is refused', () => {
  const inspection = inspectDocs(ROOT, manifest, tools({ folders: ['lib/plugin/test/docs', 'lib/docs'] }));
  assert.deepEqual(
    inspection.violations.map((violation) => violation.packageKey),
    ['./lib/plugin/test/docs', './lib/docs'],
  );
  assert.ok(inspection.violations.every((violation) => violation.rule === 'R-09'));
  assert.match(inspection.violations[0]?.message ?? '', /only at the root of a package, next to its published pkg\//);
});

test('check docs: a docs folder without skills/ is refused', () => {
  const inspection = inspectDocs(
    ROOT,
    manifest,
    tools({ folders: ['lib/plugin/docs'], isDirectory: (path) => !path.endsWith('/skills') }),
  );
  assert.deepEqual(inspection.violations, [
    { rule: 'R-09', packageKey: './lib/plugin/docs', message: 'it has no skills/ folder' },
  ]);
});

test('check docs: a docs folder that git ignores is refused', () => {
  const inspection = inspectDocs(ROOT, manifest, tools({ folders: ['lib/plugin/docs'], gitIgnores: () => true }));
  assert.deepEqual(inspection.violations, [
    { rule: 'R-09', packageKey: './lib/plugin/docs', message: 'git ignores it, and a docs folder is committed' },
  ]);
});

test('check docs: a file that Prettier or ESLint reads is refused, and the tools run from the package folder', () => {
  const asked: string[] = [];
  const inspection = inspectDocs(
    ROOT,
    manifest,
    tools({
      folders: ['lib/plugin/docs'],
      listFiles: () => ['docs/skills/setup/SKILL.md', 'docs/skills/setup/files/hardhat.config.ts'],
      toolReads: (folder, files) => {
        asked.push(folder);
        return [
          { file: files[0] ?? '', prettier: true, eslint: false },
          { file: files[1] ?? '', prettier: false, eslint: true },
        ];
      },
    }),
  );
  assert.deepEqual(asked, ['/repo/lib/plugin']);
  assert.deepEqual(
    inspection.violations.map((violation) => [violation.packageKey, violation.message.split(':')[0]]),
    [
      ['./lib/plugin/docs/skills/setup/SKILL.md', 'Prettier reads it'],
      ['./lib/plugin/docs/skills/setup/files/hardhat.config.ts', 'ESLint reads it'],
    ],
  );
});
