import assert from 'node:assert/strict';
import test from 'node:test';

import { pinAvailability, unavailableDependencies } from '../base/pin-availability.ts';
import { parseTestNpmManifest } from './helpers.ts';

const REASON = 'no release for this generation yet';

function manifest(pin: string, unavailable?: Record<string, string>) {
  return parseTestNpmManifest({
    dependencies: {
      forbidden: ['solhint'],
      pinned: { '@ext/sdk': pin, other: '^1.0.0' },
      ...(unavailable === undefined ? {} : { unavailable }),
    },
    packageJson: { published: { required: ['name', 'version'], excluded: ['private'] } },
    packages: { '.': { kind: 'workspace-root', name: 'workspace', private: true, member: false } },
  });
}

test('a pinned dependency is available unless declared unavailable', () => {
  assert.deepEqual(pinAvailability(manifest('^0.15.0-3'), '@ext/sdk'), { available: true });
  assert.deepEqual(pinAvailability(manifest('^0.15.0-3', { '@ext/sdk': REASON }), 'other'), { available: true });
});

test('a dependency declared unavailable is unavailable, with its reason, while its pin is a registry version', () => {
  assert.deepEqual(pinAvailability(manifest('^0.15.0-3', { '@ext/sdk': REASON }), '@ext/sdk'), {
    available: false,
    reason: REASON,
  });
});

test('a tarball pin makes an unavailable dependency available: that is the development path', () => {
  assert.deepEqual(pinAvailability(manifest('file:../sdk-1.0.0-0.tgz', { '@ext/sdk': REASON }), '@ext/sdk'), {
    available: true,
  });
});

test('a package.json needs the unavailable dependencies it declares, in any field', () => {
  const m = manifest('^0.15.0-3', { '@ext/sdk': REASON });
  assert.deepEqual(unavailableDependencies(m, { name: 'consumer', devDependencies: { '@ext/sdk': '^0.15.0-3' } }), [
    { name: '@ext/sdk', reason: REASON },
  ]);
  assert.deepEqual(unavailableDependencies(m, { name: 'consumer', peerDependencies: { '@ext/sdk': '^0.15.0-3' } }), [
    { name: '@ext/sdk', reason: REASON },
  ]);
  assert.deepEqual(unavailableDependencies(m, { name: 'consumer', dependencies: { other: '^1.0.0' } }), []);
});

test('the manifest refuses an unavailable entry that is not pinned, or that gives no reason', () => {
  assert.throws(() => manifest('^0.15.0-3', { stranger: REASON }), /'stranger' is not pinned/);
  assert.throws(() => manifest('^0.15.0-3', { '@ext/sdk': '' }), /must say why/);
});
