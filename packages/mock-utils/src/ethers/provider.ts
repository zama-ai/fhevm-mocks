import { ethers as EthersT } from "ethers";

import { FhevmError, isHardhatError, isHardhatProviderError } from "../utils/error.js";
import { isNodeRuntime } from "../utils/runtime.js";

export interface MinimalEthereumProvider {
  send(method: string, params: any[]): Promise<any>;
}

/**
 * A minimal provider abstraction that represents any Ethereum-compatible provider
 * capable of sending JSON-RPC requests.
 *
 * This can be either:
 * - An EIP-1193-compliant provider (e.g., `ethers.Eip1193Provider`)
 * - A lower-level provider interface (e.g., `ethers.JsonRpcApiProvider`) that exposes a `send` method
 * - A custom provider interface (e.g. `HardhatEthersProvider`)
 *
 * Used to generalize RPC interactions without relying on full `ethers.js` provider features.
 */
export type MinimalProvider = MinimalEthereumProvider | EthersT.Eip1193Provider;

/**
 * Sends a JSON-RPC request using a minimal Ethereum-compatible provider.
 *
 * This function abstracts over both `EIP-1193`-style providers (which implement `request({ method, params })`)
 * and legacy or lower-level providers (which implement `send(method, params)`), such as Hardhat or
 * custom ethers.js providers.
 *
 * It attempts to call `send()` first (commonly found in Hardhat or JsonRpcApiProvider), and falls back to
 * `request()` if `send` is not available.
 *
 * @param provider - A `MinimalProvider` that supports either `send` or `request` for RPC interaction.
 * @param method - The name of the JSON-RPC method to invoke (e.g. `"eth_getBalance"`).
 * @param params - An array of parameters to pass to the RPC method.
 * @returns A Promise resolving to the JSON-RPC result.
 *
 * @throws {FhevmError} If the provider does not implement a compatible RPC interface.
 */
export async function minimalProviderSend(provider: MinimalProvider, method: string, params: any[]) {
  let response;

  // Call send first otherwise call request.
  // In case provider is a Hardhat provider, call via send.
  if ("send" in provider && typeof provider.send === "function") {
    response = await provider.send(method, params);
  } else if ("request" in provider && typeof provider.request === "function") {
    response = await provider.request({ method, params });
  } else {
    throw new FhevmError("Invalid provider: must implement request() or send()");
  }

  return response;
}

/**
 * Retrieves the `chainId` from a given Ethereum provider.
 *
 * Attempts to query the provider using `eth_chainId`. If the provider is unreachable
 * (e.g., connection refused), the function returns `undefined`. For all other
 * unexpected failures (e.g., malformed response, internal provider error), the function throws.
 *
 * @param provider - A `MinimalProvider` that supports either `send` or `request` for RPC interaction.
 *
 * @returns A promise resolving to:
 * - The `chainId` as a number if the provider is reachable and responds correctly.
 * - `undefined` if the provider is unreachable (network failure).
 *
 * @throws If the provider responds unexpectedly or fails.
 */
export async function connectedChainId(provider: MinimalProvider): Promise<number | undefined> {
  try {
    return await getProviderChainId(provider);
  } catch (e) {
    if (isHardhatProviderError(e)) {
      // RPC method not supported
      if (e.code === -32004) {
        throw e;
      }
    } else if (isHardhatError(e)) {
      // HH only: cannot connect to specified network
      if (e.number === 108) {
        return undefined;
      }
    } else if (isNodeRuntime()) {
      if (e instanceof Error && "code" in e) {
        // Connection refused, this error can only be catched from a node runtime
        if (e.code === "ECONNREFUSED") {
          return undefined;
        }
      }
    }

    // Propagate the error
    throw e;
  }
}

/**
 * Retrieves the `chainId` from a given Ethereum provider using `eth_chainId` RPC call.
 * @param provider - A `MinimalProvider` that supports either `send` or `request` for RPC interaction.
 * @returns A promise that resolves to the chain ID as a number.
 */
export async function getProviderChainId(provider: MinimalProvider): Promise<number | undefined> {
  const chainIdHex = await minimalProviderSend(provider, "eth_chainId", []);
  return Number(BigInt(chainIdHex));
}

/**
 * Retrieves the web3 client version from a given Ethereum provider.
 *
 * @returns A promise that resolves to one of the following:
 * - `{ client: any, couldNotConnect: false }` if the provider is reachable web3 client.
 * - `{ client: undefined, couldNotConnect: false }` if the provider is reachable but is not a valid web3 client.
 * - `{ client: undefined, couldNotConnect: true }` if the provider is unreachable.
 *
 * @throws If the provider fails in an unexpected way the function will propagate the error.
 */
export async function connectedWeb3Client(
  provider: MinimalProvider,
): Promise<{ client: any; couldNotConnect: boolean }> {
  try {
    return { client: await getWeb3ClientVersion(provider), couldNotConnect: false };
  } catch (e) {
    if (isHardhatProviderError(e)) {
      // RPC method not supported
      if (e.code === -32004) {
        return { client: undefined, couldNotConnect: false };
      }
    } else if (isHardhatError(e)) {
      // HH only: cannot connect to specified network
      if (e.number === 108) {
        return { client: undefined, couldNotConnect: true };
      }
    } else if (isNodeRuntime()) {
      if (e instanceof Error && "code" in e) {
        // Connection refused, this error can only be catched from a node runtime
        if (e.code === "ECONNREFUSED") {
          return { client: undefined, couldNotConnect: true };
        }
      }
    }

    // Propagate the error
    throw e;
  }
}

/**
 * Executes the `web3_clientVersion` RPC call on a given provider.
 * @param provider - A `MinimalProvider` that supports either `send` or `request` for RPC interaction.
 * @returns A promise that resolves to the RPC call response.
 */
export async function getWeb3ClientVersion(provider: MinimalProvider) {
  return minimalProviderSend(provider, "web3_clientVersion", []);
}

// Not used
export async function getSignerChainId(signer: EthersT.Signer): Promise<number> {
  const provider = signer.provider;
  if (!provider) {
    throw new FhevmError("Unable to determine signer provider");
  }

  const network = await provider.getNetwork();

  return Number(network.chainId);
}

export function canSign(obj: any): boolean {
  if (!obj) {
    throw new FhevmError(`Invalid argument`);
  }
  const isDirectSigner = typeof obj.signTransaction === "function";
  const canProduceSigner = typeof obj.getSigner === "function";
  return isDirectSigner || canProduceSigner;
}

export function isReadonlyContract(contract: EthersT.BaseContract): boolean {
  return !canSign(contract.runner);
}

export function isReadonlyProvider(obj: any): obj is EthersT.Provider {
  if (!obj) {
    throw new FhevmError(`Invalid argument`);
  }
  return (
    !canSign(obj) &&
    typeof obj.estimateGas === "function" &&
    typeof obj.call === "function" &&
    typeof obj.getBlock === "function" &&
    typeof obj.getNetwork === "function" &&
    typeof obj.getCode === "function"
  );
}
