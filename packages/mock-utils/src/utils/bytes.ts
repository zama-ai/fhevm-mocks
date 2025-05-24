import { ethers as EthersT } from "ethers";

import { assertFhevm } from "./error.js";
import { assertIsString } from "./string.js";

export function assertIsUint8Array(value: unknown, valueName?: string): asserts value is Uint8Array {
  assertFhevm(value instanceof Uint8Array, `${valueName ?? "value"} is not of type Uint8Array`);
}

export function assertIsBytesLike(value: unknown, valueName?: string): asserts value is EthersT.BytesLike {
  assertFhevm(
    EthersT.isBytesLike(value),
    `${valueName ?? "value"} is not bytes-like (expected a hex string or Uint8Array)`,
  );
}

export function assertIsBytes32String(value: unknown, valueName?: string): asserts value is string {
  assertIsBytesString(value, 32, valueName);
}

export function assertIsBytesString(value: unknown, width?: number, valueName?: string): asserts value is string {
  assertIsString(value, valueName);
  if (width === undefined) {
    assertFhevm(EthersT.isBytesLike(value), `${valueName ?? "value"} : ${value} is not a valid bytes string`);
  } else {
    assertFhevm(
      value === EthersT.toBeHex(value, width),
      `${valueName ?? "value"} : ${value} is not a valid bytes${width} string`,
    );
  }
}

export function assertIsBytes1(value: unknown, valueName?: string): asserts value is Uint8Array {
  assertIsBytes(value, 1, valueName);
}
export function assertIsBytes8(value: unknown, valueName?: string): asserts value is Uint8Array {
  assertIsBytes(value, 8, valueName);
}
export function assertIsBytes20(value: unknown, valueName?: string): asserts value is Uint8Array {
  assertIsBytes(value, 20, valueName);
}
export function assertIsBytes32(value: unknown, valueName?: string): asserts value is Uint8Array {
  assertIsBytes(value, 32, valueName);
}

export function assertIsBytes(value: unknown, width?: number, valueName?: string): asserts value is Uint8Array {
  assertIsUint8Array(value, valueName);
  if (width === undefined) {
    assertFhevm(EthersT.isBytesLike(value), `${valueName ?? "value"} : ${value} is not a valid bytes string`);
  } else {
    assertFhevm(
      value.length === width,
      `${valueName ?? "value"} : ${value} is not a valid bytes${width} Uint8Array. Expecting length ${width}, got ${value.length} instead`,
    );
  }
}

export function bytesToBigInt(byteArray: Uint8Array): bigint {
  if (!byteArray || byteArray.length === 0) {
    return BigInt(0);
  }

  /*
  
    Equivalent to: 
    ==============

    // faster: using C/C++ lib bigint-buffer
    import { toBigIntBE } from "bigint-buffer";
    // Buffer: Node only
    const buffer = Buffer.from(byteArray);
    const result = toBigIntBE(buffer);
    return new Uint8Array(toBufferBE(value, 64));

  */

  return EthersT.toBigInt(byteArray);
}

export function uintToBytes(value: EthersT.BigNumberish, width: number): Uint8Array {
  // May be using EthersT.toBeArray(value) is more efficient.
  return EthersT.getBytes(EthersT.toBeHex(value, width));
}

export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }

  return result;
}
