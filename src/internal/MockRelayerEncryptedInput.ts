import { ENCRYPTION_TYPES } from "@fhevm/sdk/lib/sdk/encryptionTypes";
import { RelayerEncryptedInput } from "@fhevm/sdk/node";
import assert from "assert";
import { toBufferBE } from "bigint-buffer";
import crypto from "crypto";
import { ethers as EthersT } from "ethers";
import { Keccak } from "sha3";

import constants from "../constants";
import { HardhatFhevmError } from "../error";
import { FhevmEnvironment } from "./FhevmEnvironment";
import { FheType, getFheTypeBitLength, getFheTypeByteLength } from "./handle/FheType";
import { FhevmType, FhevmTypeToFheType, getFhevmTypeInfo, isFhevmEbytes, isFhevmEuint } from "./handle/FhevmType";
import { computeFhevmHandles } from "./handle/handle";
import { createCiphertextVerificationEIP712 } from "./sign";
import { multiSignEIP712 } from "./utils/ethers";
import { numberToHex, removePrefix, uint8ArrayToHexNoPrefix } from "./utils/hex";
import { MAX_UINT64, boolToBigInt, getMaxBigInt } from "./utils/math";

type FhevmSdkEncryptionBitWidths = keyof typeof ENCRYPTION_TYPES;

export class MockRelayerEncryptedInput implements RelayerEncryptedInput {
  #clearTextValues: (bigint | string)[] = [];
  #fhevmTypes: FhevmType[] = [];
  #fheTypes: FheType[] = [];
  #totalFheBits: number = 0;

  #chainId: number;
  #contractAddress: string;
  #userAddress: string;

  #fhevmEnv: FhevmEnvironment;
  #aclContractAddress: string;
  #inputVerificationEIP712Domain: EthersT.TypedDataDomain;
  #coprocessorSigners: EthersT.Signer[];

  static readonly MAX_FHE_BITS: number = 2048;
  static readonly MAX_VAR_COUNT: number = 256;

  constructor(
    fhevmEnv: FhevmEnvironment,
    chainId: number,
    contractAddress: string,
    userAddress: string,
    aclContractAddress: string,
    inputVerificationEIP712Domain: EthersT.TypedDataDomain,
    coprocessorSigners: EthersT.Signer[],
  ) {
    // Check if chainId exceeds 8 bytes
    if (BigInt(chainId) > MAX_UINT64) {
      throw new Error("ChainId exceeds maximum allowed value (8 bytes)"); // fhevm assumes chainID is only taking up to 8 bytes
    }

    this.#fhevmEnv = fhevmEnv;
    this.#chainId = chainId;
    this.#contractAddress = contractAddress;
    this.#userAddress = userAddress;
    this.#aclContractAddress = aclContractAddress;
    this.#inputVerificationEIP712Domain = inputVerificationEIP712Domain;
    this.#coprocessorSigners = coprocessorSigners;
  }

  private _checkAddFheBits(fheBitLen: number) {
    assert(fheBitLen >= 0);
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

    assert(this.#clearTextValues.length <= MockRelayerEncryptedInput.MAX_VAR_COUNT);
    assert(this.#totalFheBits <= MockRelayerEncryptedInput.MAX_FHE_BITS);
    assert(this.#clearTextValues.length === this.#fheTypes.length);
    assert(this.#clearTextValues.length === this.#fhevmTypes.length);
  }

  private _addBytes(clearTextValue: Uint8Array, fhevmType: FhevmType): MockRelayerEncryptedInput {
    assert(isFhevmEbytes(fhevmType));

    const fhevmTypeInfo = getFhevmTypeInfo(fhevmType);
    const fheBitLen = getFheTypeBitLength(fhevmTypeInfo.fheType);
    const clearTextBitLen = fhevmTypeInfo.clearTextBitLength;

    // For bytes, cleatText bit length and cypherText bit length are the same
    assert(clearTextBitLen === fheBitLen);
    assert(fheBitLen % 8 === 0);

    const fheByteLen = fheBitLen / 8;

    if (clearTextValue.length > fheByteLen) {
      throw new HardhatFhevmError(
        `Uncorrect length of input Uint8Array, should be ${fheByteLen} for an ${fhevmTypeInfo.name}`,
      );
    }

    const clearTextValueBigInt: bigint = EthersT.toBigInt(clearTextValue);
    const maxClearTextValueBigInt: bigint = getMaxBigInt(clearTextBitLen);
    //const clearTextValueBigInt : bigint = bytesToBigInt(clearTextValue);

    assert(clearTextValue.length * 8 === fheBitLen);
    assert(clearTextValueBigInt <= maxClearTextValueBigInt);

    this._addClearTextValueFheBitsPair(clearTextValueBigInt, fhevmType);

    return this;
  }

  private _addUint(clearTextValue: number | bigint, fhevmzType: FhevmType): MockRelayerEncryptedInput {
    assert(isFhevmEuint(fhevmzType));

    const fhevmTypeInfo = getFhevmTypeInfo(fhevmzType);
    const clearTextBitLen = fhevmTypeInfo.clearTextBitLength;

    if (clearTextValue < 0) {
      throw new HardhatFhevmError(`Invalid unsigned integer value ${clearTextValue}`);
    }

    const clearTextValueBigInt: bigint = BigInt(clearTextValue);
    const maxClearTextValueBigInt: bigint = getMaxBigInt(clearTextBitLen);

    if (clearTextValueBigInt > maxClearTextValueBigInt) {
      throw new HardhatFhevmError(
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

  public async encrypt() {
    let encrypted = Buffer.alloc(0);

    const numHandles = this.#clearTextValues.length;
    const numCoprocessorSigners = 1;

    // 1. Build the typed values hash
    for (let i = 0; i < numHandles; ++i) {
      /*
        type + value as bigint + random(32)
      */
      const clearTextValueBigInt = BigInt(this.#clearTextValues[i]);
      const fheByteLen = getFheTypeByteLength(this.#fheTypes[i]);

      const fheTypeBuffer = Buffer.from([this.#fheTypes[i]]);
      const clearTextValueBuffer = toBufferBE(clearTextValueBigInt, fheByteLen);
      const rand32Buffer = crypto.randomBytes(32);

      // concatenate 32 random bytes at the end of buffer to simulate encryption noise
      const encBuffer = Buffer.concat([fheTypeBuffer, clearTextValueBuffer, rand32Buffer]);

      encrypted = Buffer.concat([encrypted, encBuffer]);
    }

    const encryptedArray = new Uint8Array(encrypted);
    const mockCiphertextWithZKProof = new Keccak(256).update(Buffer.from(encryptedArray)).digest();

    // 2. Build list of handleBytes32
    const handlesBytes32HexNoPrefixList: string[] = [];
    const handlesBytes32BigIntList: bigint[] = [];

    const handlesBytes32List = computeFhevmHandles(
      mockCiphertextWithZKProof,
      this.#fheTypes,
      constants.FHEVM_HANDLE_VERSION,
      this.#chainId,
      this.#aclContractAddress,
    );

    assert(handlesBytes32List.length === numHandles);

    for (let index = 0; index < numHandles; ++index) {
      const handleBytes32 = handlesBytes32List[index];
      const handleBytes32BigInt = EthersT.toBigInt(handleBytes32);
      const handleBytes32HexNoPrefix = uint8ArrayToHexNoPrefix(handleBytes32);

      assert("0x" + handleBytes32HexNoPrefix === EthersT.hexlify(handleBytes32));
      assert("0x" + handleBytes32HexNoPrefix === EthersT.toBeHex(handleBytes32BigInt, 32));
      assert(BigInt("0x" + handleBytes32HexNoPrefix) === handleBytes32BigInt);

      // no "0x" prefix!
      handlesBytes32HexNoPrefixList.push(handleBytes32HexNoPrefix);
      handlesBytes32BigIntList.push(handleBytes32BigInt);
    }

    // 3. Simulate coprocessor signature.
    //    Compute Coprocessor signatures (see InputVerification.sol)
    const eip712 = createCiphertextVerificationEIP712(
      this.#inputVerificationEIP712Domain.chainId!,
      this.#inputVerificationEIP712Domain.verifyingContract!,
      handlesBytes32BigIntList,
      this.#chainId,
      this.#contractAddress,
      this.#userAddress,
    );
    const signaturesHex: string[] = await multiSignEIP712(
      this.#coprocessorSigners,
      eip712.domain,
      eip712.types,
      eip712.message,
    );

    // Input proof format:
    //    <number of handles>
    //  + <number of coprocessor signers>
    //  + <list of handles as bytes32 in hex format>
    //  + signatureCoprocessorSigners (total length: 1 + 1 + 32 + numHandles*32 + numSigners*65)

    const numHandlesHexByte1 = numberToHex(numHandles);
    assert(numHandlesHexByte1.length === 2); // 1 byte

    const numCoprocessorSignersHexByte1 = numberToHex(numCoprocessorSigners);
    assert(numCoprocessorSignersHexByte1.length === 2); // 1 byte

    let inputProofHex = "0x" + numHandlesHexByte1 + numCoprocessorSignersHexByte1;

    // Append the list of handles
    for (let i = 0; i < numHandles; ++i) {
      assert(handlesBytes32HexNoPrefixList[i].length === 2 * 32);
      inputProofHex += handlesBytes32HexNoPrefixList[i];
    }

    // Append list of coprocessor signatures
    signaturesHex.map((signatureHex) => {
      const signatureBytes65HexNoPrefix = removePrefix(signatureHex, "0x");
      assert(signatureBytes65HexNoPrefix.length === 2 * 65);
      inputProofHex += signatureBytes65HexNoPrefix;
    });

    // Add values to Mock SQL DB
    for (let i = 0; i < handlesBytes32HexNoPrefixList.length; ++i) {
      await this.#fhevmEnv.db.sqlInsertHandleBytes32(
        "0x" + handlesBytes32HexNoPrefixList[i],
        BigInt(this.#clearTextValues[i]),
      );
    }

    return {
      handles: handlesBytes32List,
      inputProof: EthersT.toBeArray(inputProofHex),
    };
  }

  public getBits(): FhevmSdkEncryptionBitWidths[] {
    throw new HardhatFhevmError("ZKInput interface method: Not supported in mock mode");
  }
}
