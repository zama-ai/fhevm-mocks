import { ethers as EthersT } from "ethers";

import { FhevmError } from "../../utils/error.js";
import { ACL } from "./ACL.js";
import { FHEGasLimit } from "./FHEGasLimit.js";
import { FHEVMExecutor } from "./FHEVMExecutor.js";
import { InputVerifier } from "./InputVerifier.js";
import { KMSVerifier } from "./KMSVerifier.js";

export type FhevmCoprocessorContractName = "ACL" | "FHEVMExecutor" | "InputVerifier" | "KMSVerifier" | "FHEGasLimit";
export type FhevmDecryptionOracleContractName = "DecryptionOracle";
export type FhevmContractName = FhevmCoprocessorContractName | FhevmDecryptionOracleContractName;

export { ACL, FHEGasLimit, FHEVMExecutor, InputVerifier, KMSVerifier };

export type FhevmContractsInfo = {
  kmsVerifier: KMSVerifier;
  acl: ACL;
  fhevmExecutor: FHEVMExecutor;
  inputVerifier: InputVerifier;
  fheGasLimit: FHEGasLimit;
};

export async function initFhevmContractsInfo(
  runner: EthersT.ContractRunner,
  aclContractAddress: string,
  kmsVerifierContractAddress: string,
): Promise<FhevmContractsInfo> {
  if (!EthersT.isAddress(aclContractAddress)) {
    throw new FhevmError(`Invalid ACL contract address ${aclContractAddress}`);
  }
  if (!EthersT.isAddress(kmsVerifierContractAddress)) {
    throw new FhevmError(`Invalid KMSVerifier contract address ${kmsVerifierContractAddress}`);
  }

  const acl = await ACL.create(runner, aclContractAddress);
  const fhevmExecutor = await FHEVMExecutor.create(runner, acl.fhevmExecutorAddress);
  const inputVerifier = await InputVerifier.create(runner, fhevmExecutor.inputVerifierAddress);
  const kmsVerifier = await KMSVerifier.create(runner, kmsVerifierContractAddress);
  const fheGasLimit = await FHEGasLimit.create(runner, fhevmExecutor.fheGasLimitAddress);

  return {
    kmsVerifier,
    acl,
    fhevmExecutor,
    inputVerifier,
    fheGasLimit,
  };
}
