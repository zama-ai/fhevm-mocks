import { abi as aclAbi, template as aclTemplate } from './artifacts/CleartextACL.js';
import { abi as fhevmExecutorAbi, template as fhevmExecutorTemplate } from './artifacts/CleartextFHEVMExecutor.js';
import { abi as kmsVerifierAbi, template as kmsVerifierTemplate } from './artifacts/CleartextKMSVerifier.js';
import { abi as inputVerifierAbi, template as inputVerifierTemplate } from './artifacts/CleartextInputVerifier.js';
import { abi as protocolConfigAbi, template as protocolConfigTemplate } from './artifacts/ProtocolConfig.js';
import { abi as kmsGenerationAbi, template as kmsGenerationTemplate } from './artifacts/KMSGeneration.js';
import { abi as aclOwnerAbi } from './artifacts/ACLOwner.js';
import type { ContractUpgradeSpec, DeployedImplementation, UpgradeTarget } from './types/private.js';
import type {
  AbstractEthereumSigner,
  AbstractEthereumUtils,
  CleartextAddresses,
  FhevmAddressesV14,
} from './types/public.js';
import { buildHostAddressReplacements, deployImplementations, sendStep } from './utils.js';
import { toACLOwnerOps } from './aclOwner.js';

////////////////////////////////////////////////////////////////////////////////

/**
 * Update an already-deployed v14 stack to v15.
 *
 * Creates no proxy — v15 adds no contract to the host set — so the address set is unchanged. In one
 * atomic `ACLOwner.upgrade(...)` it re-points + version-bumps the six contracts whose reinitializer moves,
 * in the order of upstream's `upgrade-manifest.json`:
 *   - `ACL.reinitializeV6()`, `FHEVMExecutor.reinitializeV7()`, `KMSVerifier.reinitializeV5()`,
 *     `InputVerifier.reinitializeV3()`, `ProtocolConfig.reinitializeV3()`, `KMSGeneration.reinitializeV3()`
 *     — all no-arg: v14 -> v15 migrates nothing.
 * `HCULimit` is untouched (its reinitializer and bytecode are unchanged), and so are `CleartextArithmetic`
 * and `CleartextDB` (their bytecode is identical across the two generations).
 *
 * All v15 implementations are patched with the ACTUAL addresses of the live stack.
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
}): Promise<void> {
  const { pauserSetAddress, ...existingV14 } = parameters.existing;

  // 1. Phase 1: deploy the v15 implementations (permissionless).
  const { implementations } = await buildUpdateV14ToV15Plan({
    ethUtils: parameters.ethUtils,
    deployer: parameters.deployer,
    fhevmAddresses: existingV14,
    cleartextAddresses: parameters.cleartext,
    pauserSetAddress,
  });

  // 2. One atomic ACLOwner.upgrade: 6 reinitializations.
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
}

/**
 * Phase 1 for a v14→v15 update: deploys the v15 implementations for the six changed contracts (patched with
 * the actual live addresses) and encodes their `upgradeToAndCall` calldata. Sends no owner-gated
 * transaction. `HCULimit` is intentionally absent (its reinitializer and bytecode are unchanged).
 * @internal — used by `updateV14ToV15`; not part of the public API.
 */
async function buildUpdateV14ToV15Plan(parameters: {
  readonly ethUtils: AbstractEthereumUtils;
  readonly deployer: AbstractEthereumSigner;
  readonly fhevmAddresses: FhevmAddressesV14;
  readonly cleartextAddresses: CleartextAddresses;
  readonly pauserSetAddress: string;
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
  ];

  return { implementations: await deployImplementations({ ...parameters, addressReplacements, targets }) };
}
