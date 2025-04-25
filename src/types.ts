import { EIP712, FhevmInstance, HandleContractPair, RelayerEncryptedInput } from "@fhevm/sdk/node";
import { AddressLike, BigNumberish, Numeric, Signer } from "ethers";

import { FhevmType, FhevmTypeEbytes, FhevmTypeEuint } from "./internal/handle/FhevmType";

export { FhevmType, FhevmTypeEuint, FhevmTypeEbytes };
export type FhevmCoprocessorContractName = "ACL" | "FHEVMExecutor" | "InputVerifier" | "KMSVerifier" | "FHEGasLimit";
export type FhevmGatewayContractName = "DecryptionOracle";
export type FhevmContractName = FhevmCoprocessorContractName | FhevmGatewayContractName;

export type HardhatFhevmMockType = "onchain" | "mock";

export type FHEVMConfig = {
  ACLAddress: string;
  FHEVMExecutorAddress: string;
  KMSVerifierAddress: string;
  InputVerifierAddress: string;
};

export type FhevmKeypair = {
  publicKey: string;
  privateKey: string;
};

export type FhevmUserDecryptValidity = {
  startTimestamp: Numeric; // number of seconds
  durationDays: Numeric;
};

export type FhevmUserDecryptOptions = {
  instance?: FhevmInstance;
  keypair?: FhevmKeypair;
  validity?: FhevmUserDecryptValidity;
};

export interface HardhatFhevmRuntimeEnvironment {
  relayerSignerAddress: string;
  debugger: HardhatFhevmRuntimeDebugger;
  awaitAllDecryptionResults(): Promise<void>;
  assertCoprocessorInitialized(contract: AddressLike, contractName?: string): Promise<void>;
  assertDecryptionOracleInitialized(contract: AddressLike, contractName?: string): Promise<void>;

  createEncryptedInput(contractAddress: string, userAddress: string): RelayerEncryptedInput;
  createEIP712(
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: string | number,
    durationDays: string | number,
  ): EIP712;
  generateKeypair(): {
    publicKey: string;
    privateKey: string;
  };
  userDecrypt(
    handles: HandleContractPair[],
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: string | number,
    durationDays: string | number,
  ): Promise<bigint[]>;

  userDecryptEbool(
    handleBytes32: string,
    contractAddress: AddressLike,
    user: Signer,
    options?: FhevmUserDecryptOptions,
  ): Promise<boolean>;

  userDecryptEuint(
    fhevmType: FhevmTypeEuint,
    handleBytes32: string,
    contractAddress: AddressLike,
    user: Signer,
    options?: FhevmUserDecryptOptions,
  ): Promise<bigint>;

  userDecryptEbytes(
    fhevmType: FhevmTypeEbytes,
    handleBytes32: string,
    contractAddress: AddressLike,
    user: Signer,
    options?: FhevmUserDecryptOptions,
  ): Promise<bigint>;

  userDecryptEaddress(
    handleBytes32: string,
    contractAddress: AddressLike,
    user: Signer,
    options?: FhevmUserDecryptOptions,
  ): Promise<string>;
}

export interface HardhatFhevmRuntimeDebugger {
  decryptEbool(handleBytes32: BigNumberish): Promise<boolean>;
  decryptEuint(fhevmType: FhevmTypeEuint, handleBytes32: BigNumberish): Promise<bigint>;
  decryptEbytes(fhevmType: FhevmTypeEbytes, handleBytes32: BigNumberish): Promise<string>;
  decryptEaddress(handleBytes32: BigNumberish): Promise<string>;
}
