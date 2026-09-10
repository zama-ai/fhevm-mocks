import type { AbstractEthereumProvider, AbstractEthereumSigner, AbstractEthereumUtils, BootstrapConfig, CleartextAddresses, Deployed, FhevmAddresses } from './types/public.js';
/**
 * Deploy a fresh v13 host-contract stack from scratch.
 *
 * End to end: deploy the 7 empty proxies + PauserSet, install a standing `ACLOwner` (owned by
 * `admin`), then atomically materialize all 7 proxies in a single `ACLOwner.upgrade(...)` transaction.
 * The `deployer` funds/sends the permissionless deployments; `admin` owns `ACLOwner` and signs the
 * one owner-gated upgrade transaction.
 */
export declare function deploy(parameters: {
    readonly ethProvider: AbstractEthereumProvider;
    readonly ethUtils: AbstractEthereumUtils;
    readonly deployer: AbstractEthereumSigner;
    readonly admin: AbstractEthereumSigner;
    readonly precomputed?: {
        readonly fhevmAddresses: FhevmAddresses;
        readonly cleartextAddresses: CleartextAddresses;
        readonly pauserSetAddress: string;
    } | undefined;
    readonly config?: BootstrapConfig | undefined;
}): Promise<Deployed>;
//# sourceMappingURL=deploy.d.ts.map