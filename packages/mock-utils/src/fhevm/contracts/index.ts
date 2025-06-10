import { ACL } from "./ACL.js";
import { FHEGasLimit } from "./FHEGasLimit.js";
import { FHEVMExecutor } from "./FHEVMExecutor.js";
import { FhevmContractsRepository } from "./FhevmContractsRepository.js";
import { InputVerifier } from "./InputVerifier.js";
import { KMSVerifier } from "./KMSVerifier.js";

export type FhevmCoprocessorContractName = "ACL" | "FHEVMExecutor" | "InputVerifier" | "KMSVerifier" | "FHEGasLimit";
export type FhevmDecryptionOracleContractName = "DecryptionOracle";
export type FhevmContractName = FhevmCoprocessorContractName | FhevmDecryptionOracleContractName;

export { ACL, FHEGasLimit, FHEVMExecutor, InputVerifier, KMSVerifier, FhevmContractsRepository };
