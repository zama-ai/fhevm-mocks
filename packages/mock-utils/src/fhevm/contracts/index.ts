import { ACL } from "./ACL.js";
import { FHEVMExecutor } from "./FHEVMExecutor.js";
import {
  FhevmContractWrapper,
  FhevmCoprocessorContractWrapper,
  FhevmDecryptionOracleContractWrapper,
} from "./FhevmContractWrapper.js";
import { FhevmContractsRepository } from "./FhevmContractsRepository.js";
import { HCULimit } from "./HCULimit.js";
import { InputVerifier } from "./InputVerifier.js";
import { KMSVerifier } from "./KMSVerifier.js";
import { ACLInterfaceVersion } from "./interfaces/ACL.itf.js";
import { FHEVMExecutorInterfaceVersion } from "./interfaces/FHEVMExecutor.itf.js";
import { HCULimitInterfaceVersion } from "./interfaces/HCULimit.itf.js";
import { InputVerifierInterfaceVersion } from "./interfaces/InputVerifier.itf.js";
import { KMSVerifierInterfaceVersion } from "./interfaces/KMSVerifier.itf.js";
import { ZamaFheDecryptionOracleInterfaceVersion } from "./interfaces/ZamaFheDecryptionOracle.itf.js";

export type FhevmCoprocessorContractName = "ACL" | "FHEVMExecutor" | "InputVerifier" | "KMSVerifier" | "HCULimit";
export type FhevmDecryptionOracleContractName = "DecryptionOracle";
export type FhevmContractName = FhevmCoprocessorContractName | FhevmDecryptionOracleContractName;

export function getContractsABIVersions(): Record<FhevmContractName, string> {
  return {
    ACL: ACLInterfaceVersion,
    FHEVMExecutor: FHEVMExecutorInterfaceVersion,
    InputVerifier: InputVerifierInterfaceVersion,
    KMSVerifier: KMSVerifierInterfaceVersion,
    HCULimit: HCULimitInterfaceVersion,
    DecryptionOracle: ZamaFheDecryptionOracleInterfaceVersion,
  };
}

export {
  ACL,
  HCULimit,
  FHEVMExecutor,
  InputVerifier,
  KMSVerifier,
  FhevmContractsRepository,
  FhevmContractWrapper,
  FhevmCoprocessorContractWrapper,
  FhevmDecryptionOracleContractWrapper,
};
