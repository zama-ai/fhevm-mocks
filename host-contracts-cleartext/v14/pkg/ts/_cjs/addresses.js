"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.precomputeAddresses = precomputeAddresses;
const HOST_NONCE_OFFSET = {
    aclAddress: 1n,
    fhevmExecutorAddress: 3n,
    kmsVerifierAddress: 4n,
    inputVerifierAddress: 5n,
    hcuLimitAddress: 6n,
    protocolConfigAddress: 7n,
    kmsGenerationAddress: 8n,
};
const HOST_NONCE_COUNT = Object.values(HOST_NONCE_OFFSET).reduce((highest, offset) => (offset > highest ? offset : highest), 0n) + 1n;
function precomputeFhevmAddresses(parameters) {
    const at = (offset) => parameters.ethUtils.getContractAddress({ from: parameters.from, nonce: parameters.startNonce + offset });
    return {
        fhevmAddresses: {
            aclAddress: at(HOST_NONCE_OFFSET.aclAddress),
            fhevmExecutorAddress: at(HOST_NONCE_OFFSET.fhevmExecutorAddress),
            kmsVerifierAddress: at(HOST_NONCE_OFFSET.kmsVerifierAddress),
            inputVerifierAddress: at(HOST_NONCE_OFFSET.inputVerifierAddress),
            hcuLimitAddress: at(HOST_NONCE_OFFSET.hcuLimitAddress),
            protocolConfigAddress: at(HOST_NONCE_OFFSET.protocolConfigAddress),
            kmsGenerationAddress: at(HOST_NONCE_OFFSET.kmsGenerationAddress),
        },
        nextStartNonce: parameters.startNonce + HOST_NONCE_COUNT,
    };
}
function precomputeAddresses(parameters) {
    const { fhevmAddresses, nextStartNonce } = precomputeFhevmAddresses(parameters);
    const at = (nonce) => parameters.ethUtils.getContractAddress({ from: parameters.from, nonce });
    const cleartextAddresses = {
        cleartextArithmeticAddress: at(nextStartNonce),
        cleartextDbAddress: at(nextStartNonce + 1n),
    };
    return {
        fhevmAddresses,
        cleartextAddresses,
        pauserSetAddress: at(nextStartNonce + 2n),
        nextStartNonce: nextStartNonce + 3n,
    };
}
//# sourceMappingURL=addresses.js.map