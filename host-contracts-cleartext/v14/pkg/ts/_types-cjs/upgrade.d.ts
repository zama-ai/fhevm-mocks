import type { AbstractEthereumProvider, AbstractEthereumSigner, AbstractEthereumUtils, CleartextAddresses, FhevmAddressesV13, UpdateV13ToV14MigrationConfig } from './types/public.js';
/**
 * Update an already-deployed v13 stack to v14.
 *
 * Creates no proxy — v14 adds no contract to the host set — so the address set is unchanged. In one
 * atomic `ACLOwner.upgrade(...)` it re-points + version-bumps the seven changed v13 contracts:
 *   - `ProtocolConfig.reinitializeV2(kmsNodeParams, softwareVersion, pcrValues)`, which re-declares the
 *     current KMS context with the v14 per-node metadata (party id, MPC identity, CA cert, storage prefix)
 *     and records the KMS software version + PCR values,
 *   - `KMSGeneration.reinitializeV2()`, `ACL`/`FHEVMExecutor` `reinitializeV5()`, `HCULimit`/`KMSVerifier`
 *     `reinitializeV4()` — all no-arg,
 *   - `CleartextArithmetic.reinitializeV3()`: v14 adds `fheMulDiv`, whose cleartext `recordMulDiv` hook is
 *     a new selector the v13 arithmetic lacks.
 * `InputVerifier` is untouched (its v14 bytecode is identical and its version did not bump).
 *
 * All v14 implementations are patched with the ACTUAL addresses of the live stack.
 *
 * @dev Requires the live stack's ACL owner to already be the `ACLOwner` at `aclOwnerAddress`, and
 *      `admin` to be that `ACLOwner`'s owner. If the stack is EOA-owned, install one first
 *      (`setupACLOwner`).
 */
export declare function updateV13ToV14(parameters: {
    readonly ethProvider: AbstractEthereumProvider;
    readonly ethUtils: AbstractEthereumUtils;
    readonly deployer: AbstractEthereumSigner;
    readonly admin: AbstractEthereumSigner;
    readonly aclOwnerAddress: string;
    readonly existing: FhevmAddressesV13 & {
        readonly pauserSetAddress: string;
    };
    readonly cleartext: CleartextAddresses;
    readonly migration?: UpdateV13ToV14MigrationConfig | undefined;
}): Promise<void>;
//# sourceMappingURL=upgrade.d.ts.map