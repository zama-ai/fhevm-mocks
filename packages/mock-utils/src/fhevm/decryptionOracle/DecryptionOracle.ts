export interface DecryptionOracle {
  awaitDecryptionOracle(): Promise<void>;
  createDecryptionSignatures(
    handlesBytes32Hex: string[],
    clearTextValues: (bigint | string | boolean)[],
  ): Promise<string[]>;
}
