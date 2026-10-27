// The previous generation, imported straight from the WORKSPACE — it is a member, so npm has already
// linked it into node_modules and there is nothing to build, pack or install first. The subpath works
// because a harness manifest declares no `exports` (ARCHITECTURE.md I2); this import is what keeps that
// mechanism exercised rather than merely documented.
//
// Deliberately NOT a tarball. A tarball buys publish fidelity — `files` omissions, undeclared deps,
// stale build output — and that is worth paying for when the package under test is the thing being
// published. Here the previous generation is just a library used to stand up the "before" stack, and its
// own publish contract is proven by its own `test:tarball:run`. This generation, below, is still consumed by
// its PUBLISHED name, because that half IS the publish rehearsal.
//
// Its exports are UNSUFFIXED — a package is pinned to one generation by its own version, so the
// specifier is what says which generation this is, not the type name. Aliased on the way in, because
// this file is the one place where both generations are in scope at once.
import {
  CONTRACT_VERSIONS as CONTRACT_VERSIONS_PREV,
  deploy as deployPrev,
  precomputeAddresses as precomputePrev,
  type BootstrapConfig as BootstrapConfigPrev,
} from '@fhevm/host-contracts-cleartext-v14-dev/pkg/ts/index.ts';
import { CONTRACT_VERSIONS, updateV14ToV1Dot0 } from '../../../pkg/ts/index.ts';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
  toEventSelector,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { expect, test } from 'vitest';
import {
  startAnvil,
  stopAnvil,
  waitForAnvil,
  MNEMONIC,
  DEPLOYER_ADDRESS_INDEX,
  ERC_1967_IMPL_SLOT,
} from '@fhevm/sdk-common-dev';
import { privateKeyFromMnemonic, privateKeyToAddress } from '@fhevm/sdk-common-dev';
import { expectedHcuLimit } from '../utils/expectedBootstrap.ts';
import { FHEVM_VERSION, generationOfMarker } from '../../../create2-deploy/ts/common.ts';
import { createViemEthereumAdapters } from '@fhevm/sdk-vendored-dev/viemEthereumLib.ts';

const IMPL_SLOT = ERC_1967_IMPL_SLOT;
const FHE_TYPE_UINT64 = 5;
// KMS_CONTEXT_COUNTER_BASE + 1 = (0x07 << 248) + 1 — the id of the first KMS context a fresh stack seeds.
const FIRST_CONTEXT_ID = (7n << 248n) + 1n;

////////////////////////////////////////////////////////////////////////////////

/**
 * Every zero-argument view getter the LIVE previous-generation stack exposes, read from its own ABIs.
 *
 * Enumerated rather than listed, deliberately. The question this answers is "does anything readable
 * change across the upgrade that should not", and a hand-written list can only answer it for the getters
 * whoever wrote the list thought of. Reading the previous generation's ABIs means a getter added upstream
 * is covered with no edit here — and a getter REMOVED by the new generation shows up as a revert, which is
 * itself a break worth failing on.
 *
 * Zero-argument only, because those are the ones whose value is a property of the stack rather than of an
 * argument. `ACL.isAllowed(handle, account)` matters just as much, but it is covered by the cleartext
 * round-trip instead, which exercises it with real handles.
 *
 * Located by asking the module system, not by walking a relative path: it is a workspace member, so
 * resolution already knows where it is and this cannot drift if the layout moves. Resolving a real file
 * inside the directory rather than the package root also makes it a live assertion that the subpath
 * reach-in of I2 still works — if its harness ever gained an `exports` map this throws
 * ERR_PACKAGE_PATH_NOT_EXPORTED right here, instead of surfacing as a puzzling missing-ABI much later.
 */
const PREV_ABI_DIR = dirname(
  fileURLToPath(import.meta.resolve('@fhevm/host-contracts-cleartext-v14-dev/pkg/abi/CleartextACL.json')),
);

type AbiEntry = {
  readonly type?: string;
  readonly name?: string;
  readonly stateMutability?: string;
  readonly inputs?: readonly unknown[];
};

/** The contracts a live previous-generation stack actually has, paired with the ABI file that describes each. */
function surveyTargets(deployed: {
  readonly fhevmAddresses: Record<string, string>;
  readonly cleartextAddresses: Record<string, string>;
  readonly pauserSetAddress: string;
  readonly aclOwnerAddress: string;
}): ReadonlyArray<{ readonly label: string; readonly abiFile: string; readonly address: Address }> {
  return [
    { label: 'ACL', abiFile: 'CleartextACL.json', address: deployed.fhevmAddresses.aclAddress as Address },
    {
      label: 'FHEVMExecutor',
      abiFile: 'CleartextFHEVMExecutor.json',
      address: deployed.fhevmAddresses.fhevmExecutorAddress as Address,
    },
    {
      label: 'KMSVerifier',
      abiFile: 'CleartextKMSVerifier.json',
      address: deployed.fhevmAddresses.kmsVerifierAddress as Address,
    },
    {
      label: 'InputVerifier',
      abiFile: 'CleartextInputVerifier.json',
      address: deployed.fhevmAddresses.inputVerifierAddress as Address,
    },
    {
      label: 'HCULimit',
      abiFile: 'CleartextHCULimit.json',
      address: deployed.fhevmAddresses.hcuLimitAddress as Address,
    },
    {
      label: 'ProtocolConfig',
      abiFile: 'ProtocolConfig.json',
      address: deployed.fhevmAddresses.protocolConfigAddress as Address,
    },
    {
      label: 'KMSGeneration',
      abiFile: 'KMSGeneration.json',
      address: deployed.fhevmAddresses.kmsGenerationAddress as Address,
    },
    {
      label: 'CleartextArithmetic',
      abiFile: 'CleartextArithmetic.json',
      address: deployed.cleartextAddresses.cleartextArithmeticAddress as Address,
    },
    {
      label: 'CleartextDB',
      abiFile: 'CleartextDB.json',
      address: deployed.cleartextAddresses.cleartextDbAddress as Address,
    },
    { label: 'PauserSet', abiFile: 'PauserSet.json', address: deployed.pauserSetAddress as Address },
    { label: 'ACLOwner', abiFile: 'ACLOwner.json', address: deployed.aclOwnerAddress as Address },
  ];
}

/**
 * The only readings allowed to differ across the upgrade, and why. Anything not here must be identical.
 *
 * `getVersion` changes on exactly the contracts `updateV<N-1>ToV<N>` re-points — which is asserted positively
 * elsewhere in this test, so here it is only excused. `HCULimit` and `CleartextDB` are deliberately absent:
 * their bytecode is unchanged between the two generations, so their versions must NOT move.
 */
const MAY_CHANGE = new Set([
  'ACL.getVersion',
  'FHEVMExecutor.getVersion',
  'KMSVerifier.getVersion',
  'InputVerifier.getVersion',
  'ProtocolConfig.getVersion',
  'KMSGeneration.getVersion',
  'CleartextArithmetic.getVersion',
  // The ACL's protocol-version marker: the previous generation's number before the upgrade, this one's
  // after, by construction. `IS_CLEARTEXT`
  // is deliberately NOT here — it reads true on both sides, so it must not move.
  'ACL.CLEARTEXT_PROTOCOL_VERSION',
  // Returns `block.number` by construction, so it differs between any two blocks.
  'HCULimit.getBlockMeter',
]);

/** Reads every zero-argument getter on every contract, as comparable strings. */
async function surveyStack(
  publicClient: ReturnType<typeof createPublicClient>,
  targets: ReturnType<typeof surveyTargets>,
): Promise<Map<string, string>> {
  const readings = new Map<string, string>();
  for (const target of targets) {
    const abi = JSON.parse(readFileSync(join(PREV_ABI_DIR, target.abiFile), 'utf8')) as AbiEntry[];
    const getters = abi.filter(
      (entry) =>
        entry.type === 'function' &&
        (entry.stateMutability === 'view' || entry.stateMutability === 'pure') &&
        (entry.inputs ?? []).length === 0 &&
        entry.name !== undefined,
    );
    for (const getter of getters) {
      const key = `${target.label}.${getter.name ?? ''}`;
      // A revert is recorded as a value rather than skipped. Some getters revert by design — OpenZeppelin
      // gates `proxiableUUID` with `notDelegated`, so it always reverts when called through the proxy —
      // and pretending they do not exist would mean an exclusion list. Recording the revert instead makes
      // "reverted before, reverts now" a survival, and turns "worked before, reverts now" into the
      // failure it is, which is the more interesting direction.
      let reading: string;
      try {
        const value = await publicClient.readContract({
          address: target.address,
          abi: abi as never,
          functionName: getter.name ?? '',
        });
        // bigints and tuples both have to survive a comparison, so everything is stringified alike.
        reading = JSON.stringify(value, (_k, v: unknown) => (typeof v === 'bigint' ? `${v.toString()}n` : v));
      } catch {
        reading = '<reverted>';
      }
      readings.set(key, reading);
    }
  }
  return readings;
}

const EXECUTOR_ABI = [
  {
    type: 'function',
    name: 'trivialEncrypt',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'pt', type: 'uint256' },
      { name: 'toType', type: 'uint8' },
    ],
    outputs: [{ name: 'result', type: 'bytes32' }],
  },
  {
    type: 'event',
    name: 'TrivialEncrypt',
    inputs: [
      { name: 'caller', type: 'address', indexed: true },
      { name: 'pt', type: 'uint256', indexed: false },
      { name: 'toType', type: 'uint8', indexed: false },
      { name: 'result', type: 'bytes32', indexed: false },
    ],
  },
  // A second FHE operation, so the DB is filled by more than one code path before the upgrade.
  //
  // `fheRand` rather than a binary op like `fheAdd`, and that is forced rather than chosen: the executor
  // gates binary operands on `ACL.isAllowed`, and `trivialEncrypt` grants only `allowTransient` — which
  // is transient storage, cleared at the end of its transaction. `ACL.allow` could make it persist but
  // itself requires `isAllowed(handle, msg.sender)`, so it too has to be in that same transaction. An EOA
  // sending one call per transaction therefore cannot feed a handle from one call into the next; doing so
  // needs a dApp-style helper contract that does both in one frame. `fheRand` takes no handle operand, so
  // it needs no allowance, while still going through _generateRand -> recordRand -> CleartextDB.set.
  {
    type: 'function',
    name: 'fheRand',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'randType', type: 'uint8' }],
    outputs: [{ name: 'result', type: 'bytes32' }],
  },
  {
    type: 'event',
    name: 'FheRand',
    inputs: [
      { name: 'caller', type: 'address', indexed: true },
      { name: 'randType', type: 'uint8', indexed: false },
      { name: 'seed', type: 'bytes16', indexed: false },
      { name: 'result', type: 'bytes32', indexed: false },
    ],
  },
] as const;

// The current KMS context and epoch, and its signers: identical signatures on both generations' `ProtocolConfig`.
const KMS_CONTEXT_ABI = [
  {
    type: 'function',
    name: 'getCurrentKmsContextAndEpoch',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'contextId', type: 'uint256' },
      { name: 'epochId', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'getKmsSigners',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
] as const;

// `ProtocolConfig` holds four per-operation KMS thresholds, which the upgrade must carry over unchanged.
const uint256Getter = (name: string) =>
  ({ type: 'function', name, stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }) as const;
const KMS_THRESHOLDS_ABI = [
  uint256Getter('getPublicDecryptionThreshold'),
  uint256Getter('getUserDecryptionThreshold'),
  uint256Getter('getKmsGenThreshold'),
  uint256Getter('getMpcThreshold'),
] as const;
const KMS_THRESHOLD_GETTERS = [
  'getPublicDecryptionThreshold',
  'getUserDecryptionThreshold',
  'getKmsGenThreshold',
  'getMpcThreshold',
] as const;

// The only events an upgrade may make a `ProtocolConfig` emit: its proxy re-pointed, its reinitializer run. Any
// other — a `NewKmsContext`, a `NewKmsEpoch` — would mean the upgrade migrated KMS state, which this one must not.
const PROXY_UPGRADE_EVENT_SELECTORS = new Set<string>([
  toEventSelector('Upgraded(address)'),
  toEventSelector('Initialized(uint64)'),
]);

// The `InputVerifier` holds the coprocessor signer set — re-pointed by the upgrade, but its signers must not move.
const INPUT_VERIFIER_ABI = [
  {
    type: 'function',
    name: 'getCoprocessorSigners',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
] as const;

/**
 * The events that would betray a change the upgrade must never make.
 *
 * Asserting on EVENT ABSENCE rather than on before/after values, because the two prove different things.
 * `PauserSet` exposes only `isPauser(address)` and no enumeration, so comparing values can only show that
 * the accounts you thought to name are unchanged — it cannot show that nobody else was added. No
 * Add/Remove/Swap event across the whole upgrade proves the membership did not move at all, whoever is
 * in it. The same argument applies to ownership: no transfer event means it never even started.
 */
const OWNERSHIP_EVENTS_ABI = [
  {
    type: 'event',
    name: 'OwnershipTransferStarted',
    inputs: [
      { name: 'previousOwner', type: 'address', indexed: true },
      { name: 'newOwner', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      { name: 'previousOwner', type: 'address', indexed: true },
      { name: 'newOwner', type: 'address', indexed: true },
    ],
  },
] as const;

const PAUSER_SET_ABI = [
  {
    type: 'function',
    name: 'isPauser',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

/** Separate from PAUSER_SET_ABI: viem's `getLogs({ events })` takes event items only, not a whole ABI. */
const PAUSER_EVENTS_ABI = [
  { type: 'event', name: 'AddPauser', inputs: [{ name: 'account', type: 'address', indexed: true }] },
  { type: 'event', name: 'RemovePauser', inputs: [{ name: 'account', type: 'address', indexed: true }] },
  {
    type: 'event',
    name: 'SwapPauser',
    inputs: [
      { name: 'oldAccount', type: 'address', indexed: true },
      { name: 'newAccount', type: 'address', indexed: true },
    ],
  },
] as const;

// The cleartext markers on the ACL. Both generations install a `CleartextACL`, so the upgrade must carry
// the marker across and move the protocol version with it.
const CLEARTEXT_MARKER_ABI = [
  { type: 'function', name: 'IS_CLEARTEXT', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  {
    type: 'function',
    name: 'CLEARTEXT_PROTOCOL_VERSION',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const CLEARTEXT_DB_ABI = [
  {
    type: 'function',
    name: 'get',
    stateMutability: 'view',
    inputs: [{ name: 'handle', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

// Every host + cleartext contract exposes ACL-style `getVersion()` → "<Name> vMAJOR.MINOR.PATCH".
const VERSION_ABI = [
  {
    type: 'function',
    name: 'getVersion',
    stateMutability: 'pure',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
] as const;

// The one KMS node the hand-configured previous-generation stack is deployed with (addresses filled in per test).
const DEPLOYER_KMS_NODE = {
  ipAddress: '127.0.0.1',
  storageUrl: 'https://kms.example',
  partyId: 1,
  mpcIdentity: 'kms-core-1-cleartext-core-1',
  caCert: '0x',
  storagePrefix: 'cleartext-1',
} as const;

function prevBootstrapConfig(deployerAddress: string): BootstrapConfigPrev {
  const verifier = { verifyingContractSource: deployerAddress, chainIDSource: 1n };
  return {
    kmsVerifier: verifier,
    inputVerifier: { ...verifier, initialSigners: [deployerAddress], initialThreshold: 1n },
    hcuLimit: expectedHcuLimit(),
    protocolConfig: {
      initialKmsNodes: [{ ...DEPLOYER_KMS_NODE, txSenderAddress: deployerAddress, signerAddress: deployerAddress }],
      initialThresholds: { publicDecryption: 1n, userDecryption: 1n, kmsGen: 1n, mpc: 1n },
      softwareVersion: '0.0.0-cleartext',
      pcrValues: [],
    },
  };
}

test('e2e: deploy a previous-generation cleartext stack, then upgrade it — cleartext survives', async () => {
  const deployerKey = privateKeyFromMnemonic({ mnemonic: MNEMONIC, addressIndex: DEPLOYER_ADDRESS_INDEX });
  const deployerAddress = privateKeyToAddress({ privateKey: deployerKey });
  // No separate KMS signer: this stack is deployed with the deployer AS its KMS signer. The upgrade
  // migrates nothing, so the survey below holds it to carrying that signer set over untouched.

  const anvil = startAnvil({ port: 8620, mnemonic: MNEMONIC });
  try {
    await waitForAnvil(anvil.rpcUrl);

    const adapters = createViemEthereumAdapters({ rpcUrl: anvil.rpcUrl, privateKey: deployerKey });
    const publicClient = createPublicClient({ chain: foundry, transport: http(anvil.rpcUrl) });
    const wallet = createWalletClient({
      account: privateKeyToAccount(deployerKey),
      chain: foundry,
      transport: http(anvil.rpcUrl),
    });

    // --- 1. Deploy a fresh previous-generation stack (installs a standing ACLOwner owned by the deployer). ---
    const precomputed = precomputePrev({ ethUtils: adapters.utils, from: deployerAddress, startNonce: 0n });
    const prev = await deployPrev({
      ethProvider: adapters.provider,
      ethUtils: adapters.utils,
      deployer: adapters.signer,
      admin: adapters.signer,
      precomputed: {
        fhevmAddresses: precomputed.fhevmAddresses,
        cleartextAddresses: precomputed.cleartextAddresses,
        pauserSetAddress: precomputed.pauserSetAddress,
      },
      config: prevBootstrapConfig(deployerAddress),
    });

    const executor = prev.fhevmAddresses.fhevmExecutorAddress as Address;
    const cleartextDb = prev.cleartextAddresses.cleartextDbAddress as Address;

    const version = (address: string): Promise<string> =>
      publicClient.readContract({ address: address as Address, abi: VERSION_ABI, functionName: 'getVersion' });

    // Every host + cleartext version, in one object so before/after read as one diff.
    const versions = async (): Promise<Record<string, string>> => ({
      acl: await version(prev.fhevmAddresses.aclAddress),
      fhevmExecutor: await version(prev.fhevmAddresses.fhevmExecutorAddress),
      kmsVerifier: await version(prev.fhevmAddresses.kmsVerifierAddress),
      inputVerifier: await version(prev.fhevmAddresses.inputVerifierAddress),
      hcuLimit: await version(prev.fhevmAddresses.hcuLimitAddress),
      protocolConfig: await version(prev.fhevmAddresses.protocolConfigAddress),
      kmsGeneration: await version(prev.fhevmAddresses.kmsGenerationAddress),
      cleartextArithmetic: await version(prev.cleartextAddresses.cleartextArithmeticAddress),
    });

    // The freshly deployed stack reports the previous generation's versions across every host + cleartext
    // contract — the ones its package ships, read from its generated `CONTRACT_VERSIONS` rather than restated
    // here, so a patch bump of the previous generation moves the expectation with it.
    expect(await versions()).toEqual({
      acl: CONTRACT_VERSIONS_PREV.acl,
      fhevmExecutor: CONTRACT_VERSIONS_PREV.fhevmExecutor,
      kmsVerifier: CONTRACT_VERSIONS_PREV.kmsVerifier,
      inputVerifier: CONTRACT_VERSIONS_PREV.inputVerifier,
      hcuLimit: CONTRACT_VERSIONS_PREV.hcuLimit,
      protocolConfig: CONTRACT_VERSIONS_PREV.protocolConfig,
      kmsGeneration: CONTRACT_VERSIONS_PREV.kmsGeneration,
      cleartextArithmetic: CONTRACT_VERSIONS_PREV.cleartextArithmetic,
    });

    // The previous-generation stack already carries the marker, and reports its own number. Asserted before
    // the upgrade as well as after, so the pair proves the protocol version actually moved rather than always
    // having read this generation's.
    expect(
      await publicClient.readContract({
        address: prev.fhevmAddresses.aclAddress as Address,
        abi: CLEARTEXT_MARKER_ABI,
        functionName: 'IS_CLEARTEXT',
      }),
    ).toBe(true);
    expect(
      await publicClient.readContract({
        address: prev.fhevmAddresses.aclAddress as Address,
        abi: CLEARTEXT_MARKER_ABI,
        functionName: 'CLEARTEXT_PROTOCOL_VERSION',
      }),
    ).toBe(14n);

    // ERC-1967 implementation slot of every proxy, by name: the upgrade must move exactly six of them.
    const implementations = async (): Promise<Record<string, string>> => {
      const out: Record<string, string> = {};
      for (const [name, address] of Object.entries({ ...prev.fhevmAddresses, ...prev.cleartextAddresses })) {
        out[name] = (await publicClient.getStorageAt({ address: address as Address, slot: IMPL_SLOT })) ?? '0x0';
      }
      return out;
    };
    const implementationsBefore = await implementations();

    // trivialEncrypt(pt) on the executor, returning the resulting handle after mining.
    const trivialEncrypt = async (pt: bigint): Promise<Hex> => {
      const hash = await wallet.writeContract({
        address: executor,
        abi: EXECUTOR_ABI,
        functionName: 'trivialEncrypt',
        args: [pt, FHE_TYPE_UINT64],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const events = parseEventLogs({ abi: EXECUTOR_ABI, eventName: 'TrivialEncrypt', logs: receipt.logs });
      const event = events[0];
      if (event === undefined) {
        throw new Error('TrivialEncrypt event not found');
      }
      return event.args.result;
    };

    // fheRand(randType), returning the result handle after mining.
    const fheRand = async (): Promise<Hex> => {
      const hash = await wallet.writeContract({
        address: executor,
        abi: EXECUTOR_ABI,
        functionName: 'fheRand',
        args: [FHE_TYPE_UINT64],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const events = parseEventLogs({ abi: EXECUTOR_ABI, eventName: 'FheRand', logs: receipt.logs });
      const event = events[0];
      if (event === undefined) {
        throw new Error('FheRand event not found');
      }
      return event.args.result;
    };

    const dbGet = async (handle: Hex): Promise<bigint> =>
      await publicClient.readContract({
        address: cleartextDb,
        abi: CLEARTEXT_DB_ABI,
        functionName: 'get',
        args: [handle],
      });

    // --- 2. Pre-upgrade round-trip: fill the DB under the previous generation's executor. ---
    //
    // Two different write paths through the live arithmetic contract, so the DB holds entries produced by
    // more than one operator before anything is upgraded. Both must still resolve afterwards, which is
    // what says the re-pointed implementations kept addressing the SAME CleartextDB rather than the
    // placeholder address their bytecode ships with.
    const handleBefore = await trivialEncrypt(42n);
    expect(await dbGet(handleBefore)).toBe(42n);

    // Whatever fheRand produced, the DB has to agree with it after the upgrade — the value is unknown
    // here, so it is read now and compared to itself later.
    const randHandleBefore = await fheRand();
    const randValueBefore = await dbGet(randHandleBefore);

    // Snapshot every readable property of the live previous-generation stack, so the upgrade can be held to preserving
    // all of it rather than only the handful this test thought to name.
    const surveyed = surveyTargets(prev);
    const before = await surveyStack(publicClient, surveyed);
    // Guard against a vacuous survey: if the ABIs could not be read this would silently compare nothing.
    expect(before.size).toBeGreaterThan(30);

    // The block the upgrade starts after. Everything it sends lands above this, so the log scan below
    // covers the WHOLE upgrade — all six implementations and the atomic ACLOwner.upgrade — not merely the
    // last transaction.
    const blockBeforeUpgrade = await publicClient.getBlockNumber();
    const pauserSet = prev.pauserSetAddress as Address;
    const aclOwner = prev.aclOwnerAddress as Address;
    const isPauser = (account: string): Promise<boolean> =>
      publicClient.readContract({
        address: pauserSet,
        abi: PAUSER_SET_ABI,
        functionName: 'isPauser',
        args: [account as Address],
      });

    // The standing ACLOwner is a registered pauser after setupACLOwner; that is the state to preserve.
    expect(await isPauser(aclOwner)).toBe(true);

    // --- 3. Upgrade the live stack to this generation (single atomic ACLOwner.upgrade). ---
    const upgraded = await updateV14ToV1Dot0({
      ethProvider: adapters.provider,
      ethUtils: adapters.utils,
      deployer: adapters.signer,
      admin: adapters.signer,
      aclOwnerAddress: prev.aclOwnerAddress,
      existing: { ...prev.fhevmAddresses, pauserSetAddress: prev.pauserSetAddress },
      cleartext: prev.cleartextAddresses,
    });

    // --- 3b. Exactly ONE proxy was created: PaddedInputter (RFC-030), the one contract this generation adds. Every
    //         other address is the one deployed above, and the new one is none of them. ---
    const { paddedInputterAddress, ...unchanged } = upgraded.fhevmAddresses;
    expect(unchanged).toEqual(prev.fhevmAddresses);
    const existingAddresses = Object.values({ ...prev.fhevmAddresses, ...prev.cleartextAddresses }).map((address) =>
      address.toLowerCase(),
    );
    expect(existingAddresses).not.toContain(paddedInputterAddress.toLowerCase());
    // Materialized, not left over the empty implementation: it answers this generation's version and the marker.
    expect(await version(paddedInputterAddress)).toBe(CONTRACT_VERSIONS.paddedInputter);
    expect(
      await publicClient.readContract({
        address: paddedInputterAddress as Address,
        abi: CLEARTEXT_MARKER_ABI,
        functionName: 'IS_CLEARTEXT',
      }),
    ).toBe(true);

    // --- 3c. And the ProtocolConfigReplica every stack of this generation deploys: created too, at none of the earlier addresses.
    const replicaAddress = upgraded.protocolConfigReplicaAddress;
    expect([...existingAddresses, paddedInputterAddress.toLowerCase()]).not.toContain(replicaAddress.toLowerCase());
    expect(await version(replicaAddress)).toBe(CONTRACT_VERSIONS.protocolConfigReplica);

    // --- 4. Exactly the six changed host proxies and CleartextArithmetic were re-pointed; nothing else moved. ---
    const implementationsAfter = await implementations();
    const repointed = Object.keys(implementationsBefore)
      .filter((name) => implementationsBefore[name] !== implementationsAfter[name])
      .sort();
    expect(repointed).toEqual(
      [
        'aclAddress',
        'fhevmExecutorAddress',
        'kmsVerifierAddress',
        'inputVerifierAddress',
        'protocolConfigAddress',
        'kmsGenerationAddress',
        'cleartextArithmeticAddress',
      ].sort(),
    );
    // Every re-pointed proxy now reports the version THIS package ships, read from the generated
    // `CONTRACT_VERSIONS` rather than restated here — a patch bump upstream then changes the expectation
    // and the contracts together. HCULimit is left where it was (its bytecode is unchanged), and reports
    // the same version on both generations; CleartextArithmetic moves (this generation adds the RFC-030 unmasking).
    expect(await versions()).toEqual({
      acl: CONTRACT_VERSIONS.acl,
      fhevmExecutor: CONTRACT_VERSIONS.fhevmExecutor,
      kmsVerifier: CONTRACT_VERSIONS.kmsVerifier,
      inputVerifier: CONTRACT_VERSIONS.inputVerifier,
      hcuLimit: CONTRACT_VERSIONS.hcuLimit,
      protocolConfig: CONTRACT_VERSIONS.protocolConfig,
      kmsGeneration: CONTRACT_VERSIONS.kmsGeneration,
      cleartextArithmetic: CONTRACT_VERSIONS.cleartextArithmetic,
    });

    // The ACL still advertises itself as cleartext after the upgrade, and now reports this generation. A consumer
    // holding only a ZamaConfig reads this to tell which generation it is talking to, so an upgrade that
    // silently reinstated the plain `ACL` would be invisible without it.
    const aclAddress = prev.fhevmAddresses.aclAddress as Address;
    expect(
      await publicClient.readContract({ address: aclAddress, abi: CLEARTEXT_MARKER_ABI, functionName: 'IS_CLEARTEXT' }),
    ).toBe(true);
    expect(
      generationOfMarker(
        await publicClient.readContract({
          address: aclAddress,
          abi: CLEARTEXT_MARKER_ABI,
          functionName: 'CLEARTEXT_PROTOCOL_VERSION',
        }),
      ),
    ).toBe(FHEVM_VERSION);

    // --- 4b. Everything readable survives. Every zero-argument getter the previous stack exposed returns
    //         exactly what it did before, except the versions the upgrade is supposed to move. ---
    const after = await surveyStack(publicClient, surveyed);

    const changed: string[] = [];
    const vanished: string[] = [];
    for (const [key, valueBefore] of before) {
      const valueAfter = after.get(key);
      if (valueAfter === undefined) {
        vanished.push(key);
      } else if (valueAfter !== valueBefore && !MAY_CHANGE.has(key)) {
        changed.push(`${key}: ${valueBefore} -> ${valueAfter}`);
      }
    }
    expect(
      vanished,
      `getters the previous stack had and the upgraded stack does not:\n  ${vanished.join('\n  ')}`,
    ).toEqual([]);
    expect(changed, `readable state changed across the upgrade:\n  ${changed.join('\n  ')}`).toEqual([]);

    // The exemptions are not a license: each one must actually have changed, or it does not belong in
    // MAY_CHANGE. This is what stops the set from quietly growing into a way of ignoring regressions.
    const unusedExemptions = [...MAY_CHANGE].filter((key) => before.has(key) && before.get(key) === after.get(key));
    expect(
      unusedExemptions,
      `MAY_CHANGE lists readings that did not change — remove them:\n  ${unusedExemptions.join('\n  ')}`,
    ).toEqual([]);

    // --- 4c. Ownership never moved, and the pauser set never changed. ---
    //
    // The upgrade is supposed to run entirely THROUGH the standing ACLOwner without touching who owns
    // what. A coordinator that re-ran the ownership dance, or a migration that re-registered pausers,
    // would still leave a working stack — and would have handed root to a different account, or changed
    // who can pause it, with nothing else noticing.
    const upgradeBlocks = { fromBlock: blockBeforeUpgrade + 1n, toBlock: 'latest' } as const;

    for (const [label, address] of [
      ['ACL', prev.fhevmAddresses.aclAddress as Address],
      ['ACLOwner', aclOwner],
    ] as const) {
      const transfers = await publicClient.getLogs({ address, events: OWNERSHIP_EVENTS_ABI, ...upgradeBlocks });
      expect(
        transfers.map((log) => log.eventName),
        `${label} emitted an ownership event during the upgrade — ownership must never change`,
      ).toEqual([]);
    }

    const pauserChanges = await publicClient.getLogs({
      address: pauserSet,
      events: PAUSER_EVENTS_ABI,
      ...upgradeBlocks,
    });
    expect(
      pauserChanges.map((log) => log.eventName),
      'PauserSet membership changed during the upgrade — the pausers must stay the same',
    ).toEqual([]);

    // Positive counterpart to the event scan: the PauserSet is the same contract, and the ACLOwner is
    // still a pauser in it. Event absence proves nothing was added or removed; this proves the set the
    // stack points at is still the one that was checked.
    expect(prev.pauserSetAddress).toBe(pauserSet);
    expect(await isPauser(aclOwner)).toBe(true);

    // --- 5. Cleartext still works after the upgrade (new executor impl → live CleartextArithmetic
    //        → CleartextDB), and the pre-upgrade value persisted through it. ---
    // The DB proxy is unchanged by the upgrade — asserted directly, so a re-pointed CleartextDB reports
    // itself as a wrong ADDRESS here rather than as a puzzling wrong value below.
    expect(prev.cleartextAddresses.cleartextDbAddress).toBe(cleartextDb);

    // Every pre-upgrade handle still resolves to the value it had, through the live arithmetic
    // implementation. This is the assertion the whole test exists for: a migration that left the new
    // executor pointing at its placeholder arithmetic address passes every version check above and fails
    // here.
    expect(await dbGet(handleBefore)).toBe(42n);
    expect(await dbGet(randHandleBefore)).toBe(randValueBefore);

    // And the new implementations can still write, by both paths.
    const handleAfter = await trivialEncrypt(99n);
    expect(await dbGet(handleAfter)).toBe(99n);

    const randHandleAfter = await fheRand();
    const randValueAfter = await dbGet(randHandleAfter);

    expect(randValueAfter).not.toBe(randValueBefore);
    expect(randHandleAfter).not.toBe(randHandleBefore);

    // The drawn value is unknowable, and 0 is a legitimate draw — so its PRESENCE is the assertion. The
    // read is what proves the new executor reached the live arithmetic + DB rather than a placeholder address.
    expect(typeof (await dbGet(randHandleAfter))).toBe('bigint');
  } finally {
    await stopAnvil(anvil.process);
  }
}, 180_000);

test('e2e: the upgrade migrates nothing — KMS and coprocessor state survive on a default stack', async () => {
  const deployerKey = privateKeyFromMnemonic({ mnemonic: MNEMONIC, addressIndex: DEPLOYER_ADDRESS_INDEX });
  const deployerAddress = privateKeyToAddress({ privateKey: deployerKey });

  const anvil = startAnvil({ port: 8621, mnemonic: MNEMONIC });
  try {
    await waitForAnvil(anvil.rpcUrl);

    const adapters = createViemEthereumAdapters({ rpcUrl: anvil.rpcUrl, privateKey: deployerKey });
    const publicClient = createPublicClient({ chain: foundry, transport: http(anvil.rpcUrl) });
    const wallet = createWalletClient({
      account: privateKeyToAccount(deployerKey),
      chain: foundry,
      transport: http(anvil.rpcUrl),
    });

    // --- 1. Deploy a fresh previous-generation stack with the package defaults (four KMS nodes). ---
    const precomputed = precomputePrev({ ethUtils: adapters.utils, from: deployerAddress, startNonce: 0n });
    const prev = await deployPrev({
      ethProvider: adapters.provider,
      ethUtils: adapters.utils,
      deployer: adapters.signer,
      admin: adapters.signer,
      precomputed: {
        fhevmAddresses: precomputed.fhevmAddresses,
        cleartextAddresses: precomputed.cleartextAddresses,
        pauserSetAddress: precomputed.pauserSetAddress,
      },
      // No config → the previous package's DEFAULT_BOOTSTRAP_CONFIG: the stack most chains run.
    });

    const executor = prev.fhevmAddresses.fhevmExecutorAddress as Address;
    const cleartextDb = prev.cleartextAddresses.cleartextDbAddress as Address;
    const protocolConfig = prev.fhevmAddresses.protocolConfigAddress as Address;
    const inputVerifier = prev.fhevmAddresses.inputVerifierAddress as Address;

    // Each reads ProtocolConfig, or the replica the upgrade creates, which answers the same getters.
    const readContextAndEpoch = async (address: Address = protocolConfig): Promise<readonly [bigint, bigint]> =>
      await publicClient.readContract({
        address,
        abi: KMS_CONTEXT_ABI,
        functionName: 'getCurrentKmsContextAndEpoch',
      });
    const readSigners = async (address: Address = protocolConfig): Promise<string[]> =>
      [
        ...(await publicClient.readContract({
          address,
          abi: KMS_CONTEXT_ABI,
          functionName: 'getKmsSigners',
        })),
      ].map((s) => s.toLowerCase());
    const readCoprocessorSigners = async (): Promise<string[]> =>
      [
        ...(await publicClient.readContract({
          address: inputVerifier,
          abi: INPUT_VERIFIER_ABI,
          functionName: 'getCoprocessorSigners',
        })),
      ].map((s) => s.toLowerCase());

    const readThresholds = async (address: Address = protocolConfig): Promise<bigint[]> => {
      const out: bigint[] = [];
      for (const getter of KMS_THRESHOLD_GETTERS) {
        out.push(await publicClient.readContract({ address, abi: KMS_THRESHOLDS_ABI, functionName: getter }));
      }
      return out;
    };

    // Capture the live KMS context and epoch, its signers and thresholds, and the coprocessor signer set.
    // A freshly deployed default stack runs the first context with its four default KMS nodes.
    const [contextBefore, epochBefore] = await readContextAndEpoch();
    const signersBefore = await readSigners();
    const thresholdsBefore = await readThresholds();
    const coprocessorSignersBefore = await readCoprocessorSigners();
    expect(contextBefore).toBe(FIRST_CONTEXT_ID);
    expect(epochBefore).toBeGreaterThan(0n);
    expect(signersBefore).toHaveLength(4);
    expect(coprocessorSignersBefore.length).toBeGreaterThan(0);

    // trivialEncrypt(pt) on the executor, returning the resulting handle after mining.
    const trivialEncrypt = async (pt: bigint): Promise<Hex> => {
      const hash = await wallet.writeContract({
        address: executor,
        abi: EXECUTOR_ABI,
        functionName: 'trivialEncrypt',
        args: [pt, FHE_TYPE_UINT64],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const events = parseEventLogs({ abi: EXECUTOR_ABI, eventName: 'TrivialEncrypt', logs: receipt.logs });
      const event = events[0];
      if (event === undefined) {
        throw new Error('TrivialEncrypt event not found');
      }
      return event.args.result;
    };

    // --- 2. Pre-upgrade round-trip: record a cleartext under the previous generation's executor. ---
    const handleBefore = await trivialEncrypt(42n);
    const blockBeforeUpgrade = await publicClient.getBlockNumber();

    // --- 3. Upgrade. No migration input exists: every reinitializer takes no arguments. ---
    const { protocolConfigReplicaAddress } = await updateV14ToV1Dot0({
      ethProvider: adapters.provider,
      ethUtils: adapters.utils,
      deployer: adapters.signer,
      admin: adapters.signer,
      aclOwnerAddress: prev.aclOwnerAddress,
      existing: { ...prev.fhevmAddresses, pauserSetAddress: prev.pauserSetAddress },
      cleartext: prev.cleartextAddresses,
    });

    // --- 4. The KMS context and epoch, its signers and thresholds, and the coprocessors all carried over. ---
    expect(await readContextAndEpoch()).toEqual([contextBefore, epochBefore]);
    expect(await readSigners()).toEqual(signersBefore);
    expect(await readThresholds()).toEqual(thresholdsBefore);
    expect(await readCoprocessorSigners()).toEqual(coprocessorSignersBefore);

    // --- 4a. The ProtocolConfigReplica the upgrade created was seeded with that same live state. ---
    const replica = protocolConfigReplicaAddress as Address;
    expect(await readContextAndEpoch(replica)).toEqual([contextBefore, epochBefore]);
    expect(await readSigners(replica)).toEqual(signersBefore);
    expect(await readThresholds(replica)).toEqual(thresholdsBefore);

    // And nothing was announced: during the upgrade, ProtocolConfig emitted only its proxy's own `Upgraded` and
    // `Initialized`. A KMS context or epoch event here would mean the upgrade migrated state it must not touch.
    const protocolConfigLogs = await publicClient.getLogs({
      address: protocolConfig,
      fromBlock: blockBeforeUpgrade + 1n,
      toBlock: 'latest',
    });
    expect(protocolConfigLogs.length, 'ProtocolConfig was not upgraded at all').toBeGreaterThan(0);
    const unexpected = protocolConfigLogs
      .map((log) => log.topics[0] ?? '<anonymous>')
      .filter((topic) => !PROXY_UPGRADE_EVENT_SELECTORS.has(topic));
    expect(unexpected, 'ProtocolConfig emitted events other than Upgraded/Initialized during the upgrade').toEqual([]);

    // --- 5. Cleartext still works after the upgrade, and the pre-upgrade value persisted. ---
    const handleAfter = await trivialEncrypt(99n);
    expect(
      await publicClient.readContract({
        address: cleartextDb,
        abi: CLEARTEXT_DB_ABI,
        functionName: 'get',
        args: [handleAfter],
      }),
    ).toBe(99n);
    expect(
      await publicClient.readContract({
        address: cleartextDb,
        abi: CLEARTEXT_DB_ABI,
        functionName: 'get',
        args: [handleBefore],
      }),
    ).toBe(42n);
  } finally {
    await stopAnvil(anvil.process);
  }
}, 180_000);
