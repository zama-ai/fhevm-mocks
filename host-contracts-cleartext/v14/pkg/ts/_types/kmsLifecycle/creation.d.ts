import type { AbstractEthereumProvider, AbstractEthereumSigner } from '../types/public.js';
/** One tx sender's creation vote. The contract enforces membership and one vote per sender. */
export declare function confirmKmsContextCreation(parameters: {
    readonly txSender: AbstractEthereumSigner;
    readonly protocolConfigAddress: string;
    readonly kmsContextId: bigint;
}): Promise<void>;
/**
 * Confirm from exactly the set the quorum needs: every incoming tx sender plus the `n - t` outgoing ones the
 * contract reports. Exact rather than "until it takes": nothing observable says Created, and a late vote reverts.
 */
export declare function reachKmsContextCreationQuorum(parameters: {
    readonly ethProvider: AbstractEthereumProvider;
    readonly incomingTxSenders: readonly AbstractEthereumSigner[];
    readonly previousTxSenders: readonly AbstractEthereumSigner[];
    readonly protocolConfigAddress: string;
    readonly kmsContextId: bigint;
}): Promise<void>;
//# sourceMappingURL=creation.d.ts.map