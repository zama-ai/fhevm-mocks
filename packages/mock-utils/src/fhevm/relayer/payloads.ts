import { assertIsAddressProperty } from "../../utils/address.js";
import { assertIsArrayProperty, assertIsObjectProperty } from "../../utils/error.js";
import { assertIsStringArrayProperty, assertIsStringProperty } from "../../utils/string.js";

export type RelayerMetadata = {
  version: string;
  chainId: number;
  gatewayChainId: number;
  ACLAddress: string;
  CoprocessorAddress: string;
  DecryptionOracleAddress: string;
  KMSVerifierAddress: string;
  InputVerifierAddress: string;
  relayerSignerAddress: string;
  // relayerSignerPrivateKey or wallet info
  // kmsSigners or wallet info
  // inputVerifierSigners or wallet info
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
  extraData: string;
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
  extraData: string;
};

export type RelayerV1UserDecryptValidity = {
  startTimestamp: string;
  durationDays: string;
};

export type RelayerV1PublicDecryptPayload = {
  ciphertextHandles: string[];
  extraData: string;
};

export type RelayerV1PublicDecryptResponse = { decrypted_value: string; signatures: string[] };
// Try to follow relayer response format. Here signature is always Bytes32(0)
export type RelayerV1UserDecryptResponse = { payload: { decrypted_values: string[] }; signature: string };

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
    "extraData",
  ];
  assertIsStringProperty(value, stringFields, "RelayerV1InputProofPayload");
}

export function assertIsRelayerV1InputProofResponse(value: unknown): asserts value is RelayerV1InputProofResponse {
  const keys: (keyof RelayerV1InputProofResponse)[] = ["handles", "signatures"];
  assertIsStringArrayProperty(value, keys, "RelayerV1InputProofResponse");
}

export function assertIsRelayerV1PublicDecryptPayload(value: unknown): asserts value is RelayerV1PublicDecryptPayload {
  const arrayKeys: (keyof RelayerV1PublicDecryptPayload)[] = ["ciphertextHandles"];
  const stringKeys: (keyof RelayerV1PublicDecryptPayload)[] = ["extraData"];
  assertIsStringArrayProperty(value, arrayKeys, "RelayerV1PublicDecryptPayload");
  assertIsStringProperty(value, stringKeys, "RelayerV1PublicDecryptResponse");
}

export function assertIsRelayerV1PublicDecryptResponse(
  value: unknown,
): asserts value is RelayerV1PublicDecryptResponse {
  const arrayKeys: (keyof RelayerV1PublicDecryptResponse)[] = ["signatures"];
  const stringKeys: (keyof RelayerV1PublicDecryptResponse)[] = ["decrypted_value"];
  assertIsStringArrayProperty(value, arrayKeys, "RelayerV1PublicDecryptResponse");
  assertIsStringProperty(value, stringKeys, "RelayerV1PublicDecryptResponse");
}

export function assertIsRelayerV1UserDecryptResponse(value: unknown): asserts value is RelayerV1UserDecryptResponse {
  const stringKeys: (keyof RelayerV1UserDecryptResponse)[] = ["signature"];
  const objectKeys: (keyof RelayerV1UserDecryptResponse)[] = ["payload"];
  assertIsStringProperty(value, stringKeys, "RelayerV1UserDecryptResponse");
  assertIsObjectProperty(value, objectKeys, "RelayerV1UserDecryptResponse");
  assertIsStringArrayProperty(value.payload, ["decrypted_values"], "RelayerV1UserDecryptResponse");
}

export function assertIsRelayerV1UserDecryptPayload(value: unknown): asserts value is RelayerV1UserDecryptPayload {
  const arrayKeys: (keyof RelayerV1UserDecryptPayload)[] = ["handleContractPairs", "contractAddresses"];
  const stringKeys: (keyof RelayerV1UserDecryptPayload)[] = [
    "contractsChainId",
    "publicKey",
    "signature",
    "userAddress",
    "extraData",
  ];
  const objectKeys: (keyof RelayerV1UserDecryptPayload)[] = ["requestValidity"];

  assertIsStringProperty(value, stringKeys, "RelayerV1UserDecryptPayload");
  assertIsArrayProperty(value, arrayKeys, "RelayerV1UserDecryptPayload");
  assertIsObjectProperty(value, objectKeys, "RelayerV1UserDecryptPayload");

  _assertIsRelayerV1UserDecryptValidity(value.requestValidity);
}

export function assertIsRelayerMetadata(value: unknown): asserts value is RelayerMetadata {
  const stringKeys: (keyof RelayerMetadata)[] = ["version"];
  assertIsStringProperty(value, stringKeys, "RelayerMetadata");
  const keys: (keyof RelayerMetadata)[] = [
    "ACLAddress",
    "CoprocessorAddress",
    "InputVerifierAddress",
    "KMSVerifierAddress",
    "relayerSignerAddress",
  ];
  assertIsAddressProperty(value, keys, "RelayerMetadata");
}
