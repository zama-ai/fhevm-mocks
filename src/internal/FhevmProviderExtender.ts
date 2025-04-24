import assert from "assert";
import { ethers as EthersT } from "ethers";
import { ProviderWrapper } from "hardhat/plugins";
import type { EIP1193Provider, HardhatConfig, HardhatRuntimeEnvironment, RequestArguments } from "hardhat/types";

import constants from "../constants";
import { isSolidityCoverageRunning } from "./utils/hh";

const USE_ETHERS_PROVIDER: boolean = true;

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

// isHardhat && !solidityCoverageRunning
export async function getLastBlockSnapshot(
  hre: HardhatRuntimeEnvironment,
): Promise<{ lastBlockSnapshot: number; lastCounterRand: number }> {
  // evm_snapshot is not supported in coverage mode
  assert(hre.network.name === "hardhat");
  assert(!isSolidityCoverageRunning(hre));

  // Using this.#hre.network.provider or this.#hre.ethers.provider ??
  const provider = USE_ETHERS_PROVIDER ? hre.ethers.provider : hre.network.provider;

  const res = await provider.send("get_lastBlockSnapshot");

  assert(Array.isArray(res));
  assert(res.length === 2);

  const lastBlockSnapshot = res[0];
  const lastCounterRand = res[1];

  assert(typeof lastBlockSnapshot === "number");
  assert(typeof lastCounterRand === "number");

  return {
    lastBlockSnapshot,
    lastCounterRand,
  };
}

// isHardhat && !solidityCoverageRunning
export async function setLastBlockSnapshot(hre: HardhatRuntimeEnvironment, lastBlockSnapshot: number): Promise<void> {
  // evm_snapshot is not supported in coverage mode
  assert(hre.network.name === "hardhat");
  assert(!isSolidityCoverageRunning(hre));

  // Using this.#hre.network.provider or this.#hre.ethers.provider ??
  const provider = USE_ETHERS_PROVIDER ? hre.ethers.provider : hre.network.provider;

  const res = await provider.send("set_lastBlockSnapshot", [lastBlockSnapshot]);

  assert(res === lastBlockSnapshot);
}

// isHardhat && !solidityCoverageRunning
export async function getLastBlockSnapshotForDecrypt(hre: HardhatRuntimeEnvironment): Promise<number> {
  // evm_snapshot is not supported in coverage mode
  assert(hre.network.name === "hardhat");
  assert(!isSolidityCoverageRunning(hre));

  // Using this.#hre.network.provider or this.#hre.ethers.provider ??
  const provider = USE_ETHERS_PROVIDER ? hre.ethers.provider : hre.network.provider;

  const res = await provider.send("get_lastBlockSnapshotForDecrypt");

  assert(typeof res === "number");

  return res;
}

// isHardhat && !solidityCoverageRunning
export async function setLastBlockSnapshotForDecrypt(
  hre: HardhatRuntimeEnvironment,
  lastBlockSnapshotForDecrypt: number,
) {
  // evm_snapshot is not supported in coverage mode
  assert(hre.network.name === "hardhat");
  assert(!isSolidityCoverageRunning(hre));

  // Using this.#hre.network.provider or this.#hre.ethers.provider ??
  const provider = USE_ETHERS_PROVIDER ? hre.ethers.provider : hre.network.provider;

  // Using this.#hre.network.provider or this.#hre.ethers.provider ??
  const res = await provider.send("set_lastBlockSnapshotForDecrypt", [lastBlockSnapshotForDecrypt]);

  assert(res === lastBlockSnapshotForDecrypt);
}
