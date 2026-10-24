// What the sdk-compatibility tests share: the sdk lines this package declares, how to load each one, the chain
// definitions a client is given, the known gaps, and a cleartext stack with an SdkProbe to decrypt from.
//
// Golden rule 5: cleartext v(N) serves every sdk line from v(N-2) to v(N). The lines are the bare `@fhevm/sdk` (the
// current line) and every `@fhevm/sdk-prev<k>` npm alias (k lines back). package.json is the ONLY place that names
// them, so this file and the tests are identical across generations; V(N-1) drops those declarations at generation
// rotation (ROTATION.md) and the tests skip there.
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
import { expect } from 'vitest';
import {
  DEPLOYER_ADDRESS_INDEX,
  MNEMONIC,
  type AnvilNode,
  privateKeyFromMnemonic,
  waitForAnvil,
} from '@fhevm/sdk-common-dev';
import { createViemEthereumAdapters } from '@fhevm/sdk-vendored-dev/viemEthereumLib.ts';
import {
  CLEARTEXT_DECRYPTION_ADDRESS,
  CLEARTEXT_GATEWAY_CHAIN_ID,
  CLEARTEXT_INPUT_VERIFICATION_ADDRESS,
  deploy,
  rotateKmsContext,
} from '../../../pkg/ts/index.ts';
import { PACKAGE_ROOT_ABS_PATH } from '../../../internal/constants.ts';
import { FIXTURE_ATTESTATION, defaultKmsEpochActivators, fundKmsTxSenders } from './kmsEpochActivators.ts';

// ---------------------------------------------------------------------------------------------------------------
// The sdk lines under test, discovered from package.json.
// ---------------------------------------------------------------------------------------------------------------

const SDK_NAME = /^@fhevm\/sdk(?:-prev\d+)?$/;
const packageJson = JSON.parse(readFileSync(join(PACKAGE_ROOT_ABS_PATH, 'package.json'), 'utf8')) as {
  devDependencies?: Record<string, string>;
};
export const SDK_LINES = Object.keys(packageJson.devDependencies ?? {})
  .filter((name) => SDK_NAME.test(name))
  .sort();

// The sdk surface the tests use, typed structurally: no import names a line, so tsc needs no generation number.
type TypedValue = { readonly type: string; readonly value: unknown };
type TransportKeyPair = unknown;
type SignedPermit = unknown;
export type SdkClient = {
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
  serializeTransportKeyPair(args: { transportKeyPair: TransportKeyPair }): Promise<unknown>;
  parseTransportKeyPair(args: StoredPermit['transportKeyPair']): Promise<TransportKeyPair>;
  serializeSignedDecryptionPermit(args: { signedPermit: SignedPermit }): Promise<unknown>;
  parseSignedDecryptionPermit(args: {
    serializedPermit: StoredPermit['signedPermit'];
    transportKeyPair: TransportKeyPair;
  }): Promise<SignedPermit>;
  decryptValues(args: {
    encryptedValues: Hex[];
    contractAddress: Address;
    transportKeyPair: TransportKeyPair;
    signedPermit: SignedPermit;
  }): Promise<readonly TypedValue[]>;
};
export type SdkLine = {
  readonly name: string;
  readonly version: string;
  /** The protocol line the sdk was built for: `0.<minor>.x` → minor. Read from the installed copy, never the name. */
  readonly protocolLine: number;
  createClient(publicClient: PublicClient, chain: unknown): SdkClient;
  defineChain(definition: unknown): unknown;
};

// The three entry points imported from each line, as far as the tests use them.
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
  // A process-wide singleton in the sdk — one per installed COPY, so each line sets its own. Every cleartext client
  // of a copy shares one runtime, and the sdk caches the KMS context and its signers per runtime: a new client in the
  // same process does NOT re-read them. Only a new process starts with an empty cache.
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
// The chain definition a client is given.
// ---------------------------------------------------------------------------------------------------------------

function cleartextChain(sdk: SdkLine, stack: Stack): unknown {
  const contract = (address: string) => ({ address: getAddress(address) });
  const { fhevmAddresses } = stack;
  return sdk.defineChain({
    id: foundry.id,
    fhevm: {
      contracts: {
        acl: contract(fhevmAddresses.aclAddress),
        inputVerifier: contract(fhevmAddresses.inputVerifierAddress),
        kmsVerifier: contract(fhevmAddresses.kmsVerifierAddress),
        protocolConfig: contract(fhevmAddresses.protocolConfigAddress),
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

/** How many lines back a declared name is: `@fhevm/sdk` is 0, `@fhevm/sdk-prev<k>` is k. */
const linesBack = (sdkName: string): number => Number(/-prev(\d+)$/.exec(sdkName)?.[1] ?? 0);

/** Every (older line, newer line) pair: a permit the older one signed, which the newer one goes on using. */
export const UPGRADES = SDK_LINES.flatMap((olderName) =>
  SDK_LINES.filter((newerName) => linesBack(newerName) < linesBack(olderName)).map((newerName) => ({
    olderName,
    newerName,
  })),
);

/** A distinct clear value per sdk line and per stack, so a decryption cannot pass by reading another line's handle. */
export const clearValueOf = (sdkName: string, offset: number) => BigInt(offset + 1 + SDK_LINES.indexOf(sdkName));

export async function connect(env: Env, sdkName: string): Promise<{ sdk: SdkLine; client: SdkClient }> {
  const sdk = await loadSdkLine(sdkName);
  const client = sdk.createClient(env.publicClient, cleartextChain(sdk, env.stack));
  await client.ready;
  return { sdk, client };
}

// ---------------------------------------------------------------------------------------------------------------
// Known gaps, predicted from what the sdk builds and what the host serves.
// ---------------------------------------------------------------------------------------------------------------

export type Scenario =
  | 'encrypt'
  | 'publicDecrypt'
  | 'userDecrypt'
  | 'delegatedUserDecrypt'
  | 'permitFromAnEarlierKmsContext'
  | 'permitFromAnOlderSdkLine'
  | 'publicDecryptWithAStaleKmsContext'
  | 'userDecryptWithAStaleKmsContext';
export type GapContext = {
  sdk: SdkLine;
  kmsVerifierVersion: readonly number[];
  scenario: Scenario;
};
type Gap = { id: string; when: (c: GapContext) => boolean; error: RegExp };

const atLeast = (version: readonly number[], floor: readonly number[]): boolean => {
  for (const [i, minimum] of floor.entries()) {
    const part = version[i] ?? 0;
    if (part !== minimum) return part > minimum;
  }
  return true;
};
// sdk 0.14 builds KMS extraData version 2 when the KMSVerifier is 0.4.0 or newer (the chain definition names
// protocolConfig); every other combination builds version 1.
const sdkBuildsExtraDataV2 = (c: GapContext) => c.sdk.protocolLine >= 14 && atLeast(c.kmsVerifierVersion, [0, 4, 0]);
// sdk 0.14.4 is the first release whose cleartext path passes the extraData it verifies against to the host
// (publicDecrypt(handles, extraData), userDecrypt(..., extraData)), and the host serves the context it names. Every
// gap below is an older release not passing it, so none applies from there on.
const sdkPassesExtraData = (c: GapContext) => atLeast(c.sdk.version.split(/[.-]/).map(Number), [0, 14, 4]);

// The host's custom error, which the sdk cannot name (it does not carry the host's ABI): CleartextKMSVerifier's
// CleartextErrorInvalidUserDecryptSignature().
const INVALID_USER_DECRYPT_SIGNATURE = /0x231d92fd/;
// The sdk recovered a signer that is not in the KMS signer list it holds: the host signed for another extraData.
const UNKNOWN_KMS_SIGNER = /is not in the list of kms signers/;

const GAPS: readonly Gap[] = [
  {
    // MIGRATION-v14 Annex A.3: the sdk's cleartext path calls publicDecrypt(handles) without the extraData it then
    // verifies against, and the host answers with version 1 (what the sdk releases that call it build).
    id: 'public decryption, extraData v2 (Annex A.3)',
    when: (c) =>
      (c.scenario === 'publicDecrypt' || c.scenario === 'publicDecryptWithAStaleKmsContext') &&
      sdkBuildsExtraDataV2(c) &&
      !sdkPassesExtraData(c),
    error: UNKNOWN_KMS_SIGNER,
  },
  {
    // MIGRATION-v14 Annex A.3: a permit stays valid across a KMS rotation and names the context it was signed in,
    // but the sdk's cleartext path calls userDecrypt without that extraData, and the host only tries the current
    // context's: the user's signature does not verify. userDecrypt(..., extraData) serves it once the sdk passes it.
    id: 'user decryption with a permit from an earlier KMS context (Annex A.3)',
    when: (c) => c.scenario === 'permitFromAnEarlierKmsContext' && !sdkPassesExtraData(c),
    error: INVALID_USER_DECRYPT_SIGNATURE,
  },
  {
    // The sdk caches the KMS context and its signers per runtime (15 minutes for the context, 24 hours for the
    // signers), and every client of one sdk copy shares one runtime. A process that used the sdk before a rotation
    // keeps the previous context: its fresh permits name it (the host only tries the current one), and it checks
    // public decryptions against the previous signers. Fixed by the sdk passing the extraData (the host then serves
    // the context it names), or by an sdk cache that a new client refreshes.
    id: 'an sdk process that used the previous KMS context keeps it after a rotation',
    when: (c) => c.scenario === 'userDecryptWithAStaleKmsContext' && !sdkPassesExtraData(c),
    error: INVALID_USER_DECRYPT_SIGNATURE,
  },
  {
    id: 'an sdk process that used the previous KMS context keeps it after a rotation (public decryption)',
    when: (c) => c.scenario === 'publicDecryptWithAStaleKmsContext' && !sdkPassesExtraData(c),
    error: UNKNOWN_KMS_SIGNER,
  },
];

export async function expectOutcome(context: GapContext, run: () => Promise<void>): Promise<void> {
  const gap = GAPS.find((g) => g.when(context));
  if (gap === undefined) {
    await run();
    return;
  }
  // When this assertion fails because the call SUCCEEDED, the gap is fixed: remove it from GAPS.
  await expect(run(), `expected known gap: ${gap.id}`).rejects.toThrow(gap.error);
}

// ---------------------------------------------------------------------------------------------------------------
// The stack: one anvil, the cleartext host, and SdkProbes.
// ---------------------------------------------------------------------------------------------------------------

type Stack = Awaited<ReturnType<typeof deploy>>;

export const ACL_ABI = parseAbi([
  'function delegateForUserDecryption(address delegate, address contractAddress, uint64 expirationDate)',
]);
const KMS_VERIFIER_ABI = parseAbi([
  'function getVersion() view returns (string)',
  'function verifyDecryptionEIP712KMSSignatures(bytes32[] handlesList, bytes decryptedResult, bytes decryptionProof) returns (bool)',
]);
const FHE_TYPE_UINT8 = 2;
export const DAY = 24 * 60 * 60;

type Probe = { abi: Abi; bytecode: Hex };
let compiledProbe: Probe | undefined;

/** SdkProbe, compiled by forge on first use. */
export function probe(): Probe {
  if (compiledProbe !== undefined) return compiledProbe;
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
    compiledProbe = { abi: artifact.abi, bytecode: artifact.bytecode.object };
    return compiledProbe;
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

const account = (addressIndex: number): LocalAccount => mnemonicToAccount(MNEMONIC, { addressIndex });
const signerOf = (user: LocalAccount) => ({ signTypedData: (data: unknown) => user.signTypedData(data as never) });
export const alice = account(7);
export const bob = account(8);

/** One anvil with a deployed cleartext host. */
export type Env = {
  readonly anvil: AnvilNode;
  readonly rpcUrl: string;
  readonly publicClient: PublicClient;
  readonly stack: Stack;
  readonly kmsVerifierVersion: readonly number[];
  readonly deployerKey: Hex;
};

export async function startEnv(anvil: AnvilNode): Promise<Env> {
  const { rpcUrl } = anvil;
  await waitForAnvil(rpcUrl);
  const deployerKey = privateKeyFromMnemonic({ mnemonic: MNEMONIC, addressIndex: DEPLOYER_ADDRESS_INDEX });
  const adapters = createViemEthereumAdapters({ rpcUrl, privateKey: deployerKey });
  const publicClient = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
  const stack = await deploy({
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
  const kmsVerifierVersion = (/(\d+)\.(\d+)\.(\d+)/.exec(version) ?? []).slice(1).map(Number);
  return { anvil, rpcUrl, publicClient, stack, kmsVerifierVersion, deployerKey };
}

// The default KMS pools are derived from the FHEVM test mnemonic, signers at m/44'/60'/0'/3/<i>.
const FHEVM_MNEMONIC = 'test test test test test test test future home engine virtual motion';

/** Replaces the KMS committee (signers 0-3 by 4-7): a new KMS context and epoch; the previous context stays valid. */
export async function rotateKms(env: Env): Promise<void> {
  // The incoming committee attests; the outgoing one supplies the previous-committee confirmations the creation
  // quorum also needs. Both pools come from the FHEVM mnemonic, so both need gas first.
  const incoming = defaultKmsEpochActivators({ rpcUrl: env.rpcUrl, mnemonic: FHEVM_MNEMONIC, indices: [4, 5, 6, 7] });
  const outgoing = defaultKmsEpochActivators({ rpcUrl: env.rpcUrl, mnemonic: FHEVM_MNEMONIC, indices: [0, 1, 2, 3] });
  await fundKmsTxSenders({ rpcUrl: env.rpcUrl, activators: [...incoming, ...outgoing] });
  const adapters = createViemEthereumAdapters({ rpcUrl: env.rpcUrl, privateKey: env.deployerKey });
  await rotateKmsContext({
    ethProvider: adapters.provider,
    ethUtils: adapters.utils,
    admin: adapters.signer,
    aclOwnerAddress: env.stack.aclOwnerAddress,
    protocolConfigAddress: env.stack.fhevmAddresses.protocolConfigAddress,
    chainId: BigInt(foundry.id),
    activators: incoming,
    previousTxSenders: outgoing.map((activator) => activator.txSender),
    attestation: FIXTURE_ATTESTATION,
  });
}

export async function deployProbe(env: Env): Promise<Address> {
  const wallet = createWalletClient({ account: alice, chain: foundry, transport: http(env.rpcUrl) });
  const hash = await wallet.deployContract({
    abi: probe().abi,
    bytecode: probe().bytecode,
    args: [env.stack.fhevmAddresses.fhevmExecutorAddress, env.stack.fhevmAddresses.aclAddress],
  });
  const receipt = await env.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.contractAddress == null) throw new Error('SdkProbe deployment created no contract');
  return receipt.contractAddress;
}

export async function send(
  env: Env,
  from: LocalAccount,
  address: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[],
): Promise<void> {
  const wallet = createWalletClient({ account: from, chain: foundry, transport: http(env.rpcUrl) });
  const hash = await wallet.writeContract({ address, abi, functionName, args });
  const receipt = await env.publicClient.waitForTransactionReceipt({ hash });
  expect(receipt.status).toBe('success');
}

const readHandle = async (env: Env, probeAddress: Address) =>
  (await env.publicClient.readContract({ address: probeAddress, abi: probe().abi, functionName: 'handle' })) as Hex;

/** Encrypts `clear` with the sdk for a fresh SdkProbe, which stores it and grants it to itself and to alice. */
export async function submitToNewProbe(
  env: Env,
  client: SdkClient,
  clear: bigint,
): Promise<{ probeAddress: Address; handle: Hex }> {
  const probeAddress = await deployProbe(env);
  const input = await client.encryptValue({
    value: { type: 'euint8', value: clear },
    contractAddress: probeAddress,
    userAddress: alice.address,
  });
  await send(env, alice, probeAddress, probe().abi, 'submit', [input.encryptedValue, input.inputProof, FHE_TYPE_UINT8]);
  const handle = await readHandle(env, probeAddress);
  expect(handle).toBe(input.encryptedValue);
  return { probeAddress, handle };
}

/** Same as `submitToNewProbe`, without the sdk: the probe trivially encrypts `clear` itself. */
export async function trivialToNewProbe(env: Env, clear: bigint): Promise<{ probeAddress: Address; handle: Hex }> {
  const probeAddress = await deployProbe(env);
  await send(env, alice, probeAddress, probe().abi, 'trivial', [clear, FHE_TYPE_UINT8]);
  return { probeAddress, handle: await readHandle(env, probeAddress) };
}

export async function makePubliclyDecryptable(env: Env, probeAddress: Address): Promise<void> {
  await send(env, alice, probeAddress, probe().abi, 'makePubliclyDecryptable', []);
}

export type Permit = { transportKeyPair: TransportKeyPair; signedPermit: SignedPermit };

/** A permit as an app stores it: the sdk's own serialization, plain JSON. */
export type StoredPermit = {
  transportKeyPair: { publicKey: string; privateKey: string; tkmsVersion?: string };
  signedPermit: {
    version: number;
    eip712: unknown;
    signature: string;
    signerAddress: string;
    delegatorAddress?: string;
  };
};

/** Stores a permit the way an app does: the sdk's own serialization, through JSON. */
export async function storePermit(client: SdkClient, permit: Permit): Promise<StoredPermit> {
  const stored = {
    transportKeyPair: await client.serializeTransportKeyPair({ transportKeyPair: permit.transportKeyPair }),
    signedPermit: await client.serializeSignedDecryptionPermit({ signedPermit: permit.signedPermit }),
  };
  return JSON.parse(JSON.stringify(stored)) as StoredPermit;
}

/** Loads a stored permit the way an app does on start-up. */
export async function loadPermit(client: SdkClient, stored: StoredPermit): Promise<Permit> {
  const transportKeyPair = await client.parseTransportKeyPair(stored.transportKeyPair);
  const signedPermit = await client.parseSignedDecryptionPermit({
    serializedPermit: stored.signedPermit,
    transportKeyPair,
  });
  return { transportKeyPair, signedPermit };
}

export async function signPermit(
  env: Env,
  client: SdkClient,
  user: LocalAccount,
  contractAddress: Address,
  delegatorAddress?: Address,
): Promise<Permit> {
  const transportKeyPair = await client.generateTransportKeyPair();
  const { timestamp } = await env.publicClient.getBlock();
  const signedPermit = await client.signLegacyDecryptionPermit({
    contractAddresses: [contractAddress],
    startTimestamp: Number(timestamp),
    durationSeconds: DAY,
    signerAddress: user.address,
    signer: signerOf(user),
    ...(delegatorAddress === undefined ? {} : { delegatorAddress }),
    transportKeyPair,
  });
  return { transportKeyPair, signedPermit };
}

export async function userDecryptWith(
  client: SdkClient,
  permit: Permit,
  handle: Hex,
  contractAddress: Address,
): Promise<bigint> {
  const values = await client.decryptValues({ encryptedValues: [handle], contractAddress, ...permit });
  return asBigInt(values[0]?.value);
}

export async function publicDecryptAndVerify(env: Env, client: SdkClient, handle: Hex): Promise<bigint> {
  const res = await client.decryptPublicValuesWithSignatures({ encryptedValues: [handle] });
  const { result } = await env.publicClient.simulateContract({
    address: env.stack.fhevmAddresses.kmsVerifierAddress as Address,
    abi: KMS_VERIFIER_ABI,
    functionName: 'verifyDecryptionEIP712KMSSignatures',
    args: [[handle], res.checkSignaturesArgs.abiEncodedCleartexts, res.checkSignaturesArgs.decryptionProof],
  });
  expect(result).toBe(true);
  return asBigInt(res.clearValues[0]?.value);
}

// The sdk returns an euint8 as a bigint today; a number would be as correct.
function asBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  throw new Error(`expected a decrypted integer, got ${typeof value}`);
}
