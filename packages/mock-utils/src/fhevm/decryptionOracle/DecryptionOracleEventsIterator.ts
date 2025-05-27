import { ethers as EthersT } from "ethers";

import { BlockLogCursor } from "../../ethers/event.js";
import { assertFhevm } from "../../utils/error.js";
import type { DecryptionOracleEvent } from "./DecryptionOracleEvents.js";
import { getDecryptionOracleEvents } from "./utils.js";

export class DecryptionOracleEventsIterator {
  #cursor: BlockLogCursor;
  #decryptionOracleContractInterface: EthersT.Interface;
  #decryptionOracleContractAddress: string;
  #readonlyProvider: EthersT.Provider;

  constructor(
    decryptionOracleContractInterface: EthersT.Interface,
    decryptionOracleContractAddress: string,
    readonlyProvider: EthersT.Provider,
    fromBlockNumber: number,
  ) {
    this.#decryptionOracleContractInterface = decryptionOracleContractInterface;
    this.#decryptionOracleContractAddress = decryptionOracleContractAddress;
    this.#readonlyProvider = readonlyProvider;
    this.#cursor = new BlockLogCursor(fromBlockNumber);
  }

  public async next(): Promise<{
    events: DecryptionOracleEvent[];
    evmHasReverted: boolean;
    currentBlockNumber: number;
  }> {
    // The oracle must detect any evm_revert call.
    // The coprocessor, however, can run even if evm_revert is called.
    let evmHasReverted = false;
    const currentBlockNumber = await this.#readonlyProvider.getBlockNumber();
    if (currentBlockNumber <= this.#cursor.blockNumber) {
      evmHasReverted = true;
      // send cursor backward since evm_revert has been executed
      this.#cursor.update(currentBlockNumber - 1, 0);
    }

    const { events, cursor } = await getDecryptionOracleEvents(
      this.#decryptionOracleContractInterface,
      this.#decryptionOracleContractAddress,
      this.#readonlyProvider,
      {
        fromBlockNumber: this.#cursor.nextBlockNumber,
        toBlockNumber: currentBlockNumber,
      },
    );

    if (!cursor.isEmpty) {
      // events can be empty here!
      this.#cursor.updateForward(cursor.blockNumber, cursor.blockLogIndex);
    } else {
      // if the cursor has not progressed, then necessarily the events array
      // must be empty.
      assertFhevm(events.length === 0);
    }

    return { events, evmHasReverted, currentBlockNumber };
  }
}
