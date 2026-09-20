import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { generateCleartextConfig, renderCleartextConfigFaces, tsFacePath } from '../base/generate-cleartext-config.ts';

const LOCALHOST = {
  MNEMONIC: { value: 'adapt mosquito move limb' },
  DEPLOYER_ADDRESS_INDEX: { value: '5' },
  DEPLOYER_ADDRESS: { value: '0x8B8f5091f8b9817EF69cFC1E8B2f721BafF60DF4' },
  DEPLOYER_START_NONCE: { value: '0' },
  zamaConfigLocal: {
    ACLAddress: '0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D',
    CoprocessorAddress: '0xe3a9105a3a932253A70F126eb1E3b589C643dD24',
    KMSVerifierAddress: '0x901F8942346f7AB3a01F6D7613119Bca447Bb030',
  },
} as const;

function makeWorkspace(constants: Record<string, unknown>, overrides?: Record<string, unknown>): string {
  const workspace = mkdtempSync(join(tmpdir(), 'fhevm-npm-cleartext-config-'));
  const config = { appliesTo: { generations: ['v13'] }, constants, localhost: LOCALHOST, ...overrides };
  writeFileSync(join(workspace, 'cleartext-config.json'), JSON.stringify(config));
  return workspace;
}

const CONSTANTS = {
  CHAIN_ID: {
    value: '100733346448153',
    ts: 'number',
    tsEmit: 'bigint',
    solidity: 'uint256',
    summary: 'The chain id.',
    formula: 'uint48(uint256(keccak256("fhevm.cheat.chainId cleartext gateway")))',
  },
  PLAIN_COUNT: { value: '4', ts: 'number', solidity: 'uint256', summary: 'A count.' },
  URL: { value: 'https://relayer.cleartext.foo', ts: 'string', solidity: 'string', summary: 'A URL.' },
  HD_PATH: { value: "m/44'/60'/0'/2/", ts: 'string', solidity: 'string', summary: 'An HD path.' },
  URL_ALIAS: { alias: 'URL', ts: 'string', solidity: 'string', summary: 'An alias.' },
} as const;

test('renders the TypeScript face: order, formula comments, literal shapes, quoting, aliases', () => {
  const workspace = makeWorkspace(CONSTANTS);
  try {
    const outputs = renderCleartextConfigFaces(workspace);
    assert.deepEqual(
      outputs.map((output) => output.path),
      [
        join(workspace, 'common-vendored', 'src', 'cleartext-config-v13.ts'),
        join(workspace, 'host-contracts-cleartext', 'v13', 'pkg', 'src', 'cleartext', 'shared', 'LibFhevmCleartextConfig.sol'),
        join(workspace, 'host-contracts-cleartext', 'v13', 'scripts', 'cleartext-config.sh'),
      ],
    );

    const body = (outputs[0]?.content ?? '').split('\n\n').slice(1).join('\n\n');
    assert.equal(
      body,
      [
        '// uint48(uint256(keccak256("fhevm.cheat.chainId cleartext gateway")))',
        'export const CHAIN_ID = 100733346448153n;',
        '',
        'export const PLAIN_COUNT = 4;',
        '',
        "export const URL = 'https://relayer.cleartext.foo';",
        '',
        // Double quotes exactly where prettier would put them: the value holds a single quote.
        "export const HD_PATH = \"m/44'/60'/0'/2/\";",
        '',
        'export const URL_ALIAS = URL;',
        '',
      ].join('\n'),
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('renders the Solidity face: declared types, bare addresses, quoted strings, aliases', () => {
  const constants = {
    ...CONSTANTS,
    AN_ADDRESS: {
      value: '0x6189F6c0c3E40B4a3c72ec86262295D78d845297',
      ts: 'string',
      solidity: 'address',
      summary: 'An address.',
    },
    AN_INDEX: { value: '0', ts: 'number', solidity: 'uint32', summary: 'An index.' },
  };
  const workspace = makeWorkspace(constants);
  try {
    const sol = renderCleartextConfigFaces(workspace)[1]?.content ?? '';
    assert.match(sol, /^\/\/ SPDX-License-Identifier: BSD-3-Clause-Clear\npragma solidity \^0\.8\.24;\n/);
    const expected = [
      'library LibFhevmCleartextConfig {',
      // The one-line summary always; the formula line only where the JSON records one.
      '    /// The chain id.',
      '    // uint48(uint256(keccak256("fhevm.cheat.chainId cleartext gateway")))',
      '    uint256 internal constant CHAIN_ID = 100733346448153;',
      '',
      '    /// A count.',
      '    uint256 internal constant PLAIN_COUNT = 4;',
      '',
      '    /// A URL.',
      '    string internal constant URL = "https://relayer.cleartext.foo";',
      '',
      '    /// An HD path.',
      "    string internal constant HD_PATH = \"m/44'/60'/0'/2/\";",
      '',
      '    /// An alias.',
      '    string internal constant URL_ALIAS = URL;',
      '',
      '    /// An address.',
      '    address internal constant AN_ADDRESS = 0x6189F6c0c3E40B4a3c72ec86262295D78d845297;',
      '',
      '    /// An index.',
      '    uint32 internal constant AN_INDEX = 0;',
      '}',
      '',
    ].join('\n');
    assert.equal(sol.slice(sol.indexOf('library LibFhevmCleartextConfig {')), expected);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('renders the shell face: verbatim constants, alias references, deploy recipe, ZamaConfig trio', () => {
  const workspace = makeWorkspace(CONSTANTS);
  try {
    const sh = renderCleartextConfigFaces(workspace)[2]?.content ?? '';
    assert.match(sh, /^#!\/usr\/bin\/env bash\n# AUTO-GENERATED/);
    assert.match(sh, /^# uint48\(uint256\(keccak256\("fhevm\.cheat\.chainId cleartext gateway"\)\)\)$/m);
    assert.match(sh, /^CHAIN_ID="100733346448153"$/m);
    assert.match(sh, /^HD_PATH="m\/44'\/60'\/0'\/2\/"$/m);
    assert.match(sh, /^URL_ALIAS="\$URL"$/m);
    assert.match(sh, /^MNEMONIC="adapt mosquito move limb"$/m);
    assert.match(sh, /^DEPLOYER_ADDRESS_INDEX="5"$/m);
    assert.match(sh, /^ZAMA_LOCAL_ACL="0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D"$/m);
    assert.match(sh, /^ZAMA_LOCAL_COPROCESSOR="0xe3a9105a3a932253A70F126eb1E3b589C643dD24"$/m);
    assert.match(sh, /^ZAMA_LOCAL_KMS_VERIFIER="0x901F8942346f7AB3a01F6D7613119Bca447Bb030"$/m);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('write mode creates every face; check mode reports identical, different and missing', () => {
  const workspace = makeWorkspace(CONSTANTS);
  const shFace = join(workspace, 'host-contracts-cleartext', 'v13', 'scripts', 'cleartext-config.sh');
  try {
    const missing = generateCleartextConfig({ workspaceRoot: workspace, check: true });
    assert.deepEqual(
      missing.map((output) => output.status),
      ['missing', 'missing', 'missing'],
    );

    generateCleartextConfig({ workspaceRoot: workspace, check: false });
    assert.match(readFileSync(shFace, 'utf8'), /AUTO-GENERATED by `fhevm-npm generate cleartext-config`/);
    const identical = generateCleartextConfig({ workspaceRoot: workspace, check: true });
    assert.deepEqual(
      identical.map((output) => output.status),
      ['identical', 'identical', 'identical'],
    );

    writeFileSync(shFace, 'CHAIN_ID="1"\n');
    const drifted = generateCleartextConfig({ workspaceRoot: workspace, check: true });
    assert.deepEqual(
      drifted.map((output) => output.status),
      ['identical', 'identical', 'different'],
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('a constant scoped by `generations` reaches only those generations, and every face is complete for its own', () => {
  const constants = {
    ...CONSTANTS,
    V14_ONLY: { value: 'kms-core-', ts: 'string', solidity: 'string', generations: ['v14'] },
    V14_ONLY_ALIAS: { alias: 'V14_ONLY', ts: 'string', solidity: 'string', generations: ['v14'] },
    // An alias may be narrower than its target: URL is everywhere, this alias only in v14.
    NARROW_ALIAS: { alias: 'URL', ts: 'string', solidity: 'string', generations: ['v14'] },
    BOTH_EXPLICIT: { value: '7', ts: 'number', solidity: 'uint8', generations: ['v13', 'v14'] },
  };
  const workspace = makeWorkspace(constants, { appliesTo: { generations: ['v13', 'v14'] } });
  try {
    const outputs = renderCleartextConfigFaces(workspace);
    const rel = (path: string): string => path.slice(workspace.length + 1);
    // Three faces per generation, the TypeScript one first; no shared file anywhere.
    assert.deepEqual(
      outputs.map((o) => rel(o.path)),
      [
        join(...tsFacePath('v13')),
        'host-contracts-cleartext/v13/pkg/src/cleartext/shared/LibFhevmCleartextConfig.sol',
        'host-contracts-cleartext/v13/scripts/cleartext-config.sh',
        join(...tsFacePath('v14')),
        'host-contracts-cleartext/v14/pkg/src/cleartext/shared/LibFhevmCleartextConfig.sol',
        'host-contracts-cleartext/v14/scripts/cleartext-config.sh',
      ],
    );
    const byPath = new Map(outputs.map((o) => [rel(o.path), o.content]));
    const names = (content: string): string[] =>
      [...content.matchAll(/(?:export const|internal constant|^)\s*([A-Z][A-Z0-9_]*)\s*=/gm)].map((m) => m[1] ?? '');

    // v13's faces agree with each other: the unscoped set plus what names v13, nothing v14-only. (The shell
    // face also carries the deploy recipe, so it is checked for membership rather than for the exact list.)
    const v13Expected = [...Object.keys(CONSTANTS), 'BOTH_EXPLICIT'];
    assert.deepEqual(names(byPath.get(join(...tsFacePath('v13'))) ?? ''), v13Expected);
    assert.deepEqual(
      names(byPath.get('host-contracts-cleartext/v13/pkg/src/cleartext/shared/LibFhevmCleartextConfig.sol') ?? ''),
      v13Expected,
    );
    const v13Sh = byPath.get('host-contracts-cleartext/v13/scripts/cleartext-config.sh') ?? '';
    assert.match(v13Sh, /^BOTH_EXPLICIT="7"$/m);
    for (const face of [
      join(...tsFacePath('v13')),
      'host-contracts-cleartext/v13/pkg/src/cleartext/shared/LibFhevmCleartextConfig.sol',
      'host-contracts-cleartext/v13/scripts/cleartext-config.sh',
    ]) {
      assert.doesNotMatch(byPath.get(face) ?? '', /V14_ONLY|NARROW_ALIAS/, face);
    }

    // v14's three faces carry everything, in declaration order, with the aliases resolved by bare name.
    const v14Expected = [...Object.keys(CONSTANTS), 'V14_ONLY', 'V14_ONLY_ALIAS', 'NARROW_ALIAS', 'BOTH_EXPLICIT'];
    const v14Ts = byPath.get(join(...tsFacePath('v14'))) ?? '';
    assert.deepEqual(names(v14Ts), v14Expected);
    assert.match(v14Ts, /The v14 TypeScript face/);
    assert.doesNotMatch(v14Ts, /^import /m);
    assert.match(v14Ts, /^export const V14_ONLY_ALIAS = V14_ONLY;$/m);
    assert.match(v14Ts, /^export const NARROW_ALIAS = URL;$/m);
    const v14Sol = byPath.get('host-contracts-cleartext/v14/pkg/src/cleartext/shared/LibFhevmCleartextConfig.sol') ?? '';
    assert.deepEqual(names(v14Sol), v14Expected);
    assert.match(v14Sol, /string internal constant V14_ONLY_ALIAS = V14_ONLY;/);
    assert.match(
      byPath.get('host-contracts-cleartext/v14/scripts/cleartext-config.sh') ?? '',
      /^V14_ONLY_ALIAS="\$V14_ONLY"$/m,
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('an unscoped source of truth gives every generation identical faces, differing only by the name in the header', () => {
  const workspace = makeWorkspace(CONSTANTS, { appliesTo: { generations: ['v13', 'v14'] } });
  try {
    const outputs = renderCleartextConfigFaces(workspace);
    assert.equal(outputs.length, 6);
    const [v13Ts, v13Sol, v13Sh, v14Ts, v14Sol, v14Sh] = outputs.map((o) => o.content);
    assert.equal(v13Sol, v14Sol);
    assert.equal(v13Sh, v14Sh);
    const body = (ts: string | undefined): string => (ts ?? '').split('\n\n').slice(1).join('\n\n');
    assert.equal(body(v13Ts), body(v14Ts));
    assert.notEqual(v13Ts, v14Ts, 'the header names its generation');
    assert.match(body(v13Ts), /export const URL_ALIAS = URL;/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('rejects a malformed source of truth instead of emitting a wrong face', () => {
  const entry = { value: '1', ts: 'number', solidity: 'uint256' };
  const cases: readonly [Record<string, unknown>, Record<string, unknown> | undefined, RegExp][] = [
    [{ BOTH: { ...entry, alias: 'X' } }, undefined, /exactly one of "value" or "alias"/],
    [{ DANGLING: { alias: 'MISSING', ts: 'string', solidity: 'string' } }, undefined, /not declared/],
    [{ WIDE_STRING: { value: 'x', ts: 'string', tsEmit: 'bigint', solidity: 'string' } }, undefined, /only widen/],
    [{ HEXY: { ...entry, value: '0x10' } }, undefined, /decimal digits/],
    [{ lower_case: entry }, undefined, /CONSTANT_CASE/],
    [{ BAD_SOL: { ...entry, solidity: 'function' } }, undefined, /unknown "solidity" type/],
    [{ EXPANDS: { value: 'has a $dollar', ts: 'string', solidity: 'string' } }, undefined, /cannot emit a shell/],
    [{}, undefined, /declares no "constants"/],
    [{ OK: entry }, { appliesTo: { generations: [] } }, /no "appliesTo.generations"/],
    [{ OK: entry }, { appliesTo: { generations: ['0.13.0'] } }, /not a generation key/],
    [{ OK: entry }, { localhost: undefined }, /no "localhost" block/],
    [{ EMPTY_SCOPE: { ...entry, generations: [] } }, undefined, /"generations" is empty/],
    [{ DUP_SCOPE: { ...entry, generations: ['v13', 'v13'] } }, undefined, /repeats a generation/],
    [
      { UNKNOWN_SCOPE: { ...entry, generations: ['v14'] } },
      undefined,
      /scoped to 'v14', which appliesTo\.generations does not list/,
    ],
    // A target must be declared in every face its alias lands in: an unscoped alias of a scoped target
    // dangles everywhere the target is absent. The narrower direction is fine and tested above.
    [
      {
        TARGET: { ...entry, generations: ['v13'] },
        SHARED_ALIAS: { alias: 'TARGET', ts: 'number', solidity: 'uint256' },
      },
      undefined,
      /aliases TARGET, which is not declared everywhere SHARED_ALIAS is/,
    ],
  ];
  for (const [constants, overrides, message] of cases) {
    const workspace = makeWorkspace(constants, overrides);
    try {
      assert.throws(() => renderCleartextConfigFaces(workspace), message);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
});
