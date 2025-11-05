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

const HANDLE_HASH_DOMAIN_SEPARATOR = "ZK-w_hdl";
const RAW_CT_HASH_DOMAIN_SEPARATOR = "ZK-w_rct";

export function assertIsFhevmHandleBytes32Hex(value: unknown, valueName?: string): asserts value is `0x${string}` {
  assertIsBytes32String(value, valueName);
  FhevmHandle.fromBytes32Hex(value);
}

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
        https://github.com/zama-ai/fhevm/blob/8ffbd5906ab3d57af178e049930e3fc065c9d4b3/coprocessor/fhevm-engine/zkproof-worker/src/verifier.rs#L431C7-L431C8
    
        handle_hash = Bytes("ZK-w_hdl") + blobHash 32 Bytes + index 1 Byte + aclAddress 20 Bytes + chainId 32 bytes
        ===========================================================================================================

        const HANDLE_HASH_DOMAIN_SEPARATOR: [u8; 8] = *b"ZK-w_hdl";
        
        let mut handle_hash = Keccak256::new();
        handle_hash.update(HANDLE_HASH_DOMAIN_SEPARATOR);
        handle_hash.update(blob_hash);
        handle_hash.update([ct_idx as u8]);
        handle_hash.update(
            Address::from_str(&aux_data.acl_contract_address)
                .expect("valid acl_contract_address")
                .into_array(),
        );
        handle_hash.update(chain_id_bytes);
        let mut handle = handle_hash.finalize().to_vec();
        assert_eq!(handle.len(), 32);

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

    const encoder = new TextEncoder();
    const domainSepBytes = encoder.encode(HANDLE_HASH_DOMAIN_SEPARATOR);

    return EthersT.keccak256(
      concatBytes(domainSepBytes, blobHashBytes32, encryptionIndex1Byte, aclContractAddress20Bytes, chainId32Bytes),
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

    /*
      Should be identical to:
      =======================

      https://github.com/zama-ai/fhevm/blob/8ffbd5906ab3d57af178e049930e3fc065c9d4b3/coprocessor/fhevm-engine/zkproof-worker/src/verifier.rs#L431C7-L431C8
      https://github.com/zama-ai/fhevm/blob/8ffbd5906ab3d57af178e049930e3fc065c9d4b3/coprocessor/fhevm-engine/zkproof-worker/src/verifier.rs#L363    
      https://github.com/zama-ai/relayer-sdk/blob/25a9efdbf7b7413372dac0f303be0a24fa105e28/src/relayer/handles.ts#L21

      let mut h = Keccak256::new();
      h.update(RAW_CT_HASH_DOMAIN_SEPARATOR);
      h.update(raw_ct);
      let blob_hash = h.finalize().to_vec();    
    */
    const encoder = new TextEncoder();
    const domainSepBytes = encoder.encode(RAW_CT_HASH_DOMAIN_SEPARATOR);
    const blobHashBytes32Hex = EthersT.keccak256(concatBytes(domainSepBytes, ciphertextWithZKProof));

    const blobHashBytes32: Uint8Array = EthersT.getBytes(blobHashBytes32Hex);
    assertFhevm(blobHashBytes32.length === 32);

    /*

    const ENCRYPTION_TYPES = {
      2: 0, // ebool takes 2 encrypted bits
      8: 2,
      16: 3,
      32: 4,
      64: 5,
      128: 6,
      160: 7,
      256: 8,
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
