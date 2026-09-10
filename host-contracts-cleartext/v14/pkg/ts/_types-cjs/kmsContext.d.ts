import type { AbstractEthereumProvider, AbstractEthereumSigner, AbstractEthereumUtils, KmsThresholds } from './types/public.js';
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
export declare function defineNewKmsContextAndEpoch(parameters: {
    readonly ethProvider: AbstractEthereumProvider;
    readonly ethUtils: AbstractEthereumUtils;
    readonly admin: AbstractEthereumSigner;
    readonly aclOwnerAddress: string;
    readonly protocolConfigAddress: string;
    readonly thresholds?: KmsThresholds | undefined;
}): Promise<{
    readonly signers: readonly string[];
    readonly kmsContextId: bigint;
}>;
/**
 * Destroy a KMS context that is not the active one: a superseded past context, or a Pending proposal.
 *
 * Marks `kmsContextId` as destroyed via `ProtocolConfig.destroyKmsContext(...)`, routed through the
 * standing `ACLOwner` (same authorization model as {@link defineNewKmsContextAndEpoch}: `admin` owns the
 * `ACLOwner`, which is the ACL owner). The ACTIVE context cannot be destroyed, and an unknown or
 * already-destroyed id is rejected — both revert on-chain and the revert bubbles up through
 * `ACLOwner.execute`. v14 also clears the context's epoch, if it had one.
 */
export declare function destroyKmsContext(parameters: {
    readonly ethUtils: AbstractEthereumUtils;
    readonly admin: AbstractEthereumSigner;
    readonly aclOwnerAddress: string;
    readonly protocolConfigAddress: string;
    readonly kmsContextId: bigint;
}): Promise<void>;
//# sourceMappingURL=kmsContext.d.ts.map