"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CREATE2_ROLES = exports.CREATE2_FACTORY = void 0;
exports.precomputeCreate2Addresses = precomputeCreate2Addresses;
const ACLOwner_js_1 = require("./artifacts/ACLOwner.js");
const EmptyUUPSProxy_js_1 = require("./artifacts/EmptyUUPSProxy.js");
const EmptyUUPSProxyACL_js_1 = require("./artifacts/EmptyUUPSProxyACL.js");
const ERC1967Proxy_js_1 = require("./artifacts/ERC1967Proxy.js");
const PauserSet_js_1 = require("./artifacts/PauserSet.js");
const EmptyUUPSProxyACL_js_2 = require("./artifacts/EmptyUUPSProxyACL.js");
const EmptyUUPSProxy_js_2 = require("./artifacts/EmptyUUPSProxy.js");
const utils_js_1 = require("./utils.js");
exports.CREATE2_FACTORY = '0x4e59b44847b379578588920cA78FbF26c0B4956C';
const SALT_PREFIX = 'fhevm.cleartext';
exports.CREATE2_ROLES = {
    implEmptyProxyAcl: 'IMPL_EMPTY_UUPS_PROXY_ACL',
    implEmptyProxy: 'IMPL_EMPTY_UUPS_PROXY',
    acl: 'ACL_ADDRESS',
    fhevmExecutor: 'FHEVM_EXECUTOR_ADDRESS',
    kmsVerifier: 'KMS_VERIFIER_ADDRESS',
    inputVerifier: 'INPUT_VERIFIER_ADDRESS',
    hcuLimit: 'HCU_LIMIT_ADDRESS',
    protocolConfig: 'PROTOCOL_CONFIG_ADDRESS',
    kmsGeneration: 'KMS_GENERATION_ADDRESS',
    cleartextArithmetic: 'CLEARTEXT_ARITHMETIC_ADDRESS',
    cleartextDb: 'CLEARTEXT_DB_ADDRESS',
    pauserSet: 'PAUSER_SET_ADDRESS',
    aclOwner: 'ACL_OWNER',
};
function concatHex(...parts) {
    return `0x${parts.map((p) => (p.startsWith('0x') ? p.slice(2) : p)).join('')}`;
}
async function precomputeCreate2Addresses(parameters) {
    const { ethUtils, version, deploymentId, deployer } = parameters;
    const factory = parameters.factory ?? exports.CREATE2_FACTORY;
    const saltFor = (role) => ethUtils.keccak256({
        bytes: ethUtils.encodeAbiParameters({
            types: ['string', 'string', 'string', 'string'],
            values: [SALT_PREFIX, version, deploymentId, role],
        }),
    });
    const predict = (role, initCode) => ethUtils.getCreate2Address({
        from: factory,
        salt: saltFor(role),
        initCodeHash: ethUtils.keccak256({ bytes: initCode }),
    });
    const proxyInitCode = (implementation, initData) => concatHex(ERC1967Proxy_js_1.template.bytecode, ethUtils.encodeAbiParameters({ types: ['address', 'bytes'], values: [implementation, initData] }));
    const implEmptyProxyAcl = predict(exports.CREATE2_ROLES.implEmptyProxyAcl, EmptyUUPSProxyACL_js_1.template.bytecode);
    const aclInitData = await ethUtils.encodeCall({
        abi: EmptyUUPSProxyACL_js_2.abi,
        functionName: 'initialize',
        args: [deployer],
    });
    const aclAddress = predict(exports.CREATE2_ROLES.acl, proxyInitCode(implEmptyProxyAcl, aclInitData));
    const withAcl = (template) => (0, utils_js_1.patchTemplateBytecode)({
        template,
        field: 'bytecode',
        replacements: [{ referenceName: exports.CREATE2_ROLES.acl, replacement: aclAddress }],
    });
    const implEmptyProxy = predict(exports.CREATE2_ROLES.implEmptyProxy, withAcl(EmptyUUPSProxy_js_1.template));
    const emptyInitData = await ethUtils.encodeCall({ abi: EmptyUUPSProxy_js_2.abi, functionName: 'initialize', args: [] });
    const sharedProxyInitCode = proxyInitCode(implEmptyProxy, emptyInitData);
    const sharedProxy = (role) => predict(role, sharedProxyInitCode);
    const pauserSetAddress = predict(exports.CREATE2_ROLES.pauserSet, withAcl(PauserSet_js_1.template));
    const aclOwnerAddress = predict(exports.CREATE2_ROLES.aclOwner, concatHex(ACLOwner_js_1.template.bytecode, ethUtils.encodeAbiParameters({ types: ['address', 'address'], values: [deployer, aclAddress] })));
    return {
        fhevmAddresses: {
            aclAddress,
            fhevmExecutorAddress: sharedProxy(exports.CREATE2_ROLES.fhevmExecutor),
            kmsVerifierAddress: sharedProxy(exports.CREATE2_ROLES.kmsVerifier),
            inputVerifierAddress: sharedProxy(exports.CREATE2_ROLES.inputVerifier),
            hcuLimitAddress: sharedProxy(exports.CREATE2_ROLES.hcuLimit),
            protocolConfigAddress: sharedProxy(exports.CREATE2_ROLES.protocolConfig),
            kmsGenerationAddress: sharedProxy(exports.CREATE2_ROLES.kmsGeneration),
        },
        cleartextAddresses: {
            cleartextArithmeticAddress: sharedProxy(exports.CREATE2_ROLES.cleartextArithmetic),
            cleartextDbAddress: sharedProxy(exports.CREATE2_ROLES.cleartextDb),
        },
        pauserSetAddress,
        aclOwnerAddress,
        emptyImplementations: { acl: implEmptyProxyAcl, shared: implEmptyProxy },
        factory,
    };
}
//# sourceMappingURL=create2Addresses.js.map