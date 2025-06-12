import { isHardhatError, isHardhatProviderError } from "../utils/error.js";
import { isNodeRuntime } from "../utils/runtime.js";
import { type MinimalProvider, minimalProviderSend } from "./provider.js";

/**
 * Determines if a given provider is an Hardhat instance.
 *
 * @param provider - A `MinimalProvider` that supports either `send` or `request` for RPC interaction.
 * @returns A promise that resolves to one of the following:
 * - `{ isHardhat: true, chainId: number }` if the provider is reachable and reports an Hardhat client.
 * - `{ isHardhat: false }` if the provider is reachable but does not report an Hardhat client.
 * - `{ couldNotConnect: true }` if the provider is unreachable (e.g. connection refused, timeout).
 *
 * @throws If the provider fails in an unexpected way the function will propagate the error.
 */
export async function isHardhatProvider(
  provider: MinimalProvider,
): Promise<
  | { couldNotConnect: true; isHardhat?: undefined; chainId?: undefined }
  | { couldNotConnect: false; isHardhat: true; chainId: number }
  | { couldNotConnect: false; isHardhat: false }
> {
  try {
    const metadata = await minimalProviderSend(provider, "hardhat_metadata", []);
    if (!("chainId" in metadata) || metadata.chainId !== 31337) {
      return { couldNotConnect: false, isHardhat: false };
    }
    if (!("instanceId" in metadata) || metadata.instanceId.length !== 66) {
      return { couldNotConnect: false, isHardhat: false };
    }
    return { couldNotConnect: false, isHardhat: true, chainId: Number(BigInt(metadata.chainId)) };
  } catch (e) {
    if (isHardhatProviderError(e)) {
      // RPC method not supported or not found
      if (e.code === -32004 || e.code === -32601) {
        return { couldNotConnect: false, isHardhat: false };
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
