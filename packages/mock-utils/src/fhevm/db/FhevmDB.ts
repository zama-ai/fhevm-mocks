export type FhevmDBHandleMetadata = {
  blockNumber: number;
  index: number;
  transactionHash: string;
};

export type FhevmDBEntry = {
  clearTextHex: string;
  metadata: FhevmDBHandleMetadata;
};

export interface FhevmDB {
  init(fromBlockNumber: number): Promise<boolean>;
  get countHandles(): number;
  tryInsertHandleBytes32(
    handleBytes32Hex: string,
    clearText: bigint | string,
    metadata: FhevmDBHandleMetadata,
    options?: {
      replace?: boolean;
    },
  ): Promise<boolean>;
  insertHandleBytes32(
    handleBytes32Hex: string,
    clearText: bigint | string,
    metadata: FhevmDBHandleMetadata,
    options?: {
      replace?: boolean;
    },
  ): Promise<void>;
  tryQueryHandleBytes32(handleBytes32Hex: string): Promise<FhevmDBEntry | undefined>;
  queryHandleBytes32(handleBytes32Hex: string): Promise<FhevmDBEntry>;
  reset(): Promise<void>;
  incRand(): void;
  get randomCounter(): number;
  get fromBlockNumber(): number;
}
