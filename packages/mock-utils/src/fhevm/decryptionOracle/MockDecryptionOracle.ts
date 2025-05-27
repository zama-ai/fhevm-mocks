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
  #iterator: DecryptionOracleEventsIterator;
  #handler: DecryptionOracleEventsHandler;
  #readonlyProvider: EthersT.Provider;
  #coprocessor: Coprocessor;
  #requestDB: MockDecryptionOracleDB = new MockDecryptionOracleDB();
  #acl: ACL;
  #kmsVerifier: KMSVerifier;
  #kmsSigners: EthersT.Signer[];

  constructor(
    decryptionOracleContractInterface: EthersT.Interface,
    decryptionOracleContractAddress: string,
    readonlyProvider: EthersT.Provider,
    coprocessor: Coprocessor,
    db: FhevmDB,
    kmsVerifier: KMSVerifier,
    acl: ACL,
    kmsSigners: EthersT.Signer[],
    relayerSigner: EthersT.Signer,
  ) {
    this.#readonlyProvider = readonlyProvider;
    this.#coprocessor = coprocessor;
    this.#iterator = new DecryptionOracleEventsIterator(
      decryptionOracleContractInterface,
      decryptionOracleContractAddress,
      readonlyProvider,
      db.fromBlockNumber,
    );
    this.#handler = new DecryptionOracleEventsHandler(db, kmsVerifier, kmsSigners, relayerSigner);
    this.#acl = acl;
    this.#kmsVerifier = kmsVerifier;
    this.#kmsSigners = kmsSigners;
  }

  public async createDecryptionSignatures(
    handlesBytes32Hex: string[],
    clearTextValues: (bigint | string | boolean)[],
  ): Promise<string[]> {
    return (
      await computeDecryptionSignatures(
        handlesBytes32Hex,
        clearTextValues,
        EthersT.AbiCoder.defaultAbiCoder(),
        this.#kmsVerifier,
        this.#kmsSigners,
      )
    ).signatures;
  }

  public async awaitDecryptionOracle(): Promise<void> {
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
