import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import type { PackageJson } from '../base/npm.ts';
import { type Packument, parseFloorRange, pickBefore, satisfiesFloorRange, toPackument } from '../base/registry-age.ts';
import {
  type UpdateTarget,
  floorLockMismatches,
  planFloorUpdates,
  updatableNames,
  updateTargets,
} from '../base/update-dependencies.ts';
import { type ParsedVersion, parseVersion } from '../base/semver.ts';
import { parseCliOptions } from '../cli-options.ts';
import { updateDependenciesCommand } from '../commands/update-dependencies.ts';
import { loadedPackage, parseTestNpmManifest } from './helpers.ts';

const CUTOFF = new Date('2026-10-20T00:00:00Z');

function packument(
  name: string,
  times: Record<string, string>,
  extra: { readonly latest?: string; readonly deprecated?: readonly string[] } = {},
): Packument {
  return {
    name,
    time: times,
    versions: Object.keys(times),
    deprecated: new Set(extra.deprecated ?? []),
    ...(extra.latest === undefined ? {} : { latest: extra.latest }),
  };
}

function semverOf(version: string): ParsedVersion {
  const parsed = parseVersion(version);
  if (parsed === undefined) throw new Error(`not a version: ${version}`);
  return parsed;
}

function range(spec: string) {
  const parsed = parseFloorRange(spec);
  if (parsed === undefined) throw new Error(`not a floor range: ${spec}`);
  return parsed;
}

test('floor ranges follow npm caret and tilde semantics and never admit a prerelease', () => {
  const cases: readonly (readonly [string, string, boolean])[] = [
    ['^1.2.3', '1.9.0', true],
    ['^1.2.3', '2.0.0', false],
    ['^1.2.3', '1.2.2', false],
    ['^0.2.3', '0.2.9', true],
    ['^0.2.3', '0.3.0', false],
    ['^0.0.3', '0.0.3', true],
    ['^0.0.3', '0.0.4', false],
    ['~1.2.3', '1.2.9', true],
    ['~1.2.3', '1.3.0', false],
    ['^1.2.3', '1.3.0-rc.1', false],
  ];
  for (const [spec, version, expected] of cases) {
    assert.equal(satisfiesFloorRange(semverOf(version), range(spec)), expected, `${version} in ${spec}`);
  }
  for (const spec of ['1.2.3', '>=1.2.3', 'file:../pkg', 'npm:x@^1.0.0', '^1.2', '^1.2.3-rc.1', '*']) {
    assert.equal(parseFloorRange(spec), undefined, spec);
  }
});

test('the pick is the newest in-range version older than the cutoff, preferring an eligible latest tag', () => {
  const vitest = packument('vitest', {
    '4.1.11': '2026-08-18T00:00:00Z',
    '4.1.12': '2026-10-15T00:00:00Z',
    '4.1.13': '2026-10-22T00:00:00Z',
    '5.0.0': '2026-09-01T00:00:00Z',
  });
  assert.equal(pickBefore(vitest, range('^4.1.11'), CUTOFF), '4.1.12');
  assert.equal(pickBefore({ ...vitest, latest: '4.1.11' }, range('^4.1.11'), CUTOFF), '4.1.11');
  assert.equal(pickBefore({ ...vitest, latest: '4.1.13' }, range('^4.1.11'), CUTOFF), '4.1.12');
  assert.equal(pickBefore(vitest, range('^4.1.13'), CUTOFF), undefined);
});

test('deprecated versions are passed over, unless the whole range is deprecated', () => {
  const times = { '9.39.2': '2026-01-01T00:00:00Z', '9.39.5': '2026-02-01T00:00:00Z' };
  assert.equal(pickBefore(packument('eslint', times, { deprecated: ['9.39.5'] }), range('^9.39.2'), CUTOFF), '9.39.2');
  assert.equal(
    pickBefore(packument('eslint', times, { deprecated: ['9.39.2', '9.39.5'] }), range('^9.39.2'), CUTOFF),
    '9.39.5',
  );
});

test('a registry body is reduced to times, versions, deprecations and the latest tag', () => {
  const reduced = toPackument('x', {
    'dist-tags': { latest: '1.0.1' },
    time: { created: '2020-01-01T00:00:00Z', '1.0.0': '2020-01-02T00:00:00Z', '1.0.1': '2020-01-03T00:00:00Z' },
    versions: { '1.0.0': { deprecated: 'use 1.0.1' }, '1.0.1': {} },
  });
  assert.deepEqual(reduced.versions, ['1.0.0', '1.0.1']);
  assert.deepEqual([...reduced.deprecated], ['1.0.0']);
  assert.equal(reduced.latest, '1.0.1');
  assert.equal(reduced.time['1.0.1'], '2020-01-03T00:00:00Z');
});

const manifest = parseTestNpmManifest({
  dependencies: { forbidden: ['solhint'], pinned: { '@fhevm/sdk': '^0.13.8' } },
  packageJson: { published: { required: ['name', 'version'], excluded: ['private'] } },
  packages: {
    '.': { kind: 'workspace-root', name: 'workspace', private: true, member: false },
  },
});

function target(key: string, packageJson: PackageJson, published = false): UpdateTarget {
  return {
    key,
    directory: `/workspace/${key.slice(2)}`,
    packageJson,
    published,
    lockRoot: '/workspace',
    isolatedConsumer: false,
  };
}

const registry = new Map<string, Packument | undefined>([
  ['tool', packument('tool', { '1.0.0': '2026-01-01T00:00:00Z', '1.4.0': '2026-03-01T00:00:00Z' })],
  ['runtime', packument('runtime', { '2.0.0': '2026-01-01T00:00:00Z', '2.1.0': '2026-03-01T00:00:00Z' })],
  ['peer', packument('peer', { '3.0.0': '2026-01-01T00:00:00Z', '3.5.0': '2026-03-01T00:00:00Z' })],
  ['@fhevm/sdk', packument('@fhevm/sdk', { '0.13.8': '2026-01-01T00:00:00Z', '0.13.9': '2026-03-01T00:00:00Z' })],
  ['ghost', undefined],
]);

test('private packages move every field but peers; published packages move devDependencies only', () => {
  const targets = [
    target('./private', {
      dependencies: { runtime: '^2.0.0' },
      devDependencies: { tool: '^1.0.0', exact: '1.0.0', local: 'file:../x', '@fhevm/sdk': '^0.13.8' },
      peerDependencies: { peer: '^3.0.0' },
    }),
    target(
      './published',
      {
        dependencies: { runtime: '^2.0.0' },
        devDependencies: { tool: '~1.0.0' },
        peerDependencies: { peer: '^3.0.0' },
      },
      true,
    ),
  ];
  assert.deepEqual(updatableNames(manifest, targets), ['runtime', 'tool']);
  const plan = planFloorUpdates(manifest, targets, registry, CUTOFF);
  assert.deepEqual(
    plan.edits.map((edit) => [edit.packageKey, edit.field, edit.name, edit.from, edit.to]),
    [
      ['./private/package.json', 'dependencies', 'runtime', '^2.0.0', '^2.1.0'],
      ['./private/package.json', 'devDependencies', 'tool', '^1.0.0', '^1.4.0'],
    ],
  );
  // `~1.0.0` has no newer patch: nothing to move, and nothing to report.
  assert.deepEqual(plan.held, []);
});

test('a floor the registry cannot move is held with its reason, never lowered', () => {
  const plan = planFloorUpdates(
    manifest,
    [target('./private', { devDependencies: { ghost: '^1.0.0', tool: '^1.4.0', fresh: '^9.0.0' } })],
    new Map([...registry, ['fresh', packument('fresh', { '9.0.0': '2026-10-22T00:00:00Z' })]]),
    CUTOFF,
  );
  assert.deepEqual(plan.edits, []);
  assert.deepEqual(
    plan.held.map((hold) => [hold.name, hold.reason]),
    [
      ['ghost', 'registry.npmjs.org does not know this name'],
      ['fresh', 'no version in range was published before 2026-10-20T00:00:00.000Z'],
    ],
  );
});

test('the floor is compared with the copy Node would resolve from the package directory', () => {
  const entries = {
    'node_modules/tool': { version: '1.4.0' },
    'member/node_modules/tool': { version: '1.5.0' },
    'node_modules/runtime': { version: '2.1.0' },
  };
  const mismatches = floorLockMismatches(
    manifest,
    [
      target('./member', { devDependencies: { tool: '^1.4.0', runtime: '^2.1.0', absent: '^1.0.0' } }),
      target('./other', { devDependencies: { tool: '^1.4.0' } }),
    ],
    () => entries,
  );
  assert.deepEqual(
    mismatches.map((mismatch) => [mismatch.packageKey, mismatch.name, mismatch.locked]),
    [['./member/package.json', 'tool', '1.5.0']],
  );
});

test('members are locked by their installation root; a non-member without a lockfile is skipped', () => {
  const targets = updateTargets([
    loadedPackage('.', { kind: 'workspace-root', name: 'workspace', private: true, member: false }, {}),
    loadedPackage('./hardhat', { kind: 'workspace-root', name: 'cluster', private: true, member: false }, {}),
    loadedPackage(
      './hardhat/plugin',
      { kind: 'dev', name: 'plugin-dev', private: true, member: true, memberOf: './hardhat' },
      {},
    ),
    loadedPackage('./common', { kind: 'shared-helper', name: 'common', private: true, member: true }, {}),
    loadedPackage('./loose/pkg', { kind: 'published', name: 'loose', member: false }, {}),
  ]);
  assert.deepEqual(
    targets.map((entry) => [entry.key, entry.lockRoot, entry.isolatedConsumer]),
    [
      ['.', '/workspace/', false],
      ['./hardhat', '/workspace/hardhat', false],
      ['./hardhat/plugin', '/workspace/hardhat', false],
      ['./common', '/workspace/', false],
    ],
  );
});

test("'update dependencies' defaults to 72 hours and accepts --dry-run", () => {
  const plain = parseCliOptions(['update', 'dependencies']);
  if (plain.command !== 'update-dependencies') throw new Error('unreachable');
  assert.deepEqual([plain.minAgeHours, plain.dryRun], [72, false]);
  const tuned = parseCliOptions(['update', 'dependencies', '--min-age-hours', '48', '--dry-run']);
  if (tuned.command !== 'update-dependencies') throw new Error('unreachable');
  assert.deepEqual([tuned.minAgeHours, tuned.dryRun], [48, true]);
  assert.throws(() => parseCliOptions(['update', 'dependencies', '--min-age-hours', '3d']), /non-negative integer/);
});

test('the command edits the floor, relocks with --before, and finds the floor equal to the lock', async () => {
  const root = mkdtempSync(join(tmpdir(), 'fhevm-npm-update-'));
  try {
    const packageJson = `{
  "name": "workspace",
  "private": true,
  "devDependencies": {
    "tool": "^1.0.0"
  }
}
`;
    writeFileSync(join(root, 'package.json'), packageJson);
    const lock = (version: string): string =>
      JSON.stringify({ lockfileVersion: 3, packages: { '': {}, 'node_modules/tool': { version } } });
    writeFileSync(join(root, 'package-lock.json'), lock('1.0.0'));

    const calls: (readonly string[])[] = [];
    const now = Date.now();
    const report = await updateDependenciesCommand(
      { workspaceRoot: root, manifest, minAgeHours: 72, dryRun: false, verbosity: 0 },
      async (name) =>
        name === 'tool'
          ? packument('tool', {
              '1.0.0': new Date(now - 30 * 86_400_000).toISOString(),
              '1.4.0': new Date(now - 10 * 86_400_000).toISOString(),
              '1.5.0': new Date(now - 3_600_000).toISOString(),
            })
          : undefined,
      (directory, args) => {
        calls.push([directory, ...args]);
        writeFileSync(join(directory, 'package-lock.json'), lock('1.4.0'));
      },
    );

    assert.match(readFileSync(join(root, 'package.json'), 'utf8'), /"tool": "\^1\.4\.0"/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.[0], root);
    assert.ok(calls[0]?.some((arg) => arg.startsWith('--before=')));
    assert.ok(calls[0]?.includes('--package-lock-only'));
    assert.deepEqual(report.violations, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a dry run writes nothing and runs no npm', async () => {
  const root = mkdtempSync(join(tmpdir(), 'fhevm-npm-update-'));
  try {
    const text =
      '{\n  "name": "workspace",\n  "private": true,\n  "devDependencies": {\n    "tool": "^1.0.0"\n  }\n}\n';
    writeFileSync(join(root, 'package.json'), text);
    let ran = false;
    await updateDependenciesCommand(
      { workspaceRoot: root, manifest, minAgeHours: 72, dryRun: true, verbosity: 0 },
      async () => packument('tool', { '1.0.0': '2020-01-01T00:00:00Z', '1.4.0': '2020-02-01T00:00:00Z' }),
      () => {
        ran = true;
      },
    );
    assert.equal(readFileSync(join(root, 'package.json'), 'utf8'), text);
    assert.equal(ran, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
