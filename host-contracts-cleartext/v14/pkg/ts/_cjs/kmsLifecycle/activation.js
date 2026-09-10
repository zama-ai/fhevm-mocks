"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.epochActivationDigests = epochActivationDigests;
exports.confirmEpochActivation = confirmEpochActivation;
const ProtocolConfig_js_1 = require("../artifacts/ProtocolConfig.js");
const EXTRA_DATA_V2 = 0x02;
const DOMAIN_NAME = 'ProtocolConfig';
const DOMAIN_VERSION = '1';
const KEY_DIGEST_TYPE = 'KeyDigest(uint8 keyType,bytes digest)';
const KEYGEN_TYPE = `KeygenVerification(uint256 prepKeygenId,uint256 keyId,KeyDigest[] keyDigests,bytes extraData)${KEY_DIGEST_TYPE}`;
const CRSGEN_TYPE = 'CrsgenVerification(uint256 crsId,uint256 maxBitLength,bytes crsDigest,bytes extraData)';
const DOMAIN_TYPE = 'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)';
function epochActivationDigests(parameters) {
    const { ethUtils, attestation } = parameters;
    const domainSeparator = _domainSeparator(parameters);
    const extraData = `0x${EXTRA_DATA_V2.toString(16).padStart(2, '0')}` +
        parameters.kmsContextId.toString(16).padStart(64, '0') +
        parameters.epochId.toString(16).padStart(64, '0');
    const extraDataHash = ethUtils.keccak256({ bytes: extraData });
    const keygen = ethUtils.encodeAbiParameters({
        types: ['bytes32', 'uint256', 'uint256', 'bytes32', 'bytes32'],
        values: [
            _hashString(ethUtils, KEYGEN_TYPE),
            attestation.prepKeygenId,
            attestation.keyId,
            _keyDigestsHash(ethUtils, attestation.keyDigests),
            extraDataHash,
        ],
    });
    const crsgen = ethUtils.encodeAbiParameters({
        types: ['bytes32', 'uint256', 'uint256', 'bytes32', 'bytes32'],
        values: [
            _hashString(ethUtils, CRSGEN_TYPE),
            attestation.crsId,
            attestation.maxBitLength,
            ethUtils.keccak256({ bytes: attestation.crsDigest }),
            extraDataHash,
        ],
    });
    return {
        keygen: _typedDataHash(ethUtils, domainSeparator, ethUtils.keccak256({ bytes: keygen })),
        crsgen: _typedDataHash(ethUtils, domainSeparator, ethUtils.keccak256({ bytes: crsgen })),
    };
}
async function confirmEpochActivation(parameters) {
    const { attestation } = parameters;
    await parameters.txSender.writeContract({
        address: parameters.protocolConfigAddress,
        abi: ProtocolConfig_js_1.abi,
        functionName: 'confirmEpochActivation',
        args: [
            parameters.epochId,
            [
                {
                    prepKeygenId: attestation.prepKeygenId,
                    keyId: attestation.keyId,
                    keyDigests: attestation.keyDigests,
                    signature: parameters.keygenSignature,
                },
            ],
            [
                {
                    crsId: attestation.crsId,
                    maxBitLength: attestation.maxBitLength,
                    crsDigest: attestation.crsDigest,
                    signature: parameters.crsgenSignature,
                },
            ],
        ],
    });
    const current = (await parameters.ethProvider.readContract({
        address: parameters.protocolConfigAddress,
        abi: ProtocolConfig_js_1.abi,
        functionName: 'getCurrentKmsContextAndEpoch',
    }));
    return { active: current[0] === parameters.kmsContextId };
}
function _domainSeparator(parameters) {
    const { ethUtils } = parameters;
    return ethUtils.keccak256({
        bytes: ethUtils.encodeAbiParameters({
            types: ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            values: [
                _hashString(ethUtils, DOMAIN_TYPE),
                _hashString(ethUtils, DOMAIN_NAME),
                _hashString(ethUtils, DOMAIN_VERSION),
                parameters.chainId,
                parameters.protocolConfigAddress,
            ],
        }),
    });
}
function _typedDataHash(ethUtils, domainSeparator, structHash) {
    return ethUtils.keccak256({ bytes: `0x1901${_strip(domainSeparator)}${_strip(structHash)}` });
}
function _keyDigestsHash(ethUtils, keyDigests) {
    const encoded = keyDigests
        .map((keyDigest) => _strip(ethUtils.keccak256({
        bytes: ethUtils.encodeAbiParameters({
            types: ['bytes32', 'uint8', 'bytes32'],
            values: [
                _hashString(ethUtils, KEY_DIGEST_TYPE),
                keyDigest.keyType,
                ethUtils.keccak256({ bytes: keyDigest.digest }),
            ],
        }),
    })))
        .join('');
    return ethUtils.keccak256({ bytes: `0x${encoded}` });
}
function _hashString(ethUtils, value) {
    const bytes = [...new TextEncoder().encode(value)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return ethUtils.keccak256({ bytes: `0x${bytes}` });
}
function _strip(hex) {
    return hex.startsWith('0x') ? hex.slice(2) : hex;
}
//# sourceMappingURL=activation.js.map