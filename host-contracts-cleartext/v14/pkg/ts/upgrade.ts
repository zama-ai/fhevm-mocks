import { abi as aclAbi, template as aclTemplate } from './artifacts/CleartextACL.js';
import { abi as fhevmExecutorAbi, template as fhevmExecutorTemplate } from './artifacts/CleartextFHEVMExecutor.js';
import { abi as kmsVerifierAbi, template as kmsVerifierTemplate } from './artifacts/CleartextKMSVerifier.js';
import { abi as hcuLimitAbi, template as hcuLimitTemplate } from './artifacts/CleartextHCULimit.js';
import { abi as protocolConfigAbi, template as protocolConfigTemplate } from './artifacts/ProtocolConfig.js';
import { abi as kmsGenerationAbi, template as kmsGenerationTemplate } from './artifacts/KMSGeneration.js';
import {
  abi as cleartextArithmeticAbi,
  template as cleartextArithmeticTemplate,
} from './artifacts/CleartextArithmetic.js';
import { abi as aclOwnerAbi } from './artifacts/ACLOwner.js';
import type { ContractUpgradeSpec, DeployedImplementation, UpgradeTarget } from './types/private.js';
import type {
  AbstractEthereumProvider,
  AbstractEthereumSigner,
  AbstractEthereumUtils,
  CleartextAddresses,
  FhevmAddressesV13,
  UpdateV13ToV14MigrationConfig,
} from './types/public.js';
import { buildHostAddressReplacements, deployImplementations, sendStep } from './utils.js';
import { toACLOwnerOps } from './aclOwner.js';
import { DEFAULT_BOOTSTRAP_CONFIG, generateFromExistingDefaultKmsNodes } from './constants.js';

////////////////////////////////////////////////////////////////////////////////

/**
 * Update an already-deployed `<vN-1>` stack to `<vN>`.
 *
 * Creates no proxy — `v14` added no contract to the host set — so the address set is unchanged. In one
 * atomic `ACLOwner.upgrade(...)` it re-points + version-bumps the seven changed `<vN-1>` contracts:
 *   - `ProtocolConfig.reinitializeV2(kmsNodeParams, softwareVersion, pcrValues)`, which re-declares the
 *     current KMS context with the `<vN>` per-node metadata (party id, MPC identity, CA cert, storage prefix)
 *     and records the KMS software version + PCR values,
 *   - `KMSGeneration.reinitializeV2()`, `ACL.reinitializeV5()`, `FHEVMExecutor.reinitializeV6()`,
 *     `HCULimit`/`KMSVerifier` `reinitializeV4()` — all no-arg,
 *   - `CleartextArithmetic.reinitializeV3()`: `v14` added `fheMulDiv`, whose cleartext `recordMulDiv` hook is
 *     a new selector the `<vN-1>` arithmetic lacks.
 * `InputVerifier` is untouched (its `<vN>` bytecode is identical and its version did not bump).
 *
 * All `<vN>` implementations are patched with the ACTUAL addresses of the live stack.
 *
 * @dev Requires the live stack's ACL owner to already be the `ACLOwner` at `aclOwnerAddress`, and
 *      `admin` to be that `ACLOwner`'s owner. If the stack is EOA-owned, install one first
 *      (`setupACLOwner`).
 */
export async function updateV13ToV14(parameters: {
  readonly ethProvider: AbstractEthereumProvider;
  readonly ethUtils: AbstractEthereumUtils;
  readonly deployer: AbstractEthereumSigner;
  readonly admin: AbstractEthereumSigner;
  readonly aclOwnerAddress: string;
  readonly existing: FhevmAddressesV13 & { readonly pauserSetAddress: string };
  // Live cleartext-infra proxies of the running `<vN-1>` stack. The new `<vN>` `CleartextFHEVMExecutor` impl
  // bakes `cleartextArithmeticAdd`, so it must be patched with the real proxy address (not the
  // placeholder) or the post-upgrade cleartext round-trip would call a dead address.
  readonly cleartext: CleartextAddresses;
  readonly migration?: UpdateV13ToV14MigrationConfig | undefined;
}): Promise<void> {
  const { pauserSetAddress, ...existingV13 } = parameters.existing;

  // If no migration is supplied, assume the live `<vN-1>` stack was deployed with the default values: read
  // the current KMS signer set off the live `<vN-1>` `ProtocolConfig`, then rebuild the full `<vN>` node details
  // (tx-sender/ip/storage + the new per-node metadata) from the package defaults.
  const migration =
    parameters.migration ??
    (await resolveDefaultMigration({
      ethProvider: parameters.ethProvider,
      protocolConfigAddress: existingV13.protocolConfigAddress,
    }));

  // 1. Phase 1: deploy the `<vN>` implementations (permissionless).
  const { implementations } = await buildUpdateV13ToV14Plan({
    ethUtils: parameters.ethUtils,
    deployer: parameters.deployer,
    fhevmAddresses: existingV13,
    cleartextAddresses: parameters.cleartext,
    pauserSetAddress,
    migration,
  });

  // 2. One atomic ACLOwner.upgrade: 7 reinitializations.
  await sendStep({
    label: 'ACLOwner.upgrade (v13 -> v14)',
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
 * Build the migration config for a `<vN-1>` stack that was deployed with the package defaults. Preserves the
 * signer set the live `<vN-1>` `ProtocolConfig` exposes, so the re-declared context matches the running stack;
 * the per-node metadata (tx-sender/ip/storage, and the `<vN>` party id/MPC identity/CA cert/storage prefix)
 * is rebuilt from the defaults via `generateFromExistingDefaultKmsNodes`. Software version + PCR values
 * are the cleartext defaults.
 * @internal — used by `updateV13ToV14` when no explicit `migration` is supplied.
 */
async function resolveDefaultMigration(parameters: {
  readonly ethProvider: AbstractEthereumProvider;
  readonly protocolConfigAddress: string;
}): Promise<UpdateV13ToV14MigrationConfig> {
  const existingSigners = (await parameters.ethProvider.readContract({
    address: parameters.protocolConfigAddress,
    abi: protocolConfigAbi,
    functionName: 'getKmsSigners',
  })) as readonly string[];

  return {
    kmsNodeParams: generateFromExistingDefaultKmsNodes([...existingSigners]),
    softwareVersion: DEFAULT_BOOTSTRAP_CONFIG.protocolConfig.softwareVersion,
    pcrValues: DEFAULT_BOOTSTRAP_CONFIG.protocolConfig.pcrValues,
  };
}

/**
 * Phase 1 for a `<vN-1>` -> `<vN>` update: deploys the `<vN>` implementations for the seven changed contracts
 * (patched with the actual live addresses) and encodes their `upgradeToAndCall` calldata. Sends no owner-gated
 * transaction. `InputVerifier` is intentionally absent (its `<vN>` bytecode is unchanged).
 * @internal — used by `updateV13ToV14`; not part of the public API.
 */
async function buildUpdateV13ToV14Plan(parameters: {
  readonly ethUtils: AbstractEthereumUtils;
  readonly deployer: AbstractEthereumSigner;
  readonly fhevmAddresses: FhevmAddressesV13;
  readonly cleartextAddresses: CleartextAddresses;
  readonly pauserSetAddress: string;
  readonly migration: UpdateV13ToV14MigrationConfig;
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
      contractName: 'ProtocolConfig',
      proxyAddress: addr.protocolConfigAddress,
      template: protocolConfigTemplate,
      abi: protocolConfigAbi,
      spec: {
        initFn: 'reinitializeV2',
        initArgs: [
          parameters.migration.kmsNodeParams,
          parameters.migration.softwareVersion,
          parameters.migration.pcrValues,
        ],
      },
    },
    {
      contractName: 'KMSGeneration',
      proxyAddress: addr.kmsGenerationAddress,
      template: kmsGenerationTemplate,
      abi: kmsGenerationAbi,
      spec: noArgs('reinitializeV2'),
    },
    {
      contractName: 'ACL',
      proxyAddress: addr.aclAddress,
      template: aclTemplate,
      abi: aclAbi,
      spec: noArgs('reinitializeV5'),
    },
    {
      contractName: 'FHEVMExecutor',
      proxyAddress: addr.fhevmExecutorAddress,
      template: fhevmExecutorTemplate,
      abi: fhevmExecutorAbi,
      spec: noArgs('reinitializeV6'),
    },
    {
      contractName: 'HCULimit',
      proxyAddress: addr.hcuLimitAddress,
      template: hcuLimitTemplate,
      abi: hcuLimitAbi,
      spec: noArgs('reinitializeV4'),
    },
    {
      contractName: 'KMSVerifier',
      proxyAddress: addr.kmsVerifierAddress,
      template: kmsVerifierTemplate,
      abi: kmsVerifierAbi,
      spec: noArgs('reinitializeV4'),
    },
    {
      contractName: 'CleartextArithmetic',
      proxyAddress: parameters.cleartextAddresses.cleartextArithmeticAddress,
      template: cleartextArithmeticTemplate,
      abi: cleartextArithmeticAbi,
      spec: noArgs('reinitializeV3'),
    },
  ];

  return { implementations: await deployImplementations({ ...parameters, addressReplacements, targets }) };
}
