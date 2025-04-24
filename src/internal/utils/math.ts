import { ethers as EthersT } from "ethers";

export const MAX_UINT64 = BigInt("18446744073709551615"); // 2^64 - 1

export function toUIntNumber(value: EthersT.BigNumberish, name?: string): number {
  try {
    const bn = EthersT.getUint(value, name);
    return EthersT.getNumber(bn);
  } catch {
    throw new Error(`${name} is not a positive integer`);
  }
}

export function isInt(value: unknown) {
  if (typeof value === "bigint") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isInteger(value);
  }
  return false;
}

export function isUInt(value: unknown) {
  if (!isInt(value)) {
    return false;
  }
  return (value as bigint | number) >= 0;
}

export function isEvenUInt(value: unknown) {
  if (!isUInt(value)) {
    return false;
  }
  const v = value as bigint | number;
  return typeof v === "bigint" ? v % 2n === 0n : v % 2 === 0;
}

export function boolToBigInt(value: number | bigint | boolean): 0n | 1n {
  if (value === null || value === undefined) {
    throw new TypeError("Missing value");
  }

  let zeroOrOne: 0n | 1n = 0n;

  // Must be 0 or 1
  if (typeof value === "bigint") {
    if (value !== 1n && value !== 0n) {
      throw new TypeError("The value must be 1 or 0.");
    }
    zeroOrOne = value;
  } else if (typeof value === "number") {
    if (value !== 1 && value !== 0) {
      throw new TypeError("The value must be 1 or 0.");
    }
    zeroOrOne = value === 0 ? 0n : 1n;
  } else if (typeof value === "boolean") {
    zeroOrOne = value === true ? 1n : 0n;
  } else {
    throw new TypeError("The value must be a boolean, a number or a bigint.");
  }

  return zeroOrOne;
}

export function bitwiseNotUIntBits(value: bigint, numBits: number | bigint) {
  if (typeof value !== "bigint") {
    throw new TypeError("The input value must be a BigInt.");
  }
  if (!isUInt(numBits)) {
    throw new TypeError("The numBits parameter must be a positive integer.");
  }
  // Create the mask with numBits bits set to 1
  const BIT_MASK = (BigInt(1) << BigInt(numBits)) - BigInt(1);
  return ~value & BIT_MASK;
}

export function getMaxBigInt(bitLength: number): bigint {
  if (!isUInt(bitLength)) {
    throw new Error(`Invalid bitLength argument (${bitLength}), expecting a positive integer value.`);
  }

  return (1n << BigInt(bitLength)) - 1n;
}
