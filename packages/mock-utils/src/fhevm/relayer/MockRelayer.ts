import { type MinimalProvider, minimalProviderSend } from "../../ethers/provider.js";
import {
  FHEVM_AWAIT_DECRYPTION_ORACLE,
  FHEVM_CREATE_DECRYPTION_SIGNATURES,
  FHEVM_GET_CLEAR_TEXT,
  RELAYER_METADATA,
  RELAYER_V1_INPUT_PROOF,
  RELAYER_V1_PUBLIC_DECRYPT,
  RELAYER_V1_USER_DECRYPT,
} from "./methods.js";
import { type MockRelayerV1InputProofPayload, assertIsMockRelayerV1InputProofPayload } from "./mock_payloads.js";
import type {
  RelayerMetadata,
  RelayerV1InputProofResponse,
  RelayerV1PublicDecryptPayload,
  RelayerV1PublicDecryptResponse,
  RelayerV1UserDecryptPayload,
  RelayerV1UserDecryptResponse,
} from "./payloads.js";
import {
  assertIsRelayerMetadata,
  assertIsRelayerV1InputProofResponse,
  assertIsRelayerV1PublicDecryptPayload,
  assertIsRelayerV1PublicDecryptResponse,
  assertIsRelayerV1UserDecryptPayload,
  assertIsRelayerV1UserDecryptResponse,
} from "./payloads.js";

// To be changed into a FhevmMockRelayerProvider class

/**
 * Equivalent to const response = await fetch(`${relayerUrl}/v1/input-proof`, options);
 */
export async function requestRelayerV1InputProof(
  relayerProvider: MinimalProvider,
  payload: MockRelayerV1InputProofPayload,
): Promise<RelayerV1InputProofResponse> {
  assertIsMockRelayerV1InputProofPayload(payload);
  const response = await minimalProviderSend(relayerProvider, RELAYER_V1_INPUT_PROOF, [payload]);
  assertIsRelayerV1InputProofResponse(response);

  return response;
}

/**
 * Equivalent to const response = await fetch(`${relayerUrl}/v1/user-decrypt`, options);
 */
export async function requestRelayerV1UserDecrypt(
  relayerProvider: MinimalProvider,
  payload: RelayerV1UserDecryptPayload,
): Promise<{ response: RelayerV1UserDecryptResponse[] }> {
  assertIsRelayerV1UserDecryptPayload(payload);
  const response = await minimalProviderSend(relayerProvider, RELAYER_V1_USER_DECRYPT, [payload]);
  assertIsRelayerV1UserDecryptResponse(response);

  return { response: [response] };
}

/**
 * Equivalent to const response = await fetch(`${relayerUrl}/v1/public-decrypt`, options);
 */
export async function requestRelayerV1PublicDecrypt(
  relayerProvider: MinimalProvider,
  payload: RelayerV1PublicDecryptPayload,
): Promise<{ response: RelayerV1PublicDecryptResponse[] }> {
  assertIsRelayerV1PublicDecryptPayload(payload);
  const response = await minimalProviderSend(relayerProvider, RELAYER_V1_PUBLIC_DECRYPT, [payload]);
  assertIsRelayerV1PublicDecryptResponse(response);
  return { response: [response] };
}

/**
 * Custom, returns Fhevm addresses expected by the relayer.
 */
export async function requestRelayerMetadata(relayerProvider: MinimalProvider): Promise<RelayerMetadata> {
  const response = await minimalProviderSend(relayerProvider, RELAYER_METADATA, []);
  assertIsRelayerMetadata(response);
  return response;
}

export async function requestFhevmAwaitDecryptionOracle(relayerProvider: MinimalProvider): Promise<any> {
  return await minimalProviderSend(relayerProvider, FHEVM_AWAIT_DECRYPTION_ORACLE, []);
}

export async function requestFhevmGetClearText(relayerProvider: MinimalProvider, payload: string[]): Promise<any> {
  return await minimalProviderSend(relayerProvider, FHEVM_GET_CLEAR_TEXT, [payload]);
}

export async function requestFhevmCreateDecryptionSignatures(
  relayerProvider: MinimalProvider,
  payload: { handlesBytes32Hex: string[]; clearTextValuesHex: string[]; extraData: string },
): Promise<any> {
  return await minimalProviderSend(relayerProvider, FHEVM_CREATE_DECRYPTION_SIGNATURES, [payload]);
}
