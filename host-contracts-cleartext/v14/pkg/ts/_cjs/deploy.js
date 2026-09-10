"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deploy = deploy;
const proxies_js_1 = require("./proxies.js");
const ACL_js_1 = require("./artifacts/ACL.js");
const CleartextFHEVMExecutor_js_1 = require("./artifacts/CleartextFHEVMExecutor.js");
const CleartextKMSVerifier_js_1 = require("./artifacts/CleartextKMSVerifier.js");
const HCULimit_js_1 = require("./artifacts/HCULimit.js");
const CleartextInputVerifier_js_1 = require("./artifacts/CleartextInputVerifier.js");
const ProtocolConfig_js_1 = require("./artifacts/ProtocolConfig.js");
const KMSGeneration_js_1 = require("./artifacts/KMSGeneration.js");
const ACLOwner_js_1 = require("./artifacts/ACLOwner.js");
const CleartextArithmetic_js_1 = require("./artifacts/CleartextArithmetic.js");
const CleartextDB_js_1 = require("./artifacts/CleartextDB.js");
const utils_js_1 = require("./utils.js");
const aclOwner_js_1 = require("./aclOwner.js");
const pauserSet_js_1 = require("./pauserSet.js");
const addresses_js_1 = require("./addresses.js");
const constants_js_1 = require("./constants.js");
async function deploy(parameters) {
    const precomputed = parameters.precomputed ?? (await precomputeFromDeployerNonce(parameters));
    const { fhevmAddresses, cleartextAddresses } = precomputed;
    const config = parameters.config ?? constants_js_1.DEFAULT_BOOTSTRAP_CONFIG;
    const { emptyUUPSProxyAddress } = await deployEmptyProxies({
        ethProvider: parameters.ethProvider,
        ethUtils: parameters.ethUtils,
        deployer: parameters.deployer,
        precomputedFhevmAddresses: fhevmAddresses,
    });
    await deployCleartextEmptyProxies({
        ethProvider: parameters.ethProvider,
        ethUtils: parameters.ethUtils,
        deployer: parameters.deployer,
        precomputedCleartextAddresses: cleartextAddresses,
        emptyUUPSProxyAddress: emptyUUPSProxyAddress.contractAddress,
    });
    await deployPauserSetContract({
        ethProvider: parameters.ethProvider,
        ethUtils: parameters.ethUtils,
        pauserSetDeployer: parameters.deployer,
        aclAddress: fhevmAddresses.aclAddress,
        precomputedPauserSetAddress: precomputed.pauserSetAddress,
    });
    const { aclOwnerAddress } = await (0, aclOwner_js_1.setupACLOwner)({
        deployer: parameters.deployer,
        currentAclOwner: parameters.deployer,
        admin: parameters.admin,
        aclAddress: fhevmAddresses.aclAddress,
        pauserSetAddress: precomputed.pauserSetAddress,
    });
    const { implementations } = await buildBootstrapPlan({
        ethUtils: parameters.ethUtils,
        deployer: parameters.deployer,
        precomputedAddresses: fhevmAddresses,
        cleartextAddresses,
        config: bootstrapUpgradeConfig({
            pauserSetAddress: precomputed.pauserSetAddress,
            cleartextAddresses,
            config,
        }),
    });
    await (0, utils_js_1.sendStep)({
        label: 'ACLOwner.upgrade',
        send: () => parameters.admin.writeContract({
            address: aclOwnerAddress,
            abi: ACLOwner_js_1.abi,
            functionName: 'upgrade',
            args: [(0, aclOwner_js_1.toACLOwnerOps)(implementations)],
        }),
    });
    return {
        fhevmAddresses,
        cleartextAddresses,
        pauserSetAddress: precomputed.pauserSetAddress,
        aclOwnerAddress,
    };
}
async function precomputeFromDeployerNonce(parameters) {
    const from = (await parameters.deployer.getAddress());
    const startNonce = BigInt(await parameters.ethProvider.getTransactionCount({ address: from }));
    return (0, addresses_js_1.precomputeAddresses)({ ethUtils: parameters.ethUtils, from, startNonce });
}
async function buildBootstrapPlan(parameters) {
    const addressReplacements = (0, utils_js_1.buildHostAddressReplacements)({
        fhevmAddresses: parameters.precomputedAddresses,
        cleartextAddresses: parameters.cleartextAddresses,
        pauserSetAddress: parameters.config.pauserSetAddress,
    });
    const addr = parameters.precomputedAddresses;
    const targets = [
        {
            contractName: 'ACL',
            proxyAddress: addr.aclAddress,
            template: ACL_js_1.template,
            abi: ACL_js_1.abi,
            spec: parameters.config.acl,
        },
        {
            contractName: 'FHEVMExecutor',
            proxyAddress: addr.fhevmExecutorAddress,
            template: CleartextFHEVMExecutor_js_1.template,
            abi: CleartextFHEVMExecutor_js_1.abi,
            spec: parameters.config.fhevmExecutor,
        },
        {
            contractName: 'KMSVerifier',
            proxyAddress: addr.kmsVerifierAddress,
            template: CleartextKMSVerifier_js_1.template,
            abi: CleartextKMSVerifier_js_1.abi,
            spec: parameters.config.kmsVerifier,
        },
        {
            contractName: 'InputVerifier',
            proxyAddress: addr.inputVerifierAddress,
            template: CleartextInputVerifier_js_1.template,
            abi: CleartextInputVerifier_js_1.abi,
            spec: parameters.config.inputVerifier,
        },
        {
            contractName: 'HCULimit',
            proxyAddress: addr.hcuLimitAddress,
            template: HCULimit_js_1.template,
            abi: HCULimit_js_1.abi,
            spec: parameters.config.hcuLimit,
        },
        {
            contractName: 'ProtocolConfig',
            proxyAddress: addr.protocolConfigAddress,
            template: ProtocolConfig_js_1.template,
            abi: ProtocolConfig_js_1.abi,
            spec: parameters.config.protocolConfig,
        },
        {
            contractName: 'KMSGeneration',
            proxyAddress: addr.kmsGenerationAddress,
            template: KMSGeneration_js_1.template,
            abi: KMSGeneration_js_1.abi,
            spec: parameters.config.kmsGeneration,
        },
        {
            contractName: 'CleartextArithmetic',
            proxyAddress: parameters.cleartextAddresses.cleartextArithmeticAddress,
            template: CleartextArithmetic_js_1.template,
            abi: CleartextArithmetic_js_1.abi,
            spec: parameters.config.cleartextArithmetic,
        },
        {
            contractName: 'CleartextDB',
            proxyAddress: parameters.cleartextAddresses.cleartextDbAddress,
            template: CleartextDB_js_1.template,
            abi: CleartextDB_js_1.abi,
            spec: parameters.config.cleartextDb,
        },
    ];
    return { implementations: await (0, utils_js_1.deployImplementations)({ ...parameters, addressReplacements, targets }) };
}
async function deployEmptyProxies(parameters) {
    const addr = parameters.precomputedFhevmAddresses;
    const sharedImplProxies = [
        { contractName: 'FHEVMExecutor', address: addr.fhevmExecutorAddress },
        { contractName: 'KMSVerifier', address: addr.kmsVerifierAddress },
        { contractName: 'InputVerifier', address: addr.inputVerifierAddress },
        { contractName: 'HCULimit', address: addr.hcuLimitAddress },
        { contractName: 'ProtocolConfig', address: addr.protocolConfigAddress },
        { contractName: 'KMSGeneration', address: addr.kmsGenerationAddress },
    ];
    await (0, utils_js_1.assertNoCodeAtTargets)({
        ethProvider: parameters.ethProvider,
        targets: [{ contractName: 'ACL', address: addr.aclAddress }, ...sharedImplProxies],
    });
    const emptyUUPSProxyACLAddress = await (0, proxies_js_1.deployEmptyUUPSProxyACL)({ deployer: parameters.deployer });
    const aclProxyAddress = await (0, proxies_js_1.deployACLProxy)({
        ethUtils: parameters.ethUtils,
        deployer: parameters.deployer,
        emptyUUPSProxyACLAddress: emptyUUPSProxyACLAddress.contractAddress,
    });
    (0, utils_js_1.assertDeployedAddress)({
        contractName: 'ACL',
        expectedAddress: addr.aclAddress,
        actualAddress: aclProxyAddress.contractAddress,
    });
    const emptyUUPSProxyAddress = await (0, proxies_js_1.deployEmptyUUPSProxy)({
        deployer: parameters.deployer,
        aclAddress: addr.aclAddress,
    });
    for (const target of sharedImplProxies) {
        const proxy = await (0, proxies_js_1.deployERC1967Proxy)({
            ethUtils: parameters.ethUtils,
            deployer: parameters.deployer,
            emptyUUPSProxyAddress: emptyUUPSProxyAddress.contractAddress,
        });
        (0, utils_js_1.assertDeployedAddress)({
            contractName: target.contractName,
            expectedAddress: target.address,
            actualAddress: proxy.contractAddress,
        });
    }
    return { emptyUUPSProxyAddress };
}
async function deployCleartextEmptyProxies(parameters) {
    await (0, utils_js_1.assertNoCodeAtTargets)({
        ethProvider: parameters.ethProvider,
        targets: [
            {
                contractName: 'CleartextArithmetic',
                address: parameters.precomputedCleartextAddresses.cleartextArithmeticAddress,
            },
            { contractName: 'CleartextDB', address: parameters.precomputedCleartextAddresses.cleartextDbAddress },
        ],
    });
    const cleartextArithmeticProxy = await (0, proxies_js_1.deployERC1967Proxy)({
        ethUtils: parameters.ethUtils,
        deployer: parameters.deployer,
        emptyUUPSProxyAddress: parameters.emptyUUPSProxyAddress,
    });
    (0, utils_js_1.assertDeployedAddress)({
        contractName: 'CleartextArithmetic',
        expectedAddress: parameters.precomputedCleartextAddresses.cleartextArithmeticAddress,
        actualAddress: cleartextArithmeticProxy.contractAddress,
    });
    const cleartextDbProxy = await (0, proxies_js_1.deployERC1967Proxy)({
        ethUtils: parameters.ethUtils,
        deployer: parameters.deployer,
        emptyUUPSProxyAddress: parameters.emptyUUPSProxyAddress,
    });
    (0, utils_js_1.assertDeployedAddress)({
        contractName: 'CleartextDB',
        expectedAddress: parameters.precomputedCleartextAddresses.cleartextDbAddress,
        actualAddress: cleartextDbProxy.contractAddress,
    });
}
async function deployPauserSetContract(parameters) {
    await (0, utils_js_1.assertNoCodeAt)({
        ethProvider: parameters.ethProvider,
        contractName: 'PauserSet',
        address: parameters.precomputedPauserSetAddress,
    });
    const pauserSetAddress = await (0, pauserSet_js_1.deployPauserSet)({
        deployer: parameters.pauserSetDeployer,
        aclAddress: parameters.aclAddress,
    });
    (0, utils_js_1.assertDeployedAddress)({
        contractName: 'PauserSet',
        expectedAddress: parameters.precomputedPauserSetAddress,
        actualAddress: pauserSetAddress.contractAddress,
    });
    return pauserSetAddress;
}
function bootstrapUpgradeConfig(parameters) {
    const { config } = parameters;
    const bootstrap = (initArgs) => ({
        initFn: 'initializeFromEmptyProxy',
        initArgs,
    });
    return {
        pauserSetAddress: parameters.pauserSetAddress,
        acl: bootstrap([]),
        fhevmExecutor: bootstrap([]),
        kmsVerifier: bootstrap(kmsVerifierInitArgs(config.kmsVerifier)),
        inputVerifier: bootstrap(inputVerifierInitArgs(config.inputVerifier)),
        hcuLimit: bootstrap(hcuLimitInitArgs(config.hcuLimit)),
        protocolConfig: bootstrap([
            config.protocolConfig.initialKmsNodes,
            config.protocolConfig.initialThresholds,
            config.protocolConfig.softwareVersion,
            config.protocolConfig.pcrValues,
        ]),
        kmsGeneration: bootstrap([]),
        cleartextArithmetic: bootstrap([]),
        cleartextDb: bootstrap([parameters.cleartextAddresses.cleartextArithmeticAddress]),
    };
}
function kmsVerifierInitArgs(config) {
    return [config.verifyingContractSource, config.chainIDSource];
}
function inputVerifierInitArgs(config) {
    return [config.verifyingContractSource, config.chainIDSource, config.initialSigners, config.initialThreshold];
}
function hcuLimitInitArgs(config) {
    return [config.hcuCapPerBlock, config.maxHCUDepthPerTx, config.maxHCUPerTx];
}
//# sourceMappingURL=deploy.js.map