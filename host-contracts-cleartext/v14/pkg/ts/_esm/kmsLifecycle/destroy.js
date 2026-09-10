// Aborting a v14 epoch: the way out of a split activation vote, which would otherwise block every later proposal.
import { abi as aclOwnerAbi } from '../artifacts/ACLOwner.js';
import { abi as protocolConfigAbi } from '../artifacts/ProtocolConfig.js';
/** Destroy a Pending epoch through the standing `ACLOwner`, like every other governance call. */
export async function destroyKmsEpoch(parameters) {
    const callData = await parameters.ethUtils.encodeCall({
        abi: protocolConfigAbi,
        functionName: 'destroyKmsEpoch',
        args: [parameters.epochId],
    });
    await parameters.admin.writeContract({
        address: parameters.aclOwnerAddress,
        abi: aclOwnerAbi,
        functionName: 'execute',
        args: [parameters.protocolConfigAddress, callData],
    });
}
//# sourceMappingURL=destroy.js.map