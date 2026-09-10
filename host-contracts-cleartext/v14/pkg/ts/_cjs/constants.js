"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BOOTSTRAP_CONFIG = exports.DEFAULT_KMS_THRESHOLDS = void 0;
exports.generateFromExistingDefaultKmsNodes = generateFromExistingDefaultKmsNodes;
exports.nextDefaultKmsSignerWindow = nextDefaultKmsSignerWindow;
const defaultCoprocessorSigners_js_1 = require("./signers/defaultCoprocessorSigners.js");
const defaultKmsSigners_js_1 = require("./signers/defaultKmsSigners.js");
const defaultKmsTxSenderSigners_js_1 = require("./signers/defaultKmsTxSenderSigners.js");
const cleartext_config_js_1 = require("./cleartext-config.js");
const cleartext_config_v14_js_1 = require("./cleartext-config-v14.js");
function kmsNodeMetadata(i) {
    const n = String(i + 1);
    return {
        ipAddress: `${cleartext_config_js_1.CLEARTEXT_KMS_NODE_IP_ADDRESS_PREFIX}${n}`,
        storageUrl: `${cleartext_config_js_1.CLEARTEXT_KMS_NODE_STORAGE_URL_PREFIX}${n}`,
        partyId: i + 1,
        mpcIdentity: `${cleartext_config_v14_js_1.CLEARTEXT_KMS_NODE_MPC_IDENTITY_PREFIX}${n}${cleartext_config_v14_js_1.CLEARTEXT_KMS_NODE_MPC_IDENTITY_INFIX}${n}`,
        caCert: cleartext_config_v14_js_1.CLEARTEXT_KMS_NODE_CA_CERT,
        storagePrefix: `${cleartext_config_v14_js_1.CLEARTEXT_KMS_NODE_PUBLIC_STORAGE_PREFIX}${n}`,
    };
}
exports.DEFAULT_KMS_THRESHOLDS = {
    publicDecryption: BigInt(cleartext_config_js_1.CLEARTEXT_KMS_NODE_COUNT),
    userDecryption: BigInt(cleartext_config_js_1.CLEARTEXT_KMS_NODE_COUNT),
    kmsGen: BigInt(cleartext_config_js_1.CLEARTEXT_KMS_NODE_COUNT),
    mpc: BigInt(cleartext_config_js_1.CLEARTEXT_KMS_NODE_COUNT),
};
function generateDefaultKmsNodes(num) {
    if (num > defaultKmsSigners_js_1.DEFAULT_KMS_NODE_ADDRESSES.length) {
        throw new Error('Too many kms nodes');
    }
    const nodes = [];
    for (let i = 0; i < num; ++i) {
        const n = {
            txSenderAddress: defaultKmsTxSenderSigners_js_1.DEFAULT_KMS_NODE_TX_SENDER_ADDRESSES[i],
            signerAddress: defaultKmsSigners_js_1.DEFAULT_KMS_NODE_ADDRESSES[i],
            ...kmsNodeMetadata(i),
        };
        nodes.push(n);
    }
    return nodes;
}
const KMS_SIGNER_INDEX = new Map(defaultKmsSigners_js_1.DEFAULT_KMS_NODE_ADDRESSES.map((a, i) => [a.toLowerCase(), i]));
function generateFromExistingDefaultKmsNodes(existingSigners) {
    if (existingSigners.length > defaultKmsSigners_js_1.DEFAULT_KMS_NODE_ADDRESSES.length) {
        throw new Error('Too many kms nodes');
    }
    return existingSigners.map((signer) => {
        const j = KMS_SIGNER_INDEX.get(signer.toLowerCase());
        if (j === undefined) {
            throw new Error(`Unknown kms signer: ${signer}`);
        }
        return {
            txSenderAddress: defaultKmsTxSenderSigners_js_1.DEFAULT_KMS_NODE_TX_SENDER_ADDRESSES[j],
            signerAddress: defaultKmsSigners_js_1.DEFAULT_KMS_NODE_ADDRESSES[j],
            ...kmsNodeMetadata(j),
        };
    });
}
function nextDefaultKmsSignerWindow(currentSigners) {
    const poolSize = defaultKmsSigners_js_1.DEFAULT_KMS_NODE_ADDRESSES.length;
    const n = currentSigners.length;
    if (n === 0) {
        throw new Error('Empty kms signer set');
    }
    if (n > poolSize) {
        throw new Error('Too many kms signers');
    }
    const indices = currentSigners.map((signer) => {
        const index = KMS_SIGNER_INDEX.get(signer.toLowerCase());
        if (index === undefined) {
            throw new Error(`Unknown kms signer: ${signer}`);
        }
        return index;
    });
    const [start] = indices;
    if (start === undefined) {
        throw new Error('Empty kms signer set');
    }
    indices.forEach((index, k) => {
        if (index !== (start + k) % poolSize) {
            throw new Error(`Kms signers are not a consecutive window of the default pool (position ${k})`);
        }
    });
    return Array.from({ length: n }, (_unused, k) => {
        const address = defaultKmsSigners_js_1.DEFAULT_KMS_NODE_ADDRESSES[(start + n + k) % poolSize];
        if (address === undefined) {
            throw new Error('Unreachable: window index out of pool bounds');
        }
        return address;
    });
}
function generateDefaultCoprocessors(num) {
    if (num > defaultCoprocessorSigners_js_1.DEFAULT_COPROCESSOR_ADDRESSES.length) {
        throw new Error('Too many coprocessors');
    }
    const signers = [];
    for (let i = 0; i < num; ++i) {
        signers.push(defaultCoprocessorSigners_js_1.DEFAULT_COPROCESSOR_ADDRESSES[i]);
    }
    return signers;
}
exports.DEFAULT_BOOTSTRAP_CONFIG = {
    hcuLimit: {
        hcuCapPerBlock: cleartext_config_js_1.CLEARTEXT_HCU_CAP_PER_BLOCK,
        maxHCUDepthPerTx: cleartext_config_js_1.CLEARTEXT_MAX_HCU_DEPTH_PER_TX,
        maxHCUPerTx: cleartext_config_js_1.CLEARTEXT_MAX_HCU_PER_TX,
    },
    inputVerifier: {
        chainIDSource: cleartext_config_js_1.CLEARTEXT_GATEWAY_CHAIN_ID,
        initialSigners: generateDefaultCoprocessors(cleartext_config_js_1.CLEARTEXT_COPROCESSOR_COUNT),
        initialThreshold: BigInt(cleartext_config_js_1.CLEARTEXT_COPROCESSOR_THRESHOLD),
        verifyingContractSource: cleartext_config_js_1.CLEARTEXT_INPUT_VERIFICATION_ADDRESS,
    },
    protocolConfig: {
        initialKmsNodes: generateDefaultKmsNodes(cleartext_config_js_1.CLEARTEXT_KMS_NODE_COUNT),
        initialThresholds: exports.DEFAULT_KMS_THRESHOLDS,
        softwareVersion: cleartext_config_v14_js_1.CLEARTEXT_KMS_SOFTWARE_VERSION,
        pcrValues: [],
    },
    kmsVerifier: {
        chainIDSource: cleartext_config_js_1.CLEARTEXT_GATEWAY_CHAIN_ID,
        verifyingContractSource: cleartext_config_js_1.CLEARTEXT_DECRYPTION_ADDRESS,
    },
};
//# sourceMappingURL=constants.js.map