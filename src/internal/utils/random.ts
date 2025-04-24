import crypto from "crypto";

export function getRandomBigInt(numBits: number): bigint {
  if (numBits <= 0) {
    throw new TypeError("Number of bits must be greater than 0");
  }

  const numBytes = Math.ceil(numBits / 8);
  const randomBytes = new Uint8Array(numBytes);

  crypto.getRandomValues(randomBytes);

  let randomBigInt = BigInt(0);
  for (let i = 0; i < numBytes; i++) {
    randomBigInt = (randomBigInt << BigInt(8)) | BigInt(randomBytes[i]);
  }

  const mask = (BigInt(1) << BigInt(numBits)) - BigInt(1);
  randomBigInt = randomBigInt & mask;

  return randomBigInt;
}
