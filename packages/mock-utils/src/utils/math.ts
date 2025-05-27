import { ethers as EthersT } from "ethers";

import { FhevmError, assertFhevm } from "./error.js";

export const MAX_UINT8 = 0xffn;
export const MAX_UINT16 = 0xffffn;
export const MAX_UINT32 = 0xffffffffn;
export const MAX_UINT64 = 0xffffffffffffffffn;
export const MAX_UINT128 = 0xffffffffffffffffffffffffffffffffn;
export const MAX_UINT160 = 0xffffffffffffffffffffffffffffffffffffffffn;
export const MAX_UINT256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;
export const MAX_UINT512 =
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;

export function toUIntNumber(value: EthersT.BigNumberish, name?: string): number {
  try {
    const bn = EthersT.getUint(value, name);
    return EthersT.getNumber(bn);
  } catch {
    throw new FhevmError(`${name} is not a positive integer`);
  }
}

export function isInt(value: unknown): value is EthersT.Numeric {
  if (typeof value === "bigint") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isInteger(value);
  }
  return false;
}

export function isUInt(value: unknown): value is EthersT.Numeric {
  if (!isInt(value)) {
    return false;
  }
  return (value as EthersT.Numeric) >= 0;
}

export function isEvenUInt(value: unknown): value is EthersT.Numeric {
  if (!isUInt(value)) {
    return false;
  }
  return typeof value === "bigint" ? value % 2n === 0n : value % 2 === 0;
}

export function boolToBigInt(value: EthersT.Numeric | boolean): 0n | 1n {
  if (value === null || value === undefined) {
    throw new FhevmError("Missing value");
  }

  let zeroOrOne: 0n | 1n = 0n;

  // Must be 0 or 1
  if (typeof value === "bigint") {
    if (value !== 1n && value !== 0n) {
      throw new FhevmError("The value must be 1 or 0.");
    }
    zeroOrOne = value;
  } else if (typeof value === "number") {
    if (value !== 1 && value !== 0) {
      throw new FhevmError("The value must be 1 or 0.");
    }
    zeroOrOne = value === 0 ? 0n : 1n;
  } else if (typeof value === "boolean") {
    zeroOrOne = value === true ? 1n : 0n;
  } else {
    throw new FhevmError("The value must be a boolean, a number or a bigint.");
  }

  return zeroOrOne;
}

export function bitwiseNotUIntBits(value: bigint, numBits: number | bigint) {
  if (typeof value !== "bigint") {
    throw new FhevmError("The input value must be a BigInt.");
  }
  if (!isUInt(numBits)) {
    throw new FhevmError("The numBits parameter must be a positive integer.");
  }
  // Create the mask with numBits bits set to 1
  const BIT_MASK = (BigInt(1) << BigInt(numBits)) - BigInt(1);
  return ~value & BIT_MASK;
}

export function getMaxBigInt(bitLength: number): bigint {
  if (!isUInt(bitLength)) {
    throw new FhevmError(`Invalid bitLength argument (${bitLength}), expecting a positive integer value.`);
  }

  return (1n << BigInt(bitLength)) - 1n;
}

export function log2BigInt(x: bigint): bigint {
  const n = x.toString(2).length - 1;
  return x <= 0n ? 0n : BigInt(n);
}

export function getRandomBigInt(numBits: number): bigint {
  if (numBits <= 0) {
    throw new TypeError("Number of bits must be greater than 0");
  }

  const numBytes = Math.ceil(numBits / 8);
  const randomBytes = EthersT.randomBytes(numBytes);

  let randomBigInt = BigInt(0);
  for (let i = 0; i < numBytes; i++) {
    randomBigInt = (randomBigInt << BigInt(8)) | BigInt(randomBytes[i]);
  }

  const mask = (BigInt(1) << BigInt(numBits)) - BigInt(1);
  randomBigInt = randomBigInt & mask;

  return randomBigInt;
}

export function assertIsUintNumber(value: unknown, valueName?: string): asserts value is number {
  assertFhevm(typeof value === "number", `${valueName ?? "value"} is not of type number, got ${typeof value} instead`);
  assertFhevm(isUInt(value), `${valueName ?? "value"} is not an uint, got ${typeof value} instead`);
}

/*

  BigInt assertions

*/

export function assertIsBigUint8(value: unknown, valueName?: string): asserts value is bigint {
  _assertIsBigUint(value, 8, MAX_UINT8, valueName);
}
export function assertIsBigUint16(value: unknown, valueName?: string): asserts value is bigint {
  _assertIsBigUint(value, 16, MAX_UINT16, valueName);
}
export function assertIsBigUint32(value: unknown, valueName?: string): asserts value is bigint {
  _assertIsBigUint(value, 32, MAX_UINT32, valueName);
}
export function assertIsBigUint64(value: unknown, valueName?: string): asserts value is bigint {
  _assertIsBigUint(value, 64, MAX_UINT64, valueName);
}
export function assertIsBigUint128(value: unknown, valueName?: string): asserts value is bigint {
  _assertIsBigUint(value, 128, MAX_UINT128, valueName);
}
export function assertIsBigUint160(value: unknown, valueName?: string): asserts value is bigint {
  _assertIsBigUint(value, 128, MAX_UINT160, valueName);
}
export function assertIsBigUint256(value: unknown, valueName?: string): asserts value is bigint {
  _assertIsBigUint(value, 256, MAX_UINT256, valueName);
}
export function assertIsBigUint512(value: unknown, valueName?: string): asserts value is bigint {
  _assertIsBigUint(value, 512, MAX_UINT512, valueName);
}
export function assertIsBigUint1024(value: unknown, valueName?: string): asserts value is bigint {
  _assertIsBigUint(value, 1024, getMaxBigInt(1024), valueName);
}
export function assertIsBigUint2048(value: unknown, valueName?: string): asserts value is bigint {
  _assertIsBigUint(value, 2048, getMaxBigInt(2048), valueName);
}

function _assertIsBigUint(
  value: unknown,
  bitLen: 8 | 16 | 32 | 64 | 128 | 256 | 512 | 1024 | 2048,
  max: bigint,
  valueName?: string,
): asserts value is bigint {
  assertFhevm(typeof value === "bigint", `${valueName ?? "value"} is not of type bigint, got ${typeof value} instead`);
  assertFhevm(
    value >= 0 && value <= max,
    `${valueName ?? "value"} is larger than uint${bitLen} maximum value, got ${value} > ${max}`,
  );
}

export function assertIsBoolean(value: unknown, valueName?: string): asserts value is boolean {
  assertFhevm(
    typeof value === "boolean",
    `${valueName ?? "value"} is not of type boolean, got ${typeof value} instead`,
  );
}

export function assertIsNumber(value: unknown, valueName?: string): asserts value is boolean {
  assertFhevm(typeof value === "number", `${valueName ?? "value"} is not of type number, got ${typeof value} instead`);
}
