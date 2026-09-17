import assert from 'node:assert/strict';
import test from 'node:test';

import { type LockfileReader, extraneousNodes, validateLockfileExtraneous } from '../base/checks/extraneous.ts';
import { loadedPackage } from './helpers.ts';

const root = loadedPackage(
  '.',
  { kind: 'workspace-root', name: 'workspace', private: true, member: false },
  {
    name: 'workspace',
    private: true,
  },
);
const cluster = loadedPackage(
  './hardhat/v3',
  { kind: 'workspace-root', name: '@fhevm/hh-v3', private: true, member: false },
  { name: '@fhevm/hh-v3', private: true },
);

/** Serves lockfile text by path; anything unlisted has no lockfile, as on disk. */
function reader(byPath: Readonly<Record<string, unknown>>): LockfileReader {
  return (file) => {
    const found = Object.entries(byPath).find(([key]) => file === `/workspace/${key}`.replace(/\/$/, ''));
    if (found === undefined) return undefined;
    return typeof found[1] === 'string' ? found[1] : JSON.stringify(found[1]);
  };
}

const lock = (packages: Record<string, unknown>) => ({ lockfileVersion: 3, packages });

test('a clean lockfile passes', () => {
  const violations = validateLockfileExtraneous(
    [root, cluster],
    reader({
      'package-lock.json': lock({ '': { name: 'workspace' }, 'node_modules/left-pad': { version: '1.0.0' } }),
      'hardhat/v3/package-lock.json': lock({ '': { name: '@fhevm/hh-v3' } }),
    }),
  );
  assert.deepEqual(violations, []);
});

test('an extraneous node fails, named by the lockfile that carries it', () => {
  const violations = validateLockfileExtraneous(
    [cluster],
    reader({
      'hardhat/v3/package-lock.json': lock({
        '': { name: '@fhevm/hh-v3' },
        '../../host-contracts-cleartext/v13/pkg': { name: '@fhevm/host-contracts-cleartext', extraneous: true },
        '../../host-contracts-cleartext/v14/pkg': { name: '@fhevm/host-contracts-cleartext' },
      }),
    }),
  );

  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.rule, '6.1.2');
  // The clickable file, not the package directory.
  assert.equal(violations[0]?.packageKey, './hardhat/v3/package-lock.json');
  assert.match(violations[0]?.message ?? '', /'\.\.\/\.\.\/host-contracts-cleartext\/v13\/pkg' is marked/);
  assert.match(violations[0]?.message ?? '', /rm -rf node_modules package-lock\.json && npm install/);
});

test('every extraneous node is reported, not just the first', () => {
  const violations = validateLockfileExtraneous(
    [root],
    reader({
      'package-lock.json': lock({
        '': { name: 'workspace' },
        'a/pkg': { extraneous: true },
        'b/pkg': { extraneous: true },
        'c/pkg': {},
      }),
    }),
  );
  assert.equal(violations.length, 2);
  assert.deepEqual(
    violations.map((violation) => violation.message.split("'")[1]),
    ['a/pkg', 'b/pkg'],
  );
});

test('a package with no lockfile is skipped rather than failed', () => {
  assert.deepEqual(
    validateLockfileExtraneous([root, cluster], () => undefined),
    [],
  );
});

test('the legacy nested shape is read too, so an old lockfile cannot pass vacuously', () => {
  const violations = validateLockfileExtraneous(
    [root],
    reader({
      'package-lock.json': {
        lockfileVersion: 1,
        dependencies: {
          keep: { version: '1.0.0' },
          stale: { version: '2.0.0', extraneous: true, dependencies: { buried: { extraneous: true } } },
        },
      },
    }),
  );
  assert.deepEqual(
    violations.map((violation) => violation.message.split("'")[1]),
    ['stale', 'stale > buried'],
  );
});

test('a malformed lockfile is a violation, not a crash', () => {
  const violations = validateLockfileExtraneous([root], reader({ 'package-lock.json': '{ not json' }));
  assert.equal(violations.length, 1);
  assert.match(violations[0]?.message ?? '', /is not valid JSON/);
});

test('extraneousNodes reads both shapes and ignores everything else', () => {
  assert.deepEqual(extraneousNodes({ packages: { 'x/y': { extraneous: true } } }), ['x/y']);
  // Only the literal `true`: npm never writes anything else, and a truthy string is not a claim.
  assert.deepEqual(extraneousNodes({ packages: { 'x/y': { extraneous: 'yes' } } }), []);
  assert.deepEqual(extraneousNodes({ packages: { '': { extraneous: true } } }), ['<root>']);
  assert.deepEqual(extraneousNodes({}), []);
  assert.deepEqual(extraneousNodes(null), []);
  assert.deepEqual(extraneousNodes('nonsense'), []);
});
