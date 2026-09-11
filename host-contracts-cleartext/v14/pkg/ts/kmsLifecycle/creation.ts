// Phase 2 of a v14 rotation: committee members confirm a Pending context until its creation quorum is reached.
import { abi as protocolConfigAbi } from '../artifacts/ProtocolConfig.js';
import type { AbstractEthereumProvider, AbstractEthereumSigner } from '../types/public.js';

/** One tx sender's creation vote. The contract enforces membership and one vote per sender. */
export async function confirmKmsContextCreation(parameters: {
  readonly txSender: AbstractEthereumSigner;
  readonly protocolConfigAddress: string;
  readonly kmsContextId: bigint;
}): Promise<void> {
  await parameters.txSender.writeContract({
    address: parameters.protocolConfigAddress,
    abi: protocolConfigAbi,
    functionName: 'confirmKmsContextCreation',
    args: [parameters.kmsContextId],
  });
}

/**
 * Confirm from exactly the set the quorum needs: every incoming tx sender plus the `n - t` outgoing ones the
 * contract reports. Exact rather than "until it takes": nothing observable says Created, and a late vote reverts.
 */
export async function reachKmsContextCreationQuorum(parameters: {
  readonly ethProvider: AbstractEthereumProvider;
  readonly incomingTxSenders: readonly AbstractEthereumSigner[];
  readonly previousTxSenders: readonly AbstractEthereumSigner[];
  readonly protocolConfigAddress: string;
  readonly kmsContextId: bigint;
}): Promise<void> {
  const previousRequired = Number(
    await parameters.ethProvider.readContract({
      address: parameters.protocolConfigAddress,
      abi: protocolConfigAbi,
      functionName: 'getContextCreationPreviousTxSenderThreshold',
      args: [parameters.kmsContextId],
    }),
  );
  if (parameters.previousTxSenders.length < previousRequired) {
    throw new Error(
      `KMS context ${parameters.kmsContextId.toString()} needs ${String(previousRequired)} confirmation(s) ` +
        `from the outgoing committee, but only ${String(parameters.previousTxSenders.length)} tx sender(s) were supplied.`,
    );
  }
  // Incoming first, so the promoting vote is the last outgoing one; the contract does not care about order.
  for (const txSender of parameters.incomingTxSenders) {
    await confirmKmsContextCreation({ ...parameters, txSender });
  }
  for (const txSender of parameters.previousTxSenders.slice(0, previousRequired)) {
    await confirmKmsContextCreation({ ...parameters, txSender });
  }
}
