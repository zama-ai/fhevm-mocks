import type { ethers as EthersT } from "ethers";

import { createEIP712, generateKeypair } from "./sdk/keypair.js";

const ENCRYPTION_TYPES = {
  1: 0, // ebool takes 2 encrypted bits
  8: 2,
  16: 3,
  32: 4,
  64: 5,
  128: 6,
  160: 7,
  256: 8,
  512: 9,
  1024: 10,
  2048: 11,
};

type EIP712Type = {
  name: string;
  type: string;
};
type EIP712 = {
  domain: {
    chainId: number;
    name: string;
    verifyingContract: string;
    version: string;
  };
  message: any;
  primaryType: string;
  types: {
    [key: string]: EIP712Type[];
  };
};

type BearerToken = {
  __type: "BearerToken";
  token: string;
};
type ApiKeyHeader = {
  __type: "ApiKeyHeader";
  header?: string;
  value: string;
};
type ApiKeyCookie = {
  __type: "ApiKeyCookie";
  cookie?: string;
  value: string;
};
type Auth = BearerToken | ApiKeyHeader | ApiKeyCookie;

type FhevmInstanceConfig = {
  verifyingContractAddressDecryption: string;
  verifyingContractAddressInputVerification: string;
  kmsContractAddress: string;
  inputVerifierContractAddress: string;
  aclContractAddress: string;
  gatewayChainId: number;
  chainId?: number;
  relayerUrl?: string;
  network?: EthersT.Eip1193Provider | string;
  publicParams?: PublicParams<Uint8Array> | null;
  publicKey?: {
    data: Uint8Array | null;
    id: string | null;
  };
  auth?: Auth;
};

type DecryptedResults = Record<string, bigint | boolean | string>;
type EncryptionTypes = keyof typeof ENCRYPTION_TYPES;
type PublicParams<T = any> = {
  [key in EncryptionTypes]?: {
    publicParams: T;
    publicParamsId: string;
  };
};
type RelayerEncryptedInput = {
  addBool: (value: boolean | number | bigint) => RelayerEncryptedInput;
  add8: (value: number | bigint) => RelayerEncryptedInput;
  add16: (value: number | bigint) => RelayerEncryptedInput;
  add32: (value: number | bigint) => RelayerEncryptedInput;
  add64: (value: number | bigint) => RelayerEncryptedInput;
  add128: (value: number | bigint) => RelayerEncryptedInput;
  add256: (value: number | bigint) => RelayerEncryptedInput;
  addAddress: (value: string) => RelayerEncryptedInput;
  getBits: () => EncryptionTypes[];
  encrypt: () => Promise<{
    handles: Uint8Array[];
    inputProof: Uint8Array;
  }>;
};
type EncryptedInput = {
  addBool: (value: boolean | number | bigint) => EncryptedInput;
  add8: (value: number | bigint) => EncryptedInput;
  add16: (value: number | bigint) => EncryptedInput;
  add32: (value: number | bigint) => EncryptedInput;
  add64: (value: number | bigint) => EncryptedInput;
  add128: (value: number | bigint) => EncryptedInput;
  add256: (value: number | bigint) => EncryptedInput;
  addAddress: (value: string) => EncryptedInput;
  getBits: () => EncryptionTypes[];
  encrypt: () => Uint8Array;
};

type FhevmInstance = {
  createEncryptedInput: (contractAddress: string, userAddress: string) => RelayerEncryptedInput;
  generateKeypair: () => {
    publicKey: string;
    privateKey: string;
  };
  createEIP712: (
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: string | number,
    durationDays: string | number,
  ) => EIP712;
  publicDecrypt: (handles: (string | Uint8Array)[]) => Promise<DecryptedResults>;
  userDecrypt: (
    handles: HandleContractPair[],
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: string | number,
    durationDays: string | number,
  ) => Promise<DecryptedResults>;
  getPublicKey: () => {
    publicKeyId: string;
    publicKey: Uint8Array;
  } | null;
  getPublicParams: (bits: keyof PublicParams) => {
    publicParams: Uint8Array;
    publicParamsId: string;
  } | null;
};

type HandleContractPair = {
  handle: Uint8Array | string;
  contractAddress: string;
};
type HandleContractPairRelayer = {
  handle: string;
  contractAddress: string;
};

export interface FhevmSdkModule {
  createEIP712: (
    gatewayChainId: number,
    verifyingContract: string,
    contractsChainId: number,
  ) => (
    publicKey: string | Uint8Array,
    contractAddresses: string[],
    startTimestamp: string | number,
    durationDays: string | number,
    delegatedAccount?: string,
  ) => EIP712;
  generateKeypair: () => {
    publicKey: string;
    privateKey: string;
  };
}

export type {
  DecryptedResults,
  EncryptionTypes,
  PublicParams,
  RelayerEncryptedInput,
  EncryptedInput,
  FhevmInstanceConfig,
  EIP712Type,
  EIP712,
  HandleContractPair,
  HandleContractPairRelayer,
  FhevmInstance,
};

export { generateKeypair, createEIP712, ENCRYPTION_TYPES };
