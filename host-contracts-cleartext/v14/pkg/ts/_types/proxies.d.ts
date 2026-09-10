import type { ContractArtifact } from './types/private.js';
import type { AbstractEthereumSigner, AbstractEthereumUtils, DeployReturnType } from './types/public.js';
export declare function getEmptyUUPSProxyACLArtifact(): ContractArtifact;
export declare function getERC1967ProxyArtifact(): ContractArtifact;
export declare function deployEmptyUUPSProxyACL(parameters: {
    readonly deployer: AbstractEthereumSigner;
}): Promise<DeployReturnType>;
export declare function deployEmptyUUPSProxy(parameters: {
    readonly deployer: AbstractEthereumSigner;
    readonly aclAddress: string;
}): Promise<DeployReturnType>;
export declare function deployERC1967Proxy(parameters: {
    readonly ethUtils: AbstractEthereumUtils;
    readonly deployer: AbstractEthereumSigner;
    readonly emptyUUPSProxyAddress: string;
}): Promise<DeployReturnType>;
export declare function deployACLProxy(parameters: {
    readonly ethUtils: AbstractEthereumUtils;
    readonly deployer: AbstractEthereumSigner;
    readonly emptyUUPSProxyACLAddress: string;
}): Promise<DeployReturnType>;
//# sourceMappingURL=proxies.d.ts.map