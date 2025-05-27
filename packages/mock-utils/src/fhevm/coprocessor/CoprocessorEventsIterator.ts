import { ethers as EthersT } from "ethers";

import { BlockLogCursor } from "../../ethers/event.js";
import { assertFhevm } from "../../utils/error.js";
import type { CoprocessorEvent } from "./CoprocessorEvents.js";
import { getCoprocessorEvents } from "./utils.js";

export class CoprocessorEventsIterator {
  #cursor: BlockLogCursor;
  #coprocessorContractInterface: EthersT.Interface;
  #coprocessorContractAddress: string;
  #readonlyProvider: EthersT.Provider;

  constructor(
    coprocessorContractInterface: EthersT.Interface,
    coprocessorContractAddress: string,
    readonlyProvider: EthersT.Provider,
    fromBlockNumber: number,
  ) {
    this.#coprocessorContractInterface = coprocessorContractInterface;
    this.#coprocessorContractAddress = coprocessorContractAddress;
    this.#readonlyProvider = readonlyProvider;
    this.#cursor = new BlockLogCursor(fromBlockNumber);
  }

  public async next(): Promise<CoprocessorEvent[]> {
    const currentBlockNumber = await this.#readonlyProvider.getBlockNumber();
    if (currentBlockNumber === this.#cursor.blockNumber) {
      return [];
    }

    const { events, cursor } = await getCoprocessorEvents(
      this.#coprocessorContractInterface,
      this.#coprocessorContractAddress,
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
      // must empty.
      assertFhevm(events.length === 0);
    }

    return events;
  }
}
