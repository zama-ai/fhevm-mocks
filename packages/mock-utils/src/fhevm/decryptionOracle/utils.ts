import { ethers as EthersT } from "ethers";

import {
  BlockLogCursor,
  assertEventArgIsAddress,
  assertEventArgIsBigUint256,
  assertEventArgIsBytes4String,
  assertEventArgIsBytes32String,
} from "../../ethers/event.js";
import type { MinimalProvider } from "../../ethers/provider.js";
import { computeStorageLocation, getAddressesFromStorage } from "../../ethers/storage.js";
import { FhevmError, assertFhevm } from "../../utils/error.js";
import type { DecryptionOracleEvent, DecryptionRequestEvent } from "./DecryptionOracleEvents.js";
import { isDecryptionOracleEventName } from "./DecryptionOracleEvents.js";
import { DecryptionOraclePartialInterface } from "./abi.js";

export async function getDecryptionOracleEvents(
  decryptionOracleContractInterface: EthersT.Interface,
  decryptionOracleContractAddress: string,
  readonlyProvider: EthersT.Provider,
  options: {
    fromBlockNumber?: number;
    fromBlockLogIndex?: number;
    toBlockNumber?: number;
  },
): Promise<{ events: DecryptionOracleEvent[]; cursor: BlockLogCursor }> {
  let currentBlockNumber: number = -1;
  let toBlock: number;

  if (options.toBlockNumber !== undefined) {
    toBlock = options.toBlockNumber;
  } else {
    currentBlockNumber = await readonlyProvider.getBlockNumber();
    toBlock = currentBlockNumber;
  }

  let fromBlock: number;
  if (options.fromBlockNumber !== undefined) {
    fromBlock = options.fromBlockNumber;
  } else {
    fromBlock = toBlock;
  }

  if (fromBlock > toBlock) {
    throw new FhevmError(`Invalid block filter fromBlock=${fromBlock} toBlock=${toBlock}`);
  }

  const eventDecryptionFragment: EthersT.EventFragment | null =
    decryptionOracleContractInterface.getEvent("DecryptionRequest");
  if (!eventDecryptionFragment) {
    throw new FhevmError(`Unknown "DecryptionRequest" event`);
  }

  // Wild card
  const topics = decryptionOracleContractInterface.encodeFilterTopics(eventDecryptionFragment, []);

  const filter: EthersT.Filter = {
    address: decryptionOracleContractAddress,
    fromBlock,
    toBlock,
    topics,
  };

  const logs = await readonlyProvider.getLogs(filter);

  const cursor = new BlockLogCursor(-1);
  const events: DecryptionOracleEvent[] = logs
    .map((log) => {
      try {
        cursor.updateForward(log.blockNumber, log.index);

        const parsedLog = decryptionOracleContractInterface.parseLog(log)!;

        if (!isDecryptionOracleEventName(parsedLog.name)) {
          return null;
        }

        if (log.blockNumber === fromBlock) {
          if (options.fromBlockLogIndex !== undefined) {
            if (log.index < options.fromBlockLogIndex) {
              return null;
            }
          }
        }

        const evt: DecryptionOracleEvent = {
          eventName: parsedLog.name,
          args: parsedLog.args,
          index: log.index,
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          transactionIndex: log.transactionIndex,
        };

        return evt;
      } catch {
        // If the log cannot be parsed, skip it
        return null;
      }
    })
    .filter((event) => event !== null);

  return { events, cursor };
}

export function toDecryptionRequestEvent(e: DecryptionOracleEvent): DecryptionRequestEvent | null {
  if (e.eventName !== "DecryptionRequest") {
    return null;
  }

  const counter = e.args[0]; //uint256
  const requestID = e.args[1]; //uint256
  const handlesBytes32Hex = e.args[2] as string[]; //bytes32[]
  const contractCallerAddress = e.args[3] as string; //address
  const callbackSelectorBytes4Hex = e.args[4] as string; //bytes4

  assertEventArgIsBigUint256(counter, "DecryptionRequest", 0);
  assertEventArgIsBigUint256(requestID, "DecryptionRequest", 1);

  assertFhevm(handlesBytes32Hex.length > 0);
  assertEventArgIsBytes32String(handlesBytes32Hex[0], "DecryptionRequest", 2);
  assertEventArgIsAddress(contractCallerAddress, "DecryptionRequest", 3);
  assertEventArgIsBytes4String(callbackSelectorBytes4Hex, "DecryptionRequest", 4);

  const evt: DecryptionRequestEvent = {
    blockNumber: e.blockNumber,
    index: e.index,
    transactionHash: e.transactionHash,
    transactionIndex: e.transactionIndex,
    counter,
    requestID,
    handlesBytes32Hex,
    contractCallerAddress,
    callbackSelectorBytes4Hex,
  };

  return evt;
}

export function parseDecryptionRequestEventsFromLogs(
  logs: (EthersT.EventLog | EthersT.Log)[] | null | undefined,
): DecryptionRequestEvent[] {
  // flexible
  if (!logs) {
    return [];
  }
  const events: DecryptionRequestEvent[] = [];
  for (const log of logs) {
    const event: EthersT.LogDescription | null = DecryptionOraclePartialInterface.parseLog(log);

    if (!event) {
      continue;
    }
    if (!isDecryptionOracleEventName(event.name)) {
      continue;
    }

    const doe: DecryptionOracleEvent = {
      eventName: event.name,
      args: event.args,
      blockNumber: log.blockNumber,
      index: log.index,
      transactionHash: log.transactionHash,
      transactionIndex: log.transactionIndex,
    };

    const e = toDecryptionRequestEvent(doe);
    if (!e) {
      continue;
    }

    events.push(e);
  }

  return events;
}

/**
 * Retrieves the `DecryptionOracleAddress` from a smart contract that utilizes the FHEVM framework,
 * deployed at the given `contractAddress`.
 *
 * This function computes the storage slot corresponding to the `DecryptionRequestsStruct` defined in
 * [`@fhevm/solidity/lib/Impl.sol`](https://github.com/zama-ai/fhevm-solidity/blob/main/lib/Impl.sol),
 * then reads the first address field (the oracle address) directly from storage.
 *
 * @param provider - A `MinimalProvider` that implements either `send` or `request` for JSON-RPC communication.
 * @param contractAddress - The on-chain address of the FHEVM contract to query.
 * @returns A Promise that resolves to the decryption oracle's Ethereum address.
 *
 * @throws If the computed storage slot does not match the expected constant layout, indicating a version or layout mismatch.
 */
export async function getDecryptionOracleAddress(provider: MinimalProvider, contractAddress: string): Promise<string> {
  const decryptionRequestsStorageLocation = computeStorageLocation("fhevm.storage.DecryptionRequests");
  assertFhevm(
    decryptionRequestsStorageLocation === "0x5ea69329017273582817d320489fbd94f775580e90c092699ca6f3d12fdf7d00",
  );

  /*
    See: @fhevm/solidity/lib/Impl.sol

    struct DecryptionRequestsStruct {
        address DecryptionOracleAddress;
        uint256 counterRequest;
        mapping(uint256 => bytes32[]) requestedHandles;
    }
  */
  const addresses: string[] = await getAddressesFromStorage(
    provider,
    contractAddress,
    decryptionRequestsStorageLocation,
    1 /* number of addresses in the struct */,
  );

  return addresses[0];
}
