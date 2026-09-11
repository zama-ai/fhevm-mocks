import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';

import { validateConsumerLockfiles } from '../base/checks/consumer-lockfiles.ts';
import type { LoadedPackage } from '../base/npm.ts';
import { loadedPackage } from './helpers.ts';

// A workspace shaped like ours, in memory: a plugin payload depending on one of two same-named host payloads,
// an isolated consumer fixture of the plugin, and versions.json for all three payloads.
const WORKSPACE = '/workspace';
const VERSIONS = {
  $schema: './fhevm-npm/schemas/versions.schema.json',
  schemaVersion: 1,
  packages: {
    './host/v13/pkg': '0.13.0',
    './host/v14/pkg': '0.14.0-0',
    './plugin/pkg': '0.14.0-0',
  },
} as const;

function packages(): LoadedPackage[] {
  const published = (key: string, name: string, extra: Record<string, unknown> = {}): LoadedPackage =>
    loadedPackage(key, { kind: 'published', name, member: false, ...extra }, { name });
  return [
    published('./host/v13/pkg', '@scope/host'),
    published('./host/v14/pkg', '@scope/host'),
    published('./plugin/pkg', '@scope/plugin', { consumerTests: { esm: ['./plugin/test-consumer/esm'] } }),
    loadedPackage(
      './plugin/test-consumer/esm',
      { kind: 'standalone', name: 'plugin-consumer', member: false },
      { name: 'plugin-consumer' },
    ),
  ];
}

/** The consumer lock npm would write for `plugin/pkg` depending on `host/<gen>/pkg`, at the given versions. */
function lock(gen: 'v13' | 'v14', pluginVersion: string, hostVersion: string): string {
  return JSON.stringify({
    lockfileVersion: 3,
    packages: {
      '': { name: 'plugin-consumer', devDependencies: { '@scope/plugin': 'file:../../pkg' } },
      'node_modules/@scope/plugin': { version: pluginVersion, resolved: 'file:../../pkg' },
      'node_modules/@scope/host': { version: hostVersion, resolved: `file:../../../host/${gen}/pkg` },
      'node_modules/left-pad': {
        version: '1.3.0',
        resolved: 'https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz',
      },
    },
  });
}

function files(lockText: string, pluginDependsOn: 'v13' | 'v14' = 'v14'): Map<string, string> {
  return new Map([
    [join(WORKSPACE, 'plugin/test-consumer/esm/package-lock.json'), lockText],
    [
      join(WORKSPACE, 'plugin/test-consumer/esm/package.json'),
      JSON.stringify({ name: 'plugin-consumer', devDependencies: { '@scope/plugin': 'file:../../pkg' } }),
    ],
    [
      join(WORKSPACE, 'plugin/pkg/package.json'),
      JSON.stringify({
        name: '@scope/plugin',
        dependencies: { '@scope/host': `file:../../host/${pluginDependsOn}/pkg` },
      }),
    ],
    [join(WORKSPACE, 'host/v13/pkg/package.json'), JSON.stringify({ name: '@scope/host' })],
    [join(WORKSPACE, 'host/v14/pkg/package.json'), JSON.stringify({ name: '@scope/host' })],
  ]);
}

const run = (fs: Map<string, string>) =>
  validateConsumerLockfiles(WORKSPACE, packages(), VERSIONS, (file) => fs.get(file));

test('a lock pinning every payload at its versions.json version, on the declared paths, is clean', () => {
  assert.deepEqual(run(files(lock('v14', '0.14.0-0', '0.14.0-0'))), []);
});

test('a published node whose version disagrees with versions.json is reported with the fix', () => {
  const violations = run(files(lock('v14', '0.13.0', '0.14.0-0')));
  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.rule, '6.1.3');
  assert.equal(violations[0]?.packageKey, './plugin/test-consumer/esm/package-lock.json');
  assert.match(
    violations[0]?.message ?? '',
    /pins @scope\/plugin@0\.13\.0, but versions\.json says \.\/plugin\/pkg is 0\.14\.0-0/,
  );
  assert.match(violations[0]?.message ?? '', /test-consumer-regenerate-package-lock \.\/plugin\/test-consumer\/esm/);
});

test('a same-named payload resolved to the generation the depender no longer names is reported, even at its own right version', () => {
  // Exactly the shape found in hardhat/v3/plugin/test-consumer/esm: 0.13.0 IS host/v13/pkg's version, so the
  // version assertion alone is silent; the path assertion is what speaks.
  const violations = run(files(lock('v13', '0.14.0-0', '0.13.0'), 'v14'));
  assert.equal(violations.length, 1);
  assert.match(
    violations[0]?.message ?? '',
    /resolves @scope\/host to node_modules\/@scope\/host → 'file:\.\.\/\.\.\/\.\.\/host\/v13\/pkg', but \.\/plugin\/pkg\/package\.json depends on \.\/host\/v14\/pkg/,
  );
});

test('a lock resolving a published name outside the workspace payloads, or missing a declared payload, is reported', () => {
  const foreign = JSON.stringify({
    lockfileVersion: 3,
    packages: {
      '': {},
      'node_modules/@scope/plugin': {
        version: '0.14.0-0',
        resolved: 'https://registry.npmjs.org/@scope/plugin/-/plugin-0.14.0-0.tgz',
      },
      'node_modules/@scope/host': { version: '0.14.0-0', resolved: 'file:../../../elsewhere/pkg' },
    },
  });
  const violations = run(files(foreign));
  const messages = violations.map((v) => v.message);
  // The registry-resolved plugin is matched by name (unique) and its version is right: no complaint about it.
  assert.equal(messages.filter((m) => m.includes('@scope/plugin')).length, 0);
  assert.ok(
    messages.some((m) =>
      /resolves @scope\/host to 'file:\.\.\/\.\.\/\.\.\/elsewhere\/pkg', which is not a published payload/.test(m),
    ),
  );

  const missing = JSON.stringify({
    lockfileVersion: 3,
    packages: { '': {}, 'node_modules/@scope/plugin': { version: '0.14.0-0', resolved: 'file:../../pkg' } },
  });
  const gone = run(files(missing));
  assert.equal(gone.length, 1);
  assert.match(gone[0]?.message ?? '', /has no node for @scope\/host, which \.\/plugin\/pkg\/package\.json depends on/);
});

test('a member consumer, a missing lock, and workspace links are left to other rules', () => {
  const fs = files(lock('v14', '0.14.0-0', '0.14.0-0'));
  fs.delete(join(WORKSPACE, 'plugin/test-consumer/esm/package-lock.json'));
  assert.deepEqual(run(fs), [], 'a missing lock is rule 6.1.1, not this one');

  // A workspace-link node carries no version: the linked target does, and is graded through the link.
  const linked = (targetVersion: string): string =>
    JSON.stringify({
      lockfileVersion: 3,
      packages: {
        '': {},
        'node_modules/@scope/plugin': { resolved: '../../pkg', link: true },
        '../../pkg': { version: targetVersion },
        'node_modules/@scope/host': { version: '0.14.0-0', resolved: 'file:../../../host/v14/pkg' },
      },
    });
  assert.deepEqual(run(files(linked('0.14.0-0'))), [], 'a link to a payload at the right version is clean');
  const stale = run(files(linked('0.0.1')));
  assert.equal(stale.length, 1);
  assert.match(
    stale[0]?.message ?? '',
    /node_modules\/@scope\/plugin → \.\.\/\.\.\/pkg: pins @scope\/plugin@0\.0\.1, but versions\.json says/,
  );

  const member = packages().map((pkg) =>
    pkg.key === './plugin/test-consumer/esm' ? { ...pkg, inventory: { ...pkg.inventory, member: true } } : pkg,
  );
  assert.deepEqual(
    validateConsumerLockfiles(WORKSPACE, member, VERSIONS, (file) => files(lock('v13', '0.13.0', '0.13.0')).get(file)),
    [],
    'a member consumer is covered by its installation root',
  );
});
