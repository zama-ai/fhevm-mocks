import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { NPMJS_REGISTRY, resolveRegistry, resolveScaffoldPackage, scaffold } from '../base/scaffold.ts';
import { loadedPackage, parseTestNpmManifest } from './helpers.ts';

function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'fhevm-npm-scaffold-'));
  mkdirSync(join(root, 'template', 'contracts'), { recursive: true });
  mkdirSync(join(root, 'plugin'), { recursive: true });
  writeFileSync(
    join(root, 'template', 'package.json'),
    JSON.stringify({
      name: 'a-template',
      version: '0.13.0',
      dependencies: { '@fhevm/solidity': '^0.13.3' },
      devDependencies: { '@fhevm/hardhat-plugin': 'file:../plugin', hardhat: '^2.28.6' },
    }),
  );
  writeFileSync(join(root, 'template', 'contracts', 'A.sol'), '// a\n');
  writeFileSync(join(root, 'plugin', 'package.json'), JSON.stringify({ name: '@fhevm/hardhat-plugin' }));
  writeFileSync(
    join(root, 'versions.json'),
    JSON.stringify({
      $schema: './fhevm-npm/schemas/versions.schema.json',
      schemaVersion: 1,
      packages: { './plugin': '0.13.0' },
    }),
  );
  const manifest = parseTestNpmManifest({
    packageJson: { published: { required: ['name', 'version'], excluded: ['private'] } },
    packages: {
      '.': { kind: 'workspace-root', name: 'workspace', private: true, member: false },
      './template': {
        kind: 'published',
        name: 'a-template',
        member: false,
        distribution: ['mirror'],
        mirror: { repository: 'https://github.com/zama-ai/a-template' },
      },
      './plugin': { kind: 'published', name: '@fhevm/hardhat-plugin', member: false },
    },
  });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'workspace', private: true }));
  return { root, manifest };
}

// The real lister shells out to git; these fixtures are not repositories.
const files = () => ['package.json', 'contracts/A.sol'];

test('scaffold copies tracked files and renders the file: link to the target range', () => {
  const { root, manifest } = workspace();
  const out = join(root, 'out');
  try {
    const result = scaffold({ workspaceRoot: root, manifest, selector: './template', out, force: false }, files);

    assert.equal(result.packageKey, './template');
    assert.equal(result.fileCount, 2);
    assert.ok(existsSync(join(out, 'contracts', 'A.sol')));

    const written = JSON.parse(readFileSync(join(out, 'package.json'), 'utf8')) as {
      devDependencies: Record<string, string>;
      dependencies: Record<string, string>;
    };
    assert.equal(written.devDependencies['@fhevm/hardhat-plugin'], '^0.13.0');
    assert.equal(written.devDependencies['hardhat'], '^2.28.6');
    assert.equal(written.dependencies['@fhevm/solidity'], '^0.13.3');
    assert.deepEqual(result.replacements, [{ name: '@fhevm/hardhat-plugin', from: 'file:../plugin', to: '^0.13.0' }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('scaffold writes a scoped .npmrc only when a registry is given', () => {
  const { root, manifest } = workspace();
  try {
    const plain = join(root, 'plain');
    scaffold({ workspaceRoot: root, manifest, selector: './template', out: plain, force: false }, files);
    assert.equal(existsSync(join(plain, '.npmrc')), false);

    const scoped = join(root, 'scoped');
    scaffold(
      {
        workspaceRoot: root,
        manifest,
        selector: './template',
        out: scoped,
        registry: 'http://127.0.0.1:4873',
        force: false,
      },
      files,
    );
    const npmrc = readFileSync(join(scoped, '.npmrc'), 'utf8');
    assert.equal(npmrc, '@fhevm:registry=http://127.0.0.1:4873\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('scaffold refuses a non-empty output directory unless forced', () => {
  const { root, manifest } = workspace();
  const out = join(root, 'out');
  try {
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'keep.txt'), 'x');

    assert.throws(
      () => scaffold({ workspaceRoot: root, manifest, selector: './template', out, force: false }, files),
      /pass --force/,
    );
    scaffold({ workspaceRoot: root, manifest, selector: './template', out, force: true }, files);
    assert.equal(existsSync(join(out, 'keep.txt')), false);
    assert.ok(existsSync(join(out, 'package.json')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a dev owner selector resolves to the payload it publishes', () => {
  const manifest = parseTestNpmManifest({
    packageJson: { published: { required: ['name', 'version'], excluded: ['private'] } },
    packages: {
      '.': { kind: 'workspace-root', name: 'workspace', private: true, member: false },
      './owner': {
        kind: 'dev',
        name: 'owner-dev',
        private: true,
        member: true,
        publishedRelPath: './owner/pkg',
      },
      './owner/pkg': { kind: 'published', name: 'payload', member: true },
    },
  });
  const packages = [
    loadedPackage('.', manifest.packages['.']!, { name: 'workspace', private: true }),
    loadedPackage('./owner', manifest.packages['./owner']!, { name: 'owner-dev', private: true }),
    loadedPackage('./owner/pkg', manifest.packages['./owner/pkg']!, { name: 'payload', version: '1.0.0' }),
  ];

  assert.equal(resolveScaffoldPackage(packages, './owner').key, './owner/pkg');
  assert.equal(resolveScaffoldPackage(packages, './owner/pkg').key, './owner/pkg');
  assert.throws(() => resolveScaffoldPackage(packages, './nope'), /No manifest package matches/);
});

test('--registry npmjs names the public registry, any other value is used verbatim', () => {
  assert.equal(resolveRegistry('npmjs'), NPMJS_REGISTRY);
  assert.equal(resolveRegistry('NPMJS'), NPMJS_REGISTRY);
  assert.equal(resolveRegistry('http://127.0.0.1:4873'), 'http://127.0.0.1:4873');

  const { root, manifest } = workspace();
  try {
    const out = join(root, 'public');
    scaffold({ workspaceRoot: root, manifest, selector: './template', out, registry: 'npmjs', force: false }, files);
    assert.equal(readFileSync(join(out, '.npmrc'), 'utf8'), `@fhevm:registry=${NPMJS_REGISTRY}\n`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
