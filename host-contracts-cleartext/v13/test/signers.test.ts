import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { PKG_DIR_ABS_PATH, WORKSPACE_ROOT_ABS_PATH } from '../internal/constants.ts';

// The js-sdk relayer duplicates this package's cleartext signer config (mnemonic, HD paths, pool size)
// deep in its internals — see js-sdk .../relayer/cleartext/signers.ts. It is not exported, so we read
// the relevant files as text and assert they agree. A silent drift here breaks cleartext decrypt.
// Read from the INSTALLED @fhevm/sdk, not from a sibling js-sdk source tree: js-sdk is named in
// npm-manifest.json#inventory.exclude and is absent from a workspace copied out of this repository, and
// the published package ships its TypeScript sources, so the installed copy is both reachable and the
// artifact a consumer actually gets.
const JS_SDK_SIGNERS_REL_PATH = join('core', 'modules', 'relayer', 'cleartext', 'signers.ts');

/** Every installed @fhevm/sdk copy of the signer config, by absolute path. */
function installedSdkSigners(root: string): readonly string[] {
  const found: string[] = [];
  const collect = (nodeModules: string): void => {
    const direct = join(nodeModules, '@fhevm', 'sdk', JS_SDK_SIGNERS_REL_PATH);
    if (existsSync(direct)) found.push(direct);
    // One level of npm nesting: a conflicting range installs as <pkg>/node_modules/@fhevm/sdk.
    for (const entry of readdirSync(nodeModules, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const nested = join(nodeModules, entry.name, 'node_modules', '@fhevm', 'sdk', JS_SDK_SIGNERS_REL_PATH);
      if (existsSync(nested)) found.push(nested);
    }
  };
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      // Never descended into: an installation root holds tens of thousands of files.
      if (entry.name === 'node_modules') collect(join(directory, entry.name));
      else walk(join(directory, entry.name));
    }
  };
  walk(root);
  return [...found].sort();
}

/**
 * The one installed copy of the signer config. Several installs are normal — each hardhat cluster has
 * its own — but they must agree: two different ones mean there is no single SDK for these constants to
 * match, and picking one silently would make this test assert something nobody asked for.
 */
function readInstalledSdkSigners(): string {
  const paths = installedSdkSigners(WORKSPACE_ROOT_ABS_PATH);
  // Destructuring is also the "none installed" check: an empty list has no first element, and taking
  // the first one this way is what lets the return type be `string` without asserting it.
  const [first, ...rest] = paths;
  if (first === undefined) {
    throw new Error(`No installed @fhevm/sdk under ${WORKSPACE_ROOT_ABS_PATH}: run 'make install' before this test`);
  }
  const expected = readFileSync(first, 'utf8');
  const differing = rest.filter((path) => readFileSync(path, 'utf8') !== expected);
  if (differing.length > 0) {
    throw new Error(
      `Installed copies of @fhevm/sdk disagree on ${JS_SDK_SIGNERS_REL_PATH}, so there is no single SDK ` +
        `to compare against:\n${paths.map((path) => `  ${path}`).join('\n')}`,
    );
  }
  return expected;
}
// The shared cleartext config, not ts/constants.ts: the mnemonic and HD paths live in
// pkg/ts/cleartext-config.ts, generated from sdk/cleartext-config.json and synced from common-vendored.
const HOST_CONFIG_PATH = join(PKG_DIR_ABS_PATH, 'ts', 'cleartext-config.ts');
const HOST_COPROCESSOR_SIGNERS_PATH = join(PKG_DIR_ABS_PATH, 'ts', 'signers', 'defaultCoprocessorSigners.ts');
const HOST_KMS_SIGNERS_PATH = join(PKG_DIR_ABS_PATH, 'ts', 'signers', 'defaultKmsSigners.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function capture(source: string, pattern: RegExp, label: string): string {
  const value = pattern.exec(source)?.[1];
  if (value === undefined) {
    throw new Error(`Could not find ${label}`);
  }
  return value;
}

// Count the quoted addresses in an `export const <name> = [ ... ]` array.
function countAddresses(source: string, constName: string): number {
  const body = capture(source, new RegExp(`const ${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]`), constName);
  return [...body.matchAll(/'0x[0-9a-fA-F]{40}'/g)].length;
}

void test('js-sdk cleartext signer config matches host-contracts-cleartext/v13 constants', () => {
  const sdk = readInstalledSdkSigners();
  const host = read(HOST_CONFIG_PATH);

  // Mnemonic.
  assert.equal(
    capture(sdk, /const FHEVM_TEST_MNEMONIC\s*=\s*'([^']+)'/, 'js-sdk FHEVM_TEST_MNEMONIC'),
    capture(host, /const FHEVM_MNEMONIC\s*=\s*'([^']+)'/, 'host FHEVM_MNEMONIC'),
    'mnemonic mismatch between js-sdk and host-contracts-cleartext/v13',
  );

  // HD paths. The js-sdk stores only the suffix after the shared `m/44'/60'/` prefix (it prepends the
  // prefix in _fillSignersPrivateKey), whereas this package stores the full path.
  assert.equal(
    `m/44'/60'/${capture(sdk, /const COPROCESSOR_PATH\s*=\s*"([^"]+)"/, 'js-sdk COPROCESSOR_PATH')}`,
    capture(
      host,
      /const CLEARTEXT_COPROCESSORS_MNEMONIC_PATH\s*=\s*"([^"]+)"/,
      'host CLEARTEXT_COPROCESSORS_MNEMONIC_PATH',
    ),
    'coprocessor derivation path mismatch',
  );
  assert.equal(
    `m/44'/60'/${capture(sdk, /const KMS_PATH\s*=\s*"([^"]+)"/, 'js-sdk KMS_PATH')}`,
    capture(host, /const CLEARTEXT_KMS_NODES_MNEMONIC_PATH\s*=\s*"([^"]+)"/, 'host CLEARTEXT_KMS_NODES_MNEMONIC_PATH'),
    'kms derivation path mismatch',
  );

  // Number of signers. The js-sdk hardcodes the pool size in both `_fillSignersPrivateKey(...)` calls;
  // this package's pool size is the number of entries in each generated signer module.
  const sdkCounts = [...sdk.matchAll(/_fillSignersPrivateKey\([^)]*?,\s*(\d+),/g)].map((m) => Number(m[1]));
  assert.ok(sdkCounts.length >= 2, 'expected the js-sdk to populate both the coprocessor and kms maps');
  assert.ok(
    sdkCounts.every((count) => count === sdkCounts[0]),
    'js-sdk uses different signer counts for coprocessor vs kms',
  );
  assert.equal(
    sdkCounts[0],
    countAddresses(read(HOST_COPROCESSOR_SIGNERS_PATH), 'DEFAULT_COPROCESSOR_ADDRESSES'),
    'coprocessor signer count mismatch',
  );
  assert.equal(
    sdkCounts[0],
    countAddresses(read(HOST_KMS_SIGNERS_PATH), 'DEFAULT_KMS_NODE_ADDRESSES'),
    'kms signer count mismatch',
  );
});
