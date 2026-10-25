import { abi as aclAbi, template as aclTemplate } from './artifacts/CleartextACL.js';
import { abi as fhevmExecutorAbi, template as fhevmExecutorTemplate } from './artifacts/CleartextFHEVMExecutor.js';
import { abi as kmsVerifierAbi, template as kmsVerifierTemplate } from './artifacts/CleartextKMSVerifier.js';
import { abi as inputVerifierAbi, template as inputVerifierTemplate } from './artifacts/CleartextInputVerifier.js';
import { abi as protocolConfigAbi, template as protocolConfigTemplate } from './artifacts/ProtocolConfig.js';
import { abi as kmsGenerationAbi, template as kmsGenerationTemplate } from './artifacts/KMSGeneration.js';
import { abi as paddedInputterAbi, template as paddedInputterTemplate } from './artifacts/CleartextPaddedInputter.js';
import { abi as aclOwnerAbi } from './artifacts/ACLOwner.js';
import {
  abi as cleartextArithmeticAbi,
  template as cleartextArithmeticTemplate,
} from './artifacts/CleartextArithmetic.js';
import type { ContractUpgradeSpec, DeployedImplementation, UpgradeTarget } from './types/private.js';
import type {
  AbstractEthereumSigner,
  AbstractEthereumUtils,
  CleartextAddresses,
  FhevmAddresses,
  FhevmAddressesV14,
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
 * v15 adds ONE contract to the host set, `PaddedInputter` (RFC-030), so this creates ONE proxy: an
 * ERC-1967 proxy over a fresh `EmptyUUPSProxy` implementation, deployed first (permissionless) because the
 * v15 `FHEVMExecutor` bakes its address. Every other address is unchanged. Then, in one atomic
 * `ACLOwner.upgrade(...)`, it re-points + version-bumps the six host contracts whose reinitializer moves, in
 * the order of upstream's `upgrade-manifest.json`, then `CleartextArithmetic`, then materializes the new
 * proxy last:
 *   - `ACL.reinitializeV6()`, `FHEVMExecutor.reinitializeV7()`, `KMSVerifier.reinitializeV5()`,
 *     `InputVerifier.reinitializeV3()`, `ProtocolConfig.reinitializeV3()`, `KMSGeneration.reinitializeV3()`
 *     — all no-arg: v14 -> v15 migrates nothing.
 *   - `CleartextArithmetic.reinitializeV4()` — no-arg; v15 adds the RFC-030 pad-based unmasking to it.
 *   - `PaddedInputter.initializeFromEmptyProxy(initialPrfInstances)`.
 * `HCULimit` is untouched (its reinitializer and bytecode are unchanged), and so is `CleartextDB` (its
 * bytecode is identical across the two generations).
 *
 * All v15 implementations are patched with the ACTUAL addresses of the live stack, plus the new
 * PaddedInputter's. Its address is a plain CREATE address of `deployer` at upgrade time, not the
 * fresh-deploy localhost one, so it is RETURNED: it is the only way a caller learns it.
 *
 * @dev Requires the live stack's ACL owner to already be the `ACLOwner` at `aclOwnerAddress`, and
 *      `admin` to be that `ACLOwner`'s owner. If the stack is EOA-owned, install one first
 *      (`setupACLOwner`).
 */
export async function updateV14ToV15(parameters: {
  readonly ethUtils: AbstractEthereumUtils;
  readonly deployer: AbstractEthereumSigner;
  readonly admin: AbstractEthereumSigner;
  readonly aclOwnerAddress: string;
  readonly existing: FhevmAddressesV14 & { readonly pauserSetAddress: string };
  // Live cleartext-infra proxies of the running v14 stack. The new v15 `CleartextFHEVMExecutor` impl
  // bakes `cleartextArithmeticAdd`, so it must be patched with the real proxy address (not the
  // placeholder) or the post-upgrade cleartext round-trip would call a dead address.
  readonly cleartext: CleartextAddresses;
  // `PaddedInputter.initializeFromEmptyProxy` arguments. Defaults to `DEFAULT_BOOTSTRAP_CONFIG`'s, which
  // registers NO PRF instance yet (see the FIXME there).
  readonly paddedInputter?: PaddedInputterInitConfig | undefined;
}): Promise<{ readonly fhevmAddresses: FhevmAddresses }> {
  const { pauserSetAddress, ...existingV14 } = parameters.existing;

  // 0. The one new proxy, over a fresh EmptyUUPSProxy implementation patched with the LIVE ACL — the stack's
  //    own empty implementation is not an input, and it bakes the ACL too. Permissionless; its upgrade
  //    authority is the ACL owner, so the ACLOwner can materialize it below.
  const emptyUUPSProxy = await deployEmptyUUPSProxy({
    deployer: parameters.deployer,
    aclAddress: existingV14.aclAddress,
  });
  const paddedInputterProxy = await deployERC1967Proxy({
    ethUtils: parameters.ethUtils,
    deployer: parameters.deployer,
    emptyUUPSProxyAddress: emptyUUPSProxy.contractAddress,
  });
  const fhevmAddresses: FhevmAddresses = {
    ...existingV14,
    paddedInputterAddress: paddedInputterProxy.contractAddress,
  };

  // 1. Phase 1: deploy the v15 implementations (permissionless).
  const { implementations } = await buildUpdateV14ToV15Plan({
    ethUtils: parameters.ethUtils,
    deployer: parameters.deployer,
    fhevmAddresses,
    cleartextAddresses: parameters.cleartext,
    pauserSetAddress,
    paddedInputter: parameters.paddedInputter ?? DEFAULT_BOOTSTRAP_CONFIG.paddedInputter,
  });

  // 2. One atomic ACLOwner.upgrade: 7 reinitializations, then the new PaddedInputter's initialization.
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

  return { fhevmAddresses };
}

/**
 * Phase 1 for a v14→v15 update: deploys the v15 implementations for the seven changed contracts and the new
 * PaddedInputter (patched with the actual live addresses) and encodes their `upgradeToAndCall` calldata.
 * Sends no owner-gated transaction. `HCULimit` is intentionally absent (its reinitializer and bytecode are
 * unchanged).
 * @internal — used by `updateV14ToV15`; not part of the public API.
 */
async function buildUpdateV14ToV15Plan(parameters: {
  readonly ethUtils: AbstractEthereumUtils;
  readonly deployer: AbstractEthereumSigner;
  readonly fhevmAddresses: FhevmAddresses;
  readonly cleartextAddresses: CleartextAddresses;
  readonly pauserSetAddress: string;
  readonly paddedInputter: PaddedInputterInitConfig;
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
    // New in v15: materialized from the empty proxy `updateV14ToV15` created, not reinitialized.
    {
      contractName: 'PaddedInputter',
      proxyAddress: addr.paddedInputterAddress,
      template: paddedInputterTemplate,
      abi: paddedInputterAbi,
      spec: { initFn: 'initializeFromEmptyProxy', initArgs: [parameters.paddedInputter.initialPrfInstances] },
    },
  ];

  return { implementations: await deployImplementations({ ...parameters, addressReplacements, targets }) };
}
