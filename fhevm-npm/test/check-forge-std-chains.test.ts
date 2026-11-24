import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { FORGE_STD_CHAINS_FILE, inspectForgeStdChains, parseChainTable } from '../base/checks/forge-std-chains.ts';

const A = (n: number): string => `0x${n.toString(16).padStart(40, '0')}`;

/** A config with one testnet host (chain 97, no host kmsGeneration) and one gateway. */
const CONFIG = {
  networks: {
    testnet: {
      relayerUrl: 'https://relayer.testnet.example',
      gateway: { contracts: { decryption: { address: A(10) }, inputVerification: { address: A(11) } } },
      hosts: {
        bsc_testnet: {
          id: 97,
          contracts: {
            acl: { address: A(1) },
            fhevmExecutor: { address: A(2) },
            inputVerifier: { address: A(3) },
            kmsVerifier: { address: A(4) },
            protocolConfig: { address: A(5) },
          },
        },
      },
    },
  },
};

type Overrides = Readonly<Record<string, string>>;

function entry(group: string, chainId: number, overrides: Overrides = {}): string {
  const fields: Record<string, string> = {
    fhevmGroup: group,
    chainId: String(chainId),
    rpcUrl: '"https://rpc.example"',
    relayerUrl: '"https://relayer.testnet.example"',
    acl: A(1),
    fhevmExecutor: A(2),
    inputVerifier: A(3),
    kmsVerifier: A(4),
    protocolConfig: A(5),
    kmsGeneration: 'address(0)',
    decryption: A(10),
    inputVerification: A(11),
    ...overrides,
  };
  const body = Object.entries(fields)
    .map(([key, value]) => `        ${key}: ${value}`)
    .join(',\n');
  return `    setFhevmChain(\n      "alias",\n      FhevmChainData({\n${body}\n      })\n    );`;
}

function table(...entries: readonly string[]): string {
  return [
    'string constant FHEVM_TESTNET_GROUP = "testnet";',
    'string constant FHEVM_LOCAL_GROUP = "local";',
    'contract StdFhevmChains {',
    '  function init() internal {',
    ...entries,
    '  }',
    '}',
  ].join('\n');
}

function inspect(source: string, config: unknown = CONFIG): ReturnType<typeof inspectForgeStdChains> {
  const root = mkdtempSync(join(tmpdir(), 'fhevm-npm-forge-std-chains-'));
  try {
    mkdirSync(dirname(join(root, FORGE_STD_CHAINS_FILE)), { recursive: true });
    writeFileSync(join(root, FORGE_STD_CHAINS_FILE), source);
    writeFileSync(join(root, 'fhevm-chains.config.json'), JSON.stringify(config));
    return inspectForgeStdChains(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const messages = (result: ReturnType<typeof inspectForgeStdChains>): readonly string[] =>
  result.violations.map((violation) => violation.message);

test('a table that carries the config passes, and the local group is not compared', () => {
  const result = inspect(table(entry('FHEVM_TESTNET_GROUP', 97), entry('FHEVM_LOCAL_GROUP', 31337, { acl: A(99) })));
  assert.deepEqual(messages(result), []);
  assert.deepEqual(result.checkedKeys, ['testnet:97']);
});

test('a host address, a gateway address, kmsGeneration and the relayer URL are each compared', () => {
  const result = inspect(
    table(
      entry('FHEVM_TESTNET_GROUP', 97, {
        acl: A(42),
        decryption: A(43),
        kmsGeneration: A(44),
        relayerUrl: '"https://relayer.other.example"',
      }),
    ),
  );
  const found = messages(result);
  assert.equal(found.length, 4);
  assert.ok(found.some((m) => m.includes('`acl` is') && m.includes(A(1))));
  assert.ok(found.some((m) => m.includes('`decryption` is') && m.includes(A(10))));
  assert.ok(found.some((m) => m.includes('`kmsGeneration` is') && m.includes('address(0)')));
  assert.ok(found.some((m) => m.includes('`relayerUrl` is https://relayer.other.example')));
  assert.ok(result.violations.every((violation) => violation.rule === 'NR-91'));
});

test('an address compares by value, whatever its letter case', () => {
  const upper = `0x${A(1).slice(2).toUpperCase()}`;
  assert.deepEqual(messages(inspect(table(entry('FHEVM_TESTNET_GROUP', 97, { acl: upper })))), []);
});

test('coverage runs both ways: a config host with no entry, and an entry the config does not know', () => {
  assert.match(
    messages(inspect(table()))[0] ?? '',
    /lists testnet host bsc_testnet \(chain 97\), and the table has no entry/,
  );
  const unknown = messages(inspect(table(entry('FHEVM_TESTNET_GROUP', 97), entry('FHEVM_TESTNET_GROUP', 80002))));
  assert.deepEqual(unknown.length, 1);
  assert.match(unknown[0] ?? '', /testnet chain 80002 .* has no testnet host with this chain ID/);
});

test('a second entry for the same chain is reported, with the line of the first', () => {
  const found = messages(inspect(table(entry('FHEVM_TESTNET_GROUP', 97), entry('FHEVM_TESTNET_GROUP', 97))));
  assert.equal(found.length, 1);
  assert.match(found[0] ?? '', /a second entry for this chain; the first is at line \d+/);
});

test('the parser reads the group through the file own constants, and keeps string fields unquoted', () => {
  const [parsed] = parseChainTable(table(entry('FHEVM_TESTNET_GROUP', 97)));
  assert.equal(parsed?.group, 'testnet');
  assert.equal(parsed?.chainId, 97);
  assert.equal(parsed?.fields.get('relayerUrl'), 'https://relayer.testnet.example');
  assert.equal(parsed?.fields.get('kmsGeneration'), 'address(0)');
});
