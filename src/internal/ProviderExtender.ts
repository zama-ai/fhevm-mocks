import { EIP1193Provider, HardhatConfig, ProviderExtender } from "hardhat/types";

import { FhevmProviderExtender } from "./FhevmProviderExtender";

/**
 * Hardhat ProviderExtender
 * Called at Hardhat initialization
 */
export const providerExtender: ProviderExtender = async (
  provider: EIP1193Provider,
  config: HardhatConfig,
  network: string,
) => {
  return new FhevmProviderExtender(provider, config, network);
};
