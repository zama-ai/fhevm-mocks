import type { AbstractEthereumProvider, AbstractEthereumSigner, AbstractEthereumUtils } from '../types/public.js';
import type { EpochActivationAttestation, EpochActivationDigests } from './types.js';
/**
 * The two digests each incoming signer must sign to activate `epochId`. Every signer signs the same
 * values: the contract requires unanimity, and a divergent attestation leaves the epoch Pending for good.
 */
export declare function epochActivationDigests(parameters: {
    readonly ethUtils: AbstractEthereumUtils;
    readonly protocolConfigAddress: string;
    readonly chainId: bigint;
    readonly kmsContextId: bigint;
    readonly epochId: bigint;
    readonly attestation: EpochActivationAttestation;
}): EpochActivationDigests;
/**
 * Submit one signer's attestations from its TX SENDER (the contract resolves the signer from `msg.sender`)
 * and report whether that vote made the context Active.
 */
export declare function confirmEpochActivation(parameters: {
    readonly ethProvider: AbstractEthereumProvider;
    readonly txSender: AbstractEthereumSigner;
    readonly protocolConfigAddress: string;
    readonly kmsContextId: bigint;
    readonly epochId: bigint;
    readonly attestation: EpochActivationAttestation;
    readonly keygenSignature: string;
    readonly crsgenSignature: string;
}): Promise<{
    readonly active: boolean;
}>;
//# sourceMappingURL=activation.d.ts.map