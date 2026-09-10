import type { AbstractEthereumSigner, AbstractEthereumUtils } from '../types/public.js';
/** Destroy a Pending epoch through the standing `ACLOwner`, like every other governance call. */
export declare function destroyKmsEpoch(parameters: {
    readonly ethUtils: AbstractEthereumUtils;
    readonly admin: AbstractEthereumSigner;
    readonly aclOwnerAddress: string;
    readonly protocolConfigAddress: string;
    readonly epochId: bigint;
}): Promise<void>;
//# sourceMappingURL=destroy.d.ts.map