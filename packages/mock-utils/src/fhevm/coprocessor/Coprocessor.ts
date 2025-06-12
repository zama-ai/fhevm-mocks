import type { FhevmDB, FhevmDBHandleMetadata } from "../db/FhevmDB.js";

export interface Coprocessor {
  awaitCoprocessor(): Promise<void>;
  clearHandleDB(): Promise<void>;
  getDB(): FhevmDB;
  insertHandleBytes32(handleBytes32Hex: string, clearTextHex: string, metadata: FhevmDBHandleMetadata): Promise<void>;
  queryHandlesBytes32AsHex(handlesBytes32: string[]): Promise<string[]>;
}
