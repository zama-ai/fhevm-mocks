"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.destroyKmsEpoch = destroyKmsEpoch;
const ACLOwner_js_1 = require("../artifacts/ACLOwner.js");
const ProtocolConfig_js_1 = require("../artifacts/ProtocolConfig.js");
async function destroyKmsEpoch(parameters) {
    const callData = await parameters.ethUtils.encodeCall({
        abi: ProtocolConfig_js_1.abi,
        functionName: 'destroyKmsEpoch',
        args: [parameters.epochId],
    });
    await parameters.admin.writeContract({
        address: parameters.aclOwnerAddress,
        abi: ACLOwner_js_1.abi,
        functionName: 'execute',
        args: [parameters.protocolConfigAddress, callData],
    });
}
//# sourceMappingURL=destroy.js.map