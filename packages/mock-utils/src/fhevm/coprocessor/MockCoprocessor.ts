import { ethers as EthersT } from "ethers";

import { multiSignEIP712 } from "../../ethers/eip712.js";
import { assertIsBytes32String } from "../../utils/bytes.js";
import { removePrefix } from "../../utils/string.js";
import { InputVerifier } from "../contracts/InputVerifier.js";
import type { FhevmDB, FhevmDBHandleMetadata } from "../db/FhevmDB.js";
import type { Coprocessor } from "./Coprocessor.js";
import type { CoprocessorEvent } from "./CoprocessorEvents.js";
import { CoprocessorEventsHandler } from "./CoprocessorEventsHandler.js";
import { CoprocessorEventsIterator } from "./CoprocessorEventsIterator.js";

export class MockCoprocessor implements Coprocessor {
  #iterator: CoprocessorEventsIterator;
  #handler: CoprocessorEventsHandler;
  #db: FhevmDB;
  #coprocessorSigners: EthersT.Signer[];
  #inputVerifier: InputVerifier;

  constructor(
    coprocessorContractInterface: EthersT.Interface,
    coprocessorContractAddress: string,
    readonlyProvider: EthersT.Provider,
    db: FhevmDB,
    inputVerifier: InputVerifier,
    coprocessorSigners: EthersT.Signer[],
  ) {
    this.#iterator = new CoprocessorEventsIterator(
      coprocessorContractInterface,
      coprocessorContractAddress,
      readonlyProvider,
      db.fromBlockNumber,
    );
    this.#handler = new CoprocessorEventsHandler(db);
    this.#db = db;
    this.#inputVerifier = inputVerifier;
    this.#coprocessorSigners = coprocessorSigners;
  }

  public async awaitCoprocessor() {
    // Warning test: solidityCoverageRunning
    const events: CoprocessorEvent[] = await this.#iterator.next();
    for (let i = 0; i < events.length; ++i) {
      await this.#handler.handleEvent(events[i]);
    }
  }

  public async clearHandleDB() {
    // Call awaitCoprocessor() to flush yet unprocessed events
    // This is critical otherwise we might have to process input handles that are
    // no more in the db. This is a scenario that randomly occurs between 2 reset
    // usually when running tests.
    await this.awaitCoprocessor();
    await this.#db.reset();
  }

  public async handleEvmRevert(newBlockNumber: number) {
    console.log("HANDLE REVERT HERE!! " + newBlockNumber);
  }

  public async insertHandleBytes32(handleBytes32Hex: string, clearTextHex: string, metadata: FhevmDBHandleMetadata) {
    await this.#db.insertHandleBytes32(handleBytes32Hex, clearTextHex, metadata);
  }

  public async queryHandlesBytes32AsHex(handlesBytes32: string[]): Promise<string[]> {
    await this.awaitCoprocessor();

    const clearTextHexList: string[] = [];

    for (let i = 0; i < handlesBytes32.length; ++i) {
      assertIsBytes32String(handlesBytes32[i]);

      let clearTextHex: string;
      try {
        clearTextHex = (await this.#db.queryHandleBytes32(handlesBytes32[i])).clearTextHex;
      } catch {
        clearTextHex = "0x";
      }
      clearTextHexList.push(clearTextHex);
    }

    return clearTextHexList;
  }

  public async computeCoprocessorSignatures(
    handlesBytes32List: Uint8Array[],
    contractChainId: number,
    contractAddress: string,
    userAddress: string,
  ): Promise<{ handles: string[]; signatures: string[] }> {
    const numHandles = handlesBytes32List.length;

    const handlesBytes32HexNoPrefixList: string[] = [];
    const handlesBytes32HexList: string[] = [];

    for (let index = 0; index < numHandles; ++index) {
      const handleBytes32Hex = EthersT.hexlify(handlesBytes32List[index]);
      handlesBytes32HexList.push(handleBytes32Hex);
      handlesBytes32HexNoPrefixList.push(removePrefix(handleBytes32Hex, "0x"));
    }

    const eip712 = this.#inputVerifier.createCiphertextVerificationEIP712(
      handlesBytes32HexList,
      contractChainId,
      contractAddress,
      userAddress,
    );

    const signaturesHex: string[] = await multiSignEIP712(
      this.#coprocessorSigners,
      eip712.domain,
      eip712.types,
      eip712.message,
    );

    // Remove 0x prefix
    const signatureHexNoPrefixList: string[] = signaturesHex.map((sigHex) => removePrefix(sigHex, "0x"));

    return {
      handles: handlesBytes32HexNoPrefixList,
      signatures: signatureHexNoPrefixList,
    };
  }
}
