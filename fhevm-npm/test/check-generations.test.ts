import assert from 'node:assert/strict';
import test from 'node:test';

import {
  generationOf,
  liveGenerationNames,
  validateGenerationCleartextConfig,
  validateGenerationDependencies,
  validateGenerationMemberFlags,
  validateGenerationMirrorPatch,
  validateGenerationUpgradeSuite,
  validateGenerationVendoredDestinations,
} from '../base/checks/generations.ts';
import type { LoadedPackage } from '../base/npm.ts';
import { loadedPackage, parseTestNpmManifest } from './helpers.ts';

const FAMILY = 'host-contracts-cleartext';
const CURRENT = `./${FAMILY}/v13`;
const PREVIOUS = `./${FAMILY}/v12`;

// `null` means "no generations block at all"; `undefined` would select the default parameter instead.
function manifest(
  generations: Record<string, unknown> | null = { [FAMILY]: { current: CURRENT, previous: PREVIOUS } },
) {
  return parseTestNpmManifest({
    ...(generations === null ? {} : { generations }),
    packageJson: { published: { required: ['name'], excluded: ['private'] } },
    packages: {
      '.': { kind: 'workspace-root', name: 'workspace', private: true, member: false },
      [PREVIOUS]: dev('v12'),
      [`${PREVIOUS}/pkg`]: { kind: 'published', name: '@fhevm/host-contracts-cleartext', member: false },
      [CURRENT]: dev('v13'),
      [`${CURRENT}/pkg`]: { kind: 'published', name: '@fhevm/host-contracts-cleartext', member: true },
      [`./${FAMILY}/v11`]: dev('v11'),
      [`./${FAMILY}/v11/pkg`]: { kind: 'published', name: '@fhevm/host-contracts-cleartext', member: false },
      './hardhat/v3': { kind: 'workspace-root', name: '@fhevm/hh-v3-cluster', private: true, member: false },
      './hardhat/v3/plugin/pkg': {
        kind: 'published',
        name: '@fhevm/hardhat-plugin',
        member: true,
        memberOf: './hardhat/v3',
      },
    },
  });
}

function dev(gen: string) {
  return {
    kind: 'dev',
    name: `@fhevm/host-contracts-cleartext-${gen}-dev`,
    private: true,
    member: true,
    publishedRelPath: `./${FAMILY}/${gen}/pkg`,
  } as const;
}

function devPackage(gen: string, devDependencies: Record<string, string> = {}): LoadedPackage {
  return loadedPackage(`./${FAMILY}/${gen}`, dev(gen), {
    name: `@fhevm/host-contracts-cleartext-${gen}-dev`,
    private: true,
    version: '0.0.0',
    devDependencies,
  });
}

function payload(gen: string, version: string, member: boolean): LoadedPackage {
  return loadedPackage(
    `./${FAMILY}/${gen}/pkg`,
    { kind: 'published', name: '@fhevm/host-contracts-cleartext', member },
    { name: '@fhevm/host-contracts-cleartext', version },
  );
}

function plugin(dependencies: Record<string, string>): LoadedPackage {
  return loadedPackage(
    './hardhat/v3/plugin/pkg',
    { kind: 'published', name: '@fhevm/hardhat-plugin', member: true, memberOf: './hardhat/v3' },
    { name: '@fhevm/hardhat-plugin', version: '0.13.0', dependencies },
  );
}

const root = loadedPackage(
  '.',
  { kind: 'workspace-root', name: 'workspace', private: true, member: false },
  { name: 'workspace', private: true },
);

test('classifies inventory keys by generation', () => {
  const family = { family: FAMILY, current: CURRENT, previous: PREVIOUS };
  assert.equal(generationOf(family, CURRENT), 'current');
  assert.equal(generationOf(family, `${CURRENT}/pkg`), 'current');
  assert.equal(generationOf(family, `${CURRENT}/test-consumer/esm`), 'current');
  assert.equal(generationOf(family, PREVIOUS), 'previous');
  assert.equal(generationOf(family, `./${FAMILY}/v11/pkg`), 'other');
  assert.equal(generationOf(family, `./${FAMILY}/v130`), 'other');
  assert.equal(generationOf(family, './hardhat/v3/plugin/pkg'), undefined);
  assert.equal(generationOf({ ...family, previous: undefined }, PREVIOUS), 'other');
});

test('accepts the intended edges: consumers on V(N), V(N) on V(N-1), a generation on itself', () => {
  const packages = [
    root,
    devPackage('v12'),
    payload('v12', '0.12.0', false),
    devPackage('v13', { '@fhevm/host-contracts-cleartext-v12-dev': '0.0.0' }),
    payload('v13', '0.13.0', true),
    loadedPackage(
      `${CURRENT}/test-consumer/esm`,
      { kind: 'standalone', name: 'consumer-esm', member: false },
      { name: 'consumer-esm', dependencies: { '@fhevm/host-contracts-cleartext': 'file:../../pkg' } },
    ),
    loadedPackage(
      `${PREVIOUS}/test-consumer/esm`,
      { kind: 'standalone', name: 'consumer-esm-v12', member: false },
      { name: 'consumer-esm-v12', dependencies: { '@fhevm/host-contracts-cleartext': 'file:../../pkg' } },
    ),
    plugin({ '@fhevm/host-contracts-cleartext': `file:../../../../${FAMILY}/v13/pkg` }),
  ];
  assert.deepEqual(validateGenerationDependencies(manifest(), packages), []);
});

test('rejects a consumer pinned to V(N-1) by file path', () => {
  const packages = [
    root,
    devPackage('v12'),
    payload('v12', '0.12.0', false),
    devPackage('v13'),
    payload('v13', '0.13.0', true),
    plugin({ '@fhevm/host-contracts-cleartext': `file:../../../../${FAMILY}/v12/pkg` }),
  ];
  const violations = validateGenerationDependencies(manifest(), packages);
  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.rule, '3.4.1');
  assert.equal(violations[0]?.packageKey, './hardhat/v3/plugin/pkg');
  assert.match(violations[0]?.message ?? '', /targets \.\/host-contracts-cleartext\/v12\/pkg, V\(N-1\)/);
  assert.match(violations[0]?.message ?? '', /only the V\(N\) dev package '\.\/host-contracts-cleartext\/v13' itself/);
});

test('narrows the V(N)-on-V(N-1) exception to the dev package, the dev target, and devDependencies', () => {
  const base = [root, devPackage('v12'), payload('v12', '0.12.0', false), payload('v13', '0.13.0', true)];
  const currentDev = (packageJson: Record<string, unknown>): LoadedPackage =>
    loadedPackage(CURRENT, dev('v13'), {
      name: '@fhevm/host-contracts-cleartext-v13-dev',
      private: true,
      version: '0.0.0',
      ...packageJson,
    });

  // A runtime field would put V(N-1) on a shipping path.
  const runtime = validateGenerationDependencies(manifest(), [
    ...base,
    currentDev({ dependencies: { '@fhevm/host-contracts-cleartext-v12-dev': '0.0.0' } }),
  ]);
  assert.equal(runtime.length, 1);
  assert.equal(runtime[0]?.packageKey, CURRENT);
  assert.match(runtime[0]?.message ?? '', /from 'dependencies'; V\(N-1\) exists only to be tested against/);

  // V(N-1)'s payload is not the dev package, even reached from V(N) itself.
  const onPayload = validateGenerationDependencies(manifest(), [
    ...base,
    currentDev({ devDependencies: { '@fhevm/host-contracts-cleartext': `file:../v12/pkg` } }),
  ]);
  assert.equal(onPayload.length, 1);
  assert.match(
    onPayload[0]?.message ?? '',
    /dev package '\.\/host-contracts-cleartext\/v12' only, not on a package below it/,
  );

  // A package BELOW V(N) is not V(N) itself.
  const fromPayload = validateGenerationDependencies(manifest(), [
    root,
    devPackage('v12'),
    payload('v12', '0.12.0', false),
    devPackage('v13'),
    loadedPackage(
      `${CURRENT}/pkg`,
      { kind: 'published', name: '@fhevm/host-contracts-cleartext', member: true },
      {
        name: '@fhevm/host-contracts-cleartext',
        version: '0.13.0',
        devDependencies: { '@fhevm/host-contracts-cleartext-v12-dev': '0.0.0' },
      },
    ),
  ]);
  assert.equal(fromPayload.length, 1);
  assert.equal(fromPayload[0]?.packageKey, `${CURRENT}/pkg`);
  assert.match(fromPayload[0]?.message ?? '', /only the V\(N\) dev package .* itself may depend on V\(N-1\)/);
});

test('rejects a consumer depending on the V(N-1) dev package by name, and V(N-1) is not exempt toward a retired one', () => {
  const packages = [
    root,
    devPackage('v11'),
    devPackage('v12', { '@fhevm/host-contracts-cleartext-v11-dev': '0.0.0' }),
    devPackage('v13'),
    payload('v13', '0.13.0', true),
    loadedPackage(
      './common',
      { kind: 'shared-helper', name: '@fhevm/sdk-common-dev', private: true, member: true },
      {
        name: '@fhevm/sdk-common-dev',
        private: true,
        devDependencies: { '@fhevm/host-contracts-cleartext-v12-dev': '0.0.0' },
      },
    ),
  ];
  const violations = validateGenerationDependencies(manifest(), packages);
  assert.deepEqual(
    violations.map((violation) => [violation.packageKey, violation.rule]),
    [
      [PREVIOUS, '3.4.1'],
      ['./common', '3.4.1'],
    ],
  );
  assert.match(violations[0]?.message ?? '', /neither V\(N\) nor V\(N-1\)/);
});

test('resolves a shared published name by exact version, and reports a range it cannot place', () => {
  const packages = [
    root,
    devPackage('v12'),
    payload('v12', '0.12.0', false),
    devPackage('v13'),
    payload('v13', '0.13.0', true),
    plugin({ '@fhevm/host-contracts-cleartext': '0.13.0' }),
  ];
  assert.deepEqual(validateGenerationDependencies(manifest(), packages), []);

  const onPrevious = [...packages.slice(0, -1), plugin({ '@fhevm/host-contracts-cleartext': '0.12.0' })];
  assert.equal(validateGenerationDependencies(manifest(), onPrevious).length, 1);

  const ranged = [...packages.slice(0, -1), plugin({ '@fhevm/host-contracts-cleartext': '^0.13.0' })];
  const violations = validateGenerationDependencies(manifest(), ranged);
  assert.equal(violations.length, 1);
  assert.match(violations[0]?.message ?? '', /shared by 2 generations/);
  assert.match(violations[0]?.message ?? '', /use a file: path to V\(N\)/);
});

test("requires V(N)'s payload to be the member and V(N-1)'s not to be", () => {
  // The fixture manifest is already the intended state: v13/pkg member, v12/pkg not.
  assert.deepEqual(validateGenerationMemberFlags(manifest()), []);

  // The flag a rotation forgets: the pair moves on, and the retired payload keeps claiming the shared
  // published name while the new V(N)'s payload is left out of every installation root.
  const stale = manifest({ [FAMILY]: { current: `./${FAMILY}/v11`, previous: CURRENT } });
  const violations = validateGenerationMemberFlags(stale);
  assert.equal(violations.length, 2);
  assert.deepEqual(
    violations.map((violation) => [violation.packageKey, violation.rule]),
    [
      [`./${FAMILY}/v11/pkg`, '3.4.4'],
      [`${CURRENT}/pkg`, '3.4.4'],
    ],
  );
  assert.match(violations[0]?.message ?? '', /must set 'member': true, not false/);
  assert.match(violations[0]?.message ?? '', /the directory the shared published name resolves to/);
  assert.match(violations[1]?.message ?? '', /must set 'member': false, not true/);

  // A single-generation family constrains only V(N).
  assert.deepEqual(validateGenerationMemberFlags(manifest({ [FAMILY]: { current: CURRENT } })), []);
  assert.equal(validateGenerationMemberFlags(manifest({ [FAMILY]: { current: PREVIOUS } })).length, 1);

  // Without a generations block there is no pair to constrain.
  assert.deepEqual(validateGenerationMemberFlags(manifest(null)), []);
});

test('is a no-op without a generations block', () => {
  const packages = [
    root,
    devPackage('v13'),
    plugin({ '@fhevm/host-contracts-cleartext': `file:../../../../${FAMILY}/v12/pkg` }),
  ];
  assert.deepEqual(validateGenerationDependencies(manifest(null), packages), []);
});

test('requires the upgrade suite on V(N) and forbids it on V(N-1)', () => {
  const withSuite = (gen: string, script?: string): LoadedPackage =>
    loadedPackage(`./${FAMILY}/${gen}`, dev(gen), {
      name: `@fhevm/host-contracts-cleartext-${gen}-dev`,
      private: true,
      version: '0.0.0',
      scripts: { test: 'npm run test:forge', ...(script === undefined ? {} : { 'test:upgrade': script }) },
    });

  // The intended arrangement: V(N) owns the suite that needs a live V(N-1).
  assert.deepEqual(
    validateGenerationUpgradeSuite(manifest(), [
      root,
      withSuite('v12'),
      withSuite('v13', 'node internal/cli/runUpgradeE2e.ts'),
    ]),
    [],
  );

  // V(N) without it: the migration consumers will run is the one thing untested.
  const missing = validateGenerationUpgradeSuite(manifest(), [root, withSuite('v12'), withSuite('v13')]);
  assert.deepEqual(
    missing.map((violation) => [violation.rule, violation.packageKey]),
    [['3.4.5', CURRENT]],
  );
  assert.match(missing[0]?.message ?? '', /must define a non-empty 'test:upgrade' script/);

  // Left behind on V(N-1) after a rotation: nothing invokes it, so nothing fails.
  const leftover = validateGenerationUpgradeSuite(manifest(), [
    root,
    withSuite('v12', 'node internal/cli/runUpgradeE2e.ts'),
    withSuite('v13', 'node internal/cli/runUpgradeE2e.ts'),
  ]);
  assert.deepEqual(
    leftover.map((violation) => [violation.rule, violation.packageKey]),
    [['3.4.5', PREVIOUS]],
  );
  assert.match(leftover[0]?.message ?? '', /must not define 'test:upgrade'/);

  // An empty command is not a suite.
  assert.equal(validateGenerationUpgradeSuite(manifest(), [root, withSuite('v12'), withSuite('v13', '  ')]).length, 1);

  // No V(N-1) to upgrade from, and no generations at all: nothing to require.
  assert.deepEqual(
    validateGenerationUpgradeSuite(manifest({ [FAMILY]: { current: CURRENT } }), [root, withSuite('v13')]),
    [],
  );
  assert.deepEqual(validateGenerationUpgradeSuite(manifest(null), [root, withSuite('v13')]), []);
});

test('accepts vendored destinations under V(N) and V(N-1), rejects one under a retired generation', () => {
  const live = [
    { to: [`${FAMILY}/v13/pkg/ts/types`, `${FAMILY}/v12/pkg/ts/types`] },
    { to: [`${FAMILY}/v13/pkg/ts`, `${FAMILY}/v12/pkg/ts`] },
    { to: ['hardhat/v3/plugin/pkg/src/internal/vendored'] },
  ];
  assert.deepEqual(validateGenerationVendoredDestinations(manifest(), live), []);

  // A wholly retired entry is reported once, as something to retarget — not also as missing each live
  // generation, which would triple the noise for one stale line.
  const stale = [...live, { to: [`${FAMILY}/v11/pkg/ts`] }];
  const violations = validateGenerationVendoredDestinations(manifest(), stale);
  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.rule, '3.4.2');
  assert.equal(violations[0]?.packageKey, `./${FAMILY}/v11/pkg/ts`);
  assert.match(violations[0]?.message ?? '', /not under V\(N\) '\.\/host-contracts-cleartext\/v13' or V\(N-1\)/);

  assert.deepEqual(validateGenerationVendoredDestinations(manifest(null), stale), []);
});

test('requires every live generation to be among the directories that receive a face', () => {
  // The half-rotated entry: one generation retargeted, the other left behind.
  const halfRotated = validateGenerationVendoredDestinations(manifest(), [
    { to: [`${FAMILY}/v13/pkg/ts`, `${FAMILY}/v11/pkg/ts`] },
  ]);
  assert.deepEqual(
    halfRotated.map((violation) => [violation.rule, violation.packageKey]),
    [
      ['3.4.2', `./${FAMILY}/v11/pkg/ts`],
      ['3.4.2', `${PREVIOUS}/pkg/ts`],
    ],
  );
  assert.match(halfRotated[1]?.message ?? '', /has no destination 'host-contracts-cleartext\/v12\/pkg\/ts'/);
  assert.match(halfRotated[1]?.message ?? '', /V\(N-1\) '\.\/host-contracts-cleartext\/v12' receives no copy/);

  // The rotation that adds nothing: the new V(N) is missing from an entry that still lists V(N-1).
  const notRotated = validateGenerationVendoredDestinations(
    manifest({ [FAMILY]: { current: `./${FAMILY}/v11`, previous: CURRENT } }),
    [{ to: [`${FAMILY}/v13/pkg/ts`] }],
  );
  assert.deepEqual(
    notRotated.map((violation) => violation.packageKey),
    [`./${FAMILY}/v11/pkg/ts`],
  );
  assert.match(notRotated[0]?.message ?? '', /V\(N\) '\.\/host-contracts-cleartext\/v11' receives no copy/);

  // One entry writes one face: mixing them cannot say which face a missing generation is owed.
  const mixed = validateGenerationVendoredDestinations(manifest(), [
    { to: [`${FAMILY}/v13/pkg/ts`, `${FAMILY}/v12/pkg/ts/types`] },
  ]);
  assert.equal(mixed.length, 1);
  assert.match(mixed[0]?.message ?? '', /writes one set of files into 2 different faces/);

  // A family the entry does not touch is unconstrained, and a single-generation family needs only V(N).
  assert.deepEqual(
    validateGenerationVendoredDestinations(manifest(), [{ to: ['hardhat/v3/plugin/pkg/src/internal/vendored'] }]),
    [],
  );
  assert.deepEqual(
    validateGenerationVendoredDestinations(manifest({ [FAMILY]: { current: CURRENT } }), [
      { to: [`${FAMILY}/v13/pkg/ts`] },
    ]),
    [],
  );
});

test('names the live generations by directory basename', () => {
  assert.deepEqual(liveGenerationNames({ family: FAMILY, current: CURRENT, previous: PREVIOUS }), ['v13', 'v12']);
  assert.deepEqual(liveGenerationNames({ family: FAMILY, current: CURRENT, previous: undefined }), ['v13']);
});

test('resolves what the mirror patch injects as an edge from the template package', () => {
  const template = loadedPackage(
    './hardhat/v2/fhevm-hardhat-template/pkg',
    {
      kind: 'published',
      name: 'fhevm-hardhat-template-v2',
      member: false,
      distribution: ['mirror'],
      mirror: { repository: 'https://github.com/example/template' },
    },
    { name: 'fhevm-hardhat-template-v2', version: '0.4.2' },
  );
  const packages = [
    root,
    devPackage('v12'),
    payload('v12', '0.12.0', false),
    devPackage('v13'),
    payload('v13', '0.13.0', true),
    template,
  ];
  const label = 'mirror patch';

  const onCurrent = { devDependencies: { '@fhevm/host-contracts-cleartext': `file:../../../../${FAMILY}/v13/pkg` } };
  assert.deepEqual(validateGenerationMirrorPatch(manifest(), packages, template.key, onCurrent, label), []);

  const onPrevious = { devDependencies: { '@fhevm/host-contracts-cleartext': `file:../../../../${FAMILY}/v12/pkg` } };
  const violations = validateGenerationMirrorPatch(manifest(), packages, template.key, onPrevious, label);
  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.rule, '3.4.1');
  assert.equal(violations[0]?.packageKey, template.key);
  assert.match(violations[0]?.message ?? '', /^mirror patch: package '@fhevm\/host-contracts-cleartext'/);
  assert.match(violations[0]?.message ?? '', /V\(N-1\)/);

  const missing = validateGenerationMirrorPatch(manifest(), packages, './hardhat/v2/nowhere/pkg', onCurrent, label);
  assert.equal(missing.length, 1);
  assert.match(missing[0]?.message ?? '', /not a manifest package/);
});

test('requires cleartext-config.json#appliesTo.generations to be exactly the live generations', () => {
  assert.deepEqual(validateGenerationCleartextConfig(manifest(), FAMILY, ['v12', 'v13']), []);
  assert.deepEqual(validateGenerationCleartextConfig(manifest(), FAMILY, ['v13', 'v12']), []);

  const stale = validateGenerationCleartextConfig(manifest(), FAMILY, ['v11', 'v12', 'v13']);
  assert.deepEqual(
    stale.map((violation) => [violation.rule, violation.packageKey]),
    [['3.4.3', './cleartext-config.json']],
  );
  assert.match(stale[0]?.message ?? '', /lists 'v11', which is not a live generation/);

  const omitted = validateGenerationCleartextConfig(manifest(), FAMILY, ['v13']);
  assert.deepEqual(
    omitted.map((violation) => [violation.rule, violation.packageKey]),
    [['3.4.3', './cleartext-config.json']],
  );
  assert.match(omitted[0]?.message ?? '', /omits live generation 'v12'/);
  // The generation that goes without a face is named in the message, since the key names the file to edit.
  assert.match(omitted[0]?.message ?? '', /\.\/host-contracts-cleartext\/v12 would receive no generated face/);

  assert.deepEqual(validateGenerationCleartextConfig(manifest(), 'other-family', ['v1']), []);
  assert.deepEqual(validateGenerationCleartextConfig(manifest(null), FAMILY, ['v11']), []);
});
