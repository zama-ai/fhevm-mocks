import type { AbstractEthereumSigner, DeployReturnType } from './types/public.js';
/**
 * Deploys the `PauserSet` contract.
 *
 * `PauserSet` is a non-proxy (immutable) contract with no constructor args and no initializer. It
 * bakes in the ACL address (via `FHEVMHostAddresses.sol`) to gate `addPauser`/`removePauser` on the
 * ACL owner, so that address is patched into the bytecode before deployment. Deploy it before the
 * `upgrade(...)` step and feed the returned address in as `UpgradeConfig.pauserSetAddress`, since the
 * other host contracts reference it too.
 */
export declare function deployPauserSet(parameters: {
    readonly deployer: AbstractEthereumSigner;
    readonly aclAddress: string;
}): Promise<DeployReturnType>;
//# sourceMappingURL=pauserSet.d.ts.map