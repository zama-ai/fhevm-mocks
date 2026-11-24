import assert from 'node:assert/strict';
import test from 'node:test';

import { validatePackageNames } from '../base/checks/package-names.ts';
import { loadedPackage } from './helpers.ts';

test('accepts the -dev convention and matching manifest names', () => {
  const violations = validatePackageNames([
    loadedPackage(
      './feature',
      { kind: 'shared-helper', name: '@scope/feature-dev', private: true, member: true },
      { name: '@scope/feature-dev', private: true, version: '0.0.0' },
    ),
  ]);
  assert.deepEqual(violations, []);
});

test('reports suffix, privacy, and inventory mismatches', () => {
  const violations = validatePackageNames([
    loadedPackage(
      './feature',
      { kind: 'shared-helper', name: '@scope/feature-dev', private: true, member: true },
      { name: '@scope/feature', version: '0.0.0' },
    ),
  ]);
  // NR-40 for the missing private flag and the -dev suffix; no rule says the name equals the manifest's.
  assert.deepEqual(violations.map((violation) => violation.rule).sort(), ['NR-40', 'NR-40', 'package-name']);
});

test('a published package that sets private breaks the published field policy', () => {
  const violations = validatePackageNames([
    loadedPackage(
      './library/pkg',
      { kind: 'published', name: '@scope/library', member: false },
      { name: '@scope/library', private: true },
    ),
  ]);
  assert.deepEqual(
    violations.map((violation) => [violation.rule, violation.message]),
    [['NR-09', 'a published package cannot set private: true']],
  );
});

test('reports missing and nonzero private development package versions', () => {
  const violations = validatePackageNames([
    loadedPackage(
      './missing-version',
      { kind: 'dev', name: '@scope/missing-version-dev', private: true, member: true },
      { name: '@scope/missing-version-dev', private: true },
    ),
    loadedPackage(
      './released-version',
      { kind: 'internal-consumer', name: '@scope/released-version-dev', private: true, member: true },
      { name: '@scope/released-version-dev', private: true, version: '1.2.3' },
    ),
  ]);

  assert.deepEqual(violations, [
    {
      rule: 'NR-01',
      packageKey: './missing-version/package.json',
      message: 'private development package version <missing> must be "0.0.0"',
    },
    {
      rule: 'NR-01',
      packageKey: './released-version/package.json',
      message: 'private development package version "1.2.3" must be "0.0.0"',
    },
  ]);
});
