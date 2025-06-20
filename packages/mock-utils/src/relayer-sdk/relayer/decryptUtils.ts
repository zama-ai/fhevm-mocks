/*
    Copy/Paste from https://github.com/zama-ai/relayer-sdk/blob/main/src/relayer/decryptUtils.ts#L18
*/
const NumEncryptedBits: Record<number, number> = {
  0: 2, // ebool
  2: 8, // euint8
  3: 16, // euint16
  4: 32, // euint32
  5: 64, // euint64
  6: 128, // euint128
  7: 160, // eaddress
  8: 256, // euint256
  9: 512, // ebytes64
  10: 1024, // ebytes128
  11: 2048, // ebytes256
} as const;

export function checkEncryptedBits(handles: string[]) {
  let total = 0;

  for (const handle of handles) {
    if (handle.length !== 66) {
      throw new Error(`Handle ${handle} is not of valid length`);
    }

    const hexPair = handle.slice(-4, -2).toLowerCase();
    const typeDiscriminant = parseInt(hexPair, 16);

    if (!(typeDiscriminant in NumEncryptedBits)) {
      throw new Error(`Handle ${handle} is not of valid type`);
    }

    total += NumEncryptedBits[typeDiscriminant as keyof typeof NumEncryptedBits];

    // enforce 2048‑bit limit
    if (total > 2048) {
      throw new Error("Cannot decrypt more than 2048 encrypted bits in a single request");
    }
  }
  return total;
}
