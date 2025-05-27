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
import { requestRelayerV1InputProof } from "./relayer/MockRelayer.js";
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

  #provider: MinimalProvider;
  #aclContractAddress: string;
  #inputVerifier: InputVerifier;

  static readonly MAX_FHE_BITS: number = 2048;
  static readonly MAX_VAR_COUNT: number = 256;

  constructor(
    provider: MinimalProvider,
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

    this.#provider = provider;
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

  private toMockFhevmRelayerV1InputProofPayload(): MockRelayerV1InputProofPayload {
    const numHandles = this.#clearTextValues.length;
    const clearTextValuesBigIntHex: string[] = [];
    const clearTextValuesBigInt: bigint[] = [];
    const rand32BufferList: Uint8Array[] = [];
    const metadatas: FhevmDBHandleMetadata[] = [];
    for (let i = 0; i < numHandles; ++i) {
      const clearTextValueBigInt = BigInt(this.#clearTextValues[i]);
      clearTextValuesBigInt.push(clearTextValueBigInt);
      clearTextValuesBigIntHex.push(EthersT.toBeHex(clearTextValueBigInt));
      rand32BufferList.push(EthersT.randomBytes(32));
      metadatas.push({
        blockNumber: 0,
        index: 0,
        transactionHash: EthersT.ZeroHash,
      });
    }

    const mockCiphertextWithInputVerification: Uint8Array = MockRelayerEncryptedInput.computeMockCiphertextWithZKProof(
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
      mockData,
    };

    return mockPayload;
  }

  private static computeMockCiphertextWithZKProof(
    clearTextValuesBigInt: bigint[],
    fheTypes: FheType[],
    rand32BufferList: Uint8Array[],
  ): Uint8Array {
    let encrypted = new Uint8Array(0);

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
    //const numHandles = this.#clearTextValues.length;

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
    const payload = this.toMockFhevmRelayerV1InputProofPayload();
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
    const response = await requestRelayerV1InputProof(this.#provider, payload);

    // const handlesBytes32List = computeInputHandlesBytes32AsBytes(
    //   mockCiphertextWithZKProof,
    //   this.#fheTypes,
    //   this.#contractChainId,
    //   this.#aclContractAddress,
    //   constants.FHEVM_HANDLE_VERSION,
    // );

    const handlesBytes32List = FhevmHandle.computeHandles(
      mockCiphertextWithZKProof,
      this.#fhevmTypes,
      this.#aclContractAddress,
      this.#contractChainId,
      constants.FHEVM_HANDLE_VERSION,
    );

    // assertArrayOfUint8ArrayDeepEqual(handlesBytes32List, h2);

    this.#inputVerifier.verifySignatures(
      handlesBytes32List,
      this.#userAddress,
      this.#contractAddress,
      this.#contractChainId,
      response.signatures,
    );

    // const handlesBytes32HexNoPrefixList: string[] = [];
    // const handlesBytes32BigIntList: bigint[] = [];

    // assertFhevm(handlesBytes32List.length === numHandles);

    // for (let index = 0; index < numHandles; ++index) {
    //   const handleBytes32 = handlesBytes32List[index];
    //   const handleBytes32BigInt = EthersT.toBigInt(handleBytes32);
    //   const handleBytes32HexNoPrefix = uint8ArrayToHexNoPrefix(handleBytes32);

    //   assertFhevm("0x" + handleBytes32HexNoPrefix === EthersT.hexlify(handleBytes32));
    //   assertFhevm("0x" + handleBytes32HexNoPrefix === EthersT.toBeHex(handleBytes32BigInt, 32));
    //   assertFhevm(BigInt("0x" + handleBytes32HexNoPrefix) === handleBytes32BigInt);

    //   // no "0x" prefix!
    //   handlesBytes32HexNoPrefixList.push(handleBytes32HexNoPrefix);
    //   handlesBytes32BigIntList.push(handleBytes32BigInt);
    // }

    // Simulate coprocessor signature.
    // Compute Coprocessor signatures (see InputVerification.sol)
    // const eip712 = createCiphertextVerificationEIP712(
    //   this.#inputVerificationEIP712Domain.chainId!,
    //   this.#inputVerificationEIP712Domain.verifyingContract!,
    //   handlesBytes32BigIntList,
    //   this.#chainId,
    //   this.#contractAddress,
    //   this.#userAddress,
    // );
    // const signaturesHex: string[] = await multiSignEIP712(
    //   this.#inputVerifierCoprocessorSigners,
    //   eip712.domain,
    //   eip712.types,
    //   eip712.message,
    // );

    // Input proof format:
    //    <number of handles>
    //  + <number of coprocessor signers>
    //  + <list of handles as bytes32 in hex format>
    //  + signatureCoprocessorSigners (total length: 1 + 1 + 32 + numHandles*32 + numSigners*65)

    // const numHandlesHexByte1 = numberToHex(numHandles);
    // assertFhevm(numHandlesHexByte1.length === 2); // 1 byte

    // const numCoprocessorSignersHexByte1 = numberToHex(this.#inputVerifier.getCoprocessorSigners().length);
    // assertFhevm(numCoprocessorSignersHexByte1.length === 2); // 1 byte

    // // Compute inputProof
    // let inputProofHex = "0x" + numHandlesHexByte1 + numCoprocessorSignersHexByte1;

    // // Append the list of handles
    // for (let i = 0; i < numHandles; ++i) {
    //   assertFhevm(handlesBytes32HexNoPrefixList[i].length === 2 * 32);
    //   inputProofHex += handlesBytes32HexNoPrefixList[i];
    // }

    // // Append list of coprocessor signatures
    // signaturesHex.map((signatureHex) => {
    //   const signatureBytes65HexNoPrefix = removePrefix(signatureHex, "0x");
    //   assertFhevm(signatureBytes65HexNoPrefix.length === 2 * 65);
    //   inputProofHex += signatureBytes65HexNoPrefix;
    // });

    // // Verify it has been inserted in DB
    // for (let i = 0; i < handlesBytes32HexNoPrefixList.length; ++i) {
    //   const responseGetClearText = await sendFhevmGetClearText(this.#provider, [handlesBytes32HexNoPrefixList[i]]);
    //   assertFhevm(Array.isArray(responseGetClearText));
    //   assertFhevm(responseGetClearText.length === 1);
    //   assertFhevm(BigInt(responseGetClearText[0]) === BigInt(this.#clearTextValues[i]));
    // }

    // assertFhevm(computeInputProofHex(handlesBytes32HexNoPrefixList, signaturesHex) === inputProofHex);
    //assertFhevm(computeInputProofHex(response.handles, response.signatures) === inputProofHex);
    const inputProofHex = computeInputProofHex(response.handles, response.signatures);

    return {
      handles: handlesBytes32List,
      inputProof: EthersT.toBeArray(inputProofHex),
    };
  }

  public getBits(): FhevmSdkEncryptionBitWidths[] {
    throw new FhevmError("ZKInput interface method: Not supported in mock mode");
  }
}

/*

        // Note that the hex strings returned by the relayer do have have the 0x prefix
        if (json.response.handles && json.response.handles.length > 0) {
          const responseHandles = json.response.handles.map(fromHexString);
          if (handles.length != responseHandles.length) {
            throw new Error(
              `Incorrect Handles list sizes: (expected) ${handles.length} != ${responseHandles.length} (received)`,
            );
          }
          for (let index = 0; index < handles.length; index += 1) {
            let handle = handles[index];
            let responseHandle = responseHandles[index];
            let expected = toHexString(handle);
            let current = toHexString(responseHandle);
            if (expected !== current) {
              throw new Error(
                `Incorrect Handle ${index}: (expected) ${expected} != ${current} (received)`,
              );
            }
          }
        }
        const signatures = json.response.signatures;


// verify signatures for inputs:
        const domain = {
          name: 'InputVerification',
          version: '1',
          chainId: gatewayChainId,
          verifyingContract: verifyingContractAddressInputVerification,
        };
        const types = {
          CiphertextVerification: [
            { name: 'ctHandles', type: 'bytes32[]' },
            { name: 'userAddress', type: 'address' },
            { name: 'contractAddress', type: 'address' },
            { name: 'contractChainId', type: 'uint256' },
          ],
        };

        const recoveredAddresses = signatures.map((signature: string) => {
          const sig = signature.startsWith('0x') ? signature : `0x${signature}`;
          const recoveredAddress = ethers.verifyTypedData(
            domain,
            types,
            {
              ctHandles: handles,
              userAddress,
              contractAddress,
              contractChainId: chainId,
            },
            sig,
          );
          return recoveredAddress;
        });


*/
