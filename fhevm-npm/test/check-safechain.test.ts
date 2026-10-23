import assert from 'node:assert/strict';
import test from 'node:test';

import { lockedPackages, parseMalwareList, validateSafechain } from '../base/checks/safechain.ts';
import type { Packument } from '../base/registry-age.ts';
import { parseCliOptions } from '../cli-options.ts';

const NOW = new Date('2026-10-23T12:00:00Z');

function packument(name: string, time: Record<string, string>): Packument {
  return { name, time, versions: Object.keys(time), deprecated: new Set() };
}

test('only registry downloads are checked, each under its real name', () => {
  const locked = lockedPackages('./package-lock.json', {
    '': { name: 'workspace' },
    common: { version: '0.0.0' },
    'node_modules/common': { link: true, resolved: 'common' },
    'node_modules/vitest': { version: '4.1.12', resolved: 'https://registry.npmjs.org/vitest/-/vitest-4.1.12.tgz' },
    'node_modules/a/node_modules/b': { version: '1.0.0', resolved: 'https://registry.npmjs.org/b/-/b-1.0.0.tgz' },
    'node_modules/alias': {
      name: 'real',
      version: '2.0.0',
      resolved: 'https://registry.npmjs.org/real/-/real-2.0.0.tgz',
    },
    'node_modules/local': { version: '1.0.0', resolved: 'file:../local' },
  });
  assert.deepEqual(
    locked.map((pkg) => `${pkg.name}@${pkg.version}`),
    ['vitest@4.1.12', 'b@1.0.0', 'real@2.0.0'],
  );
});

test('a version younger than the minimum age, or on the malware list, is a violation', () => {
  const locked = [
    { name: 'old', version: '1.0.0', lockfileKey: './package-lock.json' },
    { name: 'young', version: '1.2.15', lockfileKey: './package-lock.json' },
    { name: 'young', version: '1.2.15', lockfileKey: './package-lock.json' },
    { name: 'bad', version: '6.6.6', lockfileKey: './hardhat/v3/package-lock.json' },
    { name: 'ghost', version: '0.0.1', lockfileKey: './package-lock.json' },
  ];
  const packuments = new Map<string, Packument | undefined>([
    ['old', packument('old', { '1.0.0': '2026-01-01T00:00:00Z' })],
    ['young', packument('young', { '1.2.15': '2026-10-21T13:10:11Z' })],
    ['bad', packument('bad', { '6.6.6': '2026-01-01T00:00:00Z' })],
    ['ghost', undefined],
  ]);
  const violations = validateSafechain(locked, packuments, new Set(['bad@6.6.6']), 48, NOW);
  assert.deepEqual(
    violations.map((violation) => violation.packageKey),
    ['./package-lock.json', './hardhat/v3/package-lock.json', './package-lock.json'],
  );
  assert.match(
    violations[0]?.message ?? '',
    /young@1\.2\.15 was published 46\.8h ago .* until 2026-10-23T13:10:11\.000Z/,
  );
  assert.match(violations[1]?.message ?? '', /bad@6\.6\.6 is on Aikido's malware list/);
  assert.match(violations[2]?.message ?? '', /ghost@0\.0\.1: registry\.npmjs\.org records no publish time/);
  // Without the list, only the age is judged.
  assert.equal(validateSafechain(locked, packuments, undefined, 48, NOW).length, 2);
});

test("Aikido's feed is read as name@version pairs", () => {
  const list = parseMalwareList([
    { package_name: 'evil', version: '1.0.0', reason: 'MALWARE' },
    { package_name: 'broken' },
  ]);
  assert.deepEqual([...list], ['evil@1.0.0']);
  assert.throws(() => parseMalwareList({}), /expected a JSON array/);
});

test("'check safechain' defaults to safe-chain's 48 hours", () => {
  const plain = parseCliOptions(['check', 'safechain']);
  if (plain.command !== 'check-safechain') throw new Error('unreachable');
  assert.equal(plain.minAgeHours, 48);
  const tuned = parseCliOptions(['check', 'safechain', '--min-age-hours', '72']);
  if (tuned.command !== 'check-safechain') throw new Error('unreachable');
  assert.equal(tuned.minAgeHours, 72);
});
