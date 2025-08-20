export interface DecryptionOracle {
  awaitDecryptionOracle(): Promise<void>;
  createDecryptionSignatures(
    handlesBytes32Hex: string[],
    clearTextValues: (bigint | string | boolean)[],
    extraData: string,
  ): Promise<{ decryptedResult: string; signatures: string[] }>;
}
