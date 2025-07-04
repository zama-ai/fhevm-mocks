import { EIP1193Provider, HardhatConfig, ProviderExtender } from "hardhat/types";

import { HardhatFhevmError } from "../error";
import { FhevmProviderExtender } from "./provider/FhevmProviderExtender";

/**
 * Hardhat ProviderExtender
 * Called at Hardhat initialization
 */
export const providerExtender: ProviderExtender = async (
  provider: EIP1193Provider,
  config: HardhatConfig,
  network: string,
) => {
  const firstBlock = await provider.request({ method: "eth_blockNumber" });
  if (typeof firstBlock !== "string") {
    throw new HardhatFhevmError("Unable to retrieve chain block number.");
  }

  return new FhevmProviderExtender(provider, config, network, BigInt(firstBlock));
};
