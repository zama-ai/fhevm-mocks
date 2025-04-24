import assert from "assert";
import { toBigIntBE } from "bigint-buffer";
import { toBufferBE } from "bigint-buffer";
import { ethers as EthersT } from "ethers";

export function bytesToBigInt(byteArray: Uint8Array): bigint {
  if (!byteArray || byteArray?.length === 0) {
    return BigInt(0);
  }
  const buffer = Buffer.from(byteArray);
  const result = toBigIntBE(buffer);

  // Debug, check ethers.js function.
  assert(result === EthersT.toBigInt(byteArray), "bigint-buffer.toBigIntBE differs from ethers.toBigInt");

  return result;
}

export function bigIntToBytes64(value: bigint): Uint8Array {
  return new Uint8Array(toBufferBE(value, 64));
}

export function bigIntToBytes128(value: bigint): Uint8Array {
  return new Uint8Array(toBufferBE(value, 128));
}

export function bigIntToBytes256(value: bigint): Uint8Array {
  return new Uint8Array(toBufferBE(value, 256));
}
