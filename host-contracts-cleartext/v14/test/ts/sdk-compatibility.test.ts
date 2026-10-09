// Golden rule 5: cleartext v(N) serves every sdk line from v(N-2) to v(N). This file runs the same scenarios against
// each line this package declares — the bare `@fhevm/sdk` (the current line) and every `@fhevm/sdk-prev<k>` npm alias
// (k lines back). package.json is the ONLY place that names the lines, so this file is identical across generations;
// V(N-1) drops those declarations at rotation and the whole suite skips there.
//
// A known gap is DATA, not a branch: `GAPS` predicts it from what the sdk builds and what the host serves, both read
// at run time, and the test asserts the failure. The day a fixed sdk is pinned, the call succeeds, the test fails, and
// the gap is removed on purpose.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  parseAbi,
} from 'viem';
import { mnemonicToAccount, type LocalAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  DEPLOYER_ADDRESS_INDEX,
  MNEMONIC,
  privateKeyFromMnemonic,
  startAnvil,
  stopAnvil,
  waitForAnvil,
} from '@fhevm/sdk-common-dev';
import { createViemEthereumAdapters } from '@fhevm/sdk-vendored-dev/viemEthereumLib.ts';
import {
  CLEARTEXT_DECRYPTION_ADDRESS,
  CLEARTEXT_GATEWAY_CHAIN_ID,
  CLEARTEXT_INPUT_VERIFICATION_ADDRESS,
  deploy,
} from '../../pkg/ts/index.ts';
import { PACKAGE_ROOT_ABS_PATH } from '../../internal/constants.ts';

// ---------------------------------------------------------------------------------------------------------------
// The sdk lines under test, discovered from package.json.
// ---------------------------------------------------------------------------------------------------------------

const SDK_NAME = /^@fhevm\/sdk(?:-prev\d+)?$/;
const packageJson = JSON.parse(readFileSync(join(PACKAGE_ROOT_ABS_PATH, 'package.json'), 'utf8')) as {
  devDependencies?: Record<string, string>;
};
const SDK_LINES = Object.keys(packageJson.devDependencies ?? {})
  .filter((name) => SDK_NAME.test(name))
  .sort();

// The sdk surface this file uses, typed structurally: no import names a line, so tsc needs no generation number.
type TypedValue = { readonly type: string; readonly value: unknown };
type TransportKeyPair = unknown;
type SignedPermit = unknown;
type SdkClient = {
  readonly ready: Promise<unknown>;
  encryptValue(args: {
    value: { type: string; value: bigint | boolean | string };
    contractAddress: Address;
    userAddress: Address;
  }): Promise<{ encryptedValue: Hex; inputProof: Hex }>;
  decryptPublicValuesWithSignatures(args: { encryptedValues: Hex[] }): Promise<{
    clearValues: readonly TypedValue[];
    checkSignaturesArgs: { abiEncodedCleartexts: Hex; decryptionProof: Hex };
  }>;
  generateTransportKeyPair(): Promise<TransportKeyPair>;
  signLegacyDecryptionPermit(args: {
    contractAddresses: Address[];
    startTimestamp: number;
    durationSeconds: number;
    signerAddress: Address;
    signer: { signTypedData(data: unknown): Promise<Hex> };
    delegatorAddress?: Address;
    transportKeyPair: TransportKeyPair;
  }): Promise<SignedPermit>;
  decryptValues(args: {
    encryptedValues: Hex[];
    contractAddress: Address;
    transportKeyPair: TransportKeyPair;
    signedPermit: SignedPermit;
  }): Promise<readonly TypedValue[]>;
};
type SdkLine = {
  readonly name: string;
  readonly version: string;
  /** The protocol line the sdk was built for: `0.<minor>.x` → minor. Read from the installed copy, never the name. */
  readonly protocolLine: number;
  createClient(publicClient: PublicClient, chain: unknown): SdkClient;
  defineChain(definition: unknown): unknown;
};

// The three entry points this file imports from each line, as far as it uses them.
type SdkViemModule = { hasFhevmRuntimeConfig(): boolean; setFhevmRuntimeConfig(config: object): void };
type SdkCleartextModule = {
  createFhevmCleartextClient(args: { publicClient: PublicClient; chain: unknown }): SdkClient;
};
type SdkChainsModule = { defineFhevmChain(definition: unknown): unknown };

const requireFromPackage = createRequire(join(PACKAGE_ROOT_ABS_PATH, 'package.json'));

async function loadSdkLine(name: string): Promise<SdkLine> {
  const manifest = JSON.parse(readFileSync(requireFromPackage.resolve(`${name}/package.json`), 'utf8')) as {
    version: string;
  };
  const viem = (await import(`${name}/viem`)) as SdkViemModule;
  const cleartext = (await import(`${name}/viem/cleartext`)) as SdkCleartextModule;
  const chains = (await import(`${name}/chains`)) as SdkChainsModule;
  // A process-wide singleton in the sdk — one per installed COPY, so each line sets its own.
  if (!viem.hasFhevmRuntimeConfig()) viem.setFhevmRuntimeConfig({});
  return {
    name,
    version: manifest.version,
    protocolLine: Number(manifest.version.split('.')[1]),
    createClient: (publicClient, chain) => cleartext.createFhevmCleartextClient({ publicClient, chain }),
    defineChain: (definition) => chains.defineFhevmChain(definition),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The chain definitions an sdk client is given.
// ---------------------------------------------------------------------------------------------------------------

const CHAIN_VARIANTS = [
  { name: 'full chain definition', protocolConfig: true },
  // !!! TEMPORARY — the "no protocolConfig" trick of the hardhat plugins (MIGRATION-v14 Annex A.5). Delete this
  // variant when the patched sdk releases are pinned and the trick is removed.
  { name: 'without protocolConfig (TEMPORARY trick)', protocolConfig: false },
] as const;
type ChainVariant = (typeof CHAIN_VARIANTS)[number];

function cleartextChain(sdk: SdkLine, stack: Stack, variant: ChainVariant): unknown {
  const contract = (address: string) => ({ address: getAddress(address) });
  const { fhevmAddresses } = stack;
  return sdk.defineChain({
    id: foundry.id,
    fhevm: {
      contracts: {
        acl: contract(fhevmAddresses.aclAddress),
        inputVerifier: contract(fhevmAddresses.inputVerifierAddress),
        kmsVerifier: contract(fhevmAddresses.kmsVerifierAddress),
        ...(variant.protocolConfig ? { protocolConfig: contract(fhevmAddresses.protocolConfigAddress) } : {}),
      },
      // Required by the type, unused in cleartext mode.
      relayerUrl: 'http://localhost:8545',
      gateway: {
        id: Number(CLEARTEXT_GATEWAY_CHAIN_ID),
        contracts: {
          decryption: contract(CLEARTEXT_DECRYPTION_ADDRESS),
          inputVerification: contract(CLEARTEXT_INPUT_VERIFICATION_ADDRESS),
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Known gaps, predicted from what the sdk builds and what the host serves.
// ---------------------------------------------------------------------------------------------------------------

type Scenario = 'encrypt' | 'publicDecrypt' | 'userDecrypt' | 'delegatedUserDecrypt';
type GapContext = { sdk: SdkLine; variant: ChainVariant; kmsVerifierVersion: readonly number[]; scenario: Scenario };
type Gap = { id: string; when: (c: GapContext) => boolean; error: RegExp };

const atLeast = (version: readonly number[], floor: readonly number[]): boolean => {
  for (const [i, minimum] of floor.entries()) {
    const part = version[i] ?? 0;
    if (part !== minimum) return part > minimum;
  }
  return true;
};
// sdk 0.14 builds KMS extraData version 2 when the KMSVerifier is 0.4.0 or newer and the chain names protocolConfig;
// every other combination builds version 1.
const sdkBuildsExtraDataV2 = (c: GapContext) =>
  c.sdk.protocolLine >= 14 && c.variant.protocolConfig && atLeast(c.kmsVerifierVersion, [0, 4, 0]);

const GAPS: readonly Gap[] = [
  {
    // MIGRATION-v14 Annex A.3: the sdk's cleartext path calls publicDecrypt(handles) without the extraData it then
    // verifies against, and the host answers with version 1 (the temporary default).
    id: 'public decryption, extraData v2 (Annex A.3)',
    when: (c) => c.scenario === 'publicDecrypt' && sdkBuildsExtraDataV2(c),
    // The sdk recovers a signer from the host's v1 signatures over its own v2 digest: a junk address.
    error: /is not in the list of kms signers/,
  },
];

async function expectOutcome(context: GapContext, run: () => Promise<void>): Promise<void> {
  const gap = GAPS.find((g) => g.when(context));
  if (gap === undefined) {
    await run();
    return;
  }
  // When this assertion fails because the call SUCCEEDED, the gap is fixed: remove it from GAPS.
  await expect(run(), `expected known gap: ${gap.id}`).rejects.toThrow(gap.error);
}

// ---------------------------------------------------------------------------------------------------------------
// The stack: one anvil, the cleartext host, and an SdkProbe per (line, variant).
// ---------------------------------------------------------------------------------------------------------------

type Stack = Awaited<ReturnType<typeof deploy>>;

const ACL_ABI = parseAbi([
  'function delegateForUserDecryption(address delegate, address contractAddress, uint64 expirationDate)',
]);
const KMS_VERIFIER_ABI = parseAbi([
  'function getVersion() view returns (string)',
  'function verifyDecryptionEIP712KMSSignatures(bytes32[] handlesList, bytes decryptedResult, bytes decryptionProof) returns (bool)',
]);
const FHE_TYPE_UINT8 = 2;
const DAY = 24 * 60 * 60;

type Probe = { abi: Abi; bytecode: Hex };

function compileProbe(): Probe {
  const out = mkdtempSync(join(tmpdir(), 'sdk-probe-'));
  try {
    execFileSync(
      'forge',
      ['build', 'test/ts/fixtures/SdkProbe.sol', '--out', join(out, 'out'), '--cache-path', join(out, 'cache')],
      { cwd: PACKAGE_ROOT_ABS_PATH, stdio: 'pipe' },
    );
    const artifact = JSON.parse(readFileSync(join(out, 'out', 'SdkProbe.sol', 'SdkProbe.json'), 'utf8')) as {
      abi: Abi;
      bytecode: { object: Hex };
    };
    return { abi: artifact.abi, bytecode: artifact.bytecode.object };
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

const account = (addressIndex: number): LocalAccount => mnemonicToAccount(MNEMONIC, { addressIndex });
const signerOf = (user: LocalAccount) => ({ signTypedData: (data: unknown) => user.signTypedData(data as never) });

let anvil: ReturnType<typeof startAnvil> | undefined;
let rpcUrl: string;
let publicClient: PublicClient;
let stack: Stack;
let probe: Probe;
let kmsVerifierVersion: number[];
const alice = account(7);
const bob = account(8);

beforeAll(async () => {
  if (SDK_LINES.length === 0) return;
  probe = compileProbe();
  anvil = startAnvil({ port: 8660, mnemonic: MNEMONIC });
  rpcUrl = anvil.rpcUrl;
  await waitForAnvil(rpcUrl);
  const deployerKey = privateKeyFromMnemonic({ mnemonic: MNEMONIC, addressIndex: DEPLOYER_ADDRESS_INDEX });
  const adapters = createViemEthereumAdapters({ rpcUrl, privateKey: deployerKey });
  publicClient = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
  stack = await deploy({
    ethProvider: adapters.provider,
    ethUtils: adapters.utils,
    deployer: adapters.signer,
    admin: adapters.signer,
  });
  const version = await publicClient.readContract({
    address: stack.fhevmAddresses.kmsVerifierAddress as Address,
    abi: KMS_VERIFIER_ABI,
    functionName: 'getVersion',
  });
  kmsVerifierVersion = (/(\d+)\.(\d+)\.(\d+)/.exec(version) ?? []).slice(1).map(Number);
}, 120_000);

afterAll(async () => {
  if (anvil !== undefined) await stopAnvil(anvil.process);
});

async function deployProbe(): Promise<Address> {
  const wallet = createWalletClient({ account: alice, chain: foundry, transport: http(rpcUrl) });
  const hash = await wallet.deployContract({
    abi: probe.abi,
    bytecode: probe.bytecode,
    args: [stack.fhevmAddresses.fhevmExecutorAddress, stack.fhevmAddresses.aclAddress],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.contractAddress == null) throw new Error('SdkProbe deployment created no contract');
  return receipt.contractAddress;
}

async function send(from: LocalAccount, address: Address, abi: Abi, functionName: string, args: readonly unknown[]) {
  const wallet = createWalletClient({ account: from, chain: foundry, transport: http(rpcUrl) });
  const hash = await wallet.writeContract({ address, abi, functionName, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  expect(receipt.status).toBe('success');
}

async function userDecryptOne(
  client: SdkClient,
  user: LocalAccount,
  handle: Hex,
  contractAddress: Address,
  delegatorAddress?: Address,
): Promise<unknown> {
  const transportKeyPair = await client.generateTransportKeyPair();
  const { timestamp } = await publicClient.getBlock();
  const signedPermit = await client.signLegacyDecryptionPermit({
    contractAddresses: [contractAddress],
    startTimestamp: Number(timestamp),
    durationSeconds: DAY,
    signerAddress: user.address,
    signer: signerOf(user),
    ...(delegatorAddress === undefined ? {} : { delegatorAddress }),
    transportKeyPair,
  });
  const values = await client.decryptValues({
    encryptedValues: [handle],
    contractAddress,
    transportKeyPair,
    signedPermit,
  });
  return values[0]?.value;
}

// The sdk returns an euint8 as a bigint today; a number would be as correct.
function asBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  throw new Error(`expected a decrypted integer, got ${typeof value}`);
}

// ---------------------------------------------------------------------------------------------------------------
// The scenarios, for every (sdk line, chain variant).
// ---------------------------------------------------------------------------------------------------------------

describe.skipIf(SDK_LINES.length === 0).each(SDK_LINES)('%s', (sdkName) => {
  describe.each(CHAIN_VARIANTS)('$name', (variant) => {
    let sdk: SdkLine;
    let client: SdkClient;
    let probeAddress: Address;
    let handle: Hex;
    // A distinct clear value per (line, variant), so a decryption cannot pass by reading another one's handle.
    const clear = BigInt(1 + SDK_LINES.indexOf(sdkName) * CHAIN_VARIANTS.length + CHAIN_VARIANTS.indexOf(variant));
    const context = (scenario: Scenario): GapContext => ({ sdk, variant, kmsVerifierVersion, scenario });

    beforeAll(async () => {
      sdk = await loadSdkLine(sdkName);
      client = sdk.createClient(publicClient, cleartextChain(sdk, stack, variant));
      await client.ready;
      probeAddress = await deployProbe();
    });

    test('encrypts an input the host verifies on chain', async () => {
      await expectOutcome(context('encrypt'), async () => {
        const input = await client.encryptValue({
          value: { type: 'euint8', value: clear },
          contractAddress: probeAddress,
          userAddress: alice.address,
        });
        await send(alice, probeAddress, probe.abi, 'submit', [input.encryptedValue, input.inputProof, FHE_TYPE_UINT8]);
        handle = (await publicClient.readContract({
          address: probeAddress,
          abi: probe.abi,
          functionName: 'handle',
        })) as Hex;
        expect(handle).toBe(input.encryptedValue);
      });
    });

    test('user-decrypts with a permit signed now', async () => {
      await expectOutcome(context('userDecrypt'), async () => {
        expect(asBigInt(await userDecryptOne(client, alice, handle, probeAddress))).toBe(clear);
      });
    });

    test('user-decrypts on behalf of a delegator', async () => {
      await expectOutcome(context('delegatedUserDecrypt'), async () => {
        const { timestamp } = await publicClient.getBlock();
        await send(alice, stack.fhevmAddresses.aclAddress as Address, ACL_ABI, 'delegateForUserDecryption', [
          bob.address,
          probeAddress,
          timestamp + BigInt(DAY),
        ]);
        const value = await userDecryptOne(client, bob, handle, probeAddress, alice.address);
        expect(asBigInt(value)).toBe(clear);
      });
    });

    test('public-decrypts, and the KMSVerifier accepts the proof on chain', async () => {
      await send(alice, probeAddress, probe.abi, 'makePubliclyDecryptable', []);
      await expectOutcome(context('publicDecrypt'), async () => {
        const res = await client.decryptPublicValuesWithSignatures({ encryptedValues: [handle] });
        expect(asBigInt(res.clearValues[0]?.value)).toBe(clear);
        const { result } = await publicClient.simulateContract({
          address: stack.fhevmAddresses.kmsVerifierAddress as Address,
          abi: KMS_VERIFIER_ABI,
          functionName: 'verifyDecryptionEIP712KMSSignatures',
          args: [[handle], res.checkSignaturesArgs.abiEncodedCleartexts, res.checkSignaturesArgs.decryptionProof],
        });
        expect(result).toBe(true);
      });
    });
  });
});
