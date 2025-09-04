import { ethers as EthersT } from "ethers";

import { assertFhevm } from "./error.js";
import { assertIsString } from "./string.js";

export function uint8ArrayToHexNoPrefix(uint8Array: Uint8Array): string {
  //return EthersT.hexlify(uint8Array).slice(2);
  return Array.from(uint8Array)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function numberToHexNoPrefix(num: number): string {
  const hex = num.toString(16);
  return hex.length % 2 ? "0" + hex : hex;
}

// Unused
export function numberToEvenHexString(num: number): string {
  if (typeof num !== "number" || num < 0) {
    throw new Error("Input should be a non-negative number.");
  }
  let hexString = num.toString(16);
  if (hexString.length % 2 !== 0) {
    hexString = "0" + hexString;
  }
  return hexString;
}

// To be removed
export const fromHexString = (hexString: string): Uint8Array => {
  const arr = hexString.replace(/^(0x)/, "").match(/.{1,2}/g);
  if (!arr) return new Uint8Array();
  return Uint8Array.from(arr.map((byte) => parseInt(byte, 16)));
};

// To be removed
export const toHexString = (bytes: Uint8Array): `0x${string}` =>
  `0x${bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "")}`;

export function assertIsHexString(value: unknown, valueName?: string): asserts value is string {
  assertIsString(value, valueName);
  assertFhevm(EthersT.isHexString(value), `${valueName ?? "value"}: ${value} is not a valid hex string.`);
}
