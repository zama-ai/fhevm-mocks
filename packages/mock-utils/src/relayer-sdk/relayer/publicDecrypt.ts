/*
    Copy/Paste from https://github.com/zama-ai/relayer-sdk/blob/main/src/relayer/publicDecrypt.ts
*/
import { ethers as EthersT } from "ethers";

import type { FhevmHandle } from "../../fhevm/FhevmHandle.js";
import type { FhevmType } from "../../fhevm/FhevmType.js";
import type { ClearValueType, ClearValues } from "../types.js";

// Duplicated code from relayer-sdk/src/relayer/publicDecrypt.ts
const CiphertextType: Record<number, "bool" | "uint256" | "address" | "bytes"> = {
  0: "bool",
  2: "uint256",
  3: "uint256",
  4: "uint256",
  5: "uint256",
  6: "uint256",
  7: "address",
  8: "uint256",
};

// Duplicated code from relayer-sdk/src/relayer/publicDecrypt.ts
export function deserializeClearValues(
  orderedFhevmHandles: FhevmHandle[],
  decryptedResult: `0x${string}`,
): ClearValues {
  let fheTypeIdList: FhevmType[] = [];
  for (const fhevmHandle of orderedFhevmHandles) {
    fheTypeIdList.push(fhevmHandle.fhevmType);
  }

  const restoredEncoded =
    "0x" +
    "00".repeat(32) + // dummy requestID (ignored)
    decryptedResult.slice(2) +
    "00".repeat(32); // dummy empty bytes[] length (ignored)

  const abiTypes = fheTypeIdList.map((t: FhevmType) => {
    const abiType = CiphertextType[t]; // all types are valid because this was supposedly checked already inside the `checkEncryptedBits` function
    return abiType;
  });

  const coder = new EthersT.AbiCoder();
  const decoded = coder.decode(["uint256", ...abiTypes, "bytes[]"], restoredEncoded);

  // strip dummy first/last element
  const rawValues = decoded.slice(1, 1 + fheTypeIdList.length);

  const results: Record<string, ClearValueType> = {};

  orderedFhevmHandles.forEach((fhevmHandle, idx) => (results[fhevmHandle.toHandleBytes32Hex()] = rawValues[idx]));

  return results;
}
