import { ethers as EthersT } from "ethers";

import constants from "../constants.js";
import type { MinimalProvider } from "../ethers/provider.js";
import { ENCRYPTION_TYPES, type RelayerEncryptedInput } from "../relayer-sdk/types.js";
import { concatBytes, uintToBytes } from "../utils/bytes.js";
import { FhevmError, assertFhevm } from "../utils/error.js";
import { MAX_UINT64, boolToBigInt, getMaxBigInt } from "../utils/math.js";
import { FheType, getFheTypeBitLength, getFheTypeByteLength } from "./FheType.js";
import { FhevmHandle } from "./FhevmHandle.js";
import { FhevmType, FhevmTypeToFheType, getFhevmTypeInfo, isFhevmEbytes, isFhevmEuint } from "./FhevmType.js";
import { InputVerifier, computeInputProofHex } from "./contracts/InputVerifier.js";
import type { FhevmDBHandleMetadata } from "./db/FhevmDB.js";
import * as relayer from "./relayer/index.js";
import type { MockRelayerData, MockRelayerV1InputProofPayload } from "./relayer/mock_payloads.js";

type FhevmSdkEncryptionBitWidths = keyof typeof ENCRYPTION_TYPES;

export class MockRelayerEncryptedInput implements RelayerEncryptedInput {
  #clearTextValues: (bigint | string)[] = [];
  #fhevmTypes: FhevmType[] = [];
  #fheTypes: FheType[] = [];
  #totalFheBits: number = 0;

  #contractChainId: number;
  #contractAddress: string;
  #userAddress: string;

  #relayerProvider: MinimalProvider;
  #aclContractAddress: string;
  #inputVerifier: InputVerifier;

  static readonly MAX_FHE_BITS: number = 2048;
  static readonly MAX_VAR_COUNT: number = 256;

  constructor(
    relayerProvider: MinimalProvider,
    contractChainId: number,
    contractAddress: string,
    userAddress: string,
    aclContractAddress: string,
    inputVerifier: InputVerifier,
  ) {
    // Check if chainId exceeds 8 bytes
    if (BigInt(contractChainId) > MAX_UINT64) {
      throw new Error("ChainId exceeds maximum allowed value (8 bytes)"); // fhevm assumes chainID is only taking up to 8 bytes
    }

    this.#relayerProvider = relayerProvider;
    this.#contractChainId = contractChainId;
    this.#contractAddress = contractAddress;
    this.#userAddress = userAddress;
    this.#aclContractAddress = aclContractAddress;
    this.#inputVerifier = inputVerifier;
  }

  public get userAddress(): string {
    return this.#userAddress;
  }

  public get contractAddress(): string {
    return this.#contractAddress;
  }

  private _checkAddFheBits(fheBitLen: number) {
    assertFhevm(fheBitLen >= 0);
    if (this.#totalFheBits + fheBitLen > MockRelayerEncryptedInput.MAX_FHE_BITS) {
      throw Error("Packing more than 2048 bits in a single input ciphertext is unsupported");
    }
    if (this.#clearTextValues.length + 1 > MockRelayerEncryptedInput.MAX_VAR_COUNT) {
      throw Error("Packing more than 256 variables in a single input ciphertext is unsupported");
    }
  }

  private _addClearTextValueFheBitsPair(clearTextValue: string | bigint, fhevmType: FhevmType) {
    // Bool = 2
    const fheType = FhevmTypeToFheType(fhevmType);
    const fheBitLen = getFheTypeBitLength(fheType);

    this._checkAddFheBits(fheBitLen);

    this.#fhevmTypes.push(fhevmType);
    this.#fheTypes.push(fheType);
    this.#clearTextValues.push(clearTextValue);
    this.#totalFheBits += fheBitLen;

    assertFhevm(this.#clearTextValues.length <= MockRelayerEncryptedInput.MAX_VAR_COUNT);
    assertFhevm(this.#totalFheBits <= MockRelayerEncryptedInput.MAX_FHE_BITS);
    assertFhevm(this.#clearTextValues.length === this.#fheTypes.length);
    assertFhevm(this.#clearTextValues.length === this.#fhevmTypes.length);
  }

  private _addBytes(clearTextValue: Uint8Array, fhevmType: FhevmType): MockRelayerEncryptedInput {
    assertFhevm(isFhevmEbytes(fhevmType));

    const fhevmTypeInfo = getFhevmTypeInfo(fhevmType);
    const fheBitLen = getFheTypeBitLength(fhevmTypeInfo.fheType);
    const clearTextBitLen = fhevmTypeInfo.clearTextBitLength;

    // For bytes, cleatText bit length and cypherText bit length are the same
    assertFhevm(clearTextBitLen === fheBitLen);
    assertFhevm(fheBitLen % 8 === 0);

    const fheByteLen = fheBitLen / 8;

    if (clearTextValue.length > fheByteLen) {
      throw new FhevmError(
        `Uncorrect length of input Uint8Array, should be ${fheByteLen} for an ${fhevmTypeInfo.name}`,
      );
    }

    const clearTextValueBigInt: bigint = EthersT.toBigInt(clearTextValue);
    const maxClearTextValueBigInt: bigint = getMaxBigInt(clearTextBitLen);
    //const clearTextValueBigInt : bigint = bytesToBigInt(clearTextValue);

    assertFhevm(clearTextValue.length * 8 === fheBitLen);
    assertFhevm(clearTextValueBigInt <= maxClearTextValueBigInt);

    this._addClearTextValueFheBitsPair(clearTextValueBigInt, fhevmType);

    return this;
  }

  private _addUint(clearTextValue: number | bigint, fhevmzType: FhevmType): MockRelayerEncryptedInput {
    assertFhevm(isFhevmEuint(fhevmzType));

    const fhevmTypeInfo = getFhevmTypeInfo(fhevmzType);
    const clearTextBitLen = fhevmTypeInfo.clearTextBitLength;

    if (clearTextValue < 0) {
      throw new FhevmError(`Invalid unsigned integer value ${clearTextValue}`);
    }

    const clearTextValueBigInt: bigint = BigInt(clearTextValue);
    const maxClearTextValueBigInt: bigint = getMaxBigInt(clearTextBitLen);

    if (clearTextValueBigInt > maxClearTextValueBigInt) {
      throw new FhevmError(
        `Invalid ${fhevmTypeInfo.solidityTypeName} value: ${clearTextValue}, it exceeds the maximum allowed value of ${maxClearTextValueBigInt}.`,
      );
    }

    this._addClearTextValueFheBitsPair(clearTextValueBigInt, fhevmzType);

    return this;
  }

  // Accepts : 0, 1, true, false
  public addBool(value: number | bigint | boolean) {
    const zeroOrOneBigInt: 0n | 1n = boolToBigInt(value);

    this._addClearTextValueFheBitsPair(zeroOrOneBigInt, FhevmType.ebool);

    return this;
  }
  public add8(value: number | bigint) {
    return this._addUint(value, FhevmType.euint8);
  }
  public add16(value: number | bigint) {
    return this._addUint(value, FhevmType.euint16);
  }
  public add32(value: number | bigint) {
    return this._addUint(value, FhevmType.euint32);
  }
  public add64(value: number | bigint) {
    return this._addUint(value, FhevmType.euint64);
  }
  public add128(value: number | bigint) {
    return this._addUint(value, FhevmType.euint128);
  }
  public addAddress(value: string) {
    if (!EthersT.isAddress(value)) {
      throw new Error("Invalid address value: ${value}.");
    }

    const clearTextValue = EthersT.getAddress(value);

    this._addClearTextValueFheBitsPair(clearTextValue, FhevmType.eaddress);

    return this;
  }
  public add256(value: number | bigint): RelayerEncryptedInput {
    return this._addUint(value, FhevmType.euint256);
  }
  public addBytes64(value: Uint8Array): RelayerEncryptedInput {
    return this._addBytes(value, FhevmType.ebytes64);
  }
  public addBytes128(value: Uint8Array): RelayerEncryptedInput {
    return this._addBytes(value, FhevmType.ebytes128);
  }
  public addBytes256(value: Uint8Array): RelayerEncryptedInput {
    return this._addBytes(value, FhevmType.ebytes256);
  }

  private _toMockFhevmRelayerV1InputProofPayload(extraData: string): MockRelayerV1InputProofPayload {
    const numHandles = this.#clearTextValues.length;
    const clearTextValuesBigIntHex: string[] = [];
    const clearTextValuesBigInt: bigint[] = [];
    const rand32BufferList: Uint8Array[] = [];
    const metadatas: FhevmDBHandleMetadata[] = [];
    //const randomBytes = EthersT.getBytes("0xd3f33f613ae8521e98fe2aa43bd0c6ad37d81c388c93460b78683e692602b981");
    for (let i = 0; i < numHandles; ++i) {
      const clearTextValueBigInt = BigInt(this.#clearTextValues[i]);
      clearTextValuesBigInt.push(clearTextValueBigInt);
      clearTextValuesBigIntHex.push(EthersT.toBeHex(clearTextValueBigInt));
      rand32BufferList.push(EthersT.randomBytes(32));
      //rand32BufferList.push(randomBytes);
      metadatas.push({
        blockNumber: 0,
        index: 0,
        transactionHash: EthersT.ZeroHash,
      });
    }

    const mockCiphertextWithInputVerification: Uint8Array = MockRelayerEncryptedInput._computeMockCiphertextWithZKProof(
      clearTextValuesBigInt,
      this.#fheTypes,
      rand32BufferList,
    );

    const mockData: MockRelayerData = {
      clearTextValuesBigIntHex,
      metadatas,
      fheTypes: this.#fheTypes,
      fhevmTypes: this.#fhevmTypes,
      aclContractAddress: this.#aclContractAddress,
      random32List: rand32BufferList.map(EthersT.hexlify),
    };

    const mockPayload: MockRelayerV1InputProofPayload = {
      contractAddress: this.#contractAddress,
      userAddress: this.#userAddress,
      ciphertextWithInputVerification: EthersT.hexlify(mockCiphertextWithInputVerification),
      contractChainId: "0x" + this.#contractChainId.toString(16),
      extraData,
      mockData,
    };

    return mockPayload;
  }

  private static _computeMockCiphertextWithZKProof(
    clearTextValuesBigInt: bigint[],
    fheTypes: FheType[],
    rand32BufferList: Uint8Array[],
  ): Uint8Array {
    let encrypted: Uint8Array = new Uint8Array(0);

    const numHandles = clearTextValuesBigInt.length;

    assertFhevm(rand32BufferList.length === numHandles);
    assertFhevm(fheTypes.length === numHandles);

    // 1. Build the typed values hash
    for (let i = 0; i < numHandles; ++i) {
      /*
        type + value as bigint + random(32)
      */
      const clearTextValueBigInt = clearTextValuesBigInt[i];
      const fheByteLen = getFheTypeByteLength(fheTypes[i]);

      const fheType1Byte = new Uint8Array([fheTypes[i]]);
      const clearTextValueXXBytes = uintToBytes(clearTextValueBigInt, fheByteLen);
      const rand32Buffer: Uint8Array = rand32BufferList[i];

      // concatenate 32 random bytes at the end of buffer to simulate encryption noise
      encrypted = concatBytes(encrypted, fheType1Byte, clearTextValueXXBytes, rand32Buffer);
    }

    return EthersT.getBytes(EthersT.keccak256(encrypted));
  }

  public async encrypt() {
    const extraData: `0x${string}` = "0x00";

    /*
      Mock equivalent to https://github.com/zama-ai/fhevm-js/blob/main/src/relayer/sendEncryption.ts

      From sendEncryption.ts:
      =======================

        const bits = input.getBits();
        const ciphertext = input.encrypt();
        const payload = {
          contractAddress: getAddress(contractAddress),
          userAddress: getAddress(userAddress),
          ciphertextWithInputVerification: toHexString(ciphertext),
          contractChainId: '0x' + chainId.toString(16),
        };

    */
    const payload = this._toMockFhevmRelayerV1InputProofPayload(extraData);
    const mockCiphertextWithZKProof = EthersT.getBytes(payload.ciphertextWithInputVerification);

    /*
      Mock equivalent to https://github.com/zama-ai/fhevm-js/blob/main/src/relayer/sendEncryption.ts

        const url = `${relayerUrl}/v1/input-proof`;
        ...
        const response = await fetch(url, options);
        ...

      Will add the clear values to the mock database.
    */

    /*
      const payload = {
          contractAddress: getAddress(contractAddress),
          userAddress: getAddress(userAddress),
          ciphertextWithInputVerification: toHexString(ciphertext),
          contractChainId: '0x' + chainId.toString(16),
        };
        const options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        };
    */
    const response = await relayer.requestRelayerV1InputProof(this.#relayerProvider, payload);

    const handlesBytes32List = FhevmHandle.computeHandles(
      mockCiphertextWithZKProof,
      this.#fhevmTypes,
      this.#aclContractAddress,
      this.#contractChainId,
      constants.FHEVM_HANDLE_VERSION,
    );

    this.#inputVerifier.verifySignatures(
      handlesBytes32List,
      this.#userAddress,
      this.#contractAddress,
      this.#contractChainId,
      extraData,
      response.signatures,
    );

    const inputProofHex = computeInputProofHex(response.handles, response.signatures, extraData);

    return {
      handles: handlesBytes32List,
      inputProof: EthersT.toBeArray(inputProofHex),
    };
  }

  public getBits(): FhevmSdkEncryptionBitWidths[] {
    throw new FhevmError("ZKInput interface method: Not supported in mock mode");
  }
}
