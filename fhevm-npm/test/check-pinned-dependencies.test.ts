import assert from 'node:assert/strict';
import test from 'node:test';

import { validatePinnedDependencies } from '../base/checks/pinned-dependencies.ts';
import { loadedPackage, parseTestNpmManifest } from './helpers.ts';

function manifestWithPin(pinned?: Record<string, string>) {
  return parseTestNpmManifest({
    dependencies: { forbidden: ['solhint'], ...(pinned === undefined ? {} : { pinned }) },
    packageJson: { published: { required: ['name', 'version'], excluded: ['private'] } },
    packages: {
      '.': { kind: 'workspace-root', name: 'workspace', private: true, member: false },
      './plugin': { kind: 'standalone', name: 'plugin-dev', private: true, member: false },
      './plugin/pkg': { kind: 'standalone', name: 'plugin', private: true, member: false },
    },
  });
}

const root = (manifest: ReturnType<typeof manifestWithPin>) =>
  loadedPackage('.', manifest.packages['.']!, { name: 'workspace', private: true });

test('rule 3.3.4 accepts a pinned dependency repeated verbatim in every field that declares it', () => {
  const manifest = manifestWithPin({ '@fhevm/sdk': '^0.13.3' });
  const packages = [
    root(manifest),
    loadedPackage('./plugin', manifest.packages['./plugin']!, {
      name: 'plugin-dev',
      private: true,
      devDependencies: { '@fhevm/sdk': '^0.13.3' },
    }),
    loadedPackage('./plugin/pkg', manifest.packages['./plugin/pkg']!, {
      name: 'plugin',
      private: true,
      peerDependencies: { '@fhevm/sdk': '^0.13.3' },
    }),
  ];

  assert.deepEqual(
    validatePinnedDependencies(manifest, packages, () => undefined),
    [],
  );
});

test('rule 3.3.4 rejects a spec that differs from the pin, including one that only differs by range operator', () => {
  const manifest = manifestWithPin({ '@fhevm/sdk': '^0.13.3' });
  const packages = [
    root(manifest),
    loadedPackage('./plugin', manifest.packages['./plugin']!, {
      name: 'plugin-dev',
      private: true,
      devDependencies: { '@fhevm/sdk': '0.13.3' },
    }),
    loadedPackage('./plugin/pkg', manifest.packages['./plugin/pkg']!, {
      name: 'plugin',
      private: true,
      peerDependencies: { '@fhevm/sdk': '^0.13.2' },
    }),
  ];

  const violations = validatePinnedDependencies(manifest, packages, () => undefined);
  assert.equal(violations.length, 2);
  assert.deepEqual(
    violations.map((violation) => violation.packageKey),
    ['./plugin/package.json', './plugin/pkg/package.json'],
  );
  assert.equal(violations[0]?.rule, '3.3.4');
  assert.match(violations[0]?.message ?? '', /'devDependencies' is "0\.13\.3"; .*requires "\^0\.13\.3"/);
  assert.match(violations[1]?.message ?? '', /'peerDependencies' is "\^0\.13\.2"; .*requires "\^0\.13\.3"/);
});

test('rule 3.3.4 reports every offending field of one package separately', () => {
  const manifest = manifestWithPin({ '@fhevm/sdk': '^0.13.3' });
  const packages = [
    root(manifest),
    loadedPackage('./plugin', manifest.packages['./plugin']!, {
      name: 'plugin-dev',
      private: true,
      dependencies: { '@fhevm/sdk': '0.13.1' },
      devDependencies: { '@fhevm/sdk': '0.13.2' },
    }),
  ];

  const violations = validatePinnedDependencies(manifest, packages, () => undefined);
  assert.equal(violations.length, 2);
  assert.deepEqual(
    violations.map((violation) => violation.rule),
    ['3.3.4', '3.3.4'],
  );
});

test('rule 3.3.4 ignores a package that does not declare the pinned dependency at all', () => {
  const manifest = manifestWithPin({ '@fhevm/sdk': '^0.13.3' });
  const packages = [
    root(manifest),
    loadedPackage('./plugin', manifest.packages['./plugin']!, {
      name: 'plugin-dev',
      private: true,
      devDependencies: { '@fhevm/sdk': '^0.13.3' },
    }),
    loadedPackage('./plugin/pkg', manifest.packages['./plugin/pkg']!, { name: 'plugin', private: true }),
  ];

  assert.deepEqual(
    validatePinnedDependencies(manifest, packages, () => undefined),
    [],
  );
});

test('rule 3.3.4 rejects a pin that no inventoried package declares', () => {
  const manifest = manifestWithPin({ '@fhevm/sdk': '^0.13.3' });
  const packages = [
    root(manifest),
    loadedPackage('./plugin', manifest.packages['./plugin']!, { name: 'plugin-dev', private: true }),
  ];

  const violations = validatePinnedDependencies(manifest, packages, () => undefined);
  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.packageKey, './npm-manifest.json');
  assert.match(violations[0]?.message ?? '', /is unused/);
});

test('rule 3.3.4 rejects a lockfile still mirroring a pre-alignment spec', () => {
  const manifest = manifestWithPin({ '@fhevm/sdk': '^0.13.4' });
  const packages = [
    root(manifest),
    loadedPackage('./plugin', manifest.packages['./plugin']!, {
      name: 'plugin-dev',
      private: true,
      devDependencies: { '@fhevm/sdk': '^0.13.4' },
    }),
  ];
  const readLockfile = (file: string) =>
    file === '/workspace/plugin/package-lock.json'
      ? { '': { devDependencies: { '@fhevm/sdk': '^0.13.3' } } }
      : undefined;

  const violations = validatePinnedDependencies(manifest, packages, readLockfile);
  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.packageKey, './plugin/package-lock.json');
  assert.match(violations[0]?.message ?? '', /stale lockfile: '@fhevm\/sdk' in 'devDependencies' of '\.'/);
});

test('rule 3.3.4 ignores resolved node_modules entries inside a lockfile', () => {
  const manifest = manifestWithPin({ '@fhevm/sdk': '^0.13.4' });
  const packages = [
    root(manifest),
    loadedPackage('./plugin', manifest.packages['./plugin']!, {
      name: 'plugin-dev',
      private: true,
      devDependencies: { '@fhevm/sdk': '^0.13.4' },
    }),
  ];
  const readLockfile = () => ({
    '': { devDependencies: { '@fhevm/sdk': '^0.13.4' } },
    'node_modules/some-dep': { dependencies: { '@fhevm/sdk': '^0.13.1' } },
  });

  assert.deepEqual(validatePinnedDependencies(manifest, packages, readLockfile), []);
});

const pluginDeclaring = (manifest: ReturnType<typeof manifestWithPin>, pins: Record<string, string>) =>
  loadedPackage('./plugin', manifest.packages['./plugin']!, {
    name: 'plugin-dev',
    private: true,
    devDependencies: pins,
  });

test('rule 3.3.4 accepts every copy a lockfile resolves at exactly the pinned version', () => {
  const manifest = manifestWithPin({ '@scope/pkg': '^1.2.3' });
  const packages = [root(manifest), pluginDeclaring(manifest, { '@scope/pkg': '^1.2.3' })];
  const readLockfile = () => ({
    '': { devDependencies: { '@scope/pkg': '^1.2.3' } },
    'node_modules/@scope/pkg': { version: '1.2.3' },
    'node_modules/other/node_modules/@scope/pkg': { version: '1.2.3' },
  });

  assert.deepEqual(validatePinnedDependencies(manifest, packages, readLockfile), []);
});

test('rule 3.3.4 rejects a lockfile that resolves a newer version than the pin, and says to move the pin', () => {
  // Every package.json says ^1.2.2, so the declared half passes; the root was locked after 1.2.3 shipped.
  const manifest = manifestWithPin({ '@scope/pkg': '^1.2.2' });
  const packages = [root(manifest), pluginDeclaring(manifest, { '@scope/pkg': '^1.2.2' })];
  const readLockfile = (file: string) =>
    file === '/workspace/package-lock.json'
      ? { '': {}, 'node_modules/@scope/pkg': { version: '1.2.3' } }
      : file === '/workspace/plugin/package-lock.json'
        ? { '': { devDependencies: { '@scope/pkg': '^1.2.2' } }, 'node_modules/@scope/pkg': { version: '1.2.2' } }
        : undefined;

  const violations = validatePinnedDependencies(manifest, packages, readLockfile);
  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.rule, '3.3.4');
  assert.equal(violations[0]?.packageKey, './package-lock.json');
  assert.match(violations[0]?.message ?? '', /'@scope\/pkg' resolves to 1\.2\.3 .*newer than its pin "\^1\.2\.2"/);
  assert.match(violations[0]?.message ?? '', /Move it to "\^1\.2\.3" in npm-manifest\.json#dependencies\.pinned/);
});

test('rule 3.3.4 rejects a lockfile left behind a moved pin, naming the re-lock', () => {
  const manifest = manifestWithPin({ '@scope/pkg': '^1.2.3' });
  const packages = [root(manifest), pluginDeclaring(manifest, { '@scope/pkg': '^1.2.3' })];
  const readLockfile = (file: string) =>
    file === '/workspace/package-lock.json'
      ? { '': {}, 'node_modules/@scope/pkg': { version: '1.2.2' } }
      : file === '/workspace/plugin/package-lock.json'
        ? { '': {}, 'node_modules/@scope/pkg': { version: '1.2.2' } }
        : undefined;

  const violations = validatePinnedDependencies(manifest, packages, readLockfile);
  assert.deepEqual(
    violations.map((violation) => violation.packageKey),
    ['./package-lock.json', './plugin/package-lock.json'],
  );
  // An installation root is re-locked by npm; './plugin' is a standalone fixture here, re-locked by fhevm-npm.
  assert.match(
    violations[0]?.message ?? '',
    /not the pinned 1\.2\.3 .*delete its 'node_modules\/@scope\/pkg' entry from \.\/package-lock\.json, then run 'npm install --package-lock-only' in the repository root/,
  );
  assert.match(violations[1]?.message ?? '', /test-consumer-regenerate-package-lock \.\/plugin'/);
});

test('rule 3.3.4 checks nested copies inside one lockfile too', () => {
  const manifest = manifestWithPin({ '@scope/pkg': '^1.2.3' });
  const packages = [root(manifest), pluginDeclaring(manifest, { '@scope/pkg': '^1.2.3' })];
  // Only the root has a lockfile; one copy in it is nested under another dependency.
  const readLockfile = (file: string) =>
    file === '/workspace/package-lock.json'
      ? {
          '': {},
          'node_modules/@scope/pkg': { version: '1.2.3' },
          'node_modules/some-dep/node_modules/@scope/pkg': { version: '1.2.4' },
        }
      : undefined;

  const violations = validatePinnedDependencies(manifest, packages, readLockfile);
  assert.equal(violations.length, 1);
  assert.match(violations[0]?.message ?? '', /at 'node_modules\/some-dep\/node_modules\/@scope\/pkg'/);
});

test('rule 3.3.4 checks an npm alias against its own pin, apart from the bare name it aliases', () => {
  // @scope/pkg-prev1 installs @scope/pkg@0.13.x under the alias: a line of its own, pinned on its own.
  const pins = { '@scope/pkg': '^1.2.3', '@scope/pkg-prev1': 'npm:@scope/pkg@^1.1.7' };
  const manifest = manifestWithPin(pins);
  const packages = [root(manifest), pluginDeclaring(manifest, pins)];
  const lock = (prev1: string) => () => ({
    '': {},
    'node_modules/@scope/pkg': { version: '1.2.3' },
    'node_modules/@scope/pkg-prev1': { name: '@scope/pkg', version: prev1 },
  });

  assert.deepEqual(validatePinnedDependencies(manifest, packages, lock('1.1.7')), []);

  const violations = validatePinnedDependencies(manifest, packages, lock('1.1.8'));
  assert.ok(violations.length > 0);
  assert.match(violations[0]?.message ?? '', /'@scope\/pkg-prev1' resolves to 1\.1\.8/);
  assert.match(violations[0]?.message ?? '', /Move it to "npm:@scope\/pkg@\^1\.1\.8"/);
});

test('rule 3.3.4 is inert when the manifest pins nothing', () => {
  const manifest = manifestWithPin();
  const packages = [
    root(manifest),
    loadedPackage('./plugin', manifest.packages['./plugin']!, {
      name: 'plugin-dev',
      private: true,
      devDependencies: { '@fhevm/sdk': '0.1.0' },
    }),
  ];

  assert.deepEqual(
    validatePinnedDependencies(manifest, packages, () => undefined),
    [],
  );
});

test('rule 3.3.4 treats an npm alias as its own pin, keyed by the alias name, next to the bare name', () => {
  const manifest = manifestWithPin({ '@scope/pkg': '^1.2.2', '@scope/pkg-prev1': 'npm:@scope/pkg@^1.1.7' });
  const packages = [
    root(manifest),
    loadedPackage('./plugin', manifest.packages['./plugin']!, {
      name: 'plugin-dev',
      private: true,
      devDependencies: { '@scope/pkg': '^1.2.2', '@scope/pkg-prev1': 'npm:@scope/pkg@^1.1.7' },
    }),
  ];
  assert.deepEqual(
    validatePinnedDependencies(manifest, packages, () => undefined),
    [],
  );

  // The alias target is part of the spec: the same range under the bare name, or another range, is drift.
  const drifted = [
    root(manifest),
    loadedPackage('./plugin', manifest.packages['./plugin']!, {
      name: 'plugin-dev',
      private: true,
      devDependencies: { '@scope/pkg': '^1.2.2', '@scope/pkg-prev1': 'npm:@scope/pkg@^0.13.6' },
    }),
    loadedPackage('./plugin/pkg', manifest.packages['./plugin/pkg']!, {
      name: 'plugin',
      private: true,
      devDependencies: { '@scope/pkg-prev1': '^1.1.7' },
    }),
  ];
  const violations = validatePinnedDependencies(manifest, drifted, () => undefined);
  assert.deepEqual(
    violations.map((violation) => violation.packageKey),
    ['./plugin/package.json', './plugin/pkg/package.json'],
  );
  assert.match(
    violations[0]?.message ?? '',
    /is "npm:@scope\/pkg@\^0\.13\.6"; .*requires "npm:@scope\/pkg@\^1\.1\.7"/,
  );
});

test('the manifest accepts an npm alias of an exact, caret or tilde version', () => {
  for (const spec of ['npm:@scope/pkg@^1.1.7', 'npm:@scope/pkg@1.1.7', 'npm:@scope/pkg@~1.1.7', 'npm:viem@^2.0.0']) {
    assert.doesNotThrow(() => manifestWithPin({ alias: spec }), spec);
  }
});

test('the manifest rejects an npm alias whose target is not an exact, caret or tilde version', () => {
  assert.throws(() => manifestWithPin({ alias: 'npm:@scope/pkg@latest' }), /exact, caret, or tilde/);
  assert.throws(() => manifestWithPin({ alias: 'npm:@scope/pkg' }), /exact, caret, or tilde/);
  assert.throws(() => manifestWithPin({ alias: 'npm:@Fhevm/SDK@^1.1.7' }), /exact, caret, or tilde/);
  assert.throws(() => manifestWithPin({ alias: 'file:../sdk' }), /exact, caret, or tilde/);
});

test('the manifest rejects a pinned spec that is not an exact, caret or tilde version', () => {
  assert.throws(() => manifestWithPin({ '@fhevm/sdk': '>=0.13.3 <0.14.0' }), /exact, caret, or tilde/);
  assert.throws(() => manifestWithPin({ '@fhevm/sdk': 'latest' }), /exact, caret, or tilde/);
});

test('the manifest rejects an empty pinned map', () => {
  assert.throws(() => manifestWithPin({}), /must pin at least one package/);
});
