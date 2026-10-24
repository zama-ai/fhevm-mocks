import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import type { RegistryOptions } from '../base/publish-check.ts';
import type { AuditNpmRunner } from '../base/publish-audit.ts';
import { companionTarballs, formatRehearsal, rehearseRelease, releaseSet } from '../base/publish-rehearse.ts';
import { loadPackages } from '../base/npm.ts';
import { parseCliOptions } from '../cli-options.ts';
import { parseTestNpmManifest } from './helpers.ts';

// A library with two generations, a plugin depending on the current one, and a tool kept but never released.
const manifest = parseTestNpmManifest({
  tarballs: { relPath: './tarballs' },
  generations: { library: { current: './library/v2', previous: './library/v1' } },
  packageJson: { published: { required: [], excluded: [] } },
  packages: {
    '.': { kind: 'workspace-root', name: 'workspace', private: true, member: false },
    './library/v1': {
      kind: 'dev',
      name: '@scope/library-v1-dev',
      private: true,
      member: true,
      publishedRelPath: './library/v1/pkg',
    },
    './library/v1/pkg': { kind: 'published', name: '@scope/library', member: false },
    './library/v2': {
      kind: 'dev',
      name: '@scope/library-dev',
      private: true,
      member: true,
      publishedRelPath: './library/v2/pkg',
    },
    './library/v2/pkg': { kind: 'published', name: '@scope/library', member: true },
    './plugin/pkg': { kind: 'published', name: '@scope/plugin', member: true },
    './legacy/pkg': { kind: 'published', name: '@scope/legacy', member: true },
  },
});

function workspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'fhevm-npm-rehearse-'));
  const write = (rel: string, value: unknown) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  };
  write('package.json', { name: 'workspace', private: true });
  write('library/v1/package.json', { name: '@scope/library-v1-dev', private: true });
  write('library/v1/pkg/package.json', { name: '@scope/library', version: '0.1.0' });
  write('library/v2/package.json', { name: '@scope/library-dev', private: true });
  write('library/v2/pkg/package.json', { name: '@scope/library', version: '0.2.0', dependencies: { tiny: '^1.0.0' } });
  write('plugin/pkg/package.json', {
    name: '@scope/plugin',
    version: '0.2.0',
    dependencies: { '@scope/library': 'file:../../library/v2/pkg' },
    peerDependencies: { hardhat: '^3.0.0' },
  });
  write('legacy/pkg/package.json', { name: '@scope/legacy', version: '0.2.0' });
  write('versions.json', {
    $schema: './fhevm-npm/schemas/versions.schema.json',
    schemaVersion: 1,
    packages: {
      './library/v1/pkg': '0.1.0',
      './library/v2/pkg': '0.2.0',
      './plugin/pkg': '0.2.0',
      './legacy/pkg': '0.2.0',
    },
  });
  return root;
}

/** npm pack's layout without npm: the staged directory under `package/`, named after its name and version. */
function fakePack(staged: string, outDir: string): string {
  const { name, version } = JSON.parse(readFileSync(join(staged, 'package.json'), 'utf8')) as {
    name: string;
    version: string;
  };
  const wrapper = mkdtempSync(join(tmpdir(), 'fhevm-npm-fake-pack-'));
  try {
    cpSync(staged, join(wrapper, 'package'), { recursive: true });
    const tarball = join(outDir, `${name.replace(/^@/, '').replace('/', '-')}-${version}.tgz`);
    execFileSync('tar', ['-czf', tarball, '-C', wrapper, 'package']);
    return tarball;
  } finally {
    rmSync(wrapper, { recursive: true, force: true });
  }
}

/** A registry where nothing of ours is published yet and every third-party range is satisfied. */
const registry: RegistryOptions = {
  retries: 0,
  retryDelayMs: 0,
  sleep: async () => {},
  fetchRegistry: async () => ({ status: 404, json: async () => ({}) }),
};

test('the release set drops the previous generation and every --exclude, in publish order', () => {
  const root = workspace();
  try {
    const set = releaseSet(manifest, loadPackages(root, manifest), ['legacy/pkg']);
    assert.deepEqual(set.keys, ['./library/v2/pkg', './plugin/pkg']);
    assert.deepEqual(set.dropped, [
      { key: './legacy/pkg', reason: '--exclude' },
      { key: './library/v1/pkg', reason: 'previous generation of library' },
    ]);
    assert.throws(() => releaseSet(manifest, loadPackages(root, manifest), ['nope/pkg']), /No npm-distributed payload/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a payload depending on an unpublished set payload is checked and audited with its local tarball', async () => {
  const root = workspace();
  try {
    const installs: string[][] = [];
    const npm: AuditNpmRunner = (directory, args) => {
      if (args[0] === 'install') {
        installs.push(args.filter((arg) => arg.endsWith('.tgz')).map((arg) => arg.split('/').pop() ?? arg));
        writeFileSync(join(directory, 'package-lock.json'), JSON.stringify({ packages: { '': {} } }));
        return { status: 0, stdout: '', stderr: '' };
      }
      return { status: 0, stdout: JSON.stringify({ vulnerabilities: {} }), stderr: '' };
    };
    const { payloads } = await rehearseRelease(root, manifest, {
      excludes: ['./legacy/pkg'],
      auditLevel: 'high',
      registry,
      pack: fakePack,
      npm,
    });
    assert.deepEqual(
      payloads.map((payload) => [payload.key, Object.values(payload.steps).join(' '), payload.violations]),
      [
        ['./library/v2/pkg', 'passed passed passed passed', []],
        ['./plugin/pkg', 'passed passed passed passed', []],
      ],
    );
    // The library is installed beside the plugin: npm could not have found 0.2.0 on the registry.
    assert.deepEqual(installs, [['scope-library-0.2.0.tgz'], ['scope-plugin-0.2.0.tgz', 'scope-library-0.2.0.tgz']]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a failing step skips the ones after it, and every payload is still reported', async () => {
  const root = workspace();
  try {
    const advisory = {
      tiny: { severity: 'critical', range: '<2', via: [{ title: 'bad' }], nodes: ['node_modules/tiny'] },
    };
    const npm: AuditNpmRunner = (directory, args) => {
      if (args[0] === 'install') {
        writeFileSync(join(directory, 'package-lock.json'), JSON.stringify({ packages: { '': {} } }));
        return { status: 0, stdout: '', stderr: '' };
      }
      return { status: 1, stdout: JSON.stringify({ vulnerabilities: advisory }), stderr: '' };
    };
    const published: RegistryOptions = {
      ...registry,
      // The plugin's own version is already on npm: the registry step fails before its audit.
      fetchRegistry: async (url) =>
        url.endsWith('plugin')
          ? { status: 200, json: async () => ({ 'dist-tags': { latest: '0.2.0' }, versions: { '0.2.0': {} } }) }
          : { status: 404, json: async () => ({}) },
    };
    const { payloads } = await rehearseRelease(root, manifest, {
      excludes: ['./legacy/pkg'],
      auditLevel: 'high',
      registry: published,
      pack: fakePack,
      npm,
    });
    assert.deepEqual(
      payloads.map((payload) => Object.values(payload.steps).join(' ')),
      ['passed passed passed failed', 'passed passed failed skipped'],
    );
    assert.match(payloads[0]?.violations[0]?.message ?? '', /tiny <2 is critical: bad/);
    assert.match(payloads[1]?.violations[0]?.message ?? '', /@scope\/plugin@0\.2\.0 is already on npmjs\.com/);
    assert.equal(
      formatRehearsal(payloads),
      [
        './library/v2/pkg  ✅ pack  ✅ check  ✅ registry  ❌ audit',
        './plugin/pkg      ✅ pack  ✅ check  ❌ registry  ⏭️ audit',
      ].join('\n'),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('companions are the set payloads a tarball reaches through its dependencies, transitively', () => {
  const library = { tarball: '/t/library.tgz', shipped: { name: 'library', dependencies: { base: '^1.0.0' } } };
  const base = { tarball: '/t/base.tgz', shipped: { name: 'base' } };
  const local = new Map([
    ['library', library],
    ['base', base],
    ['unrelated', { tarball: '/t/unrelated.tgz', shipped: { name: 'unrelated' } }],
  ]);
  assert.deepEqual(
    companionTarballs({ name: 'plugin', dependencies: { library: '^0.2.0', tiny: '^1.0.0' } }, local).map(
      (companion) => companion.tarball,
    ),
    ['/t/library.tgz', '/t/base.tgz'],
  );
});

test("'publish rehearse' takes repeatable --exclude and an audit level", () => {
  const options = parseCliOptions([
    'publish',
    'rehearse',
    '--exclude',
    './hardhat/v3/plugin/pkg',
    '--exclude',
    'legacy/pkg',
  ]);
  if (options.command !== 'publish-rehearse') throw new Error('unreachable');
  assert.deepEqual(options.excludes, ['./hardhat/v3/plugin/pkg', 'legacy/pkg']);
  assert.equal(options.auditLevel, 'high');
  const bare = parseCliOptions(['publish', 'rehearse']);
  if (bare.command !== 'publish-rehearse') throw new Error('unreachable');
  assert.deepEqual(bare.excludes, []);
  assert.throws(() => parseCliOptions(['publish', 'rehearse', '--audit-level', 'x']), /--audit-level/);
});
