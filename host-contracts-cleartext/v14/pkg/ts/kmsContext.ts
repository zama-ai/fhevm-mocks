import { abi as aclOwnerAbi } from './artifacts/ACLOwner.js';
import { abi as protocolConfigAbi } from './artifacts/ProtocolConfig.js';
import {
  DEFAULT_BOOTSTRAP_CONFIG,
  generateFromExistingDefaultKmsNodes,
  nextDefaultKmsSignerWindow,
} from './constants.js';
import type {
  AbstractEthereumProvider,
  AbstractEthereumSigner,
  AbstractEthereumUtils,
  KmsThresholds,
} from './types/public.js';

////////////////////////////////////////////////////////////////////////////////

/**
 * Propose the next window of default signers as a new `ProtocolConfig` KMS context.
 *
 * Reads the current KMS signer set (which must be a consecutive window of the default 20-signer pool),
 * computes the next window of the same length via {@link nextDefaultKmsSignerWindow}, rebuilds the full
 * per-node details from the defaults, and calls `ProtocolConfig.defineNewKmsContextAndEpoch(...)`. The
 * four thresholds are preserved from the current context unless `thresholds` is provided. In v14 this
 * only PROPOSES: the context is Pending and `getKmsSigners()` still reports the old set until the
 * committees confirm it and its first epoch is activated (see `kmsLifecycle/`).
 *
 * @dev `defineNewKmsContextAndEpoch` is `onlyACLOwner`, so the call is routed through the standing `ACLOwner`
 *      (the ACL owner): `admin` — the `ACLOwner`'s own owner — sends `ACLOwner.execute(protocolConfig,
 *      calldata)`, which forwards it with `msg.sender == ACL.owner()`. This is the default post-`deploy`
 *      topology (ACL owned by `ACLOwner`, `ACLOwner` owned by `admin`).
 */
export async function defineNewKmsContextAndEpoch(parameters: {
  readonly ethProvider: AbstractEthereumProvider;
  readonly ethUtils: AbstractEthereumUtils;
  readonly admin: AbstractEthereumSigner;
  readonly aclOwnerAddress: string;
  readonly protocolConfigAddress: string;
  readonly thresholds?: KmsThresholds | undefined;
}): Promise<{ readonly signers: readonly string[]; readonly kmsContextId: bigint }> {
  const read = (functionName: string): Promise<unknown> =>
    parameters.ethProvider.readContract({
      address: parameters.protocolConfigAddress,
      abi: protocolConfigAbi,
      functionName,
    });

  const currentSigners = (await read('getKmsSigners')) as readonly string[];
  const newSigners = nextDefaultKmsSignerWindow(currentSigners);
  const kmsNodes = generateFromExistingDefaultKmsNodes(newSigners);

  const thresholds: KmsThresholds = parameters.thresholds ?? {
    publicDecryption: (await read('getPublicDecryptionThreshold')) as bigint,
    userDecryption: (await read('getUserDecryptionThreshold')) as bigint,
    kmsGen: (await read('getKmsGenThreshold')) as bigint,
    mpc: (await read('getMpcThreshold')) as bigint,
  };

  // Encode ProtocolConfig.defineNewKmsContextAndEpoch(...) and forward it through ACLOwner.execute, so
  // the on-chain msg.sender is the ACL owner (this contract) and the onlyACLOwner gate passes. The KMS
  // build name and PCR set are the same ones a fresh deploy uses.
  const { softwareVersion, pcrValues } = DEFAULT_BOOTSTRAP_CONFIG.protocolConfig;
  const callData = await parameters.ethUtils.encodeCall({
    abi: protocolConfigAbi,
    functionName: 'defineNewKmsContextAndEpoch',
    args: [kmsNodes, thresholds, softwareVersion, pcrValues],
  });

  await parameters.admin.writeContract({
    address: parameters.aclOwnerAddress,
    abi: aclOwnerAbi,
    functionName: 'execute',
    args: [parameters.protocolConfigAddress, callData],
  });

  // The proposal took the next id off the counter; that is the context the committees now confirm.
  const kmsContextId = (await read('getCurrentKmsContextIdCounter')) as bigint;
  return { signers: newSigners, kmsContextId };
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Destroy a KMS context that is not the active one: a superseded past context, or a Pending proposal.
 *
 * Marks `kmsContextId` as destroyed via `ProtocolConfig.destroyKmsContext(...)`, routed through the
 * standing `ACLOwner` (same authorization model as {@link defineNewKmsContextAndEpoch}: `admin` owns the
 * `ACLOwner`, which is the ACL owner). The ACTIVE context cannot be destroyed, and an unknown or
 * already-destroyed id is rejected — both revert on-chain and the revert bubbles up through
 * `ACLOwner.execute`. v14 also clears the context's epoch, if it had one.
 */
export async function destroyKmsContext(parameters: {
  readonly ethUtils: AbstractEthereumUtils;
  readonly admin: AbstractEthereumSigner;
  readonly aclOwnerAddress: string;
  readonly protocolConfigAddress: string;
  readonly kmsContextId: bigint;
}): Promise<void> {
  const callData = await parameters.ethUtils.encodeCall({
    abi: protocolConfigAbi,
    functionName: 'destroyKmsContext',
    args: [parameters.kmsContextId],
  });

  await parameters.admin.writeContract({
    address: parameters.aclOwnerAddress,
    abi: aclOwnerAbi,
    functionName: 'execute',
    args: [parameters.protocolConfigAddress, callData],
  });
}
