import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { type LockfileReader, validatePinnedDependencies } from '../base/checks/pinned-dependencies.ts';
import type { LoadedPackage, PackageJson } from '../base/npm.ts';
import {
  applyPinnedEdits,
  planPinRaises,
  planPinnedSync,
  renderPinRaises,
  renderPinnedEdits,
  withRaisedPins,
} from '../base/sync-pinned.ts';
import { parseCliOptions } from '../cli-options.ts';
import { loadedPackage, parseTestNpmManifest } from './helpers.ts';

const PINS = { '@fhevm/sdk': '^0.13.6', '@fhevm/solidity': '^0.13.4' };

function manifestWithPins(pinned: Record<string, string> = PINS) {
  return parseTestNpmManifest({
    dependencies: { forbidden: ['solhint'], pinned },
    packageJson: { published: { required: ['name', 'version'], excluded: ['private'] } },
    packages: {
      '.': { kind: 'workspace-root', name: 'workspace', private: true, member: false },
      './plugin': { kind: 'standalone', name: 'plugin-dev', private: true, member: false },
      './plugin/pkg': { kind: 'standalone', name: 'plugin', private: true, member: false },
    },
  });
}

// Formatted the way the repository's package.json files are: two spaces, one entry per line.
const pluginText = `{
  "name": "plugin",
  "private": true,
  "dependencies": {
    "@fhevm/sdk": "^0.13.4",
    "picocolors": "^1.1.1"
  },
  "devDependencies": {
    "@fhevm/solidity": "^0.13.3",
    "hardhat": "^3.0.0"
  },
  "peerDependencies": {
    "@fhevm/sdk": "^0.13.4"
  }
}
`;

const pluginSynced = pluginText
  .replaceAll('"@fhevm/sdk": "^0.13.4"', '"@fhevm/sdk": "^0.13.6"')
  .replace('"@fhevm/solidity": "^0.13.3"', '"@fhevm/solidity": "^0.13.4"');

test('the plan lists every declaration of a pinned package that differs from its pin, and nothing else', () => {
  const manifest = manifestWithPins();
  const packages = [
    loadedPackage('.', manifest.packages['.']!, { name: 'workspace', private: true }),
    loadedPackage('./plugin', manifest.packages['./plugin']!, {
      name: 'plugin-dev',
      private: true,
      devDependencies: { '@fhevm/sdk': '^0.13.6', typescript: '^5.0.0' },
    }),
    loadedPackage('./plugin/pkg', manifest.packages['./plugin/pkg']!, JSON.parse(pluginText) as PackageJson),
  ];

  assert.deepEqual(
    planPinnedSync(manifest, packages).map(({ packageKey, field, name, from, to }) => ({
      packageKey,
      field,
      name,
      from,
      to,
    })),
    [
      {
        packageKey: './plugin/pkg/package.json',
        field: 'dependencies',
        name: '@fhevm/sdk',
        from: '^0.13.4',
        to: '^0.13.6',
      },
      {
        packageKey: './plugin/pkg/package.json',
        field: 'peerDependencies',
        name: '@fhevm/sdk',
        from: '^0.13.4',
        to: '^0.13.6',
      },
      {
        packageKey: './plugin/pkg/package.json',
        field: 'devDependencies',
        name: '@fhevm/solidity',
        from: '^0.13.3',
        to: '^0.13.4',
      },
    ],
  );
});

test('rendering replaces exactly the planned specs and leaves the file otherwise byte for byte', () => {
  const manifest = manifestWithPins();
  const pkg = loadedPackage('./plugin/pkg', manifest.packages['./plugin/pkg']!, JSON.parse(pluginText) as PackageJson);
  const edits = planPinnedSync(manifest, [pkg]);
  assert.equal(renderPinnedEdits('package.json', pluginText, edits), pluginSynced);
  // Idempotent: a synced file plans nothing.
  const synced = loadedPackage(
    './plugin/pkg',
    manifest.packages['./plugin/pkg']!,
    JSON.parse(pluginSynced) as PackageJson,
  );
  assert.deepEqual(planPinnedSync(manifest, [synced]), []);
});

test('rendering rewrites an npm alias spec like any other, and leaves the bare name next to it alone', () => {
  const manifest = manifestWithPins({ '@scope/pkg': '^1.2.2', '@scope/pkg-prev1': 'npm:@scope/pkg@^1.1.7' });
  const text = `{
  "name": "plugin",
  "private": true,
  "devDependencies": {
    "@scope/pkg": "^1.2.2",
    "@scope/pkg-prev1": "npm:@scope/pkg@^0.13.6"
  }
}
`;
  const pkg = loadedPackage('./plugin/pkg', manifest.packages['./plugin/pkg']!, JSON.parse(text) as PackageJson);
  const edits = planPinnedSync(manifest, [pkg]);
  assert.deepEqual(
    edits.map(({ name, from, to }) => ({ name, from, to })),
    [{ name: '@scope/pkg-prev1', from: 'npm:@scope/pkg@^0.13.6', to: 'npm:@scope/pkg@^1.1.7' }],
  );
  assert.equal(
    renderPinnedEdits('package.json', text, edits),
    text.replace('"npm:@scope/pkg@^0.13.6"', '"npm:@scope/pkg@^1.1.7"'),
  );
});

test('rendering refuses a file it cannot edit unambiguously, rather than guessing', () => {
  const edit = {
    file: 'package.json',
    packageKey: './plugin/pkg/package.json',
    field: 'devDependencies' as const,
    name: '@fhevm/solidity',
    from: '^0.13.3',
    to: '^0.13.4',
  };
  // The declaration is not where the plan says it is.
  assert.throws(
    () => renderPinnedEdits('package.json', pluginText, [{ ...edit, from: '^0.13.2' }]),
    /expected exactly one "@fhevm\/solidity": "\^0\.13\.2" in "devDependencies", found 0/,
  );
  // A dependency block written on one line has no line to edit.
  const inline = '{ "name": "plugin", "devDependencies": { "@fhevm/solidity": "^0.13.3" } }\n';
  assert.throws(
    () => renderPinnedEdits('package.json', inline, [edit]),
    /expected exactly one "devDependencies" block/,
  );
});

test('after a sync the package.json half of check pinned-dependencies passes, and the lockfiles are left alone', () => {
  const root = mkdtempSync(join(tmpdir(), 'sync-pinned-'));
  try {
    const manifest = manifestWithPins();
    const directory = join(root, 'plugin', 'pkg');
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'package.json'), pluginText);
    const lockText = '{ "packages": { "": { "dependencies": { "@fhevm/sdk": "^0.13.4" } } } }\n';
    writeFileSync(join(directory, 'package-lock.json'), lockText);
    const load = (): LoadedPackage => ({
      key: './plugin/pkg',
      directory,
      inventory: { ...manifest.packages['./plugin/pkg']!, type: 'esm', browser: false },
      packageJson: JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')) as PackageJson,
    });

    const before = validatePinnedDependencies(manifest, [load()]);
    assert.ok(before.some((v) => v.packageKey === './plugin/pkg/package.json'));

    applyPinnedEdits(planPinnedSync(manifest, [load()]));
    assert.equal(readFileSync(join(directory, 'package.json'), 'utf8'), pluginSynced);

    // Only the stale lockfile remains: npm's to regenerate, never this command's to edit.
    const after = validatePinnedDependencies(manifest, [load()]);
    assert.deepEqual(
      after.map((v) => v.packageKey),
      ['./plugin/pkg/package-lock.json'],
    );
    assert.equal(readFileSync(join(directory, 'package-lock.json'), 'utf8'), lockText);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a pin behind what a lockfile resolves is raised to the newest resolved version, operator and alias kept', () => {
  const manifest = manifestWithPins({
    '@scope/pkg': '^1.2.2',
    '@scope/pkg-prev1': 'npm:@scope/pkg@^1.1.7',
    '@fhevm/solidity': '^0.13.4',
    exact: '5.1.0',
  });
  const packages = [
    loadedPackage('.', manifest.packages['.']!, { name: 'workspace', private: true }),
    loadedPackage('./plugin', manifest.packages['./plugin']!, { name: 'plugin-dev', private: true }),
  ];
  const locks = new Map<string, Record<string, Record<string, unknown>>>([
    [
      '/workspace/package-lock.json',
      {
        '': {},
        'node_modules/@scope/pkg': { version: '1.2.3' },
        'node_modules/@scope/pkg-prev1': { name: '@scope/pkg', version: '1.1.8' },
        'node_modules/@fhevm/solidity': { version: '0.13.4' },
        'node_modules/exact': { version: '5.1.1' },
      },
    ],
    [
      '/workspace/plugin/package-lock.json',
      { '': {}, 'node_modules/dep/node_modules/@scope/pkg': { version: '1.2.4' } },
    ],
  ]);
  const readLockfile: LockfileReader = (file) => locks.get(file);

  assert.deepEqual(planPinRaises(manifest, packages, readLockfile), [
    // The newest copy across every lockfile wins, nested ones included.
    { name: '@scope/pkg', from: '^1.2.2', to: '^1.2.4' },
    { name: '@scope/pkg-prev1', from: 'npm:@scope/pkg@^1.1.7', to: 'npm:@scope/pkg@^1.1.8' },
    { name: 'exact', from: '5.1.0', to: '5.1.1' },
  ]);
});

test('a pin at or ahead of every resolved copy is not raised', () => {
  const manifest = manifestWithPins({ '@scope/pkg': '^1.2.3' });
  const packages = [loadedPackage('.', manifest.packages['.']!, { name: 'workspace', private: true })];
  const readLockfile = () => ({ '': {}, 'node_modules/@scope/pkg': { version: '1.2.2' } });
  // An OLDER copy is a lockfile left behind, npm's to re-lock; lowering the pin to it would undo a deliberate move.
  assert.deepEqual(planPinRaises(manifest, packages, readLockfile), []);
});

test('raising rewrites only the pinned lines of npm-manifest.json, and the package.json plan follows it', () => {
  const text = `{
  "dependencies": {
    "forbidden": ["solhint"],
    "pinned": {
      "@scope/pkg": "^1.2.2",
      "@scope/pkg-prev1": "npm:@scope/pkg@^1.1.7"
    }
  }
}
`;
  const raises = [{ name: '@scope/pkg', from: '^1.2.2', to: '^1.2.3' }];
  assert.equal(
    renderPinRaises('npm-manifest.json', text, raises),
    text.replace('"@scope/pkg": "^1.2.2"', '"@scope/pkg": "^1.2.3"'),
  );
  assert.throws(
    () => renderPinRaises('npm-manifest.json', text, [{ name: '@scope/pkg', from: '^1.2.1', to: '^1.2.3' }]),
    /expected exactly one "@scope\/pkg": "\^1\.2\.1" in "pinned", found 0/,
  );

  const manifest = manifestWithPins({ '@scope/pkg': '^1.2.2' });
  const pkg = loadedPackage('./plugin', manifest.packages['./plugin']!, {
    name: 'plugin-dev',
    private: true,
    devDependencies: { '@scope/pkg': '^1.2.2' },
  });
  assert.deepEqual(
    planPinnedSync(withRaisedPins(manifest, raises), [pkg]).map(({ name, from, to }) => ({ name, from, to })),
    [{ name: '@scope/pkg', from: '^1.2.2', to: '^1.2.3' }],
  );
});

test("'sync pinned' parses with and without --check", () => {
  const plain = parseCliOptions(['sync', 'pinned']);
  if (plain.command !== 'sync-pinned') throw new Error(`unexpected command ${plain.command}`);
  assert.equal(plain.check, false);
  const checked = parseCliOptions(['sync', 'pinned', '--check']);
  if (checked.command !== 'sync-pinned') throw new Error(`unexpected command ${checked.command}`);
  assert.equal(checked.check, true);
});
