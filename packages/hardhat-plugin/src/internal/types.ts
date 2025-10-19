import { CoprocessorConfig } from "@fhevm/mock-utils";
import { ethers as EthersT } from "ethers";

import type { FhevmEnvironment } from "./FhevmEnvironment";

export type PrecompiledHostContractsAddresses = Omit<
  CoprocessorConfig,
  "KMSVerifierAddress" | "DecryptionOracleAddress"
> & {
  HCULimitAddress: `0x${string}`;
  InputVerifierAddress: `0x${string}`;
};

export type FhevmContext = {
  fhevmEnv: FhevmEnvironment | undefined;
  rand: number;
  get: () => FhevmEnvironment;
};

export interface FhevmProvider extends EthersT.Provider {
  send(method: string, params?: any[]): Promise<any>;
}
