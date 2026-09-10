"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rotateKmsContext = rotateKmsContext;
const ProtocolConfig_js_1 = require("../artifacts/ProtocolConfig.js");
const kmsContext_js_1 = require("../kmsContext.js");
const activation_js_1 = require("./activation.js");
const creation_js_1 = require("./creation.js");
async function rotateKmsContext(parameters) {
    const [, activeEpochId] = (await parameters.ethProvider.readContract({
        address: parameters.protocolConfigAddress,
        abi: ProtocolConfig_js_1.abi,
        functionName: 'getCurrentKmsContextAndEpoch',
    }));
    const { signers, kmsContextId } = await (0, kmsContext_js_1.defineNewKmsContextAndEpoch)(parameters);
    await (0, creation_js_1.reachKmsContextCreationQuorum)({
        ethProvider: parameters.ethProvider,
        protocolConfigAddress: parameters.protocolConfigAddress,
        kmsContextId,
        incomingTxSenders: parameters.activators.map((activator) => activator.txSender),
        previousTxSenders: parameters.previousTxSenders ?? [],
    });
    const epochId = activeEpochId + 1n;
    const digests = (0, activation_js_1.epochActivationDigests)({
        ethUtils: parameters.ethUtils,
        protocolConfigAddress: parameters.protocolConfigAddress,
        chainId: parameters.chainId,
        kmsContextId,
        epochId,
        attestation: parameters.attestation,
    });
    for (const activator of parameters.activators) {
        const { keygen, crsgen } = await activator.sign(digests);
        const { active } = await (0, activation_js_1.confirmEpochActivation)({
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