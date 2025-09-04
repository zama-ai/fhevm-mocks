import { ethers as EthersT } from "ethers";

import { multiSignEIP712 } from "../../ethers/eip712.js";
import { assertIsBytes32String } from "../../utils/bytes.js";
import { assertFhevm } from "../../utils/error.js";
import { removePrefix } from "../../utils/string.js";
import { InputVerifier } from "../contracts/InputVerifier.js";
import { FHEVMExecutorPartialInterface } from "../contracts/interfaces/FHEVMExecutor.itf.js";
import type { FhevmDB, FhevmDBHandleMetadata } from "../db/FhevmDB.js";
import type { RelayerV1InputProofResponse } from "../relayer/payloads.js";
import type { Coprocessor } from "./Coprocessor.js";
import type { CoprocessorEvent } from "./CoprocessorEvents.js";
import { CoprocessorEventsHandler } from "./CoprocessorEventsHandler.js";
import { CoprocessorEventsIterator } from "./CoprocessorEventsIterator.js";

export class MockCoprocessor implements Coprocessor {
  #iterator: CoprocessorEventsIterator | undefined;
  #handler: CoprocessorEventsHandler | undefined;
  #db: FhevmDB | undefined;
  #coprocessorSigners: EthersT.Signer[] | undefined;
  #inputVerifier: InputVerifier | undefined;

  constructor() {}

  public static async create(
    readonlyProvider: EthersT.Provider,
    params: {
      coprocessorContractAddress: string;
      coprocessorContractInterface?: EthersT.Interface;
      coprocessorSigners: EthersT.Signer[];
      inputVerifierContractAddress: string;
      db: FhevmDB;
    },
  ): Promise<MockCoprocessor> {
    const mc = new MockCoprocessor();
    const coprocessorItf = params.coprocessorContractInterface ?? FHEVMExecutorPartialInterface;
    mc.#iterator = new CoprocessorEventsIterator(
      coprocessorItf,
      params.coprocessorContractAddress,
      readonlyProvider,
      params.db.fromBlockNumber,
    );
    mc.#handler = new CoprocessorEventsHandler(params.db);
    mc.#db = params.db;
    mc.#inputVerifier = await InputVerifier.create(readonlyProvider, params.inputVerifierContractAddress);
    mc.#coprocessorSigners = params.coprocessorSigners;
    return mc;
  }

  public getDB(): FhevmDB {
    assertFhevm(this.#db !== undefined, `MockCoprocessor not initialized`);
    return this.#db;
  }

  public async awaitCoprocessor() {
    assertFhevm(this.#iterator !== undefined, `MockCoprocessor not initialized`);
    assertFhevm(this.#handler !== undefined, `MockCoprocessor not initialized`);

    // Warning test: solidityCoverageRunning
    const events: CoprocessorEvent[] = await this.#iterator.next();
    for (let i = 0; i < events.length; ++i) {
      await this.#handler.handleEvent(events[i]);
    }
  }

  public async clearHandleDB() {
    assertFhevm(this.#db !== undefined, `MockCoprocessor not initialized`);

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
    assertFhevm(this.#db !== undefined, `MockCoprocessor not initialized`);

    await this.#db.insertHandleBytes32(handleBytes32Hex, clearTextHex, metadata);
  }

  public async queryHandlesBytes32AsHex(handlesBytes32: string[]): Promise<string[]> {
    assertFhevm(this.#db !== undefined, `MockCoprocessor not initialized`);

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
    extraData: string,
  ): Promise<RelayerV1InputProofResponse> {
    assertFhevm(this.#inputVerifier !== undefined, `MockCoprocessor not initialized`);
    assertFhevm(this.#coprocessorSigners !== undefined, `MockCoprocessor not initialized`);

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
      extraData,
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
