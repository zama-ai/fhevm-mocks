import assert from "assert";
import { toBufferBE } from "bigint-buffer";
import { ethers as EthersT } from "ethers";
import { Keccak } from "sha3";

import { HardhatFhevmError } from "../../error";
import { assertAddress, assertBytes32 } from "../utils/ethers";
import { toUIntNumber } from "../utils/math";
import { FheType } from "./FheType";
import { checkFheType } from "./FheType";
import { FhevmType, FhevmTypeInfo, checkFhevmType, getFhevmTypeInfo } from "./FhevmType";

export type FhevmHandle = {
  chainId: number;
  fhevmType: FhevmType;
  fheType: FheType;
  version: number;
  computed: boolean;
};

export function getFhevmHandleTypeInfo(fhevmHandle: FhevmHandle): FhevmTypeInfo {
  return getFhevmTypeInfo(fhevmHandle.fhevmType);
}

export function getFhevmHandleClearTextBitLength(fhevmHandle: FhevmHandle): number {
  return getFhevmHandleTypeInfo(fhevmHandle).clearTextBitLength;
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
export function parseFhevmHandle(handleBytes32: string): FhevmHandle {
  assert(
    typeof handleBytes32 === "string",
    `handle argument type mismatch. Got a ${typeof handleBytes32}, expecting a string.`,
  );

  if (handleBytes32.length !== 66) {
    throw new Error(`Invalid handle ${handleBytes32}, handle length sould be 66`);
  }

  // Byte 21 = index
  const handleIndexHex = handleBytes32.slice(44, 46);
  let handleIndex: number = 0;
  try {
    handleIndex = toUIntNumber("0x" + handleIndexHex);
  } catch {
    throw new Error(`Invalid handle ${handleBytes32}, Byte 21 does not contain a valid index`);
  }

  // If the handle stems from computation, the index_handle must be set to 0xff.
  const computed: boolean = handleIndex === 255;

  // Bytes 22-29 must be the chainId
  const handleChainIdHex = handleBytes32.slice(46, 62);
  let chainId: number = 0;
  try {
    chainId = toUIntNumber("0x" + handleChainIdHex);
  } catch {
    throw new Error(`Invalid handle ${handleBytes32}, Byte 22-29 does not contain a valid chainId`);
  }

  // Byte30: type
  const handleTypeHex = handleBytes32.slice(62, 64);
  let fheType: FheType = 0;
  let fhevmType: FhevmType = 0;
  try {
    const t = toUIntNumber("0x" + handleTypeHex);
    fheType = t;
    fhevmType = t;
  } catch {
    throw new Error(`Invalid handle ${handleBytes32}, Byte 30 does not contain the a valid (got 0x${handleTypeHex}).`);
  }

  checkFheType(fheType);
  checkFhevmType(fhevmType);

  // Byte31: handle version is 0 at this point
  const handleVersionHex = handleBytes32.slice(64, 66);
  if (handleVersionHex !== "00") {
    throw new Error(
      `Invalid handle ${handleBytes32}, Byte 31 does not contain the expected version=00, got ${handleVersionHex} instead`,
    );
  }

  let version: number = 0;
  try {
    version = toUIntNumber("0x" + handleTypeHex);
  } catch {
    throw new Error(`Invalid handle ${handleBytes32}, Byte 31 does not contain a valid version number.`);
  }

  return {
    chainId,
    fhevmType,
    fheType,
    version,
    computed,
  };
}

export function verifyFhevmHandle(
  handleBytes32: string,
  expectedFhevmType?: FhevmType,
  expectedFheType?: FheType,
  expectedChainId?: number,
): FhevmHandle {
  assertBytes32(handleBytes32, "handleBytes32");

  if (handleBytes32 === EthersT.ZeroHash) {
    throw new HardhatFhevmError("Handle is not initialized");
  }

  const fhevmHandle = parseFhevmHandle(handleBytes32);

  if (expectedChainId !== undefined) {
    if (fhevmHandle.chainId !== expectedChainId) {
      throw new HardhatFhevmError(
        `Invalid handle ${handleBytes32}, chainId mismatch, expected chainId=${expectedChainId}, got ${fhevmHandle.chainId} instead.`,
      );
    }
  }

  if (expectedFheType !== undefined) {
    if (fhevmHandle.fheType !== expectedFheType) {
      throw new HardhatFhevmError(
        `Invalid handle ${handleBytes32}, type mismatch, expected type=${expectedFheType}, got ${fhevmHandle.fheType} instead.`,
      );
    }
  }

  if (expectedFhevmType !== undefined) {
    if (fhevmHandle.fhevmType !== expectedFhevmType) {
      throw new HardhatFhevmError(
        `Invalid handle ${handleBytes32}, type mismatch, expected type=${expectedFhevmType}, got ${fhevmHandle.fhevmType} instead.`,
      );
    }
  }

  return fhevmHandle;
}

export function computeFhevmHandles(
  ciphertextWithZKProof: Uint8Array,
  encryptionTypes: FheType[],
  ciphertextVersion: number,
  chainId: number,
  aclContractAddress: string,
) {
  const blobHash = new Keccak(256).update(Buffer.from(ciphertextWithZKProof)).digest();
  const aclContractAddress20Bytes = Buffer.from(EthersT.toBeArray(aclContractAddress));

  const chainId32Bytes = Buffer.from(new Uint8Array(toBufferBE(BigInt(chainId), 32)));
  const chainId8Bytes = chainId32Bytes.subarray(24, 32);

  const handlesBytes32 = encryptionTypes.map((encryptionType: FheType, encryptionIndex: number) => {
    const encryptionIndex1Byte = Buffer.from([encryptionIndex]);

    const handleHashBuffer = Buffer.concat([blobHash, encryptionIndex1Byte, aclContractAddress20Bytes, chainId32Bytes]);
    const handleHash = new Keccak(256).update(handleHashBuffer).digest();

    const handleBytes32 = new Uint8Array(32);
    handleBytes32.set(handleHash, 0);

    handleBytes32[21] = encryptionIndex;
    chainId8Bytes.copy(handleBytes32, 22);
    handleBytes32[30] = encryptionType;
    handleBytes32[31] = ciphertextVersion;

    return handleBytes32;
  });

  return handlesBytes32;
}

export function buildDeterministicContractAddressesList(
  contractAddresses: ({ contractAddress: string } | string)[],
): string[] {
  const set = new Set<string>();

  // Build a list of unique allowed contact addresses.
  for (let i = 0; i < contractAddresses.length; ++i) {
    const ca = contractAddresses[i];
    let contractAddress: string;
    if (typeof ca === "string") {
      contractAddress = ca;
    } else {
      contractAddress = ca.contractAddress;
    }
    const add = EthersT.getAddress(contractAddress);
    if (!set.has(add)) {
      set.add(add);
    }
  }

  // Sort by alphabetical order, user lowercase comparison
  return [...set].sort((a, b) => {
    const addrA = a.toLowerCase(); // ignore upper and lowercase
    const addrB = b.toLowerCase(); // ignore upper and lowercase
    if (addrA < addrB) {
      return -1;
    }
    if (addrA > addrB) {
      return 1;
    }
    return 0;
  });
}

export function verifyContractAddresses(contractAddresses: ({ contractAddress: string } | string)[]) {
  if (contractAddresses.length === 0) {
    throw new HardhatFhevmError("Empty list of contract addresses.");
  }

  for (let i = 0; i < contractAddresses.length; ++i) {
    const ca = contractAddresses[i];

    let contractAddress: string;
    if (typeof ca === "string") {
      contractAddress = ca;
    } else {
      contractAddress = ca.contractAddress;
    }
    assertAddress(contractAddress, "contractAddress");
  }
}

export function verifyFhevmHandleContractPairs(
  handleContractPairs: { handleBytes32: string; contractAddress: string; fhevmType?: FhevmType; fheType?: FheType }[],
  chainId?: number,
) {
  if (handleContractPairs.length === 0) {
    throw new HardhatFhevmError("Empty list of handle/contract pairs.");
  }

  for (let i = 0; i < handleContractPairs.length; ++i) {
    const pair = handleContractPairs[i];

    verifyFhevmHandle(pair.handleBytes32, pair.fhevmType, pair.fheType, chainId);

    assertAddress(pair.contractAddress, "contractAddress");
  }
}
