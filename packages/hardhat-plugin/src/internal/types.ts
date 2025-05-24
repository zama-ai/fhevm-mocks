import { FHEVMConfig } from "../types";
import type { FhevmEnvironment } from "./FhevmEnvironment";

export type PrecompiledCoreContractsAddresses = Omit<FHEVMConfig, "KMSVerifierAddress"> & {
  FHEGasLimitAddress: string;
};

export type FhevmContext = {
  fhevmEnv: FhevmEnvironment | undefined;
  rand: number;
  get: () => FhevmEnvironment;
};
