import { ethers as EthersT } from "ethers";

import { FhevmError } from "../utils/error.js";

export interface MinimalEthereumProvider {
  send(method: string, params: any[]): Promise<any>;
}

export type MinimalProvider = MinimalEthereumProvider | EthersT.Eip1193Provider;

export async function minimalProviderSend(provider: MinimalProvider, method: string, params: any[]) {
  let response;

  if ("request" in provider && typeof provider.request === "function") {
    response = await provider.request({ method, params });
  } else if ("send" in provider && typeof provider.send === "function") {
    response = await provider.send(method, params);
  } else {
    throw new Error("Invalid provider: must implement request() or send()");
  }

  return response;
}

export async function getProviderChainId(provider: MinimalProvider): Promise<number | undefined> {
  const chainIdHex = await minimalProviderSend(provider, "eth_chainId", []);
  return Number(BigInt(chainIdHex));
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
