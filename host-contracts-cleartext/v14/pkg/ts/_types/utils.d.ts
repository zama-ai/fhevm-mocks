import type { ContractTemplate } from './artifacts/types.js';
import type { AddressReplacement, ContractUpgradeSpec, DeployedBytecodeCheck, HexString, DeployedImplementation, TemplateBytecodeField, UpgradeTarget } from './types/private.js';
import type { AbstractEthereumProvider, AbstractEthereumSigner, AbstractEthereumUtils, CleartextAddresses, FhevmAddresses } from './types/public.js';
/**
 * Runs one transaction, naming the step if it fails.
 *
 * The nonce hint is appended only when the underlying error mentions a nonce — attaching a paragraph
 * about nonces to every revert or out-of-gas would bury the real message.
 */
export declare function sendStep<T>(parameters: {
    readonly label: string;
    readonly send: () => Promise<T>;
}): Promise<T>;
/**
 * Checks whether a contract is deployed at `address` and, if so, whether its runtime code matches
 * `expectedDeployedBytecode`. Comparison is case-insensitive over the raw hex.
 */
export declare function checkDeployedBytecode(parameters: {
    readonly ethProvider: AbstractEthereumProvider;
    readonly address: string;
    readonly expectedDeployedBytecode: string;
}): Promise<DeployedBytecodeCheck>;
export declare function assertDeployedAddress(parameters: {
    readonly contractName: string;
    readonly expectedAddress: string;
    readonly actualAddress: string;
}): void;
/**
 * Asserts that no contract code is deployed at `address`. Used before deploying to a precomputed
 * address to fail fast if the slot is already occupied (e.g. a partial or repeated deployment).
 */
export declare function assertNoCodeAt(parameters: {
    readonly ethProvider: AbstractEthereumProvider;
    readonly contractName: string;
    readonly address: string;
}): Promise<void>;
/**
 * Asserts that none of the precomputed host addresses already have code deployed. Run as a
 * precondition before `deployEmptyProxies(...)` to fail fast if any target slot is occupied
 * (wrong start nonce, or a partial/repeated deployment).
 */
export declare function assertNoCodeAtTargets(parameters: {
    readonly ethProvider: AbstractEthereumProvider;
    readonly targets: ReadonlyArray<{
        readonly contractName: string;
        readonly address: string;
    }>;
}): Promise<void>;
export declare function patchTemplateBytecode(parameters: {
    readonly template: ContractTemplate;
    readonly field: TemplateBytecodeField;
    readonly replacements: readonly AddressReplacement[];
}): HexString;
/**
 * Post-condition for `patchTemplateBytecode`: once patched, no placeholder may survive anywhere in the
 * bytecode.
 *
 * A surviving placeholder means the contract would be deployed still pointing at a marker address —
 * one with no code — so every typed call through it reverts on the first use. The pre-checks above only
 * verify that the *recorded* offsets held a placeholder; they cannot see a placeholder that the
 * generator failed to record (a compiler or optimizer change altering how the literal is encoded) or
 * one whose reference the caller simply did not pass a replacement for. This catches both, before the
 * deployment transaction is sent rather than after.
 */
export declare function assertNoPlaceholdersRemain(parameters: {
    readonly template: ContractTemplate;
    readonly field: TemplateBytecodeField;
    readonly patchedHex: string;
}): void;
/**
 * Deploys one real implementation and encodes the calldata to point its proxy at it. Sends no
 * owner-gated transaction — returns a `DeployedImplementation` for a caller to execute.
 */
export declare function deployImplementation(parameters: {
    readonly ethUtils: AbstractEthereumUtils;
    readonly deployer: AbstractEthereumSigner;
    readonly contractName: string;
    readonly proxyAddress: string;
    readonly template: ContractTemplate;
    readonly abi: readonly unknown[];
    readonly addressReplacements: readonly AddressReplacement[];
    readonly spec: ContractUpgradeSpec;
}): Promise<DeployedImplementation>;
/** Deploys each target's implementation and encodes its `upgradeToAndCall` (Phase 1; sends nothing). */
export declare function deployImplementations(parameters: {
    readonly ethUtils: AbstractEthereumUtils;
    readonly deployer: AbstractEthereumSigner;
    readonly addressReplacements: readonly AddressReplacement[];
    readonly targets: readonly UpgradeTarget[];
}): Promise<readonly DeployedImplementation[]>;
/**
 * The host addresses baked into every real implementation's bytecode (via `FHEVMHostAddresses.sol`).
 * References whose offsets are empty for a given template patch as no-ops, so passing the whole set is safe.
 */
export declare function buildHostAddressReplacements(parameters: {
    readonly fhevmAddresses: FhevmAddresses;
    readonly pauserSetAddress: string;
    readonly cleartextAddresses?: CleartextAddresses;
}): AddressReplacement[];
//# sourceMappingURL=utils.d.ts.map