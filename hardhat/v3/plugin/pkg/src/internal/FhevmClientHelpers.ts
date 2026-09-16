import { type Address, type Hex, createWalletClient, custom, isAddress } from 'viem';
import type { FhevmCheckSignaturesArgs, FhevmClient, FhevmClientHelpers, FhevmDecryptOptions } from '../types.js';
import { FhevmType, type FhevmUser, type FhevmUserDecryptOptions } from '../types-p.js';
import { HardhatPluginError } from 'hardhat/plugins';
import { PLUGIN_ID } from './constants.js';
import { asAddress, asBigInt, asBoolean, publicDecryptOne } from './decrypt.js';
import { encryptOne } from './encrypt.js';
import { userDecryptOne } from './userDecrypt.js';
import { assertDecryptedFitsType, decryptedToNumber } from './fhevmValue.js';
import { assertHandleChainId, assertHandleIsInitialized, parseFhevmHandle } from './fhevmHandle.js';

////////////////////////////////////////////////////////////////////////////////

// Local and unexported on purpose: the public interface spells these out inline so that
// `FhevmClientHelpers` is the only name it adds to the plugin's API.
type EncryptArgs<TValue> = {
  readonly value: TValue;
  readonly contractAddress: string;
  readonly userAddress: string;
};

// The EIP-1193 provider of the connection this `fhevm` belongs to. User decryption needs a SIGNER,
// not just an address: the permit is EIP-712 signed. On a development node the node itself holds the
// keys, so an address plus this provider is enough to build one — the same trick the old
// `fhevm user-decrypt` task used.
export type Eip1193Provider = { request(args: { method: string; params?: unknown }): Promise<unknown> };

// What `publicDecryptOne` hands back: the SDK's typed value, narrowed by the `as*` coercions.
type TypedValueLike = {
  readonly type: string;
  readonly value: unknown;
};

////////////////////////////////////////////////////////////////////////////////
// class FhevmClientHelpersImpl
////////////////////////////////////////////////////////////////////////////////

export class FhevmClientHelpersImpl implements FhevmClientHelpers {
  readonly #getClient: () => FhevmClient;
  readonly #provider: Eip1193Provider;

  // The client is fetched per call, never captured: on a network without one, `fhevm.helpers` is still
  // reachable and only the call throws, which is how `createEncryptedInput` behaves too.
  constructor(getClient: () => FhevmClient, provider: Eip1193Provider) {
    this.#getClient = getClient;
    this.#provider = provider;
  }

  // Turns `userAddress` into something that can sign the decryption permit. The node owns the key, so
  // the wallet client just forwards `eth_signTypedData_v4` down the connection's provider.
  #signerFor(method: string, userAddress: string): FhevmUser {
    if (!isAddress(userAddress)) {
      throw new HardhatPluginError(
        PLUGIN_ID,
        `fhevm.helpers.${method}: the 'userAddress' argument is not a valid address. Got '${userAddress}' instead.`,
      );
    }
    return createWalletClient({ account: userAddress, transport: custom(this.#provider) });
  }

  // One user decryption: check the handle really carries `expected`, then read it as `userAddress`.
  async #decryptUser(
    method: string,
    expected: FhevmType,
    args: { handle: Hex; contractAddress: string; userAddress: string; options?: FhevmDecryptOptions | undefined },
  ): Promise<TypedValueLike> {
    this.#assertHandleIs(method, expected, args.handle);
    return userDecryptOne(
      this.#getClient(),
      `fhevm.helpers.${method}`,
      args.handle,
      args.contractAddress as Address,
      this.#signerFor(method, args.userAddress),
      args.options as FhevmUserDecryptOptions | undefined,
    );
  }

  //////////////////////////////////////////////////////////////////////////////
  // Encrypt Single Value
  //////////////////////////////////////////////////////////////////////////////

  async encryptBool(args: EncryptArgs<boolean>): Promise<{ externalEbool: Hex; inputProof: Hex }> {
    const { handle, inputProof } = await this.#encryptOne('encryptBool', FhevmType.ebool, args);
    return { externalEbool: handle, inputProof };
  }

  async encryptUint8(args: EncryptArgs<number | bigint>): Promise<{ externalEuint8: Hex; inputProof: Hex }> {
    const { handle, inputProof } = await this.#encryptOne('encryptUint8', FhevmType.euint8, args);
    return { externalEuint8: handle, inputProof };
  }

  async encryptUint16(args: EncryptArgs<number | bigint>): Promise<{ externalEuint16: Hex; inputProof: Hex }> {
    const { handle, inputProof } = await this.#encryptOne('encryptUint16', FhevmType.euint16, args);
    return { externalEuint16: handle, inputProof };
  }

  async encryptUint32(args: EncryptArgs<number | bigint>): Promise<{ externalEuint32: Hex; inputProof: Hex }> {
    const { handle, inputProof } = await this.#encryptOne('encryptUint32', FhevmType.euint32, args);
    return { externalEuint32: handle, inputProof };
  }

  async encryptUint64(args: EncryptArgs<number | bigint>): Promise<{ externalEuint64: Hex; inputProof: Hex }> {
    const { handle, inputProof } = await this.#encryptOne('encryptUint64', FhevmType.euint64, args);
    return { externalEuint64: handle, inputProof };
  }

  async encryptUint128(args: EncryptArgs<number | bigint>): Promise<{ externalEuint128: Hex; inputProof: Hex }> {
    const { handle, inputProof } = await this.#encryptOne('encryptUint128', FhevmType.euint128, args);
    return { externalEuint128: handle, inputProof };
  }

  async encryptUint256(args: EncryptArgs<number | bigint>): Promise<{ externalEuint256: Hex; inputProof: Hex }> {
    const { handle, inputProof } = await this.#encryptOne('encryptUint256', FhevmType.euint256, args);
    return { externalEuint256: handle, inputProof };
  }

  async encryptAddress(args: EncryptArgs<string>): Promise<{ externalEaddress: Hex; inputProof: Hex }> {
    const { handle, inputProof } = await this.#encryptOne('encryptAddress', FhevmType.eaddress, args);
    return { externalEaddress: handle, inputProof };
  }

  //////////////////////////////////////////////////////////////////////////////
  // Decrypt Single Public Value
  //////////////////////////////////////////////////////////////////////////////

  async decryptPublicBool(args: { ebool: Hex }): Promise<boolean> {
    return asBoolean(await this.#decryptPublic('decryptPublicBool', FhevmType.ebool, args.ebool), args.ebool);
  }

  async decryptPublicUint8(args: { euint8: Hex }): Promise<number> {
    return this.#decryptPublicToNumber('decryptPublicUint8', FhevmType.euint8, args.euint8);
  }

  async decryptPublicUint16(args: { euint16: Hex }): Promise<number> {
    return this.#decryptPublicToNumber('decryptPublicUint16', FhevmType.euint16, args.euint16);
  }

  async decryptPublicUint32(args: { euint32: Hex }): Promise<number> {
    return this.#decryptPublicToNumber('decryptPublicUint32', FhevmType.euint32, args.euint32);
  }

  async decryptPublicUint64(args: { euint64: Hex }): Promise<bigint> {
    return this.#decryptPublicToBigInt('decryptPublicUint64', FhevmType.euint64, args.euint64);
  }

  async decryptPublicUint128(args: { euint128: Hex }): Promise<bigint> {
    return this.#decryptPublicToBigInt('decryptPublicUint128', FhevmType.euint128, args.euint128);
  }

  async decryptPublicUint256(args: { euint256: Hex }): Promise<bigint> {
    return this.#decryptPublicToBigInt('decryptPublicUint256', FhevmType.euint256, args.euint256);
  }

  async decryptPublicAddress(args: { eaddress: Hex }): Promise<Hex> {
    return asAddress(
      await this.#decryptPublic('decryptPublicAddress', FhevmType.eaddress, args.eaddress),
      args.eaddress,
    );
  }

  //////////////////////////////////////////////////////////////////////////////
  // Private Helpers
  //////////////////////////////////////////////////////////////////////////////

  // euint4/8/16/32 come back as a `number`; every value of those widths is a safe integer.
  async #decryptPublicToNumber(method: string, expected: FhevmType, handle: Hex): Promise<number> {
    const value = asBigInt(await this.#decryptPublic(method, expected, handle), handle);
    return decryptedToNumber(`fhevm.helpers.${method}`, expected, value, handle);
  }

  // euint64 and wider stay a `bigint`. The range check is the same one, minus the narrowing.
  async #decryptPublicToBigInt(method: string, expected: FhevmType, handle: Hex): Promise<bigint> {
    const value = asBigInt(await this.#decryptPublic(method, expected, handle), handle);
    return assertDecryptedFitsType(`fhevm.helpers.${method}`, expected, value, handle);
  }

  // Reads the cleartext behind `handle`, after checking the handle really carries `expected`. Without
  // that check `decryptPublicUint8({ euint8: <an euint64 handle> })` would go through and hand back a
  // value the declared `number` return cannot hold — the type name in the argument is a claim by the
  // caller, and the handle's own byte 30 is the fact.
  #assertHandleIs(method: string, expected: FhevmType, handle: Hex): void {
    // Uninitialized FIRST, exactly as `debugger.read` does. The zero word's byte 30 is 0x00, which is
    // `FhevmType.ebool`, so a type check placed ahead of this would report the zero handle as "a ebool,
    // not a euint32" — a diagnosis about the wrong thing. It is not an ebool; it is not a handle.
    assertHandleIsInitialized(handle);

    const info = parseFhevmHandle(handle);
    // The client knows the chain this connection talks to, so no extra wiring is needed here.
    assertHandleChainId(`fhevm.helpers.${method}`, info, this.#getClient().chain.id);
    if (info.fhevmType !== expected) {
      throw new HardhatPluginError(
        PLUGIN_ID,
        `fhevm.helpers.${method}: handle '${handle}' is a ${info.typeName}, not a ${FhevmType[expected]}.`,
      );
    }
  }

  async #decryptPublic(method: string, expected: FhevmType, handle: Hex): Promise<TypedValueLike> {
    this.#assertHandleIs(method, expected, handle);
    return publicDecryptOne(this.#getClient(), handle);
  }

  // The same read, keeping the KMS proof the SDK returns alongside it, so a test can hand
  // `checkSignaturesArgs` straight to a contract's `verify(...)`. One handle in, one value out: the
  // SDK answers positionally, so `clearValues[0]` is this handle's — there is no second candidate.
  async #decryptPublicWithSignatures(
    method: string,
    expected: FhevmType,
    handle: Hex,
  ): Promise<{ value: TypedValueLike; checkSignaturesArgs: FhevmCheckSignaturesArgs }> {
    this.#assertHandleIs(method, expected, handle);
    const res = await this.#getClient().decryptPublicValuesWithSignatures({ encryptedValues: [handle] });
    // `clearValues` is typed `NonEmptyReadonlyArray`, and one handle went in, so `[0]` is this
    // handle's value and cannot be undefined — no runtime guard to write here.
    return {
      value: res.clearValues[0],
      checkSignaturesArgs: {
        // Copied out of the SDK's readonly tuple so callers get a plain array they may sort or slice.
        handlesList: [...res.checkSignaturesArgs.handlesList],
        abiEncodedCleartexts: res.checkSignaturesArgs.abiEncodedCleartexts,
        decryptionProof: res.checkSignaturesArgs.decryptionProof,
      },
    };
  }

  async decryptPublicBoolWithSignatures(args: {
    ebool: Hex;
  }): Promise<{ clearValue: boolean; checkSignaturesArgs: FhevmCheckSignaturesArgs }> {
    const { value, checkSignaturesArgs } = await this.#decryptPublicWithSignatures(
      'decryptPublicBoolWithSignatures',
      FhevmType.ebool,
      args.ebool,
    );
    return { clearValue: asBoolean(value, args.ebool), checkSignaturesArgs };
  }

  async decryptPublicUint8WithSignatures(args: {
    euint8: Hex;
  }): Promise<{ clearValue: number; checkSignaturesArgs: FhevmCheckSignaturesArgs }> {
    const { value, checkSignaturesArgs } = await this.#decryptPublicWithSignatures(
      'decryptPublicUint8WithSignatures',
      FhevmType.euint8,
      args.euint8,
    );
    return {
      clearValue: decryptedToNumber(
        `fhevm.helpers.decryptPublicUint8WithSignatures`,
        FhevmType.euint8,
        asBigInt(value, args.euint8),
        args.euint8,
      ),
      checkSignaturesArgs,
    };
  }

  async decryptPublicUint16WithSignatures(args: {
    euint16: Hex;
  }): Promise<{ clearValue: number; checkSignaturesArgs: FhevmCheckSignaturesArgs }> {
    const { value, checkSignaturesArgs } = await this.#decryptPublicWithSignatures(
      'decryptPublicUint16WithSignatures',
      FhevmType.euint16,
      args.euint16,
    );
    return {
      clearValue: decryptedToNumber(
        `fhevm.helpers.decryptPublicUint16WithSignatures`,
        FhevmType.euint16,
        asBigInt(value, args.euint16),
        args.euint16,
      ),
      checkSignaturesArgs,
    };
  }

  async decryptPublicUint32WithSignatures(args: {
    euint32: Hex;
  }): Promise<{ clearValue: number; checkSignaturesArgs: FhevmCheckSignaturesArgs }> {
    const { value, checkSignaturesArgs } = await this.#decryptPublicWithSignatures(
      'decryptPublicUint32WithSignatures',
      FhevmType.euint32,
      args.euint32,
    );
    return {
      clearValue: decryptedToNumber(
        `fhevm.helpers.decryptPublicUint32WithSignatures`,
        FhevmType.euint32,
        asBigInt(value, args.euint32),
        args.euint32,
      ),
      checkSignaturesArgs,
    };
  }

  async decryptPublicUint64WithSignatures(args: {
    euint64: Hex;
  }): Promise<{ clearValue: bigint; checkSignaturesArgs: FhevmCheckSignaturesArgs }> {
    const { value, checkSignaturesArgs } = await this.#decryptPublicWithSignatures(
      'decryptPublicUint64WithSignatures',
      FhevmType.euint64,
      args.euint64,
    );
    return {
      clearValue: assertDecryptedFitsType(
        `fhevm.helpers.decryptPublicUint64WithSignatures`,
        FhevmType.euint64,
        asBigInt(value, args.euint64),
        args.euint64,
      ),
      checkSignaturesArgs,
    };
  }

  async decryptPublicUint128WithSignatures(args: {
    euint128: Hex;
  }): Promise<{ clearValue: bigint; checkSignaturesArgs: FhevmCheckSignaturesArgs }> {
    const { value, checkSignaturesArgs } = await this.#decryptPublicWithSignatures(
      'decryptPublicUint128WithSignatures',
      FhevmType.euint128,
      args.euint128,
    );
    return {
      clearValue: assertDecryptedFitsType(
        `fhevm.helpers.decryptPublicUint128WithSignatures`,
        FhevmType.euint128,
        asBigInt(value, args.euint128),
        args.euint128,
      ),
      checkSignaturesArgs,
    };
  }

  async decryptPublicUint256WithSignatures(args: {
    euint256: Hex;
  }): Promise<{ clearValue: bigint; checkSignaturesArgs: FhevmCheckSignaturesArgs }> {
    const { value, checkSignaturesArgs } = await this.#decryptPublicWithSignatures(
      'decryptPublicUint256WithSignatures',
      FhevmType.euint256,
      args.euint256,
    );
    return {
      clearValue: assertDecryptedFitsType(
        `fhevm.helpers.decryptPublicUint256WithSignatures`,
        FhevmType.euint256,
        asBigInt(value, args.euint256),
        args.euint256,
      ),
      checkSignaturesArgs,
    };
  }

  async decryptPublicAddressWithSignatures(args: {
    eaddress: Hex;
  }): Promise<{ clearValue: Hex; checkSignaturesArgs: FhevmCheckSignaturesArgs }> {
    const { value, checkSignaturesArgs } = await this.#decryptPublicWithSignatures(
      'decryptPublicAddressWithSignatures',
      FhevmType.eaddress,
      args.eaddress,
    );
    return { clearValue: asAddress(value, args.eaddress), checkSignaturesArgs };
  }

  async decryptBool(args: {
    ebool: Hex;
    contractAddress: string;
    userAddress: string;
    options?: FhevmDecryptOptions | undefined;
  }): Promise<boolean> {
    const value = await this.#decryptUser('decryptBool', FhevmType.ebool, { ...args, handle: args.ebool });
    return asBoolean(value, args.ebool);
  }

  async decryptUint8(args: {
    euint8: Hex;
    contractAddress: string;
    userAddress: string;
    options?: FhevmDecryptOptions | undefined;
  }): Promise<number> {
    const value = await this.#decryptUser('decryptUint8', FhevmType.euint8, { ...args, handle: args.euint8 });
    return decryptedToNumber(`fhevm.helpers.decryptUint8`, FhevmType.euint8, asBigInt(value, args.euint8), args.euint8);
  }

  async decryptUint16(args: {
    euint16: Hex;
    contractAddress: string;
    userAddress: string;
    options?: FhevmDecryptOptions | undefined;
  }): Promise<number> {
    const value = await this.#decryptUser('decryptUint16', FhevmType.euint16, { ...args, handle: args.euint16 });
    return decryptedToNumber(
      `fhevm.helpers.decryptUint16`,
      FhevmType.euint16,
      asBigInt(value, args.euint16),
      args.euint16,
    );
  }

  async decryptUint32(args: {
    euint32: Hex;
    contractAddress: string;
    userAddress: string;
    options?: FhevmDecryptOptions | undefined;
  }): Promise<number> {
    const value = await this.#decryptUser('decryptUint32', FhevmType.euint32, { ...args, handle: args.euint32 });
    return decryptedToNumber(
      `fhevm.helpers.decryptUint32`,
      FhevmType.euint32,
      asBigInt(value, args.euint32),
      args.euint32,
    );
  }

  async decryptUint64(args: {
    euint64: Hex;
    contractAddress: string;
    userAddress: string;
    options?: FhevmDecryptOptions | undefined;
  }): Promise<bigint> {
    const value = await this.#decryptUser('decryptUint64', FhevmType.euint64, { ...args, handle: args.euint64 });
    return assertDecryptedFitsType(
      `fhevm.helpers.decryptUint64`,
      FhevmType.euint64,
      asBigInt(value, args.euint64),
      args.euint64,
    );
  }

  async decryptUint128(args: {
    euint128: Hex;
    contractAddress: string;
    userAddress: string;
    options?: FhevmDecryptOptions | undefined;
  }): Promise<bigint> {
    const value = await this.#decryptUser('decryptUint128', FhevmType.euint128, { ...args, handle: args.euint128 });
    return assertDecryptedFitsType(
      `fhevm.helpers.decryptUint128`,
      FhevmType.euint128,
      asBigInt(value, args.euint128),
      args.euint128,
    );
  }

  async decryptUint256(args: {
    euint256: Hex;
    contractAddress: string;
    userAddress: string;
    options?: FhevmDecryptOptions | undefined;
  }): Promise<bigint> {
    const value = await this.#decryptUser('decryptUint256', FhevmType.euint256, { ...args, handle: args.euint256 });
    return assertDecryptedFitsType(
      `fhevm.helpers.decryptUint256`,
      FhevmType.euint256,
      asBigInt(value, args.euint256),
      args.euint256,
    );
  }

  async decryptAddress(args: {
    eaddress: Hex;
    contractAddress: string;
    userAddress: string;
    options?: FhevmDecryptOptions | undefined;
  }): Promise<Hex> {
    const value = await this.#decryptUser('decryptAddress', FhevmType.eaddress, { ...args, handle: args.eaddress });
    return asAddress(value, args.eaddress);
  }

  async #encryptOne(
    method: string,
    fhevmType: FhevmType,
    args: EncryptArgs<boolean | number | bigint | string>,
  ): Promise<{ handle: Hex; inputProof: Hex }> {
    return encryptOne(
      this.#getClient(),
      `fhevm.helpers.${method}`,
      fhevmType,
      args.value,
      args.contractAddress as Address,
      args.userAddress as Address,
    );
  }
}
