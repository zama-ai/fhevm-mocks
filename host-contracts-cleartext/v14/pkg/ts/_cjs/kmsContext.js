"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defineNewKmsContextAndEpoch = defineNewKmsContextAndEpoch;
exports.destroyKmsContext = destroyKmsContext;
const ACLOwner_js_1 = require("./artifacts/ACLOwner.js");
const ProtocolConfig_js_1 = require("./artifacts/ProtocolConfig.js");
const constants_js_1 = require("./constants.js");
async function defineNewKmsContextAndEpoch(parameters) {
    const read = (functionName) => parameters.ethProvider.readContract({
        address: parameters.protocolConfigAddress,
        abi: ProtocolConfig_js_1.abi,
        functionName,
    });
    const currentSigners = (await read('getKmsSigners'));
    const newSigners = (0, constants_js_1.nextDefaultKmsSignerWindow)(currentSigners);
    const kmsNodes = (0, constants_js_1.generateFromExistingDefaultKmsNodes)(newSigners);
    const thresholds = parameters.thresholds ?? {
        publicDecryption: (await read('getPublicDecryptionThreshold')),
        userDecryption: (await read('getUserDecryptionThreshold')),
        kmsGen: (await read('getKmsGenThreshold')),
        mpc: (await read('getMpcThreshold')),
    };
    const { softwareVersion, pcrValues } = constants_js_1.DEFAULT_BOOTSTRAP_CONFIG.protocolConfig;
    const callData = await parameters.ethUtils.encodeCall({
        abi: ProtocolConfig_js_1.abi,
        functionName: 'defineNewKmsContextAndEpoch',
        args: [kmsNodes, thresholds, softwareVersion, pcrValues],
    });
    await parameters.admin.writeContract({
        address: parameters.aclOwnerAddress,
        abi: ACLOwner_js_1.abi,
        functionName: 'execute',
        args: [parameters.protocolConfigAddress, callData],
    });
    const kmsContextId = (await read('getCurrentKmsContextIdCounter'));
    return { signers: newSigners, kmsContextId };
}
async function destroyKmsContext(parameters) {
    const callData = await parameters.ethUtils.encodeCall({
        abi: ProtocolConfig_js_1.abi,
        functionName: 'destroyKmsContext',
        args: [parameters.kmsContextId],
    });
    await parameters.admin.writeContract({
        address: parameters.aclOwnerAddress,
        abi: ACLOwner_js_1.abi,
        functionName: 'execute',
        args: [parameters.protocolConfigAddress, callData],
    });
}
//# sourceMappingURL=kmsContext.js.map