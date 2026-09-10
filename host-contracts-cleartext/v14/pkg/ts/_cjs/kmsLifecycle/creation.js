"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmKmsContextCreation = confirmKmsContextCreation;
exports.reachKmsContextCreationQuorum = reachKmsContextCreationQuorum;
const ProtocolConfig_js_1 = require("../artifacts/ProtocolConfig.js");
async function confirmKmsContextCreation(parameters) {
    await parameters.txSender.writeContract({
        address: parameters.protocolConfigAddress,
        abi: ProtocolConfig_js_1.abi,
        functionName: 'confirmKmsContextCreation',
        args: [parameters.kmsContextId],
    });
}
async function reachKmsContextCreationQuorum(parameters) {
    const previousRequired = Number(await parameters.ethProvider.readContract({
        address: parameters.protocolConfigAddress,
        abi: ProtocolConfig_js_1.abi,
        functionName: 'getContextCreationPreviousTxSenderThreshold',
        args: [parameters.kmsContextId],
    }));
    if (parameters.previousTxSenders.length < previousRequired) {
        throw new Error(`KMS context ${parameters.kmsContextId.toString()} needs ${String(previousRequired)} confirmation(s) ` +
            `from the outgoing committee, but only ${String(parameters.previousTxSenders.length)} tx sender(s) were supplied.`);
    }
    for (const txSender of parameters.incomingTxSenders) {
        await confirmKmsContextCreation({ ...parameters, txSender });
    }
    for (const txSender of parameters.previousTxSenders.slice(0, previousRequired)) {
        await confirmKmsContextCreation({ ...parameters, txSender });
    }
}
//# sourceMappingURL=creation.js.map