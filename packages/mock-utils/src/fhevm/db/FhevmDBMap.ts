import { ethers as EthersT } from "ethers";

import { BlockLogCursor } from "../../ethers/event.js";
import { FhevmError } from "../../utils/error.js";
import type { FhevmDB, FhevmDBEntry, FhevmDBHandleMetadata } from "./FhevmDB.js";
import { checkInsertArgs, checkQueryArgs, fhevmDBEntryToString, stringToFhevmDBEntry } from "./utils.js";

const __STRICT__: boolean = false;

export class FhevmDBMap implements FhevmDB {
  #handleBytes32HexToClearText: Map<string, string> | undefined;
  #counter: BlockLogCursor | undefined;
  #randomCounter: number = 0;
  #fromBlockNumber: number = -1;

  public constructor() {}

  incRand(): void {
    this.#randomCounter++;
  }

  get randomCounter(): number {
    return this.#randomCounter;
  }

  get fromBlockNumber(): number {
    return this.#fromBlockNumber;
  }

  get countHandles(): number {
    if (!this.#handleBytes32HexToClearText) {
      throw new FhevmError(`FhevmDB not yet initialized`);
    }
    return this.#handleBytes32HexToClearText.size;
  }

  private _get(): Map<string, string> {
    if (!this.#handleBytes32HexToClearText) {
      throw new FhevmError(`FhevmDB not yet initialized`);
    }
    return this.#handleBytes32HexToClearText;
  }

  public async init(fromBlockNumber: number): Promise<boolean> {
    if (this.#handleBytes32HexToClearText) {
      throw new FhevmError(`FhevmDB already initialized`);
    }
    this.#fromBlockNumber = fromBlockNumber;
    this.#counter = new BlockLogCursor(fromBlockNumber);
    this.#handleBytes32HexToClearText = new Map();
    return true;
  }

  /**
   * Reset can be usefull to test deterministic handles like trivialEncrypt.
   */
  public async reset(): Promise<void> {
    this._get().clear();
  }

  private async _insertHandleBytes32(
    handleBytes32Hex: string,
    clearTextBigIntOrHex: bigint | string,
    metadata: FhevmDBHandleMetadata,
    options?: { replace?: boolean },
  ): Promise<void> {
    if (!this.#counter) {
      throw new FhevmError(`FhevmDB not yet initialized`);
    }
    const map: Map<string, string> = this._get();
    if (__STRICT__) {
      if (options?.replace !== true) {
        if (map.has(handleBytes32Hex)) {
          throw new FhevmError(`Handle ${handleBytes32Hex} already exists.`);
        }
      }
    }

    if (typeof clearTextBigIntOrHex !== "string") {
      clearTextBigIntOrHex = clearTextBigIntOrHex.toString();
    }

    const entryStr = fhevmDBEntryToString({ clearTextHex: clearTextBigIntOrHex, metadata });

    map.set(handleBytes32Hex, entryStr);

    if (metadata.transactionHash !== EthersT.ZeroHash) {
      if (__STRICT__) {
        // Always insert forward
        this.#counter.updateForward(metadata.blockNumber, metadata.index);
      } else {
        this.#counter.update(metadata.blockNumber, metadata.index);
      }
    }

    //console.log("insert handleBytes32Hex=" + handleBytes32Hex);
  }

  private async _queryHandleBytes32(handleBytes32Hex: string): Promise<FhevmDBEntry> {
    const map: Map<string, string> = this._get();

    const entryStr = map.get(handleBytes32Hex);
    if (entryStr === undefined) {
      throw new FhevmError(`Handle ${handleBytes32Hex} does not exist.`);
    }

    return stringToFhevmDBEntry(entryStr);
  }

  public async insertHandleBytes32(
    handleBytes32Hex: string,
    clearText: bigint | string,
    metadata: FhevmDBHandleMetadata,
    options?: { replace?: boolean },
  ): Promise<void> {
    checkInsertArgs(handleBytes32Hex, clearText, metadata);
    await this._insertHandleBytes32(handleBytes32Hex, clearText, metadata, options);
  }

  async queryHandleBytes32(handleBytes32Hex: string): Promise<FhevmDBEntry> {
    checkQueryArgs(handleBytes32Hex);
    return await this._queryHandleBytes32(handleBytes32Hex);
  }

  public async tryInsertHandleBytes32(
    handleBytes32Hex: string,
    clearText: bigint | string,
    metadata: FhevmDBHandleMetadata,
    options?: {
      replace?: boolean;
    },
  ): Promise<boolean> {
    checkInsertArgs(handleBytes32Hex, clearText, metadata);
    try {
      await this._insertHandleBytes32(handleBytes32Hex, clearText, metadata, options);
      return true;
    } catch {
      return false;
    }
  }

  public async tryQueryHandleBytes32(handleBytes32Hex: string): Promise<FhevmDBEntry | undefined> {
    checkQueryArgs(handleBytes32Hex);
    try {
      return await this._queryHandleBytes32(handleBytes32Hex);
    } catch {
      return undefined;
    }
  }
}
