import type { ethers as EthersT } from "ethers";

export type DecryptionOracleEventName = "DecryptionRequest";

export function isDecryptionOracleEventName(value: unknown): value is DecryptionOracleEventName {
  return value === "DecryptionRequest";
}

export type DecryptionOracleEvent = {
  eventName: DecryptionOracleEventName;
  args: EthersT.Result;
  index: number;
  blockNumber: number;
  transactionHash: string;
  transactionIndex: number;
};

export type DecryptionRequestEvent = {
  counter: bigint;
  requestID: bigint;
  handlesBytes32Hex: string[];
  contractCallerAddress: string;
  callbackSelectorBytes4Hex: string;
  index: number;
  blockNumber: number;
  transactionHash: string;
  transactionIndex: number;
};
