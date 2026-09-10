import type { BootstrapConfig, KmsNodeParams, KmsThresholds } from './types/public.js';
/**
 * The four KMS thresholds, each defaulting to the node count.
 *
 * `CLEARTEXT_KMS_NODE_COUNT` is a plain number — it is a count, and the harness renders it into Solidity
 * as one — whereas the on-chain struct takes `uint256`, so it is widened here rather than stored twice in
 * two types.
 */
export declare const DEFAULT_KMS_THRESHOLDS: KmsThresholds;
export declare function generateFromExistingDefaultKmsNodes(existingSigners: string[]): KmsNodeParams[];
/**
 * Rotate a KMS signer set to the next window of the default pool.
 *
 * The default signer pool is a fixed list of {@link DEFAULT_KMS_NODE_ADDRESSES.length} addresses. A KMS
 * context always uses a consecutive, circularly-wrapping window of it: `currentSigners` must be exactly
 * `[pool[i], pool[(i + 1) % N], …, pool[(i + n - 1) % N]]` for some start `i` and length `n`. This
 * returns the next window of the same length — `[pool[(i + n) % N], …, pool[(i + 2n - 1) % N]]`.
 *
 * @throws if `currentSigners` is empty, longer than the pool, contains an unknown signer, or is not a
 *         consecutive window (wrong order or a gap).
 */
export declare function nextDefaultKmsSignerWindow(currentSigners: readonly string[]): string[];
export declare const DEFAULT_BOOTSTRAP_CONFIG: BootstrapConfig;
//# sourceMappingURL=constants.d.ts.map