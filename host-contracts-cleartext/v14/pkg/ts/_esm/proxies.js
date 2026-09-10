////////////////////////////////////////////////////////////////////////////////
import { abi as erc1967ProxyAbi, template as erc1967ProxyTemplate } from './artifacts/ERC1967Proxy.js';
import { abi as emptyUUPSProxyAbi, template as emptyUUPSProxyTemplate } from './artifacts/EmptyUUPSProxy.js';
import { abi as emptyUUPSProxyACLAbi, template as emptyUUPSProxyACLTemplate } from './artifacts/EmptyUUPSProxyACL.js';
import { patchTemplateBytecode, sendStep } from './utils.js';
////////////////////////////////////////////////////////////////////////////////
export function getEmptyUUPSProxyACLArtifact() {
    return {
        abi: emptyUUPSProxyACLAbi,
        bytecode: emptyUUPSProxyACLTemplate.bytecode,
        deployedBytecode: emptyUUPSProxyACLTemplate.deployedBytecode,
    };
}
////////////////////////////////////////////////////////////////////////////////
/**
 * Returns the shared `EmptyUUPSProxy` implementation artifact with its hardcoded ACL address patched.
 *
 * `src/contracts/emptyProxy/EmptyUUPSProxy.sol` inherits from `ACLOwnable`, which reads the ACL address from
 * `FHEVMHostAddresses.sol` at compile time. Because this package deploys from bytecode templates, the compiled dummy
 * `ACL_ADDRESS` placeholder must be replaced with the caller's precomputed ACL proxy address before deployment.
 */
function getEmptyUUPSProxyArtifact(parameters) {
    const replacements = [{ referenceName: 'ACL_ADDRESS', replacement: parameters.aclAddress }];
    return {
        abi: emptyUUPSProxyAbi,
        bytecode: patchTemplateBytecode({
            template: emptyUUPSProxyTemplate,
            field: 'bytecode',
            replacements,
        }),
        deployedBytecode: patchTemplateBytecode({
            template: emptyUUPSProxyTemplate,
            field: 'deployedBytecode',
            replacements,
        }),
    };
}
////////////////////////////////////////////////////////////////////////////////
export function getERC1967ProxyArtifact() {
    return {
        abi: erc1967ProxyAbi,
        bytecode: erc1967ProxyTemplate.bytecode,
        deployedBytecode: erc1967ProxyTemplate.deployedBytecode,
    };
}
////////////////////////////////////////////////////////////////////////////////
/*
  EmptyUUPSProxyACL.sol
*/
export async function deployEmptyUUPSProxyACL(parameters) {
    const bytecode = getEmptyUUPSProxyACLArtifact().bytecode;
    return await sendStep({
        label: 'EmptyUUPSProxyACL deploy',
        send: () => parameters.deployer.deploy({ bytecode }),
    });
}
////////////////////////////////////////////////////////////////////////////////
/*
  EmptyUUPSProxy.sol
*/
export async function deployEmptyUUPSProxy(parameters) {
    const bytecode = getEmptyUUPSProxyArtifact(parameters).bytecode;
    return await sendStep({
        label: 'EmptyUUPSProxy deploy',
        send: () => parameters.deployer.deploy({ bytecode }),
    });
}
////////////////////////////////////////////////////////////////////////////////
/*
  ERC1967Proxy.sol + EmptyUUPSProxy.sol
*/
export async function deployERC1967Proxy(parameters) {
    /*
      ERC1967Proxy proxy = new ERC1967Proxy(address(emptyUupsProxy), abi.encodeCall(EmptyUUPSProxy.initialize, ()));
    */
    const erc1967ProxyArtifact = getERC1967ProxyArtifact();
    const initializeCall = await parameters.ethUtils.encodeCall({
        abi: emptyUUPSProxyAbi,
        functionName: 'initialize',
        args: [],
    });
    return await sendStep({
        label: 'ERC1967Proxy deploy',
        send: () => parameters.deployer.deploy({
            abi: erc1967ProxyArtifact.abi,
            bytecode: erc1967ProxyArtifact.bytecode,
            args: [parameters.emptyUUPSProxyAddress, initializeCall],
        }),
    });
}
////////////////////////////////////////////////////////////////////////////////
/*
  ERC1967Proxy.sol + EmptyUUPSProxyACL.sol
*/
export async function deployACLProxy(parameters) {
    /*
      ERC1967Proxy proxy = new ERC1967Proxy(
          address(emptyUupsProxyACL), abi.encodeCall(EmptyUUPSProxyACL.initialize, (deployer))
      );
    */
    const erc1967ProxyArtifact = getERC1967ProxyArtifact();
    const initialOwner = await parameters.deployer.getAddress();
    const initializeCall = await parameters.ethUtils.encodeCall({
        abi: emptyUUPSProxyACLAbi,
        functionName: 'initialize',
        args: [initialOwner],
    });
    return await sendStep({
        label: 'ACL proxy (ERC1967Proxy) deploy',
        send: () => parameters.deployer.deploy({
            abi: erc1967ProxyArtifact.abi,
            bytecode: erc1967ProxyArtifact.bytecode,
            args: [parameters.emptyUUPSProxyACLAddress, initializeCall],
        }),
    });
}
//# sourceMappingURL=proxies.js.map