/*
    This file contains duplicated code from relayer-sdk/src/relayer/userDecrypt.ts
*/
import { ethers as EthersT } from "ethers";

import { FhevmError } from "../../utils/error.js";
import type { DecryptedResults } from "../types.js";

const MAX_USER_DECRYPT_CONTRACT_ADDRESSES: number = 10;
const MAX_USER_DECRYPT_DURATION_DAYS: bigint = 365n;

// Duplicated code from relayer-sdk/src/relayer/userDecrypt.ts
export function checkDeadlineValidity(startTimestamp: bigint, durationDays: bigint) {
  if (durationDays === BigInt(0)) {
    throw new FhevmError("durationDays is null");
  }

  if (durationDays > MAX_USER_DECRYPT_DURATION_DAYS) {
    throw new FhevmError(`durationDays is above max duration of ${MAX_USER_DECRYPT_DURATION_DAYS}`);
  }

  const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
  if (startTimestamp > currentTimestamp) {
    throw new FhevmError("startTimestamp is set in the future");
  }

  const durationInSeconds = durationDays * BigInt(86400);
  if (startTimestamp + durationInSeconds < currentTimestamp) {
    throw new FhevmError("User decrypt request has expired");
  }
}

// Duplicated code from relayer-sdk/src/relayer/userDecrypt.ts
function formatAccordingToType(decryptedBigInt: bigint, type: number): boolean | bigint | string {
  if (type === 0) {
    // ebool
    return decryptedBigInt === BigInt(1);
  } else if (type === 7) {
    // eaddress
    return EthersT.getAddress("0x" + decryptedBigInt.toString(16).padStart(40, "0"));
  } else if (type === 9) {
    // ebytes64
    return "0x" + decryptedBigInt.toString(16).padStart(128, "0");
  } else if (type === 10) {
    // ebytes128
    return "0x" + decryptedBigInt.toString(16).padStart(256, "0");
  } else if (type === 11) {
    // ebytes256
    return "0x" + decryptedBigInt.toString(16).padStart(512, "0");
  } // euintXXX
  return decryptedBigInt;
}

// Duplicated code from relayer-sdk/src/relayer/userDecrypt.ts
export function buildUserDecryptedResult(handles: string[], listBigIntDecryptions: bigint[]): DecryptedResults {
  let typesList: number[] = [];
  for (const handle of handles) {
    const hexPair = handle.slice(-4, -2).toLowerCase();
    const typeDiscriminant = parseInt(hexPair, 16);
    typesList.push(typeDiscriminant);
  }

  let results: DecryptedResults = {};
  handles.forEach(
    (handle, idx) => (results[handle] = formatAccordingToType(listBigIntDecryptions[idx], typesList[idx])),
  );

  return results;
}

export function checkMaxContractAddresses(contractAddresses: string[]) {
  const contractAddressesLength = contractAddresses.length;
  if (contractAddressesLength === 0) {
    throw new FhevmError("contractAddresses is empty");
  }
  if (contractAddressesLength > MAX_USER_DECRYPT_CONTRACT_ADDRESSES) {
    throw new FhevmError(`contractAddresses max length of ${MAX_USER_DECRYPT_CONTRACT_ADDRESSES} exceeded`);
  }
}
