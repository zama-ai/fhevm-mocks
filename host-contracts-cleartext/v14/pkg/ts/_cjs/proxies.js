"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmptyUUPSProxyACLArtifact = getEmptyUUPSProxyACLArtifact;
exports.getERC1967ProxyArtifact = getERC1967ProxyArtifact;
exports.deployEmptyUUPSProxyACL = deployEmptyUUPSProxyACL;
exports.deployEmptyUUPSProxy = deployEmptyUUPSProxy;
exports.deployERC1967Proxy = deployERC1967Proxy;
exports.deployACLProxy = deployACLProxy;
const ERC1967Proxy_js_1 = require("./artifacts/ERC1967Proxy.js");
const EmptyUUPSProxy_js_1 = require("./artifacts/EmptyUUPSProxy.js");
const EmptyUUPSProxyACL_js_1 = require("./artifacts/EmptyUUPSProxyACL.js");
const utils_js_1 = require("./utils.js");
function getEmptyUUPSProxyACLArtifact() {
    return {
        abi: EmptyUUPSProxyACL_js_1.abi,
        bytecode: EmptyUUPSProxyACL_js_1.template.bytecode,
        deployedBytecode: EmptyUUPSProxyACL_js_1.template.deployedBytecode,
    };
}
function getEmptyUUPSProxyArtifact(parameters) {
    const replacements = [{ referenceName: 'ACL_ADDRESS', replacement: parameters.aclAddress }];
    return {
        abi: EmptyUUPSProxy_js_1.abi,
        bytecode: (0, utils_js_1.patchTemplateBytecode)({
            template: EmptyUUPSProxy_js_1.template,
            field: 'bytecode',
            replacements,
        }),
        deployedBytecode: (0, utils_js_1.patchTemplateBytecode)({
            template: EmptyUUPSProxy_js_1.template,
            field: 'deployedBytecode',
            replacements,
        }),
    };
}
function getERC1967ProxyArtifact() {
    return {
        abi: ERC1967Proxy_js_1.abi,
        bytecode: ERC1967Proxy_js_1.template.bytecode,
        deployedBytecode: ERC1967Proxy_js_1.template.deployedBytecode,
    };
}
async function deployEmptyUUPSProxyACL(parameters) {
    const bytecode = getEmptyUUPSProxyACLArtifact().bytecode;
    return await (0, utils_js_1.sendStep)({
        label: 'EmptyUUPSProxyACL deploy',
        send: () => parameters.deployer.deploy({ bytecode }),
    });
}
async function deployEmptyUUPSProxy(parameters) {
    const bytecode = getEmptyUUPSProxyArtifact(parameters).bytecode;
    return await (0, utils_js_1.sendStep)({
        label: 'EmptyUUPSProxy deploy',
        send: () => parameters.deployer.deploy({ bytecode }),
    });
}
async function deployERC1967Proxy(parameters) {
    const erc1967ProxyArtifact = getERC1967ProxyArtifact();
    const initializeCall = await parameters.ethUtils.encodeCall({
        abi: EmptyUUPSProxy_js_1.abi,
        functionName: 'initialize',
        args: [],
    });
    return await (0, utils_js_1.sendStep)({
        label: 'ERC1967Proxy deploy',
        send: () => parameters.deployer.deploy({
            abi: erc1967ProxyArtifact.abi,
            bytecode: erc1967ProxyArtifact.bytecode,
            args: [parameters.emptyUUPSProxyAddress, initializeCall],
        }),
    });
}
async function deployACLProxy(parameters) {
    const erc1967ProxyArtifact = getERC1967ProxyArtifact();
    const initialOwner = await parameters.deployer.getAddress();
    const initializeCall = await parameters.ethUtils.encodeCall({
        abi: EmptyUUPSProxyACL_js_1.abi,
        functionName: 'initialize',
        args: [initialOwner],
    });
    return await (0, utils_js_1.sendStep)({
        label: 'ACL proxy (ERC1967Proxy) deploy',
        send: () => parameters.deployer.deploy({
            abi: erc1967ProxyArtifact.abi,
            bytecode: erc1967ProxyArtifact.bytecode,
            args: [parameters.emptyUUPSProxyACLAddress, initializeCall],
        }),
    });
}
//# sourceMappingURL=proxies.js.map