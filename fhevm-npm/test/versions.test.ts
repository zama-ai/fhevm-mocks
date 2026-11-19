import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  VERSIONS_FILE,
  VERSIONS_SCHEMA_REFERENCE,
  type VersionsFile,
  loadVersions,
  publishedPayloadKeys,
  validateVersionGraph,
} from '../base/versions.ts';
import { parseTestNpmManifest } from './helpers.ts';

const manifest = () =>
  parseTestNpmManifest({
    packageJson: { published: { required: [], excluded: [] } },
    packages: {
      '.': { kind: 'workspace-root', name: 'workspace', private: true, member: false },
      './library/pkg': { kind: 'published', name: '@scope/library', member: true },
      './library': {
        kind: 'dev',
        name: '@scope/library-dev',
        private: true,
        member: true,
        publishedRelPath: './library/pkg',
      },
      './plugin/pkg': { kind: 'published', name: '@scope/plugin', member: true },
    },
  });

const versions = (packages: Record<string, string>): VersionsFile => ({
  $schema: VERSIONS_SCHEMA_REFERENCE,
  schemaVersion: 1 as const,
  packages,
});

test('every kind: published payload needs a central version, in manifest order', () => {
  assert.deepEqual(publishedPayloadKeys(manifest()), ['./library/pkg', './plugin/pkg']);
  assert.deepEqual(
    validateVersionGraph(manifest(), versions({ './library/pkg': '1.2.3', './plugin/pkg': '0.4.0' })),
    [],
  );
});

test('coverage is checked both ways: a payload without an entry, an entry without a payload', () => {
  const missing = validateVersionGraph(manifest(), versions({ './library/pkg': '1.2.3' }));
  assert.deepEqual(missing, [
    {
      rule: 'NR-36',
      packageKey: `./${VERSIONS_FILE}`,
      message: `'./plugin/pkg' is a published payload with no entry here`,
    },
  ]);
  const extra = validateVersionGraph(
    manifest(),
    versions({ './library/pkg': '1.2.3', './plugin/pkg': '0.4.0', './library': '0.0.0' }),
  );
  assert.deepEqual(
    extra.map((violation) => [violation.rule, violation.packageKey]),
    [['NR-36', `./${VERSIONS_FILE}`]],
  );
  // NR-36 also covers SemVer and order: the message says this one is the coverage violation.
  assert.match(extra[0]?.message ?? '', /is not a published payload/);
});

test('values must be canonical SemVer; the order must follow the manifest', () => {
  const ranged = validateVersionGraph(manifest(), versions({ './library/pkg': '^1.2.3', './plugin/pkg': '0.4.0' }));
  assert.deepEqual(
    ranged.map((violation) => violation.rule),
    ['NR-36'],
  );
  assert.match(ranged[0]?.message ?? '', /not canonical SemVer/);
  const reordered = validateVersionGraph(manifest(), versions({ './plugin/pkg': '0.4.0', './library/pkg': '1.2.3' }));
  assert.deepEqual(reordered, [
    {
      rule: 'NR-36',
      packageKey: `./${VERSIONS_FILE}`,
      message: 'entries must follow npm-manifest.json order: ./library/pkg, ./plugin/pkg',
    },
  ]);
});

test('loadVersions reads the file at the workspace root and rejects a wrong shape outright', () => {
  const root = mkdtempSync(join(tmpdir(), 'fhevm-npm-versions-'));
  try {
    assert.throws(() => loadVersions(root), /is missing at the workspace root/);
    writeFileSync(join(root, VERSIONS_FILE), JSON.stringify({ schemaVersion: 1, packages: {} }));
    assert.throws(() => loadVersions(root), new RegExp(VERSIONS_FILE));
    writeFileSync(join(root, VERSIONS_FILE), JSON.stringify(versions({ './plugin/pkg': '0.4.0' })));
    assert.deepEqual(loadVersions(root).packages, { './plugin/pkg': '0.4.0' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
