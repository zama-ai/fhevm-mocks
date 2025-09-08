import { ethers as EthersT } from "ethers";

import { FhevmError, assertFhevm } from "../../utils/error.js";
import { ACL } from "../contracts/ACL.js";
import { KMSVerifier, computeDecryptionSignatures } from "../contracts/KMSVerifier.js";
import type { Coprocessor } from "../coprocessor/Coprocessor.js";
import type { FhevmDB } from "../db/FhevmDB.js";
import type { DecryptionOracle } from "./DecryptionOracle.js";
import type { DecryptionRequestEvent } from "./DecryptionOracleEvents.js";
import { DecryptionOracleEventsHandler } from "./DecryptionOracleEventsHandler.js";
import { DecryptionOracleEventsIterator } from "./DecryptionOracleEventsIterator.js";
import { DecryptionOraclePartialInterface } from "./abi.js";
import { toDecryptionRequestEvent } from "./utils.js";

type DecryptionRequestDBEntry = {
  event: {
    counter: number;
    requestID: number;
    contractCallerAddress: string;
    index: number;
    blockNumber: number;
    transactionHash: string;
    transactionIndex: number;
  };
  callbackBlockNumber: number | undefined;
  callbackTransactionHash: string | undefined;
  callbackReverted: boolean | undefined;
  pending: boolean;
};

class MockDecryptionOracleDB {
  #map: Map<string, DecryptionRequestDBEntry> = new Map<string, DecryptionRequestDBEntry>();

  private static key(event: DecryptionRequestEvent, counterOverride?: bigint | number) {
    return `${Number(counterOverride ?? event.counter)}}`;
  }

  public tryQuery(event: DecryptionRequestEvent): DecryptionRequestDBEntry | undefined {
    return this.#map.get(MockDecryptionOracleDB.key(event));
  }

  public delete(event: DecryptionRequestEvent) {
    this.#map.delete(MockDecryptionOracleDB.key(event));
  }

  public setPending(event: DecryptionRequestEvent, evmHasReverted: boolean): DecryptionRequestDBEntry {
    if (this.has(event) && !evmHasReverted) {
      throw new FhevmError(
        `Decryption Request counter=${event.counter}, requestID=${event.requestID}, contractCaller=${event.contractCallerAddress} already registered`,
      );
    }
    const entry: DecryptionRequestDBEntry = {
      event: {
        counter: Number(event.counter),
        requestID: Number(event.requestID),
        contractCallerAddress: event.contractCallerAddress,
        index: event.index,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        transactionIndex: event.transactionIndex,
      },
      callbackBlockNumber: -1,
      callbackTransactionHash: undefined,
      callbackReverted: undefined,
      pending: true,
    };
    this.#map.set(MockDecryptionOracleDB.key(event), entry);
    return entry;
  }

  public isPending(event: DecryptionRequestEvent): boolean {
    const entry = this.#map.get(MockDecryptionOracleDB.key(event));
    if (!entry) {
      return false;
    }
    return entry.pending;
  }

  public executed(event: DecryptionRequestEvent): boolean {
    const entry = this.#map.get(MockDecryptionOracleDB.key(event));
    if (!entry) {
      return false;
    }
    return !entry.pending;
  }

  public has(event: DecryptionRequestEvent): boolean {
    return this.#map.has(MockDecryptionOracleDB.key(event));
  }
}

export class MockDecryptionOracle implements DecryptionOracle {
  #iterator: DecryptionOracleEventsIterator | undefined;
  #handler: DecryptionOracleEventsHandler | undefined;
  #readonlyProvider: EthersT.Provider | undefined;
  #coprocessor: Coprocessor | undefined;
  #requestDB: MockDecryptionOracleDB = new MockDecryptionOracleDB();
  #acl: ACL | undefined;
  #kmsVerifier: KMSVerifier | undefined;
  #kmsSigners: EthersT.Signer[] | undefined;

  public static async create(
    readonlyProvider: EthersT.Provider,
    params: {
      decryptionOracleContractAddress: string;
      decryptionOracleContractInterface?: EthersT.Interface;
      kmsSigners: EthersT.Signer[];
      kmsVerifierContractAddress: string;
      aclContractAddress: string;
      coprocessor: Coprocessor;
      relayerSigner: EthersT.Signer;
    },
  ): Promise<MockDecryptionOracle> {
    const mdo = new MockDecryptionOracle();
    const db: FhevmDB = params.coprocessor.getDB();
    const decryptionOracleContractItf = params.decryptionOracleContractInterface ?? DecryptionOraclePartialInterface;
    mdo.#readonlyProvider = readonlyProvider;
    mdo.#coprocessor = params.coprocessor;
    mdo.#iterator = new DecryptionOracleEventsIterator(
      decryptionOracleContractItf,
      params.decryptionOracleContractAddress,
      readonlyProvider,
      db.fromBlockNumber,
    );
    mdo.#kmsVerifier = await KMSVerifier.create(readonlyProvider, params.kmsVerifierContractAddress);
    mdo.#acl = await ACL.create(readonlyProvider, params.aclContractAddress);
    mdo.#handler = new DecryptionOracleEventsHandler(db, mdo.#kmsVerifier, params.kmsSigners, params.relayerSigner);
    mdo.#kmsSigners = params.kmsSigners;
    return mdo;
  }

  public async createDecryptionSignatures(
    handlesBytes32Hex: string[],
    clearTextValues: (bigint | string | boolean)[],
    extraData: string,
  ): Promise<{ decryptedResult: string; signatures: string[] }> {
    assertFhevm(this.#kmsVerifier !== undefined, `MockDecryptionOracle not initialized`);
    assertFhevm(this.#kmsSigners !== undefined, `MockDecryptionOracle not initialized`);

    const res = await computeDecryptionSignatures(
      handlesBytes32Hex,
      clearTextValues,
      extraData,
      EthersT.AbiCoder.defaultAbiCoder(),
      this.#kmsVerifier,
      this.#kmsSigners,
    );

    return { decryptedResult: res.decryptedResult, signatures: res.signatures };
  }

  public async awaitDecryptionOracle(): Promise<void> {
    assertFhevm(this.#coprocessor !== undefined, `MockDecryptionOracle not initialized`);
    assertFhevm(this.#iterator !== undefined, `MockDecryptionOracle not initialized`);
    assertFhevm(this.#readonlyProvider !== undefined, `MockDecryptionOracle not initialized`);
    assertFhevm(this.#acl !== undefined, `MockDecryptionOracle not initialized`);
    assertFhevm(this.#handler !== undefined, `MockDecryptionOracle not initialized`);

    // Required (healthier to do it even if events in empty)
    await this.#coprocessor.awaitCoprocessor();

    // Warning test: solidityCoverageRunning
    const { events, evmHasReverted } = await this.#iterator.next();

    for (let i = 0; i < events.length; ++i) {
      const dre: DecryptionRequestEvent | null = toDecryptionRequestEvent(events[i]);
      if (!dre) {
        continue;
      }

      // Should not process an already processed event
      if (this.#requestDB.isPending(dre)) {
        throw new FhevmError(
          `DecryptionRequest requestID=${dre.requestID}, contractCaller=${dre.contractCallerAddress} already being executed.`,
        );
      }

      // First throw if ACL permission failed.
      await this.#acl.checkIsAllowedForDecryption(dre.handlesBytes32Hex, this.#readonlyProvider);

      // This is not formally exact. We pass a flag indicating that the evm has reverted to a given
      // snapshot id. This can only occur on dev chains.
      const newEntry = this.#requestDB.setPending(dre, evmHasReverted);
      assertFhevm(newEntry.pending);
      assertFhevm(newEntry.callbackBlockNumber === -1);
      assertFhevm(newEntry.callbackReverted === undefined);
      assertFhevm(newEntry.callbackTransactionHash === undefined);

      try {
        const { tx, receipt } = await this.#handler.handleEvent(dre);
        newEntry.callbackBlockNumber = receipt?.blockNumber;
        newEntry.callbackReverted = receipt?.status === 0;
        newEntry.callbackTransactionHash = tx.hash;
        newEntry.pending = false;
      } catch (e) {
        this.#requestDB.delete(dre);
        throw e;
      }
    }
  }
}
