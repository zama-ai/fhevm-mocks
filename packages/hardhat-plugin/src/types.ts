import {
  CoprocessorEvent,
  DecryptionRequestEvent,
  FhevmContractName,
  FhevmHandleCoder,
  FhevmTypeEbytes,
  FhevmTypeEuint,
} from "@fhevm/mock-utils";
import type {
  DecryptedResults,
  EIP712,
  FhevmInstance,
  HandleContractPair,
  RelayerEncryptedInput,
} from "@zama-fhe/relayer-sdk/node";
import { AddressLike, BigNumberish, Numeric, Provider, Signer, ethers } from "ethers";

import { FhevmContractError } from "./internal/errors/FhevmContractError";

export { FhevmType, FhevmTypeEbytes, FhevmTypeEuint } from "@fhevm/mock-utils";

export interface FhevmProvider extends Provider {
  send(method: string, params?: any[]): Promise<any>;
}

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
  isMock: boolean;
  relayerSignerAddress: string;
  debugger: HardhatFhevmRuntimeDebugger;

  parseCoprocessorEvents(logs: (ethers.EventLog | ethers.Log)[] | null | undefined): CoprocessorEvent[];
  parseDecryptionRequestEvents(logs: (ethers.EventLog | ethers.Log)[] | null | undefined): DecryptionRequestEvent[];

  awaitDecryptionOracle(): Promise<void>;

  assertCoprocessorInitialized(contract: AddressLike, contractName?: string): Promise<void>;
  assertDecryptionOracleInitialized(contract: AddressLike, contractName?: string): Promise<void>;

  revertedWithCustomErrorArgs(
    contractName: FhevmContractName,
    customErrorName: string,
  ): [{ interface: ethers.Interface }, string];

  tryParseFhevmError(
    e: unknown,
    options?: {
      encryptedInput?: RelayerEncryptedInput;
      out?: "stderr" | "stdout" | "console";
    },
  ): Promise<FhevmContractError | undefined>;

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
  ): Promise<DecryptedResults>;

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
  createHandleCoder(): FhevmHandleCoder;

  createDecryptionSignatures(
    handlesBytes32Hex: string[],
    clearTextValues: (bigint | string | boolean)[],
  ): Promise<string[]>;

  decryptEbool(handleBytes32: BigNumberish): Promise<boolean>;
  decryptEuint(fhevmType: FhevmTypeEuint, handleBytes32: BigNumberish): Promise<bigint>;
  decryptEbytes(fhevmType: FhevmTypeEbytes, handleBytes32: BigNumberish): Promise<string>;
  decryptEaddress(handleBytes32: BigNumberish): Promise<string>;
}
