"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateV13ToV14 = updateV13ToV14;
const ACL_js_1 = require("./artifacts/ACL.js");
const CleartextFHEVMExecutor_js_1 = require("./artifacts/CleartextFHEVMExecutor.js");
const CleartextKMSVerifier_js_1 = require("./artifacts/CleartextKMSVerifier.js");
const HCULimit_js_1 = require("./artifacts/HCULimit.js");
const ProtocolConfig_js_1 = require("./artifacts/ProtocolConfig.js");
const KMSGeneration_js_1 = require("./artifacts/KMSGeneration.js");
const CleartextArithmetic_js_1 = require("./artifacts/CleartextArithmetic.js");
const ACLOwner_js_1 = require("./artifacts/ACLOwner.js");
const utils_js_1 = require("./utils.js");
const aclOwner_js_1 = require("./aclOwner.js");
const constants_js_1 = require("./constants.js");
async function updateV13ToV14(parameters) {
    const { pauserSetAddress, ...existingV13 } = parameters.existing;
    const migration = parameters.migration ??
        (await resolveDefaultMigration({
            ethProvider: parameters.ethProvider,
            protocolConfigAddress: existingV13.protocolConfigAddress,
        }));
    const { implementations } = await buildUpdateV13ToV14Plan({
        ethUtils: parameters.ethUtils,
        deployer: parameters.deployer,
        fhevmAddresses: existingV13,
        cleartextAddresses: parameters.cleartext,
        pauserSetAddress,
        migration,
    });
    await (0, utils_js_1.sendStep)({
        label: 'ACLOwner.upgrade (v13 -> v14)',
        send: () => parameters.admin.writeContract({
            address: parameters.aclOwnerAddress,
            abi: ACLOwner_js_1.abi,
            functionName: 'upgrade',
            args: [(0, aclOwner_js_1.toACLOwnerOps)(implementations)],
        }),
    });
}
async function resolveDefaultMigration(parameters) {
    const existingSigners = (await parameters.ethProvider.readContract({
        address: parameters.protocolConfigAddress,
        abi: ProtocolConfig_js_1.abi,
        functionName: 'getKmsSigners',
    }));
    return {
        kmsNodeParams: (0, constants_js_1.generateFromExistingDefaultKmsNodes)([...existingSigners]),
        softwareVersion: constants_js_1.DEFAULT_BOOTSTRAP_CONFIG.protocolConfig.softwareVersion,
        pcrValues: constants_js_1.DEFAULT_BOOTSTRAP_CONFIG.protocolConfig.pcrValues,
    };
}
async function buildUpdateV13ToV14Plan(parameters) {
    const addressReplacements = (0, utils_js_1.buildHostAddressReplacements)({
        fhevmAddresses: parameters.fhevmAddresses,
        cleartextAddresses: parameters.cleartextAddresses,
        pauserSetAddress: parameters.pauserSetAddress,
    });
    const addr = parameters.fhevmAddresses;
    const noArgs = (initFn) => ({ initFn, initArgs: [] });
    const targets = [
        {
            contractName: 'ProtocolConfig',
            proxyAddress: addr.protocolConfigAddress,
            template: ProtocolConfig_js_1.template,
            abi: ProtocolConfig_js_1.abi,
            spec: {
                initFn: 'reinitializeV2',
                initArgs: [
                    parameters.migration.kmsNodeParams,
                    parameters.migration.softwareVersion,
                    parameters.migration.pcrValues,
                ],
            },
        },
        {
            contractName: 'KMSGeneration',
            proxyAddress: addr.kmsGenerationAddress,
            template: KMSGeneration_js_1.template,
            abi: KMSGeneration_js_1.abi,
            spec: noArgs('reinitializeV2'),
        },
        {
            contractName: 'ACL',
            proxyAddress: addr.aclAddress,
            template: ACL_js_1.template,
            abi: ACL_js_1.abi,
            spec: noArgs('reinitializeV5'),
        },
        {
            contractName: 'FHEVMExecutor',
            proxyAddress: addr.fhevmExecutorAddress,
            template: CleartextFHEVMExecutor_js_1.template,
            abi: CleartextFHEVMExecutor_js_1.abi,
            spec: noArgs('reinitializeV5'),
        },
        {
            contractName: 'HCULimit',
            proxyAddress: addr.hcuLimitAddress,
            template: HCULimit_js_1.template,
            abi: HCULimit_js_1.abi,
            spec: noArgs('reinitializeV4'),
        },
        {
            contractName: 'KMSVerifier',
            proxyAddress: addr.kmsVerifierAddress,
            template: CleartextKMSVerifier_js_1.template,
            abi: CleartextKMSVerifier_js_1.abi,
            spec: noArgs('reinitializeV4'),
        },
        {
            contractName: 'CleartextArithmetic',
            proxyAddress: parameters.cleartextAddresses.cleartextArithmeticAddress,
            template: CleartextArithmetic_js_1.template,
            abi: CleartextArithmetic_js_1.abi,
            spec: noArgs('reinitializeV3'),
        },
    ];
    return { implementations: await (0, utils_js_1.deployImplementations)({ ...parameters, addressReplacements, targets }) };
}
//# sourceMappingURL=upgrade.js.map