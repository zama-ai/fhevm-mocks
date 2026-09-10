import type { AbstractEthereumProvider, AbstractEthereumSigner, AbstractEthereumUtils, KmsThresholds } from '../types/public.js';
import type { EpochActivationAttestation, KmsEpochActivator } from './types.js';
/**
 * Propose the next default signer window, reach its creation quorum, then have every activator attest to
 * the new epoch; returns once the new signer set is actually in charge, and throws if it never is.
 */
export declare function rotateKmsContext(parameters: {
    readonly ethProvider: AbstractEthereumProvider;
    readonly ethUtils: AbstractEthereumUtils;
    readonly admin: AbstractEthereumSigner;
    readonly aclOwnerAddress: string;
    readonly protocolConfigAddress: string;
    readonly chainId: bigint;
    readonly activators: readonly KmsEpochActivator[];
    readonly attestation: EpochActivationAttestation;
    readonly previousTxSenders?: readonly AbstractEthereumSigner[] | undefined;
    readonly thresholds?: KmsThresholds | undefined;
}): Promise<{
    readonly signers: readonly string[];
    readonly kmsContextId: bigint;
    readonly epochId: bigint;
}>;
//# sourceMappingURL=rotate.d.ts.map