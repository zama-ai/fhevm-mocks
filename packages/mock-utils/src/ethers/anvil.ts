import { isHardhatError, isHardhatProviderError } from "../utils/error.js";
import { isNodeRuntime } from "../utils/runtime.js";
import { type MinimalProvider, minimalProviderSend } from "./provider.js";

/**
 * Executes the `anvil_nodeInfo` RPC call on a given provider.
 * @param provider - A `MinimalProvider` that supports either `send` or `request` for RPC interaction.
 * @returns A promise that resolves to the RPC call response.
 */
export async function anvilNodeInfo(provider: MinimalProvider) {
  return minimalProviderSend(provider, "anvil_nodeInfo", []);
}

/**
 * Determines if a given provider is an Anvil instance.
 *
 * @param provider - A `MinimalProvider` that supports either `send` or `request` for RPC interaction.
 * @returns A promise that resolves to one of the following:
 * - `{ isAnvil: true, chainId: number }` if the provider is reachable and reports an Anvil client.
 * - `{ isAnvil: false }` if the provider is reachable but does not report an Anvil client.
 * - `{ couldNotConnect: true }` if the provider is unreachable (e.g. connection refused, timeout).
 *
 * @throws If the provider fails in an unexpected way the function will propagate the error.
 */
export async function isAnvilProvider(
  provider: MinimalProvider,
): Promise<
  | { couldNotConnect: true; isAnvil?: undefined; chainId?: undefined }
  | { couldNotConnect: false; isAnvil: true; chainId: number }
  | { couldNotConnect: false; isAnvil: false }
> {
  try {
    const nodeInfo = await anvilNodeInfo(provider);
    if (!("environment" in nodeInfo)) {
      return { isAnvil: false, couldNotConnect: false };
    }
    const env = nodeInfo.environment;
    if (!("chainId" in env)) {
      return { isAnvil: false, couldNotConnect: false };
    }
    return { isAnvil: true, chainId: Number(BigInt(env.chainId)), couldNotConnect: false };
  } catch (e) {
    if (isHardhatProviderError(e)) {
      // RPC method not supported / method not found
      if (e.code === -32004 || e.code === -32601) {
        return { isAnvil: false, couldNotConnect: false };
      }
    } else if (isHardhatError(e)) {
      // HH only: cannot connect to specified network
      if (e.number === 108) {
        return { couldNotConnect: true };
      }
    } else if (isNodeRuntime()) {
      if (e instanceof Error && "code" in e) {
        // Connection refused, this error can only be catched from a node runtime
        if (e.code === "ECONNREFUSED") {
          return { couldNotConnect: true };
        }
      }
    }

    // Propagate the error
    throw e;
  }
}
