import type {
  Auth,
  ClearValueType,
  ClearValues,
  EncryptionBits,
  FhevmInstance,
  FhevmInstanceConfig,
  HandleContractPair,
  HandleContractPairRelayer,
  KmsUserDecryptEIP712Type,
  PublicDecryptResults,
  PublicParams,
  RelayerEncryptedInput,
  RelayerInputProofOptionsType,
  UserDecryptResults,
  ZKProofLike,
} from "@zama-fhe/relayer-sdk/node";

import { generateKeypair } from "./sdk/keypair.js";

const ENCRYPTION_TYPES = {
  2: 0, // ebool takes 2 encrypted bits
  8: 2,
  16: 3,
  32: 4,
  64: 5,
  128: 6,
  160: 7,
  256: 8,
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
  getBits: () => EncryptionBits[];
  encrypt: () => Uint8Array;
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
  ) => KmsUserDecryptEIP712Type;
  generateKeypair: () => {
    publicKey: string;
    privateKey: string;
  };
}

export type {
  UserDecryptResults,
  PublicDecryptResults,
  ClearValueType,
  ClearValues,
  EncryptionBits,
  PublicParams,
  RelayerEncryptedInput,
  EncryptedInput,
  FhevmInstanceConfig,
  Auth,
  HandleContractPair,
  HandleContractPairRelayer,
  FhevmInstance,
  ZKProofLike,
  RelayerInputProofOptionsType,
};

export { generateKeypair, ENCRYPTION_TYPES };
