import assert from 'node:assert/strict';
import test from 'node:test';

import { validateWorkspaces } from '../base/checks/workspaces.ts';
import { loadedPackage } from './helpers.ts';

test('accepts the exact explicit workspace member set', () => {
  const root = workspaceRoot(['dev', 'published']);
  const packages = [root, devPackage(), publishedPackage('./published', '@scope/library', true)];
  assert.deepEqual(validateWorkspaces(packages), []);
});

test('reports globs, missing members, standalone members, and duplicate published names', () => {
  const root = workspaceRoot(['packages/*', 'standalone', 'published-a', 'published-b']);
  const packages = [
    root,
    devPackage(),
    loadedPackage('./standalone', { kind: 'standalone', name: 'consumer', member: false }, { name: 'consumer' }),
    publishedPackage('./published-a', '@scope/library', true),
    publishedPackage('./published-b', '@scope/library', true),
  ];

  const violations = validateWorkspaces(packages);
  assert.equal(violations.filter((violation) => violation.rule === '2.1.1').length, 2);
  assert.equal(violations.filter((violation) => violation.rule === '2.1.3').length, 2);
  assert.equal(violations.filter((violation) => violation.rule === '2.1.4').length, 1);
});

function workspaceRoot(workspaces: readonly string[]) {
  return loadedPackage(
    '.',
    { kind: 'workspace-root', name: 'workspace', private: true, member: false },
    { name: 'workspace', private: true, workspaces: [...workspaces] },
  );
}

function devPackage() {
  return loadedPackage(
    './dev',
    {
      kind: 'dev',
      name: '@scope/dev-owner-dev',
      private: true,
      member: true,
      publishedRelPath: './published',
    },
    { name: '@scope/dev-owner-dev', private: true },
  );
}

function publishedPackage(key: string, name: string, member: boolean) {
  return loadedPackage(key, { kind: 'published', name, member }, { name, version: '1.0.0' });
}

test('validates each installation root independently, and published names across every root', () => {
  const clusterRoot = loadedPackage(
    './hardhat/v2',
    { kind: 'workspace-root', name: '@scope/hh-v2-cluster', private: true, member: false },
    { name: '@scope/hh-v2-cluster', private: true, workspaces: ['plugin/pkg'] },
  );
  const packages = [
    workspaceRoot(['dev', 'published']),
    devPackage(),
    publishedPackage('./published', '@scope/library', true),
    clusterRoot,
    loadedPackage(
      './hardhat/v2/plugin/pkg',
      { kind: 'published', name: '@scope/library', member: true, memberOf: './hardhat/v2' },
      { name: '@scope/library', version: '2.0.0' },
    ),
  ];
  // Each root's workspaces array is complete, but one published name has a member in two roots (2.1.3).
  assert.deepEqual(
    validateWorkspaces(packages)
      .map((violation) => `${violation.rule} ${violation.packageKey}`)
      .sort(),
    ['2.1.3 ./hardhat/v2/plugin/pkg/package.json', '2.1.3 ./published/package.json'],
  );
});

test("flags a cluster root's missing member, and a '.'-rooted member living inside a cluster", () => {
  const clusterRoot = loadedPackage(
    './hardhat/v2',
    { kind: 'workspace-root', name: '@scope/hh-v2-cluster', private: true, member: false },
    { name: '@scope/hh-v2-cluster', private: true, workspaces: [] },
  );
  const strayMember = loadedPackage(
    './hardhat/v2/e2e',
    { kind: 'internal-consumer', name: '@scope/e2e-dev', private: true, member: true },
    { name: '@scope/e2e-dev', private: true },
  );
  const clusterMember = loadedPackage(
    './hardhat/v2/plugin/pkg',
    { kind: 'published', name: '@scope/plugin', member: true, memberOf: './hardhat/v2' },
    { name: '@scope/plugin', version: '2.0.0' },
  );

  const violations = validateWorkspaces([
    workspaceRoot(['dev', 'published', 'hardhat/v2/e2e']),
    devPackage(),
    publishedPackage('./published', '@scope/library', true),
    clusterRoot,
    strayMember,
    clusterMember,
  ]);
  assert.ok(
    violations.some((v) => v.rule === '2.1.1' && v.packageKey === './hardhat/v2/plugin/pkg/package.json'),
    'the cluster member missing from the cluster workspaces array must be flagged',
  );
  assert.ok(
    violations.some((v) => v.rule === '2.1.6' && v.packageKey === './hardhat/v2/e2e/package.json'),
    "a '.'-rooted member inside the cluster must be told to declare memberOf",
  );
});

test('2.1.1: a package that is not an installation root may not list a glob in workspaces either', () => {
  const standalone = loadedPackage(
    './consumer',
    { kind: 'standalone', name: 'consumer', member: false },
    { name: 'consumer', private: true, workspaces: ['*'] },
  );
  const violations = validateWorkspaces([
    workspaceRoot(['dev', 'published']),
    devPackage(),
    publishedPackage('./published', '@scope/library', true),
    standalone,
  ]);

  assert.deepEqual(
    violations.map((violation) => `${violation.rule} ${violation.packageKey}`),
    ['2.1.1 ./consumer/package.json'],
  );
});

test('4.2.2: one installation root holds one major of each dependency its private members declare', () => {
  const member = (key: string, group: string, hardhat: string) =>
    loadedPackage(
      key,
      { kind: 'internal-consumer', name: `${key.slice(2)}-dev`, private: true, member: true, dependencyGroup: group },
      { name: `${key.slice(2)}-dev`, private: true, devDependencies: { hardhat } },
    );
  const published = loadedPackage(
    './published',
    { kind: 'published', name: '@scope/library', member: true },
    { name: '@scope/library', version: '1.0.0', peerDependencies: { hardhat: '^2.0.0' } },
  );

  // Two groups with two hardhat majors in the one root '.': both members are reported.
  const shared = [
    workspaceRoot(['v2', 'v3', 'published']),
    member('./v2', 'hardhat/v2', '^2.29.1'),
    member('./v3', 'hardhat/v3', '^3.20.0'),
    published,
  ];
  assert.deepEqual(
    validateWorkspaces(shared).map((violation) => `${violation.rule} ${violation.packageKey}`),
    ['4.2.2 ./v2/package.json', '4.2.2 ./v3/package.json'],
  );

  // One major in the root, and a published payload's peer range does not count.
  const single = [workspaceRoot(['v2', 'published']), member('./v2', 'hardhat/v2', '^2.29.1'), published];
  assert.deepEqual(validateWorkspaces(single), []);
});
