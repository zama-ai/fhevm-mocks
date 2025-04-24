import { ethers as EthersT } from "ethers";
import { ProviderWrapper } from "hardhat/plugins";
import type { EIP1193Provider, HardhatConfig, RequestArguments } from "hardhat/types";

import constants from "../constants";

// Always instanciated at "test" startup
export class FhevmProviderExtender extends ProviderWrapper {
  protected readonly _wrappedProvider: EIP1193Provider;
  protected readonly _config: HardhatConfig;
  protected readonly _networkName: string;

  private lastBlockSnapshot: number;
  private lastCounterRand: number;
  private lastBlockSnapshotForDecrypt: number;

  // override estimated gasLimit by 120%, to avoid some edge case with ethermint gas estimation
  private static readonly ESTIMATEGAS_PERCENTAGE: bigint = 120n;

  constructor(_wrappedProvider: EIP1193Provider, _config: HardhatConfig, _network: string) {
    super(_wrappedProvider);
    this._wrappedProvider = _wrappedProvider;
    this._config = _config;
    this._networkName = _network;

    this.lastBlockSnapshot = 0; // Initialize the variable
    this.lastCounterRand = 0;
    this.lastBlockSnapshotForDecrypt = 0;
  }

  /**
   * @todo Not running anymore.
   * Call MockedPrecompile.sol:counterRand property
   */
  private async solidityMockedPrecompileGetCounterRand(): Promise<number> {
    // MockedPrecompile.sol:
    // get public property: MockedPrecompile.counterRand
    const callData = {
      to: constants.EXT_TFHE_LIBRARY, // MockedPrecompile address
      data: "0x1f20d85c", //counterRand property
    };
    return Number(
      await this._wrappedProvider.request({
        method: "eth_call",
        params: [callData, "latest"],
      }),
    );
  }

  public async request(args: RequestArguments) {
    if (args.method === "eth_estimateGas") {
      const estimatedGasLimit = BigInt((await this._wrappedProvider.request(args)) as bigint);
      const increasedGasLimit = EthersT.toBeHex(
        (estimatedGasLimit * FhevmProviderExtender.ESTIMATEGAS_PERCENTAGE) / 100n,
      );
      return increasedGasLimit;
    }

    if (args.method === "evm_revert") {
      const result = await this._wrappedProvider.request(args);
      const blockNumberHex = (await this._wrappedProvider.request({ method: "eth_blockNumber" })) as string;

      this.lastBlockSnapshot = parseInt(blockNumberHex);
      this.lastBlockSnapshotForDecrypt = parseInt(blockNumberHex);
      this.lastCounterRand = await this.solidityMockedPrecompileGetCounterRand();
      return result;
    }

    if (args.method === "get_lastBlockSnapshot") {
      return [this.lastBlockSnapshot, this.lastCounterRand];
    }

    if (args.method === "get_lastBlockSnapshotForDecrypt") {
      return this.lastBlockSnapshotForDecrypt;
    }

    if (args.method === "set_lastBlockSnapshot") {
      this.lastBlockSnapshot = Array.isArray(args.params!) && args.params[0];
      return this.lastBlockSnapshot;
    }

    if (args.method === "set_lastBlockSnapshotForDecrypt") {
      this.lastBlockSnapshotForDecrypt = Array.isArray(args.params!) && args.params[0];
      return this.lastBlockSnapshotForDecrypt;
    }

    const result = this._wrappedProvider.request(args);

    return result;
  }
}
