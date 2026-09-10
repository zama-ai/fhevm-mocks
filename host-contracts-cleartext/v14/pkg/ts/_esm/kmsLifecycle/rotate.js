// A whole v14 rotation, phases 1 to 3 in order: the call a caller wants by default, since a rotation that
// stops after phase 1 leaves the old committee in charge and nothing on-chain reports the gap.
import { abi as protocolConfigAbi } from '../artifacts/ProtocolConfig.js';
import { defineNewKmsContextAndEpoch } from '../kmsContext.js';
import { confirmEpochActivation, epochActivationDigests } from './activation.js';
import { reachKmsContextCreationQuorum } from './creation.js';
/**
 * Propose the next default signer window, reach its creation quorum, then have every activator attest to
 * the new epoch; returns once the new signer set is actually in charge, and throws if it never is.
 */
export async function rotateKmsContext(parameters) {
    const [, activeEpochId] = (await parameters.ethProvider.readContract({
        address: parameters.protocolConfigAddress,
        abi: protocolConfigAbi,
        functionName: 'getCurrentKmsContextAndEpoch',
    }));
    const { signers, kmsContextId } = await defineNewKmsContextAndEpoch(parameters);
    await reachKmsContextCreationQuorum({
        ethProvider: parameters.ethProvider,
        protocolConfigAddress: parameters.protocolConfigAddress,
        kmsContextId,
        incomingTxSenders: parameters.activators.map((activator) => activator.txSender),
        previousTxSenders: parameters.previousTxSenders ?? [],
    });
    // The quorum opened the context's first epoch, the next one after the active epoch.
    const epochId = activeEpochId + 1n;
    const digests = epochActivationDigests({
        ethUtils: parameters.ethUtils,
        protocolConfigAddress: parameters.protocolConfigAddress,
        chainId: parameters.chainId,
        kmsContextId,
        epochId,
        attestation: parameters.attestation,
    });
    for (const activator of parameters.activators) {
        const { keygen, crsgen } = await activator.sign(digests);
        const { active } = await confirmEpochActivation({
            ethProvider: parameters.ethProvider,
            txSender: activator.txSender,
            protocolConfigAddress: parameters.protocolConfigAddress,
            kmsContextId,
            epochId,
            attestation: parameters.attestation,
            keygenSignature: keygen,
            crsgenSignature: crsgen,
        });
        if (active)
            return { signers, kmsContextId, epochId };
    }
    throw new Error(`KMS epoch ${epochId.toString()} did not activate after ${String(parameters.activators.length)} attestation(s); ` +
        `activation needs one from every signer of the incoming committee, all over identical values.`);
}
//# sourceMappingURL=rotate.js.map