import { FHEVMConfig } from "@fhevm/mock-utils";
import { ethers as EthersT } from "ethers";

import type { FhevmEnvironment } from "./FhevmEnvironment";

export type PrecompiledCoreContractsAddresses = Omit<FHEVMConfig, "KMSVerifierAddress"> & {
  HCULimitAddress: string;
};

export type FhevmContext = {
  fhevmEnv: FhevmEnvironment | undefined;
  rand: number;
  get: () => FhevmEnvironment;
};

export interface FhevmProvider extends EthersT.Provider {
  send(method: string, params?: any[]): Promise<any>;
}
