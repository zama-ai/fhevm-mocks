import { assertIsAddressProperty } from "../../utils/address.js";
import { assertIsArrayProperty, assertIsObjectProperty } from "../../utils/error.js";
import { assertIsStringArrayProperty, assertIsStringProperty } from "../../utils/string.js";

export type RelayerMetadata = {
  ACLAddress: string;
  FHEVMExecutorAddress: string;
  InputVerifierAddress: string;
  KMSVerifierAddress: string;
};

export type RelayerV1UserDecryptHandleContractPair = {
  handle: string;
  contractAddress: string;
};

export type RelayerV1InputProofPayload = {
  contractAddress: string;
  userAddress: string;
  ciphertextWithInputVerification: string;
  contractChainId: string;
};

export type RelayerV1InputProofResponse = {
  handles: string[];
  signatures: string[];
};

export type RelayerV1UserDecryptPayload = {
  handleContractPairs: RelayerV1UserDecryptHandleContractPair[];
  requestValidity: RelayerV1UserDecryptValidity;
  contractsChainId: string;
  contractAddresses: string[];
  userAddress: string;
  signature: string;
  publicKey: string;
};

export type RelayerV1UserDecryptValidity = {
  startTimestamp: string;
  durationDays: string;
};

export type RelayerV1PublicDecryptPayload = {
  ciphertext_handle: string;
};

function _assertIsRelayerV1UserDecryptValidity(value: unknown): asserts value is RelayerV1UserDecryptValidity {
  const stringFields: (keyof RelayerV1UserDecryptValidity)[] = ["durationDays", "startTimestamp"];
  assertIsStringProperty(value, stringFields, "RelayerV1UserDecryptValidity");
}

export function assertIsRelayerV1InputProofPayload(value: unknown): asserts value is RelayerV1InputProofPayload {
  const stringFields: (keyof RelayerV1InputProofPayload)[] = [
    "contractAddress",
    "userAddress",
    "ciphertextWithInputVerification",
    "contractChainId",
  ];
  assertIsStringProperty(value, stringFields, "RelayerV1InputProofPayload");
}

export function assertIsRelayerV1InputProofResponse(value: unknown): asserts value is RelayerV1InputProofResponse {
  const keys: (keyof RelayerV1InputProofResponse)[] = ["handles", "signatures"];
  assertIsStringArrayProperty(value, keys, "RelayerV1InputProofResponse");
}

export function assertIsRelayerV1PublicDecryptPayload(value: unknown): asserts value is RelayerV1PublicDecryptPayload {
  const stringFields: (keyof RelayerV1PublicDecryptPayload)[] = ["ciphertext_handle"];
  assertIsStringProperty(value, stringFields, "RelayerV1PublicDecryptPayload");
}

export function assertIsRelayerV1UserDecryptPayload(value: unknown): asserts value is RelayerV1UserDecryptPayload {
  const arrayKeys: (keyof RelayerV1UserDecryptPayload)[] = ["handleContractPairs", "contractAddresses"];
  const stringKeys: (keyof RelayerV1UserDecryptPayload)[] = [
    "contractsChainId",
    "publicKey",
    "signature",
    "userAddress",
  ];
  const objectKeys: (keyof RelayerV1UserDecryptPayload)[] = ["requestValidity"];

  assertIsStringProperty(value, stringKeys, "RelayerV1UserDecryptPayload");
  assertIsArrayProperty(value, arrayKeys, "RelayerV1UserDecryptPayload");
  assertIsObjectProperty(value, objectKeys, "RelayerV1UserDecryptPayload");

  _assertIsRelayerV1UserDecryptValidity(value.requestValidity);
}

export function assertIsRelayerMetadata(value: unknown): asserts value is RelayerMetadata {
  const keys: (keyof RelayerMetadata)[] = [
    "ACLAddress",
    "FHEVMExecutorAddress",
    "InputVerifierAddress",
    "KMSVerifierAddress",
  ];
  assertIsAddressProperty(value, keys, "RelayerV1InputProofResponse");
}
