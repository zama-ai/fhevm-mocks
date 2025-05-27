import { HardhatError } from "hardhat/internal/core/errors";
import { ProviderError } from "hardhat/internal/core/providers/errors";

import { FhevmProvider } from "../../types";

export async function anvilNodeInfo(provider: FhevmProvider) {
  const res = await provider.send("anvil_nodeInfo", []);
  return res;
}

export async function isAnvilProvider(networkName: string, provider: FhevmProvider) {
  if (networkName === "hardhat") {
    return false;
  }

  try {
    const nodeInfo = await anvilNodeInfo(provider);
    if (!("environment" in nodeInfo)) {
      return false;
    }
    const env = nodeInfo.environment;
    if (!("chainId" in env)) {
      return false;
    }
    return true;
  } catch (e) {
    if (ProviderError.isProviderError(e)) {
      if (e.code === -32004) {
        return false;
      }
      throw e;
    } else if (e instanceof HardhatError) {
      if (e.number === 108) {
        throw e;
      }
    }
    return false;
  }
}
