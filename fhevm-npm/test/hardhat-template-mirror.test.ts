import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { cleartextPayloadSpec, patchHardhatTemplateV2Manifest } from '../base/mirrors/hardhat-template-v2.ts';
import { VERSIONS_SCHEMA_REFERENCE } from '../base/versions.ts';
import { parseTestNpmManifest } from './helpers.ts';

const FAMILY = 'host-contracts-cleartext';
const TEMPLATE_KEY = './hardhat/v2/fhevm-hardhat-template/pkg';

/** A workspace root holding only what the patch reads from disk: the template's version. */
function workspace(version = '0.13.0'): string {
  const root = mkdtempSync(join(tmpdir(), 'fhevm-npm-mirror-patch-'));
  writeFileSync(
    join(root, 'versions.json'),
    `${JSON.stringify({ $schema: VERSIONS_SCHEMA_REFERENCE, schemaVersion: 1, packages: { [TEMPLATE_KEY]: version } }, null, 2)}\n`,
  );
  return root;
}

// Only what the patch reads: the pinned specs it injects, and the generation pair it links against.
function npmManifest(current = 'v13') {
  return parseTestNpmManifest({
    generations: { [FAMILY]: { current: `./${FAMILY}/${current}`, previous: `./${FAMILY}/v12` } },
    dependencies: { forbidden: ['solhint'], pinned: { '@fhevm/sdk': '^0.13.4', '@fhevm/solidity': '^0.13.3' } },
    packageJson: { published: { required: ['name'], excluded: ['private'] } },
    packages: {
      '.': { kind: 'workspace-root', name: 'workspace', private: true, member: false },
      [`./${FAMILY}/v12`]: {
        kind: 'dev',
        name: `@fhevm/${FAMILY}-v12-dev`,
        private: true,
        member: true,
        publishedRelPath: `./${FAMILY}/v12/pkg`,
      },
      [`./${FAMILY}/v12/pkg`]: { kind: 'published', name: `@fhevm/${FAMILY}`, member: false },
      [`./${FAMILY}/${current}`]: {
        kind: 'dev',
        name: `@fhevm/${FAMILY}-${current}-dev`,
        private: true,
        member: true,
        publishedRelPath: `./${FAMILY}/${current}/pkg`,
      },
      [`./${FAMILY}/${current}/pkg`]: { kind: 'published', name: `@fhevm/${FAMILY}`, member: true },
    },
  });
}

test('applies the complete Hardhat v2 workspace mirror transformation', () => {
  const root = workspace();
  const patched = patchHardhatTemplateV2Manifest(
    {
      name: 'fhevm-hardhat-template',
      description: 'upstream',
      version: '0.4.1',
      dependencies: {
        '@fhevm/mock-utils': '^0.4.2',
        '@fhevm/solidity': '^0.11.1',
      },
      devDependencies: {
        '@fhevm/hardhat-plugin': '^0.4.2',
        '@zama-fhe/relayer-sdk': '^0.4.1',
      },
      scripts: { test: 'hardhat test' },
    },
    root,
    npmManifest(),
  );

  assert.equal(patched.name, 'fhevm-hardhat-template-v2');
  assert.equal((patched.dependencies as Record<string, string>)['@fhevm/mock-utils'], undefined);
  assert.equal((patched.dependencies as Record<string, string>)['@fhevm/solidity'], '^0.13.3');
  assert.equal((patched.devDependencies as Record<string, string>)['@zama-fhe/relayer-sdk'], undefined);
  assert.equal(
    (patched.scripts as Record<string, string>)['check:mirror'],
    'node ../../../fhevm-npm/fhevm-npm.ts check mirror ./hardhat/v2/fhevm-hardhat-template',
  );

  // Injected from npm-manifest.json, not from a copy in the tool: the pinned specs and the payload link.
  const dev = patched.devDependencies as Record<string, string>;
  assert.equal(dev['@fhevm/sdk'], '^0.13.4');
  assert.equal(dev['@fhevm/host-contracts-cleartext'], 'file:../../../../host-contracts-cleartext/v13/pkg');
  // The version is versions.json's, not the upstream 0.4.1 and not a copy kept in the patch.
  assert.equal(patched.version, '0.13.0');
  rmSync(root, { recursive: true, force: true });
});

test('takes the rendered version from versions.json, and refuses a payload it does not version', () => {
  const root = workspace('9.9.9');
  try {
    const patched = patchHardhatTemplateV2Manifest({ version: '0.0.1' }, root, npmManifest());
    assert.equal(patched.version, '9.9.9');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  const bare = mkdtempSync(join(tmpdir(), 'fhevm-npm-mirror-patch-'));
  try {
    writeFileSync(
      join(bare, 'versions.json'),
      `${JSON.stringify({ $schema: VERSIONS_SCHEMA_REFERENCE, schemaVersion: 1, packages: {} }, null, 2)}\n`,
    );
    assert.throws(() => patchHardhatTemplateV2Manifest({}, bare, npmManifest()), /does not version/);
  } finally {
    rmSync(bare, { recursive: true, force: true });
  }
});

test('follows the generation pair instead of a spec written down here', () => {
  assert.equal(cleartextPayloadSpec(npmManifest()), 'file:../../../../host-contracts-cleartext/v13/pkg');
  assert.equal(cleartextPayloadSpec(npmManifest('v14')), 'file:../../../../host-contracts-cleartext/v14/pkg');

  // A manifest with no generations cannot say which payload the template links against.
  assert.throws(
    () =>
      cleartextPayloadSpec(
        parseTestNpmManifest({
          packageJson: { published: { required: ['name'], excluded: ['private'] } },
          packages: { '.': { kind: 'workspace-root', name: 'workspace', private: true, member: false } },
        }),
      ),
    /names no current generation whose payload publishes @fhevm\/host-contracts-cleartext/,
  );
});
