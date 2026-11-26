import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type InstallReader,
  type Platform,
  fits,
  validateInstalledOptionals,
} from '../base/checks/installed-optionals.ts';
import { loadedPackage } from './helpers.ts';

const root = loadedPackage(
  '.',
  { kind: 'workspace-root', name: 'workspace', private: true, member: false },
  { name: 'workspace', private: true },
);
const cluster = loadedPackage(
  './hardhat/v3',
  { kind: 'workspace-root', name: '@fhevm/hh-v3', private: true, member: false },
  { name: '@fhevm/hh-v3', private: true },
);

const LINUX_GLIBC: Platform = { os: 'linux', cpu: 'x64', libc: 'glibc' };
const DARWIN_ARM: Platform = { os: 'darwin', cpu: 'arm64' };

const lock = (packages: Record<string, unknown>) => JSON.stringify({ lockfileVersion: 3, packages });

/** A workspace on disk: lockfiles by path, and the set of paths that exist. */
function disk(lockfiles: Readonly<Record<string, string>>, installed: readonly string[]): InstallReader {
  const at = (path: string) => `/workspace/${path}`.replace(/\/$/, '');
  const files = new Map(Object.entries(lockfiles).map(([path, text]) => [at(path), text]));
  const paths = new Set(installed.map(at));
  return { read: (file) => files.get(file), exists: (path) => paths.has(path) };
}

// rolldown's shape: one optional binding per platform, the right one kept by npm.
const ROLLDOWN = {
  '': { name: 'workspace' },
  'node_modules/rolldown': { version: '1.2.14', dev: true },
  'node_modules/@rolldown/binding-linux-x64-gnu': {
    optional: true,
    dev: true,
    os: ['linux'],
    cpu: ['x64'],
    libc: ['glibc'],
  },
  'node_modules/@rolldown/binding-linux-x64-musl': {
    optional: true,
    dev: true,
    os: ['linux'],
    cpu: ['x64'],
    libc: ['musl'],
  },
  'node_modules/@rolldown/binding-darwin-arm64': { optional: true, dev: true, os: ['darwin'], cpu: ['arm64'] },
};

test('an install that holds the binding for its platform passes', () => {
  const violations = validateInstalledOptionals(
    [root],
    LINUX_GLIBC,
    disk({ 'package-lock.json': lock(ROLLDOWN) }, [
      'node_modules',
      'node_modules/rolldown/package.json',
      'node_modules/@rolldown/binding-linux-x64-gnu/package.json',
    ]),
  );
  assert.deepEqual(violations, []);
});

test('a binding npm dropped fails, named by the lockfile that lists it', () => {
  // The CI case: the download of the linux-x64-gnu binding aborted, npm ci still exited 0.
  const violations = validateInstalledOptionals(
    [root],
    LINUX_GLIBC,
    disk({ 'package-lock.json': lock(ROLLDOWN) }, ['node_modules', 'node_modules/rolldown/package.json']),
  );
  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.rule, 'NR-93');
  assert.equal(violations[0]?.packageKey, './package-lock.json');
  assert.match(violations[0]?.message ?? '', /'node_modules\/@rolldown\/binding-linux-x64-gnu' is optional/);
  assert.match(violations[0]?.message ?? '', /fits linux\/x64\/glibc/);
});

test('bindings for other platforms are not required', () => {
  const violations = validateInstalledOptionals(
    [root],
    DARWIN_ARM,
    disk({ 'package-lock.json': lock(ROLLDOWN) }, [
      'node_modules',
      'node_modules/@rolldown/binding-darwin-arm64/package.json',
    ]),
  );
  assert.deepEqual(violations, []);
});

test('libc is checked on Linux only, and musl does not need the glibc binding', () => {
  const violations = validateInstalledOptionals(
    [root],
    { os: 'linux', cpu: 'x64', libc: 'musl' },
    disk({ 'package-lock.json': lock(ROLLDOWN) }, ['node_modules']),
  );
  assert.deepEqual(
    violations.map((violation) => violation.message.split("'")[1]),
    ['node_modules/@rolldown/binding-linux-x64-musl'],
  );
});

test('an optional package with no platform list is required everywhere', () => {
  const violations = validateInstalledOptionals(
    [cluster],
    DARWIN_ARM,
    disk(
      {
        'hardhat/v3/package-lock.json': lock({
          '': { name: '@fhevm/hh-v3' },
          'node_modules/any-optional': { optional: true },
          'node_modules/dev-optional': { devOptional: true },
          'node_modules/required': {},
        }),
      },
      ['hardhat/v3/node_modules'],
    ),
  );
  assert.equal(violations.length, 2);
  assert.equal(violations[0]?.packageKey, './hardhat/v3/package-lock.json');
  assert.deepEqual(
    violations.map((violation) => violation.message.split("'")[1]),
    ['node_modules/any-optional', 'node_modules/dev-optional'],
  );
});

test('a node nested under a parent that is not installed is skipped', () => {
  const violations = validateInstalledOptionals(
    [root],
    DARWIN_ARM,
    disk(
      {
        'package-lock.json': lock({
          '': { name: 'workspace' },
          'node_modules/parent': { optional: true, os: ['linux'] },
          'node_modules/parent/node_modules/child': { optional: true },
        }),
      },
      ['node_modules'],
    ),
  );
  assert.deepEqual(violations, []);
});

test('links and the root are never checked', () => {
  const violations = validateInstalledOptionals(
    [root],
    DARWIN_ARM,
    disk(
      {
        'package-lock.json': lock({
          '': { name: 'workspace', optional: true },
          'packages/member': { optional: true },
          'node_modules/member': { link: true, optional: true },
        }),
      },
      ['node_modules'],
    ),
  );
  assert.deepEqual(violations, []);
});

test('an installation root that was never installed is skipped', () => {
  const violations = validateInstalledOptionals([root], LINUX_GLIBC, disk({ 'package-lock.json': lock(ROLLDOWN) }, []));
  assert.deepEqual(violations, []);
});

test('a lockfile with no packages section fails rather than passing vacuously', () => {
  const violations = validateInstalledOptionals(
    [root],
    LINUX_GLIBC,
    disk({ 'package-lock.json': JSON.stringify({ lockfileVersion: 1, dependencies: {} }) }, ['node_modules']),
  );
  assert.equal(violations.length, 1);
  assert.match(violations[0]?.message ?? '', /no "packages" section/);
});

test('fits follows npm: no list fits all, ! excludes, positive entries must include the value', () => {
  assert.equal(fits(undefined, 'linux'), true);
  assert.equal(fits([], 'linux'), true);
  assert.equal(fits(['linux'], 'linux'), true);
  assert.equal(fits(['darwin'], 'linux'), false);
  assert.equal(fits(['!win32'], 'linux'), true);
  assert.equal(fits(['!linux'], 'linux'), false);
  assert.equal(fits(['glibc'], undefined), true);
});
