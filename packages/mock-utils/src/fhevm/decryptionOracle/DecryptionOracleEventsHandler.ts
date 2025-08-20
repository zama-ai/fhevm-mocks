import { ethers as EthersT } from "ethers";

import { assertFhevm } from "../../utils/error.js";
import { KMSVerifier, computeDecryptionCallbackSignaturesAndCalldata } from "../contracts/KMSVerifier.js";
import type { FhevmDB } from "../db/FhevmDB.js";
import type { DecryptionRequestEvent } from "./DecryptionOracleEvents.js";

export class DecryptionOracleEventsHandler {
  #db: FhevmDB;
  #kmsVerifier: KMSVerifier;
  #kmsSigners: EthersT.Signer[];
  #relayerSigner: EthersT.Signer;

  constructor(db: FhevmDB, kmsVerifier: KMSVerifier, kmsSigners: EthersT.Signer[], relayerSigner: EthersT.Signer) {
    this.#db = db;
    this.#kmsVerifier = kmsVerifier;
    this.#kmsSigners = kmsSigners;
    this.#relayerSigner = relayerSigner;
  }

  // coproc.await should have been called before
  public async handleEvent(
    decryptionRequestEvent: DecryptionRequestEvent,
  ): Promise<{ tx: EthersT.TransactionResponse; receipt: EthersT.TransactionReceipt | null }> {
    const clearTextsHex: string[] = [];
    const handlesBytes32Hex: string[] = [];
    for (let i = 0; i < decryptionRequestEvent.handlesBytes32Hex.length; ++i) {
      assertFhevm(
        decryptionRequestEvent.blockNumber >= this.#db.fromBlockNumber,
        `Unexpected event blockNumber: decryptionRequestEvent.blockNumber < this.#db.fromBlockNumber`,
      );
      // if (decryptionRequestEvent.blockNumber < this.#db.fromBlockNumber) {
      //   // Ignore. This is an old decryption request. This usually occurs when running
      //   // tests using Anvil
      //   continue;
      // }
      const entry = await this.#db.queryHandleBytes32(decryptionRequestEvent.handlesBytes32Hex[i]);
      // should have thrown an exception earlier
      assertFhevm(entry.clearTextHex !== "0x");
      clearTextsHex.push(entry.clearTextHex);
      handlesBytes32Hex.push(decryptionRequestEvent.handlesBytes32Hex[i]);
    }

    const extraDataV0: string = EthersT.solidityPacked(["uint8"], [0]);

    const { calldata } = await computeDecryptionCallbackSignaturesAndCalldata(
      handlesBytes32Hex,
      clearTextsHex,
      extraDataV0,
      decryptionRequestEvent.requestID,
      decryptionRequestEvent.callbackSelectorBytes4Hex,
      EthersT.AbiCoder.defaultAbiCoder(),
      this.#kmsVerifier,
      this.#kmsSigners,
    );

    const txData = {
      to: decryptionRequestEvent.contractCallerAddress,
      data: calldata,
    };

    const tx = await this.#relayerSigner.sendTransaction(txData);
    const receipt = await tx.wait();

    return { tx, receipt };
  }
}
