import { connectedChainId, isHardhatProvider } from "@fhevm/mock-utils";
import { ethers as EthersT } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { HardhatFhevmError } from "../../error";
import constants from "../constants";
import { FhevmProvider } from "../types";

/**
 * Validates the current `HardhatRuntimeEnvironment` hre object to ensure that
 * essential Hardhat plugins and provider bindings are correctly configured.
 *
 * Specifically:
 * - Verifies that the `@nomicfoundation/hardhat-ethers` plugin is loaded.
 * - Checks consistency between `hre.ethers.provider` and `hre.network.provider`.
 *
 * @param hre - The `HardhatRuntimeEnvironment` object
 * @throws Will throw an error if:
 * - The `@nomicfoundation/hardhat-ethers` plugin is not loaded.
 * - The `hre.ethers.provider` object is inconsistent with the `hre.network.provider` object.
 */
export function checkHardhatRuntimeEnvironment(hre: HardhatRuntimeEnvironment) {
  if (!("ethers" in hre && hre.ethers !== undefined && hre.ethers !== null)) {
    throw new HardhatFhevmError(
      `Missing "@nomicfoundation/hardhat-ethers" plugin. Make sure the "@nomicfoundation/hardhat-ethers" plugin is properly initialized in the hardhat config file.`,
    );
  }

  if (!("provider" in hre.ethers && hre.ethers.provider !== undefined && hre.ethers.provider !== null)) {
    throw new HardhatFhevmError(
      `Unexpected "@nomicfoundation/hardhat-ethers" plugin. Unable to access the 'provider' property.`,
    );
  }

  const _hardhatProvider = (hre.ethers.provider as any)["_hardhatProvider"];
  if (!_hardhatProvider) {
    return; //wrong version or no more exposed
  }

  /**
   * see https://github.com/NomicFoundation/hardhat/blob/d77ecabb19e31f010dc9da2c023253b9da41c147/packages/hardhat-ethers/src/internal/index.ts#L26
   */
  if (_hardhatProvider !== hre.network.provider) {
    throw new HardhatFhevmError(`hre.ethers.provider._hardhatProvider !== hre.network.provider`);
  }
}

export function computeDummyAddress(): string {
  return EthersT.getAddress(
    EthersT.toBeHex(
      (BigInt(EthersT.keccak256(EthersT.toUtf8Bytes("fhevm-hardhat-plugin.dummy"))) - 1n) &
        0xffffffffffffffffffffffffffffffffffffffffn,
      20,
    ),
  );
}

export async function resolveNetworkConfigChainId(
  hre: HardhatRuntimeEnvironment,
  useEthChainId: boolean,
): Promise<number> {
  if (hre.network.config.chainId === undefined) {
    const chainId: number | undefined = useEthChainId ? await connectedChainId(hre.ethers.provider) : undefined;
    if (chainId === undefined) {
      // No network connection
      if (hre.network.name === "localhost") {
        return constants.DEVELOPMENT_NETWORK_CHAINID;
      }
      throw new HardhatFhevmError(`Unable to resolve network chainId. Network name: ${hre.network.name}`);
    }
    return chainId;
  }

  return hre.network.config.chainId;
}

export async function getWeb3ClientVersion(provider: FhevmProvider) {
  return await provider.send("web3_clientVersion");
}

export async function isHardhatNode(networkName: string, chainId: number | undefined, provider: FhevmProvider) {
  if (networkName !== "localhost") {
    return false;
  }

  const res = await isHardhatProvider(provider);
  if (res.couldNotConnect) {
    // If all the conditions are met:
    // - we cannot connect to provider
    // - the network is `localhost`
    // - the chainId is 31337
    // Then we assume that the provider we want to connect to must be the Hardhat Node.
    return chainId === constants.DEVELOPMENT_NETWORK_CHAINID;
  }

  if (!res.isHardhat) {
    return false;
  }

  // We try to connect to a hardhat runtime with the wrong chainId
  // Hardhat node chainId is always 31337
  if (res.chainId !== constants.DEVELOPMENT_NETWORK_CHAINID) {
    return false;
  }

  return chainId === undefined || res.chainId === chainId;
}

export async function checkSupportedNetwork(hre: HardhatRuntimeEnvironment) {
  if (hre.network.name === "hardhat") {
    return;
  }

  if (await isHardhatNode(hre.network.name, hre.network.config.chainId, hre.ethers.provider)) {
    return true;
  }

  if (hre.network.name === "localhost") {
    throw new HardhatFhevmError(
      `Unsupported network: The fhevm hardhat plugin only supports the default 'localhost' hardhat node with chainId=${constants.DEVELOPMENT_NETWORK_CHAINID}. Got network 'localhost' with chainId=${hre.network.config.chainId} instead.`,
    );
  }

  throw new HardhatFhevmError(
    `Unsupported network: The fhevm hardhat plugin only supports the 'hardhat' network or the 'localhost' hardhat node with chainId=${constants.DEVELOPMENT_NETWORK_CHAINID}. Got network '${hre.network.name}' with chainId=${hre.network.config.chainId} instead.`,
  );
}
