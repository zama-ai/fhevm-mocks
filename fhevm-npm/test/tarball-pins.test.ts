import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { type LockfileReader, validatePinnedDependencies } from '../base/checks/pinned-dependencies.ts';
import type { LoadedPackage, PackageJson } from '../base/npm.ts';
import { planPinRaises, planPinnedSync } from '../base/sync-pinned.ts';
import { expectedPinnedSpec, isTarballPin, tarballPinPath } from '../base/tarball-pins.ts';
import { loadedPackage, parseTestNpmManifest } from './helpers.ts';

const VERSION = '1.0.0-0';
const readVersion = () => VERSION;

function manifestWithPin(pin: string) {
  return parseTestNpmManifest({
    dependencies: { forbidden: ['solhint'], pinned: { '@ext/sdk': pin } },
    packageJson: { published: { required: ['name', 'version'], excluded: ['private'] } },
    packages: {
      '.': { kind: 'workspace-root', name: 'workspace', private: true, member: false },
      './plugin': { kind: 'standalone', name: 'plugin-dev', private: true, member: false },
      './plugin/pkg': { kind: 'standalone', name: 'plugin', private: true, member: false },
    },
  });
}

/** A workspace on disk (only the tarball needs to exist), with the root and two packages at real paths. */
function workspace(): { readonly root: string; readonly tarball: string; readonly cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'fhevm-npm-tarball-pin-'));
  mkdirSync(join(root, 'tarballs'));
  const tarball = join(root, 'tarballs', 'ext-sdk-1.0.0-0.tgz');
  writeFileSync(tarball, 'not read: the version reader is stubbed');
  return { root, tarball, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function packagesAt(
  root: string,
  manifest: ReturnType<typeof manifestWithPin>,
  plugin: PackageJson,
  pluginPkg: PackageJson,
): LoadedPackage[] {
  const at = (pkg: LoadedPackage, key: string): LoadedPackage => ({
    ...pkg,
    directory: key === '.' ? root : join(root, key.slice(2)),
  });
  return [
    at(loadedPackage('.', manifest.packages['.']!, { name: 'workspace', private: true }), '.'),
    at(loadedPackage('./plugin', manifest.packages['./plugin']!, plugin), './plugin'),
    at(loadedPackage('./plugin/pkg', manifest.packages['./plugin/pkg']!, pluginPkg), './plugin/pkg'),
  ];
}

const aligned = {
  plugin: {
    name: 'plugin-dev',
    private: true,
    devDependencies: { '@ext/sdk': 'file:../tarballs/ext-sdk-1.0.0-0.tgz' },
  },
  pluginPkg: { name: 'plugin', private: true, peerDependencies: { '@ext/sdk': `~${VERSION}` } },
};

test('a tarball pin is file:<path>.tgz; any other file: spec is not one', () => {
  assert.equal(isTarballPin('file:../sdk-1.0.0-0.tgz'), true);
  assert.equal(isTarballPin('file:/abs/sdk.tgz'), true);
  assert.equal(isTarballPin('file:../sdk'), false);
  assert.equal(isTarballPin('^1.0.0'), false);
});

test('a tarball pin path is absolute, or relative to the workspace root', () => {
  assert.equal(tarballPinPath('/ws', 'file:/abs/sdk.tgz'), '/abs/sdk.tgz');
  assert.equal(tarballPinPath('/ws', 'file:tarballs/sdk.tgz'), '/ws/tarballs/sdk.tgz');
  assert.equal(tarballPinPath('/ws', 'file:../elsewhere/sdk.tgz'), '/elsewhere/sdk.tgz');
});

test('each declaration of a tarball pin gets its own spec: a relative file: path, or a range for a peer', () => {
  const at = (directory: string, field: 'devDependencies' | 'peerDependencies' | 'dependencies') =>
    expectedPinnedSpec({ workspaceRoot: '/ws', pin: 'file:tarballs/sdk.tgz', directory, field, readVersion });
  assert.equal(at('/ws', 'devDependencies'), 'file:./tarballs/sdk.tgz');
  assert.equal(at('/ws/a/b', 'devDependencies'), 'file:../../tarballs/sdk.tgz');
  assert.equal(at('/ws/a', 'dependencies'), 'file:../tarballs/sdk.tgz');
  assert.equal(at('/ws/a/b', 'peerDependencies'), `~${VERSION}`);
  // A version pin is still repeated verbatim, whatever the field.
  assert.equal(
    expectedPinnedSpec({ workspaceRoot: '/ws', pin: '^1.2.3', directory: '/ws/a', field: 'peerDependencies' }),
    '^1.2.3',
  );
});

test('rule 3.3.4 accepts a tarball pin declared with the spec each package must carry', () => {
  const { root, cleanup } = workspace();
  try {
    const manifest = manifestWithPin('file:tarballs/ext-sdk-1.0.0-0.tgz');
    const packages = packagesAt(root, manifest, aligned.plugin, aligned.pluginPkg);
    assert.deepEqual(
      validatePinnedDependencies(manifest, packages, () => undefined, readVersion),
      [],
    );
  } finally {
    cleanup();
  }
});

test('rule 3.3.4 accepts an absolute tarball pin, the tarball outside the workspace', () => {
  const { root, tarball, cleanup } = workspace();
  try {
    const manifest = manifestWithPin(`file:${tarball}`);
    const packages = packagesAt(root, manifest, aligned.plugin, aligned.pluginPkg);
    assert.deepEqual(
      validatePinnedDependencies(manifest, packages, () => undefined, readVersion),
      [],
    );
  } finally {
    cleanup();
  }
});

test('rule 3.3.4 rejects the pin copied verbatim, and a peer that is not a range on the tarball version', () => {
  const { root, cleanup } = workspace();
  try {
    const pin = 'file:tarballs/ext-sdk-1.0.0-0.tgz';
    const manifest = manifestWithPin(pin);
    const packages = packagesAt(
      root,
      manifest,
      { name: 'plugin-dev', private: true, devDependencies: { '@ext/sdk': pin } },
      { name: 'plugin', private: true, peerDependencies: { '@ext/sdk': '^0.15.0-3' } },
    );
    const messages = validatePinnedDependencies(manifest, packages, () => undefined, readVersion).map((v) => v.message);
    assert.equal(messages.length, 2);
    assert.match(messages[0] ?? '', /requires "file:\.\.\/tarballs\/ext-sdk-1\.0\.0-0\.tgz" \(from the pin/);
    assert.match(messages[1] ?? '', /requires "~1\.0\.0-0" \(from the pin/);
  } finally {
    cleanup();
  }
});

test('rule 3.3.4 reports a tarball pin whose tarball is missing, once, and nothing else about it', () => {
  const { root, cleanup } = workspace();
  try {
    const manifest = manifestWithPin('file:tarballs/moved.tgz');
    const packages = packagesAt(root, manifest, aligned.plugin, aligned.pluginPkg);
    const violations = validatePinnedDependencies(manifest, packages, () => undefined, readVersion);
    assert.equal(violations.length, 1);
    assert.equal(violations[0]?.packageKey, './npm-manifest.json');
    assert.match(violations[0]?.message ?? '', /moved\.tgz, which does not exist/);
  } finally {
    cleanup();
  }
});

test('rule 3.3.4 rejects a tarball dependency no pin names', () => {
  const { root, cleanup } = workspace();
  try {
    const manifest = manifestWithPin('file:tarballs/ext-sdk-1.0.0-0.tgz');
    const packages = packagesAt(
      root,
      manifest,
      { ...aligned.plugin, devDependencies: { ...aligned.plugin.devDependencies, other: 'file:../x.tgz' } },
      aligned.pluginPkg,
    );
    const messages = validatePinnedDependencies(manifest, packages, () => undefined, readVersion).map((v) => v.message);
    assert.deepEqual(messages.length, 1);
    assert.match(messages[0] ?? '', /'other' .* is the tarball "file:\.\.\/x\.tgz", but no .*pinned entry names it/);
  } finally {
    cleanup();
  }
});

test('rule 3.3.4 checks a lockfile: specs per entry, and every copy installed from the pinned tarball', () => {
  const { root, cleanup } = workspace();
  try {
    const manifest = manifestWithPin('file:tarballs/ext-sdk-1.0.0-0.tgz');
    const packages = packagesAt(root, manifest, aligned.plugin, aligned.pluginPkg);
    const lock =
      (entries: Record<string, Record<string, unknown>>): LockfileReader =>
      (file) =>
        file === join(root, 'package-lock.json') ? entries : undefined;

    const good = lock({
      plugin: { devDependencies: { '@ext/sdk': 'file:../tarballs/ext-sdk-1.0.0-0.tgz' } },
      'plugin/pkg': { peerDependencies: { '@ext/sdk': '~1.0.0-0' } },
      'node_modules/@ext/sdk': { version: VERSION, resolved: 'file:tarballs/ext-sdk-1.0.0-0.tgz' },
    });
    assert.deepEqual(validatePinnedDependencies(manifest, packages, good, readVersion), []);

    const stale = lock({
      plugin: { devDependencies: { '@ext/sdk': '^0.15.0-3' } },
      'node_modules/@ext/sdk': {
        version: '0.15.0-3',
        resolved: 'https://registry.npmjs.org/@ext/sdk/-/sdk-0.15.0-3.tgz',
      },
    });
    const messages = validatePinnedDependencies(manifest, packages, stale, readVersion).map((v) => v.message);
    assert.equal(messages.length, 2);
    assert.match(messages[0] ?? '', /stale lockfile: .* requires "file:\.\.\/tarballs\/ext-sdk-1\.0\.0-0\.tgz"/);
    assert.match(messages[1] ?? '', /resolved from "https:.*", not from the pinned tarball .*Reinstall it/);

    const otherVersion = lock({
      'node_modules/@ext/sdk': { version: '1.0.0-1', resolved: 'file:tarballs/ext-sdk-1.0.0-0.tgz' },
    });
    const versionMessages = validatePinnedDependencies(manifest, packages, otherVersion, readVersion).map(
      (v) => v.message,
    );
    assert.equal(versionMessages.length, 1);
    assert.match(versionMessages[0] ?? '', /locked at 1\.0\.0-1, but the pinned tarball .* is 1\.0\.0-0/);
  } finally {
    cleanup();
  }
});

test('sync pinned writes each declaration its own spec, and never raises a tarball pin', () => {
  const { root, cleanup } = workspace();
  try {
    const manifest = manifestWithPin('file:tarballs/ext-sdk-1.0.0-0.tgz');
    const packages = packagesAt(
      root,
      manifest,
      { name: 'plugin-dev', private: true, devDependencies: { '@ext/sdk': '^0.15.0-3' } },
      { name: 'plugin', private: true, peerDependencies: { '@ext/sdk': '^0.15.0-3' } },
    );
    assert.deepEqual(
      planPinnedSync(manifest, packages, readVersion).map((edit) => [edit.packageKey, edit.field, edit.to]),
      [
        ['./plugin/package.json', 'devDependencies', 'file:../tarballs/ext-sdk-1.0.0-0.tgz'],
        ['./plugin/pkg/package.json', 'peerDependencies', '~1.0.0-0'],
      ],
    );
    const newer: LockfileReader = (file) =>
      file === join(root, 'package-lock.json') ? { 'node_modules/@ext/sdk': { version: '9.9.9' } } : undefined;
    assert.deepEqual(planPinRaises(manifest, packages, newer), []);
  } finally {
    cleanup();
  }
});

test('the manifest accepts a tarball pin, relative or absolute, and still rejects a file: directory', () => {
  assert.doesNotThrow(() => manifestWithPin('file:tarballs/sdk-1.0.0-0.tgz'));
  assert.doesNotThrow(() => manifestWithPin('file:/abs/path/sdk-1.0.0-0.tgz'));
  assert.throws(() => manifestWithPin('file:../sdk'), /exact, caret, or tilde/);
});
