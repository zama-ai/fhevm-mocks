// HARDHAT 2 ONLY. Delete with commands/sync-hh-v2-constants.ts when hardhat/v2 goes.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { parseCliOptions } from '../cli-options.ts';
import {
  HH_V2_CONSTANTS_FILE,
  HH_V2_PLUGIN_DIR,
  type HhV2ConstantsEntry,
  hhV2HostContractsVersion,
  hhV2SolidityVersion,
  renderHhV2Constants,
  syncHhV2Constants,
} from '../commands/sync-hh-v2-constants.ts';

const constants = (host: string, solidity: string): string => `export const constants = {
  // https://www.npmjs.com/package/@fhevm/solidity?activeTab=versions
  // @fhevm/solidity@${solidity}
  FHEVM_SOLIDITY_PACKAGE: {
    version: '${solidity}',
    name: '@fhevm/solidity',
  },
  // @fhevm/host-contracts-cleartext@${host}
  //
  // The canonical localhost cleartext stack.
  FHEVM_HOST_CONTRACTS_CLEARTEXT_PACKAGE: {
    version: '${host}',
    name: '@fhevm/host-contracts-cleartext',
  },
  OTHER_PACKAGE: {
    version: '9.9.9',
  },
};
`;

const entries = (host: string, solidity: string): readonly HhV2ConstantsEntry[] => [
  {
    packageName: '@fhevm/host-contracts-cleartext',
    block: 'FHEVM_HOST_CONTRACTS_CLEARTEXT_PACKAGE',
    version: host,
    source: 'versions.json',
  },
  { packageName: '@fhevm/solidity', block: 'FHEVM_SOLIDITY_PACKAGE', version: solidity, source: 'npm-manifest.json' },
];

function workspace(options: {
  readonly versions: Record<string, string>;
  readonly solidityPin?: string;
  readonly recorded: readonly [string, string];
}): string {
  const root = mkdtempSync(join(tmpdir(), 'hh-v2-constants-'));
  const write = (path: string, content: string): void => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  write(
    'versions.json',
    JSON.stringify({
      $schema: './fhevm-npm/schemas/versions.schema.json',
      schemaVersion: 1,
      packages: options.versions,
    }),
  );
  write(
    'npm-manifest.json',
    JSON.stringify({
      dependencies: { pinned: options.solidityPin === undefined ? {} : { '@fhevm/solidity': options.solidityPin } },
    }),
  );
  write(
    `${HH_V2_PLUGIN_DIR}/package.json`,
    JSON.stringify({
      name: '@fhevm/hardhat-plugin',
      dependencies: { '@fhevm/host-contracts-cleartext': 'file:../../../../host-contracts-cleartext/v13/pkg' },
    }),
  );
  write(HH_V2_CONSTANTS_FILE, constants(...options.recorded));
  return root;
}

function withWorkspace(options: Parameters<typeof workspace>[0], body: (root: string) => void): void {
  const root = workspace(options);
  try {
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('renders both blocks and leaves every other version alone', () => {
  assert.equal(
    renderHhV2Constants(constants('0.13.0', '0.13.3'), entries('0.13.1', '0.13.4')),
    constants('0.13.1', '0.13.4'),
  );
  assert.equal(
    renderHhV2Constants(constants('0.13.1', '0.13.4'), entries('0.13.1', '0.13.4')),
    constants('0.13.1', '0.13.4'),
  );
});

test('refuses a file where a spot is missing or repeated', () => {
  const text = constants('0.13.0', '0.13.3');
  assert.throws(
    () => renderHhV2Constants(text.replace(/^ *\/\/ @fhevm\/host-contracts.*\n/m, ''), entries('0.13.1', '0.13.3')),
    /exactly one '\/\/ @fhevm\/host-contracts-cleartext@<version>' comment, found 0/,
  );
  assert.throws(
    () =>
      renderHhV2Constants(text.replace('FHEVM_SOLIDITY_PACKAGE: {', 'FHEVM_RENAMED: {'), entries('0.13.0', '0.13.3')),
    /exactly one 'version' field opening FHEVM_SOLIDITY_PACKAGE, found 0/,
  );
  assert.throws(() => renderHhV2Constants(text + text, entries('0.13.0', '0.13.3')), /found 2/);
});

test('reads the host-contracts version at the key the plugin file: dependency points to', () => {
  withWorkspace(
    {
      versions: { './host-contracts-cleartext/v12/pkg': '0.12.0', './host-contracts-cleartext/v13/pkg': '0.13.1' },
      solidityPin: '^0.13.3',
      recorded: ['0.13.0', '0.13.3'],
    },
    (root) => assert.equal(hhV2HostContractsVersion(root), '0.13.1'),
  );
  withWorkspace(
    {
      versions: { './host-contracts-cleartext/v12/pkg': '0.12.0' },
      solidityPin: '^0.13.3',
      recorded: ['0.13.0', '0.13.3'],
    },
    (root) =>
      assert.throws(() => hhV2HostContractsVersion(root), /no entry for \.\/host-contracts-cleartext\/v13\/pkg/),
  );
});

test('reads the solidity version as the floor of its manifest pin', () => {
  for (const [pin, floor] of [
    ['^0.13.4', '0.13.4'],
    ['~0.13.4', '0.13.4'],
    ['0.13.4', '0.13.4'],
  ] as const) {
    withWorkspace({ versions: {}, solidityPin: pin, recorded: ['0.13.0', '0.13.3'] }, (root) =>
      assert.equal(hhV2SolidityVersion(root), floor),
    );
  }
  withWorkspace({ versions: {}, recorded: ['0.13.0', '0.13.3'] }, (root) =>
    assert.throws(() => hhV2SolidityVersion(root), /pin of @fhevm\/solidity, found undefined/),
  );
});

test('--check reports a stale solidity pin without writing; a sync writes it; a second check passes', () => {
  withWorkspace(
    {
      versions: { './host-contracts-cleartext/v13/pkg': '0.13.1' },
      solidityPin: '^0.13.4',
      recorded: ['0.13.1', '0.13.3'],
    },
    (root) => {
      const file = join(root, HH_V2_CONSTANTS_FILE);
      assert.equal(syncHhV2Constants({ workspaceRoot: root, check: true }).status, 'different');
      assert.equal(readFileSync(file, 'utf8'), constants('0.13.1', '0.13.3'));

      assert.equal(syncHhV2Constants({ workspaceRoot: root, check: false }).status, 'identical');
      assert.equal(readFileSync(file, 'utf8'), constants('0.13.1', '0.13.4'));

      const checked = syncHhV2Constants({ workspaceRoot: root, check: true });
      assert.equal(checked.status, 'identical');
      assert.deepEqual(
        checked.entries.map(({ packageName, version }) => `${packageName}@${version}`),
        ['@fhevm/host-contracts-cleartext@0.13.1', '@fhevm/solidity@0.13.4'],
      );
    },
  );
});

test("'sync hh-v2-constants' parses with and without --check", () => {
  const plain = parseCliOptions(['sync', 'hh-v2-constants']);
  if (plain.command !== 'sync-hh-v2-constants') throw new Error(`unexpected command ${plain.command}`);
  assert.equal(plain.check, false);

  const checked = parseCliOptions(['sync', 'hh-v2-constants', '--check']);
  if (checked.command !== 'sync-hh-v2-constants') throw new Error(`unexpected command ${checked.command}`);
  assert.equal(checked.check, true);
});
