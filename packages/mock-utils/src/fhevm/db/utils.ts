import { assertIsBytes32String } from "../../utils/bytes.js";
import { FhevmError } from "../../utils/error.js";
import { assertIsHexString } from "../../utils/hex.js";
import { assertIsUintNumber } from "../../utils/math.js";
import type { FhevmDBEntry, FhevmDBHandleMetadata } from "./FhevmDB.js";

export function checkInsertArgs(handleBytes32Hex: string, clearText: bigint | string, metadata: FhevmDBHandleMetadata) {
  assertIsBytes32String(handleBytes32Hex);
  assertIsBytes32String(metadata.transactionHash);
  assertIsUintNumber(metadata.blockNumber);
  assertIsUintNumber(metadata.index);

  if (typeof clearText !== "bigint" && typeof clearText !== "string") {
    throw new FhevmError(`Invalid clearText argument, expecting bigint or string, got ${typeof clearText} instead`);
  }

  if (typeof clearText === "string") {
    assertIsHexString(clearText, "clearText argument");
  }
}

export function checkQueryArgs(handleBytes32Hex: string) {
  assertIsBytes32String(handleBytes32Hex);
}

export function fhevmDBEntryToString(entry: FhevmDBEntry) {
  return `${entry.metadata.blockNumber}:${entry.metadata.index}:${entry.metadata.transactionHash}:${entry.clearTextHex}`;
}

export function stringToFhevmDBEntry(str: string): FhevmDBEntry {
  const elements = str.split(":");
  return {
    clearTextHex: elements[3],
    metadata: {
      blockNumber: Number.parseInt(elements[0]),
      index: Number.parseInt(elements[1]),
      transactionHash: elements[2],
    },
  };
}
