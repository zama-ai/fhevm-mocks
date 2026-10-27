import { abi as aclAbi, template as aclTemplate } from './artifacts/CleartextACL.js';
import { abi as fhevmExecutorAbi, template as fhevmExecutorTemplate } from './artifacts/CleartextFHEVMExecutor.js';
import { abi as kmsVerifierAbi, template as kmsVerifierTemplate } from './artifacts/CleartextKMSVerifier.js';
import { abi as inputVerifierAbi, template as inputVerifierTemplate } from './artifacts/CleartextInputVerifier.js';
import { abi as protocolConfigAbi, template as protocolConfigTemplate } from './artifacts/ProtocolConfig.js';
import { abi as kmsGenerationAbi, template as kmsGenerationTemplate } from './artifacts/KMSGeneration.js';
import { abi as paddedInputterAbi, template as paddedInputterTemplate } from './artifacts/CleartextPaddedInputter.js';
import {
  abi as protocolConfigReplicaAbi,
  template as protocolConfigReplicaTemplate,
} from './artifacts/ProtocolConfigReplica.js';
import { abi as aclOwnerAbi } from './artifacts/ACLOwner.js';
import {
  abi as cleartextArithmeticAbi,
  template as cleartextArithmeticTemplate,
} from './artifacts/CleartextArithmetic.js';
import type { ContractUpgradeSpec, DeployedImplementation, UpgradeTarget } from './types/private.js';
import type {
  AbstractEthereumProvider,
  AbstractEthereumSigner,
  AbstractEthereumUtils,
  CleartextAddresses,
  FhevmAddresses,
  FhevmAddressesV14,
  KmsNode,
  KmsNodeParams,
  KmsThresholds,
  PaddedInputterInitConfig,
} from './types/public.js';
import { buildHostAddressReplacements, deployImplementations, sendStep } from './utils.js';
import { toACLOwnerOps } from './aclOwner.js';
import { deployEmptyUUPSProxy, deployERC1967Proxy } from './proxies.js';
import { DEFAULT_BOOTSTRAP_CONFIG } from './constants.js';

////////////////////////////////////////////////////////////////////////////////

/**
 * Update an already-deployed v14 stack to v15.
 *
 * v15 adds TWO contracts to the host set, `PaddedInputter` (RFC-030) and `ProtocolConfigReplica`, so this
 * creates TWO proxies: ERC-1967 proxies over a fresh `EmptyUUPSProxy` implementation, deployed first
 * (permissionless) because the v15 `FHEVMExecutor` bakes PaddedInputter's address. Every other address is
 * unchanged. Then, in one atomic `ACLOwner.upgrade(...)`, it re-points + version-bumps the six host contracts
 * whose reinitializer moves, in the order of upstream's `upgrade-manifest.json`, then `CleartextArithmetic`,
 * then materializes the new proxies last:
 *   - `ACL.reinitializeV6()`, `FHEVMExecutor.reinitializeV7()`, `KMSVerifier.reinitializeV5()`,
 *     `InputVerifier.reinitializeV3()`, `ProtocolConfig.reinitializeV3()`, `KMSGeneration.reinitializeV3()`
 *     — all no-arg: v14 -> v15 migrates nothing.
 *   - `CleartextArithmetic.reinitializeV4()` — no-arg; v15 adds the RFC-030 pad-based unmasking to it.
 *   - `PaddedInputter.initializeFromEmptyProxy(initialPrfInstances)`.
 *   - `ProtocolConfigReplica.initializeFromCanonical(...)`, seeded with what the live ProtocolConfig holds when
 *     this runs: its current KMS context and epoch, that context's nodes and thresholds.
 * `HCULimit` is untouched (its reinitializer and bytecode are unchanged), and so is `CleartextDB` (its
 * bytecode is identical across the two generations).
 *
 * All v15 implementations are patched with the ACTUAL addresses of the live stack, plus the new
 * PaddedInputter's. The new addresses are plain CREATE addresses of `deployer` at upgrade time, not the
 * fresh-deploy localhost ones, so they are RETURNED: it is the only way a caller learns them.
 *
 * @dev Requires the live stack's ACL owner to already be the `ACLOwner` at `aclOwnerAddress`, and
 *      `admin` to be that `ACLOwner`'s owner. If the stack is EOA-owned, install one first
 *      (`setupACLOwner`).
 */
export async function updateV14ToV1Dot0(parameters: {
  // Reads the live ProtocolConfig the replica is seeded from.
  readonly ethProvider: AbstractEthereumProvider;
  readonly ethUtils: AbstractEthereumUtils;
  readonly deployer: AbstractEthereumSigner;
  readonly admin: AbstractEthereumSigner;
  readonly aclOwnerAddress: string;
  readonly existing: FhevmAddressesV14 & { readonly pauserSetAddress: string };
  // Live cleartext-infra proxies of the running v14 stack. The new v15 `CleartextFHEVMExecutor` impl
  // bakes `cleartextArithmeticAdd`, so it must be patched with the real proxy address (not the
  // placeholder) or the post-upgrade cleartext round-trip would call a dead address.
  readonly cleartext: CleartextAddresses;
  // `PaddedInputter.initializeFromEmptyProxy` arguments. Defaults to `DEFAULT_BOOTSTRAP_CONFIG`'s: the default
  // PRF instance (cleartext-config.json `CLEARTEXT_PAD_PRF_INSTANCE`).
  readonly paddedInputter?: PaddedInputterInitConfig | undefined;
}): Promise<{ readonly fhevmAddresses: FhevmAddresses; readonly protocolConfigReplicaAddress: string }> {
  const { pauserSetAddress, ...existingV14 } = parameters.existing;

  // 0. The two new proxies, over a fresh EmptyUUPSProxy implementation patched with the LIVE ACL — the stack's
  //    own empty implementation is not an input, and it bakes the ACL too. Permissionless; their upgrade
  //    authority is the ACL owner, so the ACLOwner can materialize them below.
  const emptyUUPSProxy = await deployEmptyUUPSProxy({
    deployer: parameters.deployer,
    aclAddress: existingV14.aclAddress,
  });
  const paddedInputterProxy = await deployERC1967Proxy({
    ethUtils: parameters.ethUtils,
    deployer: parameters.deployer,
    emptyUUPSProxyAddress: emptyUUPSProxy.contractAddress,
  });
  const protocolConfigReplicaProxy = await deployERC1967Proxy({
    ethUtils: parameters.ethUtils,
    deployer: parameters.deployer,
    emptyUUPSProxyAddress: emptyUUPSProxy.contractAddress,
  });
  const fhevmAddresses: FhevmAddresses = {
    ...existingV14,
    paddedInputterAddress: paddedInputterProxy.contractAddress,
  };
  const protocolConfigReplicaAddress = protocolConfigReplicaProxy.contractAddress;

  // 1. Phase 1: deploy the v15 implementations (permissionless).
  const { implementations } = await buildUpdateV14ToV1Dot0Plan({
    ethUtils: parameters.ethUtils,
    deployer: parameters.deployer,
    fhevmAddresses,
    cleartextAddresses: parameters.cleartext,
    pauserSetAddress,
    paddedInputter: parameters.paddedInputter ?? DEFAULT_BOOTSTRAP_CONFIG.paddedInputter,
    protocolConfigReplicaAddress,
    protocolConfigReplicaSeed: await readProtocolConfigReplicaSeed({
      ethProvider: parameters.ethProvider,
      protocolConfigAddress: existingV14.protocolConfigAddress,
    }),
  });

  // 2. One atomic ACLOwner.upgrade: 7 reinitializations, then the two new proxies' initializations.
  await sendStep({
    label: 'ACLOwner.upgrade (v14 -> v15)',
    send: () =>
      parameters.admin.writeContract({
        address: parameters.aclOwnerAddress,
        abi: aclOwnerAbi,
        functionName: 'upgrade',
        args: [toACLOwnerOps(implementations)],
      }),
  });

  return { fhevmAddresses, protocolConfigReplicaAddress };
}

/**
 * The `initializeFromCanonical` arguments that seed a ProtocolConfigReplica with what the live canonical
 * ProtocolConfig holds now: its current KMS context and epoch, that context's nodes and thresholds. Getters both
 * generations have. The replica stores a node's `KmsNode` part only and drops the MPC metadata, which no getter
 * returns either: left empty. The same seed as the forge upgrade's (`LibForgeFhevmUpgrade`).
 */
async function readProtocolConfigReplicaSeed(parameters: {
  readonly ethProvider: AbstractEthereumProvider;
  readonly protocolConfigAddress: string;
}): Promise<readonly unknown[]> {
  const read = (functionName: string, args?: readonly unknown[]): Promise<unknown> =>
    parameters.ethProvider.readContract({
      address: parameters.protocolConfigAddress,
      abi: protocolConfigAbi,
      functionName,
      ...(args === undefined ? {} : { args }),
    });
  const [contextId, epochId] = (await read('getCurrentKmsContextAndEpoch')) as readonly [bigint, bigint];
  const live = (await read('getKmsNodesForContext', [contextId])) as readonly KmsNode[];
  const nodes: readonly KmsNodeParams[] = live.map((node) => ({
    txSenderAddress: node.txSenderAddress,
    signerAddress: node.signerAddress,
    ipAddress: node.ipAddress,
    storageUrl: node.storageUrl,
    partyId: 0,
    mpcIdentity: '',
    caCert: '0x',
    storagePrefix: '',
  }));
  const thresholds: KmsThresholds = {
    publicDecryption: (await read('getPublicDecryptionThresholdForContext', [contextId])) as bigint,
    userDecryption: (await read('getUserDecryptionThresholdForContext', [contextId])) as bigint,
    kmsGen: (await read('getKmsGenThresholdForContext', [contextId])) as bigint,
    mpc: (await read('getMpcThresholdForContext', [contextId])) as bigint,
  };
  return [contextId, epochId, nodes, thresholds];
}

/**
 * Phase 1 for a v14→v15 update: deploys the v15 implementations for the seven changed contracts and the two
 * new ones (patched with the actual live addresses) and encodes their `upgradeToAndCall` calldata.
 * Sends no owner-gated transaction. `HCULimit` is intentionally absent (its reinitializer and bytecode are
 * unchanged).
 * @internal — used by `updateV<N-1>ToV<N>`; not part of the public API.
 */
async function buildUpdateV14ToV1Dot0Plan(parameters: {
  readonly ethUtils: AbstractEthereumUtils;
  readonly deployer: AbstractEthereumSigner;
  readonly fhevmAddresses: FhevmAddresses;
  readonly cleartextAddresses: CleartextAddresses;
  readonly pauserSetAddress: string;
  readonly paddedInputter: PaddedInputterInitConfig;
  readonly protocolConfigReplicaAddress: string;
  readonly protocolConfigReplicaSeed: readonly unknown[];
}): Promise<{ readonly implementations: readonly DeployedImplementation[] }> {
  const addressReplacements = buildHostAddressReplacements({
    fhevmAddresses: parameters.fhevmAddresses,
    cleartextAddresses: parameters.cleartextAddresses,
    pauserSetAddress: parameters.pauserSetAddress,
  });

  const addr = parameters.fhevmAddresses;
  const noArgs = (initFn: string): ContractUpgradeSpec => ({ initFn, initArgs: [] });
  const targets: readonly UpgradeTarget[] = [
    {
      contractName: 'ACL',
      proxyAddress: addr.aclAddress,
      template: aclTemplate,
      abi: aclAbi,
      spec: noArgs('reinitializeV6'),
    },
    {
      contractName: 'FHEVMExecutor',
      proxyAddress: addr.fhevmExecutorAddress,
      template: fhevmExecutorTemplate,
      abi: fhevmExecutorAbi,
      spec: noArgs('reinitializeV7'),
    },
    {
      contractName: 'KMSVerifier',
      proxyAddress: addr.kmsVerifierAddress,
      template: kmsVerifierTemplate,
      abi: kmsVerifierAbi,
      spec: noArgs('reinitializeV5'),
    },
    {
      contractName: 'InputVerifier',
      proxyAddress: addr.inputVerifierAddress,
      template: inputVerifierTemplate,
      abi: inputVerifierAbi,
      spec: noArgs('reinitializeV3'),
    },
    {
      contractName: 'ProtocolConfig',
      proxyAddress: addr.protocolConfigAddress,
      template: protocolConfigTemplate,
      abi: protocolConfigAbi,
      spec: noArgs('reinitializeV3'),
    },
    {
      contractName: 'KMSGeneration',
      proxyAddress: addr.kmsGenerationAddress,
      template: kmsGenerationTemplate,
      abi: kmsGenerationAbi,
      spec: noArgs('reinitializeV3'),
    },
    // Cleartext-only, so not in upstream's manifest: v15 changes its bytecode (RFC-030 unmasking).
    {
      contractName: 'CleartextArithmetic',
      proxyAddress: parameters.cleartextAddresses.cleartextArithmeticAddress,
      template: cleartextArithmeticTemplate,
      abi: cleartextArithmeticAbi,
      spec: noArgs('reinitializeV4'),
    },
    // New in v15: materialized from the empty proxy `updateV<N-1>ToV<N>` created, not reinitialized.
    {
      contractName: 'PaddedInputter',
      proxyAddress: addr.paddedInputterAddress,
      template: paddedInputterTemplate,
      abi: paddedInputterAbi,
      spec: { initFn: 'initializeFromEmptyProxy', initArgs: [parameters.paddedInputter.initialPrfInstances] },
    },
    // New in v15 too, seeded from the live ProtocolConfig. Nothing bakes its address.
    {
      contractName: 'ProtocolConfigReplica',
      proxyAddress: parameters.protocolConfigReplicaAddress,
      template: protocolConfigReplicaTemplate,
      abi: protocolConfigReplicaAbi,
      spec: { initFn: 'initializeFromCanonical', initArgs: parameters.protocolConfigReplicaSeed },
    },
  ];

  return { implementations: await deployImplementations({ ...parameters, addressReplacements, targets }) };
}
