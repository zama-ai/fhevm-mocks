import type { FhevmDecryptClient, FhevmEncryptClient } from '@fhevm/sdk/types';
import type { FhevmHostChainConstants, FhevmNetworkGroup } from './internal/vendored/fhevm-chains.js';

////////////////////////////////////////////////////////////////////////////////

export type {
  FhevmChainContract,
  FhevmHostChainConstants,
  FhevmNetworkGroup,
} from './internal/vendored/fhevm-chains.js';

////////////////////////////////////////////////////////////////////////////////
// FHE types
////////////////////////////////////////////////////////////////////////////////

export type FhevmTypeName =
  'ebool' | 'euint4' | 'euint8' | 'euint16' | 'euint32' | 'euint64' | 'euint128' | 'eaddress' | 'euint256';

////////////////////////////////////////////////////////////////////////////////
// Network
////////////////////////////////////////////////////////////////////////////////

export type FhevmNetworkKind =
  /** In-process EDR chain: ours to prepare. */
  | 'hardhat'
  /** A remote development node on the development chain id: `hardhat node` or anvil. */
  | 'localhost'
  /** A host chain the protocol registry knows, served by at least one gateway. */
  | 'public'
  | 'unknown';

/** One registry host chain and the network group (gateway + relayer) that serves it. */
export type FhevmPublicChain = {
  readonly group: FhevmNetworkGroup;
  readonly host: FhevmHostChainConstants;
};

export type FhevmNetworkInfo = {
  readonly networkName: string;
  readonly chainId: number;
  readonly kind: FhevmNetworkKind;
  /** The remote node's URL; undefined in process. */
  readonly url: string | undefined;

  /**
   * Every registry host chain with this chain id, one per network group that serves it — Sepolia is
   * under both `testnet` and `devnet`, with different addresses. Empty unless `kind` is `public`.
   */
  readonly publicChains: readonly FhevmPublicChain[];
};

////////////////////////////////////////////////////////////////////////////////
// Encryption, decryption, errors, events, HCU — the shapes the methods exchange
////////////////////////////////////////////////////////////////////////////////

/**
 * The `@fhevm/sdk` client the plugin drives — the SDK's own client type, NOT the viem-templated one
 * `createFhevmCleartextClient` returns. That factory is generic in its `publicClient`, so naming its
 * return type here would publish viem's `PublicClient` through `fhevm.client`. Intersecting the two
 * SDK-level halves gives the same surface (`Fhevm & BaseActions & EncryptActions & DecryptActions`)
 * with the provider slot left at its default, so `client.client` is an opaque `object`: the plugin
 * promises the FHEVM actions and says nothing about what transport is underneath.
 */
export type FhevmClient = FhevmEncryptClient & FhevmDecryptClient;

/** The three addresses `FHE.setCoprocessor` records in a consumer contract. */
export type CoprocessorConfig = {
  ACLAddress: `0x${string}`;
  CoprocessorAddress: `0x${string}`;
  KMSVerifierAddress: `0x${string}`;
};

export type FhevmTransactionHCUInfo = {
  transactionHash: `0x${string}`;
  globalHCU: number;
  maxHCUDepth: number;
  HCUDepthByHandle: Record<`0x${string}`, number>;
};

export type FhevmDecryptOptions = {
  readonly validity?:
    | {
        readonly startTimestamp: number | bigint;
        readonly durationDays: number | bigint;
      }
    | undefined;

  /**
   * Delegated decryption: the account (typically a contract) whose handle the USER decrypts on its
   * behalf, after it granted `FHE.delegateUserDecryption(user, contract, expiry)` on-chain.
   */
  readonly delegatorAddress?: string | undefined;
};

////////////////////////////////////////////////////////////////////////////////
// The runtime environment, on every connection
////////////////////////////////////////////////////////////////////////////////

/**
 * The KMS proof bundle a `WithSignatures` decryption returns, shaped for the on-chain check:
 * `contract.verify(handlesList, abiEncodedCleartexts, decryptionProof)`. The three fields agree with
 * one another — `abiEncodedCleartexts` is the ABI encoding of the clear values of `handlesList`, IN
 * THAT ORDER, and `decryptionProof` is the KMS signature over that payload — so they travel together.
 */
export type FhevmCheckSignaturesArgs = {
  handlesList: Array<`0x${string}`>;
  abiEncodedCleartexts: `0x${string}`;
  decryptionProof: `0x${string}`;
};

/**
 * `fhevm.helpers` — one encryption call per Solidity type, so a test names the type it is passing
 * rather than threading a `FhevmType` argument. Shorthands only: each is `fhevm.encryptUint(...)` and
 * friends with the type pinned, kept off the runtime environment so the SDK client API stays distinct.
 */
export interface FhevmClientHelpers {
  /**
   * Encrypts `value` into a Solidity `externalEbool` input, bound to the
   * `contractAddress`/`userAddress` pair: only that contract may consume it,
   * and only when that user sends it. The contract turns it into a
   * `ebool` with `FHE.fromExternal(handle, inputProof)`.
   *
   * @param args.value - The cleartext to encrypt.
   * @param args.contractAddress - Contract allowed to consume it.
   * @param args.userAddress - Account allowed to submit it.
   * @returns The `externalEbool` handle and its `inputProof`.
   *
   * @example
   * ```ts
   * const { externalEbool, inputProof } = await fhevm.helpers.encryptBool({
   *   value: true,
   *   contractAddress,
   *   userAddress,
   * });
   * await contract.connect(alice).store(externalEbool, inputProof);
   * ```
   */
  encryptBool(args: {
    readonly value: boolean;
    readonly contractAddress: string;
    readonly userAddress: string;
  }): Promise<{ externalEbool: `0x${string}`; inputProof: `0x${string}` }>;

  /**
   * Encrypts `value` into a Solidity `externalEuint8` input, bound to the
   * `contractAddress`/`userAddress` pair: only that contract may consume it,
   * and only when that user sends it. The contract turns it into a
   * `euint8` with `FHE.fromExternal(handle, inputProof)`.
   *
   * @param args.value - The cleartext to encrypt.
   * @param args.contractAddress - Contract allowed to consume it.
   * @param args.userAddress - Account allowed to submit it.
   * @returns The `externalEuint8` handle and its `inputProof`.
   *
   * @example
   * ```ts
   * const { externalEuint8, inputProof } = await fhevm.helpers.encryptUint8({
   *   value: 42,
   *   contractAddress,
   *   userAddress,
   * });
   * await contract.connect(alice).store(externalEuint8, inputProof);
   * ```
   */
  encryptUint8(args: {
    readonly value: number | bigint;
    readonly contractAddress: string;
    readonly userAddress: string;
  }): Promise<{ externalEuint8: `0x${string}`; inputProof: `0x${string}` }>;

  /**
   * Encrypts `value` into a Solidity `externalEuint16` input, bound to the
   * `contractAddress`/`userAddress` pair: only that contract may consume it,
   * and only when that user sends it. The contract turns it into a `euint16`
   * with `FHE.fromExternal(handle, inputProof)`.
   *
   * @param args.value - The cleartext to encrypt.
   * @param args.contractAddress - Contract allowed to consume it.
   * @param args.userAddress - Account allowed to submit it.
   * @returns The `externalEuint16` handle and its `inputProof`.
   *
   * @example
   * ```ts
   * const { externalEuint16, inputProof } = await fhevm.helpers.encryptUint16({
   *   value: 1000,
   *   contractAddress,
   *   userAddress,
   * });
   * await contract.connect(alice).store(externalEuint16, inputProof);
   * ```
   */
  encryptUint16(args: {
    readonly value: number | bigint;
    readonly contractAddress: string;
    readonly userAddress: string;
  }): Promise<{ externalEuint16: `0x${string}`; inputProof: `0x${string}` }>;

  /**
   * Encrypts `value` into a Solidity `externalEuint32` input, bound to the
   * `contractAddress`/`userAddress` pair: only that contract may consume it,
   * and only when that user sends it. The contract turns it into a `euint32`
   * with `FHE.fromExternal(handle, inputProof)`.
   *
   * @param args.value - The cleartext to encrypt.
   * @param args.contractAddress - Contract allowed to consume it.
   * @param args.userAddress - Account allowed to submit it.
   * @returns The `externalEuint32` handle and its `inputProof`.
   *
   * @example
   * ```ts
   * const { externalEuint32, inputProof } = await fhevm.helpers.encryptUint32({
   *   value: 123456,
   *   contractAddress,
   *   userAddress,
   * });
   * await contract.connect(alice).store(externalEuint32, inputProof);
   * ```
   */
  encryptUint32(args: {
    readonly value: number | bigint;
    readonly contractAddress: string;
    readonly userAddress: string;
  }): Promise<{ externalEuint32: `0x${string}`; inputProof: `0x${string}` }>;

  /**
   * Encrypts `value` into a Solidity `externalEuint64` input, bound to the
   * `contractAddress`/`userAddress` pair: only that contract may consume it,
   * and only when that user sends it. The contract turns it into a `euint64`
   * with `FHE.fromExternal(handle, inputProof)`.
   *
   * @param args.value - The cleartext to encrypt.
   * @param args.contractAddress - Contract allowed to consume it.
   * @param args.userAddress - Account allowed to submit it.
   * @returns The `externalEuint64` handle and its `inputProof`.
   *
   * @example
   * ```ts
   * const { externalEuint64, inputProof } = await fhevm.helpers.encryptUint64({
   *   value: 1_000_000n,
   *   contractAddress,
   *   userAddress,
   * });
   * await contract.connect(alice).store(externalEuint64, inputProof);
   * ```
   */
  encryptUint64(args: {
    readonly value: number | bigint;
    readonly contractAddress: string;
    readonly userAddress: string;
  }): Promise<{ externalEuint64: `0x${string}`; inputProof: `0x${string}` }>;

  /**
   * Encrypts `value` into a Solidity `externalEuint128` input, bound to the
   * `contractAddress`/`userAddress` pair: only that contract may consume it,
   * and only when that user sends it. The contract turns it into a `euint128`
   * with `FHE.fromExternal(handle, inputProof)`.
   *
   * @param args.value - The cleartext to encrypt.
   * @param args.contractAddress - Contract allowed to consume it.
   * @param args.userAddress - Account allowed to submit it.
   * @returns The `externalEuint128` handle and its `inputProof`.
   *
   * @example
   * ```ts
   * const { externalEuint128, inputProof } =
   *   await fhevm.helpers.encryptUint128({
   *   value: 10n ** 20n,
   *   contractAddress,
   *   userAddress,
   * });
   * await contract.connect(alice).store(externalEuint128, inputProof);
   * ```
   */
  encryptUint128(args: {
    readonly value: number | bigint;
    readonly contractAddress: string;
    readonly userAddress: string;
  }): Promise<{ externalEuint128: `0x${string}`; inputProof: `0x${string}` }>;

  /**
   * Encrypts `value` into a Solidity `externalEuint256` input, bound to the
   * `contractAddress`/`userAddress` pair: only that contract may consume it,
   * and only when that user sends it. The contract turns it into a `euint256`
   * with `FHE.fromExternal(handle, inputProof)`.
   *
   * @param args.value - The cleartext to encrypt.
   * @param args.contractAddress - Contract allowed to consume it.
   * @param args.userAddress - Account allowed to submit it.
   * @returns The `externalEuint256` handle and its `inputProof`.
   *
   * @example
   * ```ts
   * const { externalEuint256, inputProof } =
   *   await fhevm.helpers.encryptUint256({
   *   value: 2n ** 200n,
   *   contractAddress,
   *   userAddress,
   * });
   * await contract.connect(alice).store(externalEuint256, inputProof);
   * ```
   */
  encryptUint256(args: {
    readonly value: number | bigint;
    readonly contractAddress: string;
    readonly userAddress: string;
  }): Promise<{ externalEuint256: `0x${string}`; inputProof: `0x${string}` }>;

  /**
   * Encrypts `value` into a Solidity `externalEaddress` input, bound to the
   * `contractAddress`/`userAddress` pair: only that contract may consume it,
   * and only when that user sends it. The contract turns it into a `eaddress`
   * with `FHE.fromExternal(handle, inputProof)`.
   *
   * @param args.value - The cleartext to encrypt.
   * @param args.contractAddress - Contract allowed to consume it.
   * @param args.userAddress - Account allowed to submit it.
   * @returns The `externalEaddress` handle and its `inputProof`.
   *
   * @example
   * ```ts
   * const { externalEaddress, inputProof } =
   *   await fhevm.helpers.encryptAddress({
   *   value: '0x2222…2222',
   *   contractAddress,
   *   userAddress,
   * });
   * await contract.connect(alice).store(externalEaddress, inputProof);
   * ```
   */
  encryptAddress(args: {
    readonly value: string;
    readonly contractAddress: string;
    readonly userAddress: string;
  }): Promise<{ externalEaddress: `0x${string}`; inputProof: `0x${string}` }>;

  /**
   * User-decrypts a `ebool` on behalf of `userAddress`, who must have been
   * granted access to the handle on-chain. The node signs the EIP-712 permit.
   *
   * @param args.ebool - Handle of the `ebool` to decrypt.
   * @param args.contractAddress - Contract the handle belongs to.
   * @param args.userAddress - Account the decryption is for.
   * @param args.options - Optional validity window and delegator.
   * @returns The clear boolean.
   *
   * @example
   * ```ts
   * const clear = await fhevm.helpers.decryptBool({
   *   ebool: await contract.value(),
   *   contractAddress,
   *   userAddress: alice.address,
   * });
   * ```
   */
  decryptBool(args: {
    readonly ebool: `0x${string}`;
    readonly contractAddress: string;
    readonly userAddress: string;
    readonly options?: FhevmDecryptOptions | undefined;
  }): Promise<boolean>;

  /**
   * User-decrypts a `euint8` on behalf of `userAddress`, who must have been
   * granted access to the handle on-chain. The node signs the EIP-712 permit.
   *
   * @param args.euint8 - Handle of the `euint8` to decrypt.
   * @param args.contractAddress - Contract the handle belongs to.
   * @param args.userAddress - Account the decryption is for.
   * @param args.options - Optional validity window and delegator.
   * @returns The clear number.
   *
   * @example
   * ```ts
   * const clear = await fhevm.helpers.decryptUint8({
   *   euint8: await contract.value(),
   *   contractAddress,
   *   userAddress: alice.address,
   * });
   * ```
   */
  decryptUint8(args: {
    readonly euint8: `0x${string}`;
    readonly contractAddress: string;
    readonly userAddress: string;
    readonly options?: FhevmDecryptOptions | undefined;
  }): Promise<number>;

  /**
   * User-decrypts a `euint16` on behalf of `userAddress`, who must have been
   * granted access to the handle on-chain. The node signs the EIP-712 permit.
   *
   * @param args.euint16 - Handle of the `euint16` to decrypt.
   * @param args.contractAddress - Contract the handle belongs to.
   * @param args.userAddress - Account the decryption is for.
   * @param args.options - Optional validity window and delegator.
   * @returns The clear number.
   *
   * @example
   * ```ts
   * const clear = await fhevm.helpers.decryptUint16({
   *   euint16: await contract.value(),
   *   contractAddress,
   *   userAddress: alice.address,
   * });
   * ```
   */
  decryptUint16(args: {
    readonly euint16: `0x${string}`;
    readonly contractAddress: string;
    readonly userAddress: string;
    readonly options?: FhevmDecryptOptions | undefined;
  }): Promise<number>;

  /**
   * User-decrypts a `euint32` on behalf of `userAddress`, who must have been
   * granted access to the handle on-chain. The node signs the EIP-712 permit.
   *
   * @param args.euint32 - Handle of the `euint32` to decrypt.
   * @param args.contractAddress - Contract the handle belongs to.
   * @param args.userAddress - Account the decryption is for.
   * @param args.options - Optional validity window and delegator.
   * @returns The clear number.
   *
   * @example
   * ```ts
   * const clear = await fhevm.helpers.decryptUint32({
   *   euint32: await contract.value(),
   *   contractAddress,
   *   userAddress: alice.address,
   * });
   * ```
   */
  decryptUint32(args: {
    readonly euint32: `0x${string}`;
    readonly contractAddress: string;
    readonly userAddress: string;
    readonly options?: FhevmDecryptOptions | undefined;
  }): Promise<number>;

  /**
   * User-decrypts a `euint64` on behalf of `userAddress`, who must have been
   * granted access to the handle on-chain. The node signs the EIP-712 permit.
   *
   * @param args.euint64 - Handle of the `euint64` to decrypt.
   * @param args.contractAddress - Contract the handle belongs to.
   * @param args.userAddress - Account the decryption is for.
   * @param args.options - Optional validity window and delegator.
   * @returns The clear bigint.
   *
   * @example
   * ```ts
   * const clear = await fhevm.helpers.decryptUint64({
   *   euint64: await contract.value(),
   *   contractAddress,
   *   userAddress: alice.address,
   * });
   * ```
   */
  decryptUint64(args: {
    readonly euint64: `0x${string}`;
    readonly contractAddress: string;
    readonly userAddress: string;
    readonly options?: FhevmDecryptOptions | undefined;
  }): Promise<bigint>;

  /**
   * User-decrypts a `euint128` on behalf of `userAddress`, who must have been
   * granted access to the handle on-chain. The node signs the EIP-712 permit.
   *
   * @param args.euint128 - Handle of the `euint128` to decrypt.
   * @param args.contractAddress - Contract the handle belongs to.
   * @param args.userAddress - Account the decryption is for.
   * @param args.options - Optional validity window and delegator.
   * @returns The clear bigint.
   *
   * @example
   * ```ts
   * const clear = await fhevm.helpers.decryptUint128({
   *   euint128: await contract.value(),
   *   contractAddress,
   *   userAddress: alice.address,
   * });
   * ```
   */
  decryptUint128(args: {
    readonly euint128: `0x${string}`;
    readonly contractAddress: string;
    readonly userAddress: string;
    readonly options?: FhevmDecryptOptions | undefined;
  }): Promise<bigint>;

  /**
   * User-decrypts a `euint256` on behalf of `userAddress`, who must have been
   * granted access to the handle on-chain. The node signs the EIP-712 permit.
   *
   * @param args.euint256 - Handle of the `euint256` to decrypt.
   * @param args.contractAddress - Contract the handle belongs to.
   * @param args.userAddress - Account the decryption is for.
   * @param args.options - Optional validity window and delegator.
   * @returns The clear bigint.
   *
   * @example
   * ```ts
   * const clear = await fhevm.helpers.decryptUint256({
   *   euint256: await contract.value(),
   *   contractAddress,
   *   userAddress: alice.address,
   * });
   * ```
   */
  decryptUint256(args: {
    readonly euint256: `0x${string}`;
    readonly contractAddress: string;
    readonly userAddress: string;
    readonly options?: FhevmDecryptOptions | undefined;
  }): Promise<bigint>;

  /**
   * User-decrypts a `eaddress` on behalf of `userAddress`, who must have been
   * granted access to the handle on-chain. The node signs the EIP-712 permit.
   *
   * @param args.eaddress - Handle of the `eaddress` to decrypt.
   * @param args.contractAddress - Contract the handle belongs to.
   * @param args.userAddress - Account the decryption is for.
   * @param args.options - Optional validity window and delegator.
   * @returns The clear address.
   *
   * @example
   * ```ts
   * const clear = await fhevm.helpers.decryptAddress({
   *   eaddress: await contract.value(),
   *   contractAddress,
   *   userAddress: alice.address,
   * });
   * ```
   */
  decryptAddress(args: {
    readonly eaddress: `0x${string}`;
    readonly contractAddress: string;
    readonly userAddress: string;
    readonly options?: FhevmDecryptOptions | undefined;
  }): Promise<`0x${string}`>;

  /**
   * Publicly decrypts a `ebool` that the contract made publicly decryptable
   * with `FHE.makePubliclyDecryptable`. No permit, and no user: anyone may read
   * it.
   *
   * @param args.ebool - Handle of the `ebool` to decrypt.
   * @returns The clear boolean.
   *
   * @example
   * ```ts
   * const clear = await fhevm.helpers.decryptPublicBool({
   *   ebool: await contract.value(),
   * });
   * ```
   */
  decryptPublicBool(args: { readonly ebool: `0x${string}` }): Promise<boolean>;

  /**
   * Publicly decrypts a `euint8` that the contract made publicly decryptable
   * with `FHE.makePubliclyDecryptable`. No permit, and no user: anyone may read
   * it.
   *
   * @param args.euint8 - Handle of the `euint8` to decrypt.
   * @returns The clear number.
   *
   * @example
   * ```ts
   * const clear = await fhevm.helpers.decryptPublicUint8({
   *   euint8: await contract.value(),
   * });
   * ```
   */
  decryptPublicUint8(args: { readonly euint8: `0x${string}` }): Promise<number>;

  /**
   * Publicly decrypts a `euint16` that the contract made publicly decryptable
   * with `FHE.makePubliclyDecryptable`. No permit, and no user: anyone may read
   * it.
   *
   * @param args.euint16 - Handle of the `euint16` to decrypt.
   * @returns The clear number.
   *
   * @example
   * ```ts
   * const clear = await fhevm.helpers.decryptPublicUint16({
   *   euint16: await contract.value(),
   * });
   * ```
   */
  decryptPublicUint16(args: { readonly euint16: `0x${string}` }): Promise<number>;

  /**
   * Publicly decrypts a `euint32` that the contract made publicly decryptable
   * with `FHE.makePubliclyDecryptable`. No permit, and no user: anyone may read
   * it.
   *
   * @param args.euint32 - Handle of the `euint32` to decrypt.
   * @returns The clear number.
   *
   * @example
   * ```ts
   * const clear = await fhevm.helpers.decryptPublicUint32({
   *   euint32: await contract.value(),
   * });
   * ```
   */
  decryptPublicUint32(args: { readonly euint32: `0x${string}` }): Promise<number>;

  /**
   * Publicly decrypts a `euint64` that the contract made publicly decryptable
   * with `FHE.makePubliclyDecryptable`. No permit, and no user: anyone may read
   * it.
   *
   * @param args.euint64 - Handle of the `euint64` to decrypt.
   * @returns The clear bigint.
   *
   * @example
   * ```ts
   * const clear = await fhevm.helpers.decryptPublicUint64({
   *   euint64: await contract.value(),
   * });
   * ```
   */
  decryptPublicUint64(args: { readonly euint64: `0x${string}` }): Promise<bigint>;

  /**
   * Publicly decrypts a `euint128` that the contract made publicly decryptable
   * with `FHE.makePubliclyDecryptable`. No permit, and no user: anyone may read
   * it.
   *
   * @param args.euint128 - Handle of the `euint128` to decrypt.
   * @returns The clear bigint.
   *
   * @example
   * ```ts
   * const clear = await fhevm.helpers.decryptPublicUint128({
   *   euint128: await contract.value(),
   * });
   * ```
   */
  decryptPublicUint128(args: { readonly euint128: `0x${string}` }): Promise<bigint>;

  /**
   * Publicly decrypts a `euint256` that the contract made publicly decryptable
   * with `FHE.makePubliclyDecryptable`. No permit, and no user: anyone may read
   * it.
   *
   * @param args.euint256 - Handle of the `euint256` to decrypt.
   * @returns The clear bigint.
   *
   * @example
   * ```ts
   * const clear = await fhevm.helpers.decryptPublicUint256({
   *   euint256: await contract.value(),
   * });
   * ```
   */
  decryptPublicUint256(args: { readonly euint256: `0x${string}` }): Promise<bigint>;

  /**
   * Publicly decrypts a `eaddress` that the contract made publicly decryptable
   * with `FHE.makePubliclyDecryptable`. No permit, and no user: anyone may read
   * it.
   *
   * @param args.eaddress - Handle of the `eaddress` to decrypt.
   * @returns The clear address.
   *
   * @example
   * ```ts
   * const clear = await fhevm.helpers.decryptPublicAddress({
   *   eaddress: await contract.value(),
   * });
   * ```
   */
  decryptPublicAddress(args: { readonly eaddress: `0x${string}` }): Promise<`0x${string}`>;

  /**
   * As {@link FhevmClientHelpers.decryptPublicBool}, and additionally returns
   * the KMS proof, so a contract can verify on-chain that the cleartext really
   * is that handle's value.
   *
   * @param args.ebool - Handle of the `ebool` to decrypt.
   * @returns The clear value and its `checkSignaturesArgs`.
   *
   * @example
   * ```ts
   * const { clearValue, checkSignaturesArgs } =
   *   await fhevm.helpers.decryptPublicBoolWithSignatures({ ebool: handle });
   * await contract.verify(
   *   checkSignaturesArgs.handlesList,
   *   checkSignaturesArgs.abiEncodedCleartexts,
   *   checkSignaturesArgs.decryptionProof,
   * );
   * ```
   */
  decryptPublicBoolWithSignatures(args: { readonly ebool: `0x${string}` }): Promise<{
    clearValue: boolean;
    checkSignaturesArgs: FhevmCheckSignaturesArgs;
  }>;

  /**
   * As {@link FhevmClientHelpers.decryptPublicUint8}, and additionally returns
   * the KMS proof, so a contract can verify on-chain that the cleartext really
   * is that handle's value.
   *
   * @param args.euint8 - Handle of the `euint8` to decrypt.
   * @returns The clear value and its `checkSignaturesArgs`.
   *
   * @example
   * ```ts
   * const { clearValue, checkSignaturesArgs } =
   *   await fhevm.helpers.decryptPublicUint8WithSignatures({ euint8: handle });
   * await contract.verify(
   *   checkSignaturesArgs.handlesList,
   *   checkSignaturesArgs.abiEncodedCleartexts,
   *   checkSignaturesArgs.decryptionProof,
   * );
   * ```
   */
  decryptPublicUint8WithSignatures(args: { readonly euint8: `0x${string}` }): Promise<{
    clearValue: number;
    checkSignaturesArgs: FhevmCheckSignaturesArgs;
  }>;

  /**
   * As {@link FhevmClientHelpers.decryptPublicUint16}, and additionally returns
   * the KMS proof, so a contract can verify on-chain that the cleartext really
   * is that handle's value.
   *
   * @param args.euint16 - Handle of the `euint16` to decrypt.
   * @returns The clear value and its `checkSignaturesArgs`.
   *
   * @example
   * ```ts
   * const { clearValue, checkSignaturesArgs } =
   *   await fhevm.helpers.decryptPublicUint16WithSignatures({
   *     euint16: handle,
   *   });
   * await contract.verify(
   *   checkSignaturesArgs.handlesList,
   *   checkSignaturesArgs.abiEncodedCleartexts,
   *   checkSignaturesArgs.decryptionProof,
   * );
   * ```
   */
  decryptPublicUint16WithSignatures(args: { readonly euint16: `0x${string}` }): Promise<{
    clearValue: number;
    checkSignaturesArgs: FhevmCheckSignaturesArgs;
  }>;

  /**
   * As {@link FhevmClientHelpers.decryptPublicUint32}, and additionally returns
   * the KMS proof, so a contract can verify on-chain that the cleartext really
   * is that handle's value.
   *
   * @param args.euint32 - Handle of the `euint32` to decrypt.
   * @returns The clear value and its `checkSignaturesArgs`.
   *
   * @example
   * ```ts
   * const { clearValue, checkSignaturesArgs } =
   *   await fhevm.helpers.decryptPublicUint32WithSignatures({
   *     euint32: handle,
   *   });
   * await contract.verify(
   *   checkSignaturesArgs.handlesList,
   *   checkSignaturesArgs.abiEncodedCleartexts,
   *   checkSignaturesArgs.decryptionProof,
   * );
   * ```
   */
  decryptPublicUint32WithSignatures(args: { readonly euint32: `0x${string}` }): Promise<{
    clearValue: number;
    checkSignaturesArgs: FhevmCheckSignaturesArgs;
  }>;

  /**
   * As {@link FhevmClientHelpers.decryptPublicUint64}, and additionally returns
   * the KMS proof, so a contract can verify on-chain that the cleartext really
   * is that handle's value.
   *
   * @param args.euint64 - Handle of the `euint64` to decrypt.
   * @returns The clear value and its `checkSignaturesArgs`.
   *
   * @example
   * ```ts
   * const { clearValue, checkSignaturesArgs } =
   *   await fhevm.helpers.decryptPublicUint64WithSignatures({
   *     euint64: handle,
   *   });
   * await contract.verify(
   *   checkSignaturesArgs.handlesList,
   *   checkSignaturesArgs.abiEncodedCleartexts,
   *   checkSignaturesArgs.decryptionProof,
   * );
   * ```
   */
  decryptPublicUint64WithSignatures(args: { readonly euint64: `0x${string}` }): Promise<{
    clearValue: bigint;
    checkSignaturesArgs: FhevmCheckSignaturesArgs;
  }>;

  /**
   * As {@link FhevmClientHelpers.decryptPublicUint128}, and additionally
   * returns the KMS proof, so a contract can verify on-chain that the cleartext
   * really is that handle's value.
   *
   * @param args.euint128 - Handle of the `euint128` to decrypt.
   * @returns The clear value and its `checkSignaturesArgs`.
   *
   * @example
   * ```ts
   * const { clearValue, checkSignaturesArgs } =
   *   await fhevm.helpers.decryptPublicUint128WithSignatures({
   *     euint128: handle,
   *   });
   * await contract.verify(
   *   checkSignaturesArgs.handlesList,
   *   checkSignaturesArgs.abiEncodedCleartexts,
   *   checkSignaturesArgs.decryptionProof,
   * );
   * ```
   */
  decryptPublicUint128WithSignatures(args: { readonly euint128: `0x${string}` }): Promise<{
    clearValue: bigint;
    checkSignaturesArgs: FhevmCheckSignaturesArgs;
  }>;

  /**
   * As {@link FhevmClientHelpers.decryptPublicUint256}, and additionally
   * returns the KMS proof, so a contract can verify on-chain that the cleartext
   * really is that handle's value.
   *
   * @param args.euint256 - Handle of the `euint256` to decrypt.
   * @returns The clear value and its `checkSignaturesArgs`.
   *
   * @example
   * ```ts
   * const { clearValue, checkSignaturesArgs } =
   *   await fhevm.helpers.decryptPublicUint256WithSignatures({
   *     euint256: handle,
   *   });
   * await contract.verify(
   *   checkSignaturesArgs.handlesList,
   *   checkSignaturesArgs.abiEncodedCleartexts,
   *   checkSignaturesArgs.decryptionProof,
   * );
   * ```
   */
  decryptPublicUint256WithSignatures(args: { readonly euint256: `0x${string}` }): Promise<{
    clearValue: bigint;
    checkSignaturesArgs: FhevmCheckSignaturesArgs;
  }>;

  /**
   * As {@link FhevmClientHelpers.decryptPublicAddress}, and additionally
   * returns the KMS proof, so a contract can verify on-chain that the cleartext
   * really is that handle's value.
   *
   * @param args.eaddress - Handle of the `eaddress` to decrypt.
   * @returns The clear value and its `checkSignaturesArgs`.
   *
   * @example
   * ```ts
   * const { clearValue, checkSignaturesArgs } =
   *   await fhevm.helpers.decryptPublicAddressWithSignatures({
   *     eaddress: handle,
   *   });
   * await contract.verify(
   *   checkSignaturesArgs.handlesList,
   *   checkSignaturesArgs.abiEncodedCleartexts,
   *   checkSignaturesArgs.decryptionProof,
   * );
   * ```
   */
  decryptPublicAddressWithSignatures(args: { readonly eaddress: `0x${string}` }): Promise<{
    clearValue: `0x${string}`;
    checkSignaturesArgs: FhevmCheckSignaturesArgs;
  }>;
}

/** Reads cleartexts off the cleartext stack with NO ACL check — test tooling, cleartext networks only. */
export interface FhevmCleartextDB {
  /**
   * Reads the cleartext of a `ebool` straight out of `CleartextDB`, bypassing
   * the ACL entirely. Test tooling: it answers even when nobody is allowed to
   * see the value.
   *
   * @param args.ebool - Handle of the `ebool` to read.
   * @returns The clear boolean.
   *
   * @example
   * ```ts
   * // no permit, no allow: reads whatever the operator produced
   * const clear = await fhevm.cleartextDb.readBool({ ebool: handle });
   * ```
   */
  readBool(args: { readonly ebool: `0x${string}` }): Promise<boolean>;

  /**
   * Reads the cleartext of a `euint8` straight out of `CleartextDB`, bypassing
   * the ACL entirely. Test tooling: it answers even when nobody is allowed to
   * see the value.
   *
   * @param args.euint8 - Handle of the `euint8` to read.
   * @returns The clear number.
   *
   * @example
   * ```ts
   * // no permit, no allow: reads whatever the operator produced
   * const clear = await fhevm.cleartextDb.readUint8({ euint8: handle });
   * ```
   */
  readUint8(args: { readonly euint8: `0x${string}` }): Promise<number>;

  /**
   * Reads the cleartext of a `euint16` straight out of `CleartextDB`, bypassing
   * the ACL entirely. Test tooling: it answers even when nobody is allowed to
   * see the value.
   *
   * @param args.euint16 - Handle of the `euint16` to read.
   * @returns The clear number.
   *
   * @example
   * ```ts
   * // no permit, no allow: reads whatever the operator produced
   * const clear = await fhevm.cleartextDb.readUint16({ euint16: handle });
   * ```
   */
  readUint16(args: { readonly euint16: `0x${string}` }): Promise<number>;

  /**
   * Reads the cleartext of a `euint32` straight out of `CleartextDB`, bypassing
   * the ACL entirely. Test tooling: it answers even when nobody is allowed to
   * see the value.
   *
   * @param args.euint32 - Handle of the `euint32` to read.
   * @returns The clear number.
   *
   * @example
   * ```ts
   * // no permit, no allow: reads whatever the operator produced
   * const clear = await fhevm.cleartextDb.readUint32({ euint32: handle });
   * ```
   */
  readUint32(args: { readonly euint32: `0x${string}` }): Promise<number>;

  /**
   * Reads the cleartext of a `euint64` straight out of `CleartextDB`, bypassing
   * the ACL entirely. Test tooling: it answers even when nobody is allowed to
   * see the value.
   *
   * @param args.euint64 - Handle of the `euint64` to read.
   * @returns The clear bigint.
   *
   * @example
   * ```ts
   * // no permit, no allow: reads whatever the operator produced
   * const clear = await fhevm.cleartextDb.readUint64({ euint64: handle });
   * ```
   */
  readUint64(args: { readonly euint64: `0x${string}` }): Promise<bigint>;

  /**
   * Reads the cleartext of a `euint128` straight out of `CleartextDB`,
   * bypassing the ACL entirely. Test tooling: it answers even when nobody is
   * allowed to see the value.
   *
   * @param args.euint128 - Handle of the `euint128` to read.
   * @returns The clear bigint.
   *
   * @example
   * ```ts
   * // no permit, no allow: reads whatever the operator produced
   * const clear = await fhevm.cleartextDb.readUint128({ euint128: handle });
   * ```
   */
  readUint128(args: { readonly euint128: `0x${string}` }): Promise<bigint>;

  /**
   * Reads the cleartext of a `euint256` straight out of `CleartextDB`,
   * bypassing the ACL entirely. Test tooling: it answers even when nobody is
   * allowed to see the value.
   *
   * @param args.euint256 - Handle of the `euint256` to read.
   * @returns The clear bigint.
   *
   * @example
   * ```ts
   * // no permit, no allow: reads whatever the operator produced
   * const clear = await fhevm.cleartextDb.readUint256({ euint256: handle });
   * ```
   */
  readUint256(args: { readonly euint256: `0x${string}` }): Promise<bigint>;

  /**
   * Reads the cleartext of a `eaddress` straight out of `CleartextDB`,
   * bypassing the ACL entirely. Test tooling: it answers even when nobody is
   * allowed to see the value.
   *
   * @param args.eaddress - Handle of the `eaddress` to read.
   * @returns The clear address.
   *
   * @example
   * ```ts
   * // no permit, no allow: reads whatever the operator produced
   * const clear = await fhevm.cleartextDb.readAddress({ eaddress: handle });
   * ```
   */
  readAddress(args: { readonly eaddress: `0x${string}` }): Promise<`0x${string}`>;
}

export interface HardhatFhevmRuntimeEnvironment {
  /** True when the SDK talks to this node in cleartext mode (every development node). */
  readonly isCleartext: boolean;
  /** True on a development node the plugin may deploy the cleartext stack onto. */
  readonly isDevelopment: boolean;
  /** The detected network: name, live chain id, kind, remote URL, registry host chains. */
  readonly network: FhevmNetworkInfo;

  readonly cleartextDb: FhevmCleartextDB;
  readonly client: FhevmClient;
  readonly helpers: FhevmClientHelpers;

  /**
   * The Homomorphic Complexity Units a mined transaction consumed: the total,
   * and the deepest dependency chain, computed from the operator events in its
   * receipt.
   *
   * @param txHash - Hash of a transaction mined on this connection.
   * @returns The total HCU, the max depth, and the depth per handle.
   *
   * @example
   * ```ts
   * const tx = await contract.increment(handle, proof);
   * const receipt = await tx.wait();
   * const { globalHCU, maxHCUDepth } =
   *   await fhevm.computeTransactionHCU(receipt.hash);
   * ```
   */
  computeTransactionHCU(txHash: string): Promise<FhevmTransactionHCUInfo>;

  /**
   * Fails by name when the contract was not compiled against the FHEVM stack
   * this connection runs, which is the usual cause of an otherwise unexplained
   * revert.
   *
   * @param contractAddress - The contract to check.
   * @param contractName - Optional name, used in the error message.
   * @returns Nothing; throws when it does not match the stack.
   *
   * @example
   * ```ts
   * await fhevm.assertCoprocessorInitialized(contractAddress, "FHECounter");
   * ```
   */
  assertCoprocessorInitialized(contractAddress: string, contractName?: string): Promise<void>;

  /**
   * The three FHEVM addresses a contract recorded when it inherited
   * `ZamaConfig` or called `FHE.setCoprocessor()`.
   *
   * @param contractAddress - The contract to read the config from.
   * @returns The ACL, Coprocessor and KMSVerifier addresses.
   *
   * @example
   * ```ts
   * const { ACLAddress } = await fhevm.getCoprocessorConfig(contractAddress);
   * ```
   */
  getCoprocessorConfig(contractAddress: string): Promise<CoprocessorConfig>;
}
