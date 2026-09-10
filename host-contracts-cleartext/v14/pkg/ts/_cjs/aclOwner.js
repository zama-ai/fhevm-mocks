"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployACLOwner = deployACLOwner;
exports.setupACLOwner = setupACLOwner;
exports.pauseACL = pauseACL;
exports.unpauseACL = unpauseACL;
exports.toACLOwnerOps = toACLOwnerOps;
exports.encodeACLOwnerUpgrade = encodeACLOwnerUpgrade;
const ACLOwner_js_1 = require("./artifacts/ACLOwner.js");
const ACL_js_1 = require("./artifacts/ACL.js");
const PauserSet_js_1 = require("./artifacts/PauserSet.js");
const utils_js_1 = require("./utils.js");
async function deployACLOwner(parameters) {
    return await (0, utils_js_1.sendStep)({
        label: 'ACLOwner deploy',
        send: () => parameters.deployer.deploy({
            abi: ACLOwner_js_1.abi,
            bytecode: ACLOwner_js_1.template.bytecode,
            args: [parameters.initialOwner, parameters.aclAddress],
        }),
    });
}
async function setupACLOwner(parameters) {
    const initialOwner = await parameters.admin.getAddress();
    const { contractAddress: aclOwnerAddress } = await deployACLOwner({
        deployer: parameters.deployer,
        initialOwner,
        aclAddress: parameters.aclAddress,
    });
    await (0, utils_js_1.sendStep)({
        label: 'PauserSet.addPauser',
        send: () => parameters.currentAclOwner.writeContract({
            address: parameters.pauserSetAddress,
            abi: PauserSet_js_1.abi,
            functionName: 'addPauser',
            args: [aclOwnerAddress],
        }),
    });
    await (0, utils_js_1.sendStep)({
        label: 'ACL.transferOwnership',
        send: () => parameters.currentAclOwner.writeContract({
            address: parameters.aclAddress,
            abi: ACL_js_1.abi,
            functionName: 'transferOwnership',
            args: [aclOwnerAddress],
        }),
    });
    await (0, utils_js_1.sendStep)({
        label: 'ACLOwner.acceptACLOwnership',
        send: () => parameters.admin.writeContract({
            address: aclOwnerAddress,
            abi: ACLOwner_js_1.abi,
            functionName: 'acceptACLOwnership',
            args: [],
        }),
    });
    return { aclOwnerAddress };
}
async function pauseACL(parameters) {
    await parameters.admin.writeContract({
        address: parameters.aclOwnerAddress,
        abi: ACLOwner_js_1.abi,
        functionName: 'pause',
        args: [],
    });
}
async function unpauseACL(parameters) {
    await parameters.admin.writeContract({
        address: parameters.aclOwnerAddress,
        abi: ACLOwner_js_1.abi,
        functionName: 'unpause',
        args: [],
    });
}
function toACLOwnerOps(implementations) {
    return implementations.map((proxy) => ({
        proxy: proxy.proxyAddress,
        implementation: proxy.implementationAddress,
        initData: proxy.initData,
    }));
}
async function encodeACLOwnerUpgrade(parameters) {
    return await parameters.ethUtils.encodeCall({
        abi: ACLOwner_js_1.abi,
        functionName: 'upgrade',
        args: [toACLOwnerOps(parameters.implementations)],
    });
}
//# sourceMappingURL=aclOwner.js.map