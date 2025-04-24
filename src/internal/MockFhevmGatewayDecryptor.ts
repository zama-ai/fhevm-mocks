/*
    WARNING : Never import the "hardhat" package!
*/
import assert from "assert";
import { ethers as EthersT } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { HardhatFhevmError } from "../error";
import { FhevmType } from "../types";
import { FhevmEnvironment } from "./FhevmEnvironment";
import { getFhevmHandleTypeInfo, parseFhevmHandle } from "./handle/handle";
import { createPublicDecryptVerificationEIP712 } from "./sign";
import {
  assertEventArgAddress,
  assertEventArgBytes4,
  assertEventArgBytes32,
  assertEventArgUint256,
  multiSignEIP712,
} from "./utils/ethers";
import { isSolidityCoverageRunning } from "./utils/hh";
import { currentTime } from "./utils/time";

export class MockFhevmGatewayDecryptor {
  #fhevmEnv: FhevmEnvironment;
  #gatewayChainId: number;
  #decryptionMgrAddress: string;
  #decryptionOracleAddress: string;
  #relayerSigner: EthersT.Signer;
  #decryptionOracleReadOnly: EthersT.Contract;
  #kmsSigners: EthersT.Signer[];
  #firstBlockListening: number;
  #lastBlockSnapshotForDecrypt: number;
  #toSkip: bigint[] = [];

  /*
    From Solidity file: 'DecryptionOracle.sol'

    event DecryptionRequest(
        uint256 indexed counter,
        uint256 requestID,
        bytes32[] cts,
        address contractCaller,
        bytes4 callbackSelector
    );
  */
  static readonly #eventDecryptionItf = new EthersT.Interface([
    "event DecryptionRequest(uint256 indexed counter, uint256 requestID, bytes32[] cts, address contractCaller, bytes4 callbackSelector)",
  ]);

  constructor(
    fhevmEnv: FhevmEnvironment,
    params: {
      gatewayChainId: number;
      decryptionMgrAddress: string;
      decryptionOracleAddress: string;
      decryptionOracleReadOnly: EthersT.Contract;
      kmsSigners: EthersT.Signer[];
      relayerSigner: EthersT.Signer;
      firstBlockListening: number;
    },
  ) {
    this.#fhevmEnv = fhevmEnv;

    const currentNetwork = this.#fhevmEnv.hre.network;
    if (currentNetwork.config.chainId === undefined) {
      throw new Error(`Unable to determine current network chainId (network name: ${currentNetwork.name})`);
    }

    this.#gatewayChainId = params.gatewayChainId;
    this.#decryptionMgrAddress = params.decryptionMgrAddress;
    this.#decryptionOracleAddress = params.decryptionOracleAddress;
    this.#decryptionOracleReadOnly = params.decryptionOracleReadOnly;
    this.#relayerSigner = params.relayerSigner;
    this.#kmsSigners = params.kmsSigners;
    this.#firstBlockListening = params.firstBlockListening;
    this.#lastBlockSnapshotForDecrypt = params.firstBlockListening;

    if (this.#relayerSigner === undefined) {
      throw new HardhatFhevmError("Missing relayer signer.");
    }
  }

  private get hre(): HardhatRuntimeEnvironment {
    return this.#fhevmEnv.hre;
  }

  public static async create(fhevmEnv: FhevmEnvironment, traceEvents?: boolean): Promise<MockFhevmGatewayDecryptor> {
    const decryptionMgrAddress = fhevmEnv.getGatewayDecryptionAddress();
    const kmsSigners = fhevmEnv.getKMSSigners();
    const decryptionOracleAddress = fhevmEnv.getDecryptionOracleAddress();
    const relayerSigner = fhevmEnv.getRelayerSigner();
    const gatewayChainId = fhevmEnv.getGatewayChainId();

    if (!EthersT.isAddress(decryptionMgrAddress)) {
      throw new Error(`Invalid Decryption Manager Address ${decryptionMgrAddress}`);
    }

    const hre: HardhatRuntimeEnvironment = fhevmEnv.hre;
    const decryptionOracleReadOnly = fhevmEnv.getDecryptionOracleReadOnly();

    if (traceEvents === true) {
      decryptionOracleReadOnly.on(
        "DecryptionRequest",
        async (counter, requestID, cts, contractCaller, callbackSelector, eventData) => {
          const blockNumber = eventData.log.blockNumber;
          console.log(
            `${currentTime()} - Requested decrypt on block ${blockNumber} (counter ${counter} - requestID ${requestID})`,
          );
        },
      );
    }

    const firstBlockListening = await hre.ethers.provider.getBlockNumber();
    if (hre.network.name === "hardhat" && isSolidityCoverageRunning(hre)) {
      // evm_snapshot is not supported in coverage mode
      await hre.ethers.provider.send("set_lastBlockSnapshotForDecrypt", [firstBlockListening]);
    }

    return new MockFhevmGatewayDecryptor(fhevmEnv, {
      gatewayChainId,
      decryptionMgrAddress,
      decryptionOracleAddress,
      decryptionOracleReadOnly,
      relayerSigner,
      kmsSigners,
      firstBlockListening,
    });
  }

  private async _getLastBlockSnapshotForDecrypt(): Promise<number> {
    // Using this.#hre.network.provider or this.#hre.ethers.provider ??
    const ls = await this.#fhevmEnv.hre.network.provider.send("get_lastBlockSnapshotForDecrypt");
    assert(ls !== undefined, "get_lastBlockSnapshotForDecrypt return value is undefined");
    return ls;
  }

  private async _setLastBlockSnapshotForDecrypt(ls: number) {
    // Using this.#hre.network.provider or this.#hre.ethers.provider ??
    await this.#fhevmEnv.hre.network.provider.send("set_lastBlockSnapshotForDecrypt", [ls]);
  }

  public async awaitAllDecryptionResults(): Promise<void> {
    if (this.#relayerSigner === undefined) {
      throw new Error("Missing relayer signer");
    }

    const hre: HardhatRuntimeEnvironment = this.#fhevmEnv.hre;
    const isHardhat = hre.network.name === "hardhat";
    const solidityCoverageRunning = isSolidityCoverageRunning(hre);

    // Read evm snapshot
    if (isHardhat && !solidityCoverageRunning) {
      // evm_snapshot is not supported in coverage mode
      this.#lastBlockSnapshotForDecrypt = await this._getLastBlockSnapshotForDecrypt();
      if (this.#lastBlockSnapshotForDecrypt < this.#firstBlockListening) {
        this.#firstBlockListening = this.#lastBlockSnapshotForDecrypt + 1;
      }
    }

    await this._fulfillAllPastRequestsIds(isHardhat);

    // Save evm snapshot
    this.#firstBlockListening = (await hre.ethers.provider.getBlockNumber()) + 1;
    if (isHardhat && !solidityCoverageRunning) {
      // evm_snapshot is not supported in coverage mode
      await this._setLastBlockSnapshotForDecrypt(this.#firstBlockListening);
    }
  }

  private async _fulfillAllPastRequestsIds(mocked: boolean) {
    const eventDecryption = await this.#decryptionOracleReadOnly.filters.DecryptionRequest().getTopicFilter();

    // GATEWAYCONTRACT_ADDRESS == DECRYPTION_ORACLE_ADDRESS
    const filterDecryption = {
      address: this.#decryptionOracleAddress, //parsedEnv.DECRYPTION_ORACLE_ADDRESS,
      fromBlock: this.#firstBlockListening,
      toBlock: "latest",
      topics: eventDecryption,
    };

    const pastLogs: EthersT.Log[] = await this.#fhevmEnv.hre.ethers.provider.getLogs(filterDecryption);

    for (const log of pastLogs) {
      const event: EthersT.LogDescription | null = MockFhevmGatewayDecryptor.#eventDecryptionItf.parseLog(log);
      if (!event) {
        throw new Error("Event is null");
      }

      const requestID = event.args[1]; //uint256
      assertEventArgUint256(requestID, "DecryptionRequest", 1);

      if (!mocked || this.#toSkip.includes(requestID)) {
        continue;
      }

      const handlesBytes32 = event.args[2] as string[]; //bytes32[]
      const contractCaller = event.args[3] as string; //address
      const callbackSelector = event.args[4] as string; //bytes4

      assert(handlesBytes32.length > 0);

      assertEventArgAddress(contractCaller, "DecryptionRequest", 1);
      assertEventArgBytes4(callbackSelector, "DecryptionRequest", 1);
      assertEventArgBytes32(handlesBytes32[0], "DecryptionRequest", 2);

      const fhevmHandles = handlesBytes32.map((handleBytes32) => parseFhevmHandle(handleBytes32));

      // in mocked mode, we trigger the decryption fulfillment manually
      await this.#fhevmEnv.coproc.awaitCoprocessor();

      // first check that all handles are allowed for decryption
      const aclReadOnly = this.#fhevmEnv.getACLReadOnly();
      const isAllowedForDec: boolean[] = await Promise.all(
        handlesBytes32.map(async (handleBytes32: string) => aclReadOnly.isAllowedForDecryption(handleBytes32)),
      );

      for (let i = 0; i < isAllowedForDec.length; ++i) {
        if (!isAllowedForDec[i]) {
          throw new Error(`Handle ${handlesBytes32[i]} is not authorized for decryption`);
        }
      }

      const clearTextValuesString: string[] = await Promise.all(
        handlesBytes32.map(
          async (handleBytes32: string) => await this.#fhevmEnv.db.sqlQueryHandleBytes32(handleBytes32),
        ),
      );

      const abiTypes: string[] = [];
      const abiValues: (string | bigint)[] = [];

      for (let i = 0; i < handlesBytes32.length; ++i) {
        const clearTextValueString: string = clearTextValuesString[i];
        const fhevmTypeInfo = getFhevmHandleTypeInfo(fhevmHandles[i]);

        abiTypes.push(fhevmTypeInfo.solidityTypeName);

        switch (fhevmTypeInfo.type) {
          case FhevmType.eaddress: {
            // string
            abiValues.push(`0x${BigInt(clearTextValueString).toString(16).padStart(40, "0")}`);
            break;
          }
          case FhevmType.ebool: {
            // bigint (0 or 1)
            abiValues.push(BigInt(clearTextValueString));
            break;
          }
          case FhevmType.euint4:
          case FhevmType.euint8:
          case FhevmType.euint16:
          case FhevmType.euint32:
          case FhevmType.euint64:
          case FhevmType.euint128:
          case FhevmType.euint256: {
            // bigint
            abiValues.push(BigInt(clearTextValueString));
            break;
          }
          case FhevmType.ebytes64: {
            // string
            abiValues.push(`0x${BigInt(clearTextValueString).toString(16).padStart(128, "0")}`);
            break;
          }
          case FhevmType.ebytes128: {
            // string
            abiValues.push(`0x${BigInt(clearTextValueString).toString(16).padStart(256, "0")}`);
            break;
          }
          case FhevmType.ebytes256: {
            // string
            abiValues.push(`0x${BigInt(clearTextValueString).toString(16).padStart(512, "0")}`);
            break;
          }
          default: {
            throw new HardhatFhevmError(
              `Unsupported Fhevm primitive type id: ${fhevmTypeInfo.type}, name: ${fhevmTypeInfo.name}, solidity: ${fhevmTypeInfo.solidityTypeName}`,
            );
          }
        }
      }

      const abiCoder = new this.#fhevmEnv.hre.ethers.AbiCoder();

      // 1. 31 is just a dummy uint256 requestID to get correct abi encoding for the remaining arguments
      //    (i.e everything except the requestID)
      // 2. Adding also a dummy empty array of bytes for correct abi-encoding when used with signatures
      const encodedData = abiCoder.encode(["uint256", ...abiTypes, "bytes[]"], [31, ...abiValues, []]);

      // 1. We pop the dummy requestID to get the correct value to pass for `decryptedCts`
      // 2. We also pop the last 32 bytes (empty bytes[])
      const decryptedResult = "0x" + encodedData.slice(66).slice(0, -64);

      // See: fhevm-gateway/contracts/Decryption.sol
      const eip712 = createPublicDecryptVerificationEIP712(
        this.#gatewayChainId,
        this.#decryptionMgrAddress,
        handlesBytes32,
        decryptedResult,
      );
      const decryptResultsEIP712signatures: string[] = await multiSignEIP712(
        this.#kmsSigners,
        eip712.domain,
        eip712.types,
        eip712.message,
      );

      // Call relayer
      const calldata =
        callbackSelector +
        abiCoder
          .encode(["uint256", ...abiTypes, "bytes[]"], [requestID, ...abiValues, decryptResultsEIP712signatures])
          .slice(2);

      const txData = {
        to: contractCaller,
        data: calldata,
      };

      // Simulate the relayer callback performed by the relayer signer
      try {
        const tx = await this.#relayerSigner.sendTransaction(txData);
        await tx.wait();
      } catch (error) {
        if (error instanceof Error) {
          console.log("Gateway fulfillment tx failed with the following error:", error.message);
        } else {
          console.log("Gateway fulfillment tx failed with an unknown error");
        }

        this.#toSkip.push(requestID);

        throw error;
      }
    }
  }
}
