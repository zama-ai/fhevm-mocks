import type { AbstractEthereumSigner, AbstractEthereumUtils, DeployReturnType } from './types/public.js';
import type { HexString, DeployedImplementation } from './types/private.js';
/**
 * Deploys the standing `ACLOwner` admin. One-time; afterwards ACL ownership is handed to it via
 * `setupACLOwner` (or a manual transfer + `acceptACLOwnership`).
 */
export declare function deployACLOwner(parameters: {
    readonly deployer: AbstractEthereumSigner;
    readonly initialOwner: string;
    readonly aclAddress: string;
}): Promise<DeployReturnType>;
/**
 * One-time setup: deploy `ACLOwner` and hand it ACL ownership.
 *
 * `ACLOwner`'s owner is set to `admin`'s address. `currentAclOwner` (the current ACL owner) transfers
 * ownership to the new `ACLOwner`, then `admin` completes the two-step transfer via
 * `acceptACLOwnership`. The three signers are often the same account in a single-operator setup.
 *
 * @dev Sends the transfer and accept as sequential transactions; correct on ordered/auto-mining
 *      networks. If `currentAclOwner` and `admin` are different accounts on a live network, ensure the
 *      transfer is confirmed before the accept.
 */
export declare function setupACLOwner(parameters: {
    readonly deployer: AbstractEthereumSigner;
    readonly currentAclOwner: AbstractEthereumSigner;
    readonly admin: AbstractEthereumSigner;
    readonly aclAddress: string;
    readonly pauserSetAddress: string;
}): Promise<{
    readonly aclOwnerAddress: string;
}>;
/**
 * Emergency-stop the ACL via the standing `ACLOwner`. Sent by `admin` (the `ACLOwner`'s owner);
 * `ACLOwner.pause()` forwards to `ACL.pause()`, which is authorized because `ACLOwner` is a
 * registered pauser (see `setupACLOwner`).
 */
export declare function pauseACL(parameters: {
    readonly admin: AbstractEthereumSigner;
    readonly aclOwnerAddress: string;
}): Promise<void>;
/**
 * Lift a pause on the ACL via the standing `ACLOwner`. Sent by `admin`; `ACLOwner.unpause()` forwards
 * to `ACL.unpause()`, which ACL gates on its owner — the `ACLOwner` itself.
 */
export declare function unpauseACL(parameters: {
    readonly admin: AbstractEthereumSigner;
    readonly aclOwnerAddress: string;
}): Promise<void>;
/** Maps a Phase 1 plan to the `ACLOwner.Op[]` argument for `upgrade(ops)`. */
export declare function toACLOwnerOps(implementations: readonly DeployedImplementation[]): ReadonlyArray<{
    readonly proxy: string;
    readonly implementation: string;
    readonly initData: HexString;
}>;
/**
 * Encodes `ACLOwner.upgrade(ops)` calldata from a Phase 1 plan — for the owner to send directly, or
 * to hand to a multisig/timelock owner to execute.
 */
export declare function encodeACLOwnerUpgrade(parameters: {
    readonly ethUtils: AbstractEthereumUtils;
    readonly implementations: readonly DeployedImplementation[];
}): Promise<HexString>;
//# sourceMappingURL=aclOwner.d.ts.map