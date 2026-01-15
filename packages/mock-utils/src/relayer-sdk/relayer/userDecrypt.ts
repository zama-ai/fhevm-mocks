/*
    This file contains duplicated code from relayer-sdk/src/relayer/userDecrypt.ts
*/
import { ethers as EthersT } from "ethers";

import { FhevmError } from "../../utils/error.js";
import type { ClearValueType, UserDecryptResults } from "../types.js";

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
// Modified to remove ebytes
function formatAccordingToType(decryptedBigInt: bigint, type: number): ClearValueType {
  if (type === 0) {
    // ebool
    return decryptedBigInt === BigInt(1);
  } else if (type === 7) {
    // eaddress
    return EthersT.getAddress("0x" + decryptedBigInt.toString(16).padStart(40, "0")) as `0x${string}`;
  } else if (type === 9 || type === 10 || type === 11 || type === 1) {
    // deprecated ebytes64
    throw new FhevmError(`Deprecated ebytes type ${type}`);
  } // euintXXX
  return decryptedBigInt;
}

export function buildUserDecryptResults(handles: `0x${string}`[], listBigIntDecryptions: bigint[]): UserDecryptResults {
  let typesList: number[] = [];
  for (const handle of handles) {
    const hexPair = handle.slice(-4, -2).toLowerCase();
    const typeDiscriminant = parseInt(hexPair, 16);
    typesList.push(typeDiscriminant);
  }

  const results: UserDecryptResults = {};
  handles.forEach(
    (handle, idx) =>
      ((results as Record<`0x${string}`, ClearValueType>)[handle] = formatAccordingToType(
        listBigIntDecryptions[idx],
        typesList[idx],
      )),
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
