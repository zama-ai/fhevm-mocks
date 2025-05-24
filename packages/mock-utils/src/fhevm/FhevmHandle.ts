import { ethers as EthersT } from "ethers";

import constants from "../constants.js";
import { addressToBytes, assertIsAddress } from "../utils/address.js";
import {
  assertIsBytes1,
  assertIsBytes20,
  assertIsBytes32,
  assertIsBytes32String,
  concatBytes,
  uintToBytes,
} from "../utils/bytes.js";
import { FhevmError, assertFhevm } from "../utils/error.js";
import { MAX_UINT64, assertIsNumber, toUIntNumber } from "../utils/math.js";
import { FheType, type FheTypeInfo, checkFheType, getFheTypeInfo } from "./FheType.js";
import { FhevmType, type FhevmTypeInfo, checkFhevmType, getFhevmTypeInfo } from "./FhevmType.js";

export class FhevmHandle {
  #hash21: string;
  #chainId: number;
  #fhevmType: FhevmType;
  #fheType: FheType;
  #version: number;
  #computed: boolean;
  #index?: number;

  constructor(
    hash21: string,
    chainId: number,
    fhevmType: FhevmType,
    fheType: FheType,
    version: number,
    computed: boolean,
    index?: number,
  ) {
    this.#hash21 = hash21;
    this.#chainId = chainId;
    this.#fhevmType = fhevmType;
    this.#fheType = fheType;
    this.#version = version;
    this.#computed = computed;
    if (index !== undefined) {
      this.#index = index;
    }
  }

  public get hash21(): string {
    return this.#hash21;
  }
  public get chainId(): number {
    return this.#chainId;
  }
  public get fhevmType(): FhevmType {
    return this.#fhevmType;
  }
  public get fheType(): FheType {
    return this.#fheType;
  }
  public get version(): number {
    return this.#version;
  }
  public get computed(): boolean {
    return this.#computed;
  }
  public get index(): number | undefined {
    return this.#index;
  }
  public get fhevmTypeInfo(): FhevmTypeInfo {
    return getFhevmTypeInfo(this.#fhevmType);
  }
  public get fheTypeInfo(): FheTypeInfo {
    return getFheTypeInfo(this.#fheType);
  }

  /**
   * Handles have the following format:
   * [21 first random bytes from hashing] | index_21 | chainID_22...29 | type_30 | version_31
   *
   * Handle format for user inputs and ops results are as such:
   * keccak256(keccak256(CiphertextFHEList)||index_handle)[0:20] || index_handle[21] || chainID [22:29] ||  handle_type [30] || handle_version [31]
   * If the handle stems from computation, the index_handle must be set to 0xff.
   * The CiphertextFHEList actually contains: 1 byte (= N) for size of handles_list, N bytes for the handles_types : 1 per handle, then the original fhe160list raw ciphertext
   */
  public static fromBytes32Hex(handleBytes32Hex: string): FhevmHandle {
    assertFhevm(
      typeof handleBytes32Hex === "string",
      `handle argument type mismatch. Got a ${typeof handleBytes32Hex}, expecting a string.`,
    );

    if (!EthersT.isHexString(handleBytes32Hex, 32)) {
      throw new FhevmError(`Invalid handle ${handleBytes32Hex}, handle length sould be 66`);
    }

    const hash21 = handleBytes32Hex.slice(0, 44);

    // Byte 21 = index
    const handleIndexHex = handleBytes32Hex.slice(44, 46);
    let handleIndex: number = 0;
    try {
      handleIndex = toUIntNumber("0x" + handleIndexHex);
    } catch {
      throw new FhevmError(`Invalid handle ${handleBytes32Hex}, Byte 21 does not contain a valid index`);
    }

    // If the handle stems from computation, the index_handle must be set to 0xff.
    const computed: boolean = handleIndex === 255;

    // Bytes 22-29 must be the chainId
    const handleChainIdHex = handleBytes32Hex.slice(46, 62);
    let chainId: number = 0;
    try {
      chainId = toUIntNumber("0x" + handleChainIdHex);
    } catch {
      throw new FhevmError(`Invalid handle ${handleBytes32Hex}, Byte 22-29 does not contain a valid chainId`);
    }

    // Byte30: type
    const handleTypeHex = handleBytes32Hex.slice(62, 64);

    let fheType: FheType | undefined = undefined;
    let fhevmType: FhevmType | undefined = undefined;
    try {
      const t = toUIntNumber("0x" + handleTypeHex);
      fheType = t;
      fhevmType = t;
    } catch {
      throw new FhevmError(
        `Invalid handle ${handleBytes32Hex}, Byte 30 does not contain the a valid (got 0x${handleTypeHex}).`,
      );
    }

    checkFheType(fheType);
    checkFhevmType(fhevmType);

    // Byte31: handle version is 0 at this point
    const handleVersionHex = handleBytes32Hex.slice(64, 66);

    let version: number = 0;
    try {
      version = toUIntNumber("0x" + handleVersionHex);
    } catch {
      throw new FhevmError(`Invalid handle ${handleBytes32Hex}, Byte 31 does not contain a valid version number.`);
    }

    if (version !== constants.FHEVM_HANDLE_VERSION) {
      throw new FhevmError(
        `Invalid handle ${handleBytes32Hex}, Byte 31 does not contain the expected version=${constants.FHEVM_HANDLE_VERSION}, got ${version} instead`,
      );
    }

    const fhevmHandle = new FhevmHandle(
      hash21,
      chainId,
      fhevmType,
      fheType,
      version,
      computed,
      handleIndex < 255 ? handleIndex : undefined,
    );

    // For debug purpose
    // const _h = fhevmHandle.toHandleBytes32Hex();
    // if (_h !== handleBytes32Hex) {
    //   assertFhevmFailed(`${_h} === ${handleBytes32Hex}`);
    // }

    return fhevmHandle;
  }

  static verify(
    handleBytes32: string,
    expected?: {
      fhevmType?: FhevmType;
      fheType?: FheType;
      chainId?: number;
    },
  ): FhevmHandle {
    assertIsBytes32String(handleBytes32, "handleBytes32");

    if (handleBytes32 === EthersT.ZeroHash) {
      throw new FhevmError("Handle is not initialized");
    }

    const fhevmHandle = FhevmHandle.fromBytes32Hex(handleBytes32);

    if (expected?.chainId !== undefined) {
      if (fhevmHandle.chainId !== expected.chainId) {
        throw new FhevmError(
          `Chain ID mismatch for handle ${handleBytes32}, expected ${expected.chainId}, but got ${fhevmHandle.chainId} instead.`,
        );
      }
    }

    if (expected?.fhevmType !== undefined) {
      if (fhevmHandle.fhevmType !== expected.fhevmType) {
        const fhevmTypeInfo = fhevmHandle.fhevmTypeInfo;
        const expectedFhevmTypeInfo = getFhevmTypeInfo(expected.fhevmType);
        throw new FhevmError(
          `Type mismatch for handle '${handleBytes32}': expected '${expectedFhevmTypeInfo.name}', but got '${fhevmTypeInfo.name}' instead.`,
        );
      }
    }

    if (expected?.fheType !== undefined) {
      if (fhevmHandle.fheType !== expected.fheType) {
        const fheTypeInfo = fhevmHandle.fheTypeInfo;
        const expectedFheTypeInfo = getFheTypeInfo(expected.fheType);
        throw new FhevmError(
          `Type mismatch for handle '${handleBytes32}': expected '${expectedFheTypeInfo.type}', but got '${fheTypeInfo.type}' instead.`,
        );
      }
    }

    return fhevmHandle;
  }

  public toHandleBytes32(): Uint8Array {
    assertFhevm(Number(this.#fheType) === Number(this.#fhevmType));
    assertFhevm(
      (this.#index === undefined && this.#computed) ||
        (this.#index !== undefined && this.#index < 255 && !this.#computed),
    );

    const chainId32Bytes = uintToBytes(this.#chainId, 32);
    const chainId8Bytes = chainId32Bytes.subarray(24, 32);

    assertFhevm(chainId32Bytes.length === 32);
    assertFhevm(chainId8Bytes.length === 8);

    //const encryptionIndex1Byte = [this.#index === undefined ? 255 : this.#index];
    const handleHash = EthersT.getBytes(this.#hash21);

    const handleBytes32AsBytes = new Uint8Array(32);
    handleBytes32AsBytes.set(handleHash, 0);
    handleBytes32AsBytes[21] = this.#index === undefined ? 255 : this.#index;
    handleBytes32AsBytes.set(chainId8Bytes, 22);
    handleBytes32AsBytes[30] = this.#fheType;
    handleBytes32AsBytes[31] = this.#version;

    return handleBytes32AsBytes;
  }

  public toHandleBytes32Hex(): string {
    return EthersT.hexlify(this.toHandleBytes32());
  }

  public static createInputHandle(
    blobHashBytes32: Uint8Array,
    aclAddress: string,
    chainId: number,
    fhevmType: FhevmType,
    ciphertextVersion: number,
    index: number,
  ) {
    const hash21 = FhevmHandle._computeInputHash21(blobHashBytes32, aclAddress, chainId, index);
    return new FhevmHandle(
      hash21,
      chainId,
      fhevmType,
      fhevmType as unknown as FheType,
      ciphertextVersion,
      false,
      index,
    );
  }

  /**
   * blobHashBytes32 = keccak256(ciphertextWithZKProof)
   */
  private static _computeInputHash21(blobHashBytes32: Uint8Array, aclAddress: string, chainId: number, index: number) {
    /*

        handle_hash = blobHash 32 Bytes + index 1 Byte + aclAddress 20 Bytes + chainId 32 bytes
        =======================================================================================

        let mut handle_hash = Keccak256::new();
        handle_hash.update(blob_hash);
        handle_hash.update([ct_idx as u8]);
        handle_hash.update(
            Address::from_str(&aux_data.acl_contract_address)
                .expect("valid acl_contract_address")
                .into_array(),
        );
        handle_hash.update(chain_id_bytes);
        let mut handle = handle_hash.finalize().to_vec();

    */
    assertIsBytes32(blobHashBytes32, "blobHash");
    assertIsAddress(aclAddress, "aclAddress");
    assertIsNumber(index, "index");
    assertIsNumber(chainId, "chainId");

    const encryptionIndex1Byte = new Uint8Array([index]);
    const aclContractAddress20Bytes = addressToBytes(aclAddress, "ACL address");
    const chainId32Bytes = uintToBytes(chainId, 32);

    assertIsBytes1(encryptionIndex1Byte);
    assertIsBytes20(aclContractAddress20Bytes);
    assertIsBytes32(chainId32Bytes);

    return EthersT.keccak256(
      concatBytes(blobHashBytes32, encryptionIndex1Byte, aclContractAddress20Bytes, chainId32Bytes),
    );
  }

  public static computeHandlesHex(
    ciphertextWithZKProof: Uint8Array,
    fhevmTypes: FhevmType[],
    aclContractAddress: string,
    chainId: number,
    ciphertextVersion: number,
  ): string[] {
    const handlesAsBytes: Uint8Array[] = FhevmHandle.computeHandles(
      ciphertextWithZKProof,
      fhevmTypes,
      aclContractAddress,
      chainId,
      ciphertextVersion,
    );
    return handlesAsBytes.map(EthersT.hexlify);
  }

  public static computeHandles(
    ciphertextWithZKProof: Uint8Array,
    fhevmTypes: FhevmType[],
    aclContractAddress: string,
    chainId: number,
    ciphertextVersion: number,
  ): Uint8Array[] {
    if (BigInt(chainId) > MAX_UINT64) {
      throw new FhevmError("ChainId exceeds maximum allowed value (8 bytes)"); // fhevm assumes chainID is only taking up to 8 bytes
    }

    // Should be identical to:
    // https://github.com/zama-ai/fhevm-backend/blob/bae00d1b0feafb63286e94acdc58dc88d9c481bf/fhevm-engine/zkproof-worker/src/verifier.rs#L301
    const blobHashBytes32Hex = EthersT.keccak256(ciphertextWithZKProof);

    const blobHashBytes32: Uint8Array = EthersT.getBytes(blobHashBytes32Hex);
    assertFhevm(blobHashBytes32.length === 32);

    /*

    const ENCRYPTION_TYPES = {
      1: 0, // ebool takes 2 encrypted bits
      8: 2,
      16: 3,
      32: 4,
      64: 5,
      128: 6,
      160: 7,
      256: 8,
      512: 9,
      1024: 10,
      2048: 11,
    };

    */
    const handles = fhevmTypes.map((fhevmType, encryptionIndex) => {
      const fhevmHandle = FhevmHandle.createInputHandle(
        blobHashBytes32,
        aclContractAddress,
        chainId,
        fhevmType,
        ciphertextVersion,
        encryptionIndex,
      );
      return fhevmHandle.toHandleBytes32();
    });

    return handles;
  }
}

/*
private static computeMockCiphertextWithZKProof(
    clearTextValuesBigInt: bigint[],
    fheTypes: FheType[],
    rand32BufferList: Buffer[],
  ): Uint8Array {
    let encrypted = Buffer.alloc(0);

    const numHandles = clearTextValuesBigInt.length;

    assertHHFhevm(rand32BufferList.length === numHandles);
    assertHHFhevm(fheTypes.length === numHandles);

    // 1. Build the typed values hash
    for (let i = 0; i < numHandles; ++i) {
      //type + value as bigint + random(32)
      const clearTextValueBigInt = clearTextValuesBigInt[i];
      const fheByteLen = getFheTypeByteLength(fheTypes[i]);

      const fheTypeBuffer = Buffer.from([fheTypes[i]]);
      const clearTextValueBuffer = toBufferBE(clearTextValueBigInt, fheByteLen);
      const rand32Buffer = rand32BufferList[i];

      // concatenate 32 random bytes at the end of buffer to simulate encryption noise
      const encBuffer = Buffer.concat([fheTypeBuffer, clearTextValueBuffer, rand32Buffer]);

      encrypted = Buffer.concat([encrypted, encBuffer]);
    }

    return new Uint8Array(new Keccak(256).update(Buffer.from(new Uint8Array(encrypted))).digest());
  }

*/

/*
const closestPP = getClosestPP();
      const pp = publicParams[closestPP]!.publicParams;
      const buffContract = fromHexString(contractAddress);
      const buffUser = fromHexString(userAddress);
      const buffAcl = fromHexString(aclContractAddress);
      const buffChainId = fromHexString(chainId.toString(16).padStart(64, '0'));
      const auxData = new Uint8Array(
        buffContract.length + buffUser.length + buffAcl.length + 32, // buffChainId.length,
      );
      auxData.set(buffContract, 0);
      auxData.set(buffUser, 20);
      auxData.set(buffAcl, 40);
      auxData.set(buffChainId, auxData.length - buffChainId.length);
      const encrypted = builder.build_with_proof_packed(
        pp,
        auxData,
        ZkComputeLoad.Verify,
      );
      ciphertextWithZKProof = encrypted.safe_serialize(
        SERIALIZED_SIZE_LIMIT_CIPHERTEXT,
      );
      return ciphertextWithZKProof;
*/

/*

// Compute input handle
export function computeInputHandlesBytes32AsBytes(
  ciphertextWithZKProof: Uint8Array | string,
  encryptionTypes: FheType[],
  chainId: number,
  aclContractAddress: string,
  ciphertextVersion: number,
): Uint8Array[] {
  const ciphertextWithZKProofUint8Array: Uint8Array =
    typeof ciphertextWithZKProof === "string" ? EthersT.toBeArray(aclContractAddress) : ciphertextWithZKProof;

  const blobHash = new Keccak(256).update(Buffer.from(ciphertextWithZKProofUint8Array)).digest();
  const aclContractAddress20Bytes = Buffer.from(EthersT.toBeArray(aclContractAddress));

  const chainId32Bytes = Buffer.from(new Uint8Array(toBufferBE(BigInt(chainId), 32)));
  const chainId8Bytes = chainId32Bytes.subarray(24, 32);

  const handlesBytes32AsBytes: Uint8Array[] = encryptionTypes.map(
    (encryptionType: FheType, encryptionIndex: number) => {
      const encryptionIndex1Byte = Buffer.from([encryptionIndex]);

      const handleHashBuffer = Buffer.concat([
        blobHash,
        encryptionIndex1Byte,
        aclContractAddress20Bytes,
        chainId32Bytes,
      ]);
      const handleHash = new Keccak(256).update(handleHashBuffer).digest();

      const handleBytes32AsBytes = new Uint8Array(32);
      handleBytes32AsBytes.set(handleHash, 0);

      handleBytes32AsBytes[21] = encryptionIndex;
      chainId8Bytes.copy(handleBytes32AsBytes, 22);
      handleBytes32AsBytes[30] = encryptionType;
      handleBytes32AsBytes[31] = ciphertextVersion;

      return handleBytes32AsBytes;
    },
  );

  return handlesBytes32AsBytes;
}


*/

/*
  public static computeHandles(
    ciphertextWithZKProof: Uint8Array,
    fhevmTypes: FhevmType[],
    aclContractAddress: string,
    chainId: number,
    ciphertextVersion: number,
  ): Uint8Array[] {

// Compute input handle (used by provider, must be moved to base)
export function computeInputHandlesBytes32AsBytes(
  ciphertextWithZKProof: Uint8Array | string,
  encryptionTypes: FheType[],
  chainId: number,
  aclContractAddress: string,
  ciphertextVersion: number,
): Uint8Array[] {
  const ciphertextWithZKProofUint8Array: Uint8Array =
    typeof ciphertextWithZKProof === "string" ? EthersT.toBeArray(aclContractAddress) : ciphertextWithZKProof;

  const blobHash = new Keccak(256).update(Buffer.from(ciphertextWithZKProofUint8Array)).digest();
  const aclContractAddress20Bytes = Buffer.from(EthersT.toBeArray(aclContractAddress));

  const chainId32Bytes = Buffer.from(new Uint8Array(toBufferBE(BigInt(chainId), 32)));
  const chainId8Bytes = chainId32Bytes.subarray(24, 32);

  const handlesBytes32AsBytes: Uint8Array[] = encryptionTypes.map(
    (encryptionType: FheType, encryptionIndex: number) => {
      const encryptionIndex1Byte = Buffer.from([encryptionIndex]);

      const handleHashBuffer = Buffer.concat([
        blobHash,
        encryptionIndex1Byte,
        aclContractAddress20Bytes,
        chainId32Bytes,
      ]);
      const handleHash = new Keccak(256).update(handleHashBuffer).digest();

      const handleBytes32AsBytes = new Uint8Array(32);
      handleBytes32AsBytes.set(handleHash, 0);

      handleBytes32AsBytes[21] = encryptionIndex;
      chainId8Bytes.copy(handleBytes32AsBytes, 22);
      handleBytes32AsBytes[30] = encryptionType;
      handleBytes32AsBytes[31] = ciphertextVersion;

      return handleBytes32AsBytes;
    },
  );

  return handlesBytes32AsBytes;
}

*/
