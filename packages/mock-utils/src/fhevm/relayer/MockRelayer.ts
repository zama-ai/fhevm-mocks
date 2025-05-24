import { type MinimalProvider, minimalProviderSend } from "../../ethers/provider.js";
import { assertIsString, assertIsStringArray } from "../../utils/string.js";
import {
  FHEVM_AWAIT_DECRYPTION_ORACLE,
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
  RelayerV1UserDecryptPayload,
} from "./payloads.js";
import {
  assertIsRelayerMetadata,
  assertIsRelayerV1InputProofResponse,
  assertIsRelayerV1PublicDecryptPayload,
  assertIsRelayerV1UserDecryptPayload,
} from "./payloads.js";

/**
 * Equivalent to const response = await fetch(`${relayerUrl}/v1/input-proof`, options);
 */
export async function requestRelayerV1InputProof(
  provider: MinimalProvider,
  payload: MockRelayerV1InputProofPayload,
): Promise<RelayerV1InputProofResponse> {
  assertIsMockRelayerV1InputProofPayload(payload);
  const response = await minimalProviderSend(provider, RELAYER_V1_INPUT_PROOF, [payload]);
  assertIsRelayerV1InputProofResponse(response);

  return response;
}

/**
 * Equivalent to const response = await fetch(`${relayerUrl}/v1/user-decrypt`, options);
 */
export async function requestRelayerV1UserDecrypt(
  provider: MinimalProvider,
  payload: RelayerV1UserDecryptPayload,
): Promise<string[]> {
  assertIsRelayerV1UserDecryptPayload(payload);
  const response = await minimalProviderSend(provider, RELAYER_V1_USER_DECRYPT, [payload]);
  assertIsStringArray(response, "userDecryptResponse");

  return response;
}

/**
 * Equivalent to const response = await fetch(`${relayerUrl}/v1/public-decrypt`, options);
 */
export async function requestRelayerV1PublicDecrypt(
  provider: MinimalProvider,
  payload: RelayerV1PublicDecryptPayload,
): Promise<string> {
  assertIsRelayerV1PublicDecryptPayload(payload);
  const response = await minimalProviderSend(provider, RELAYER_V1_PUBLIC_DECRYPT, [payload]);
  assertIsString(response, "publicDecryptResponse");

  return response;
}

/**
 * Custom, returns Fhevm addresses expected by the relayer.
 */
export async function requestRelayerMetadata(provider: MinimalProvider): Promise<RelayerMetadata> {
  const response = await minimalProviderSend(provider, RELAYER_METADATA, []);
  assertIsRelayerMetadata(response);
  return response;
}

export async function requestFhevmAwaitDecryptionOracle(provider: MinimalProvider): Promise<any> {
  return await minimalProviderSend(provider, FHEVM_AWAIT_DECRYPTION_ORACLE, []);
}

export async function requestFhevmGetClearText(provider: MinimalProvider, payload: string[]): Promise<any> {
  return await minimalProviderSend(provider, FHEVM_GET_CLEAR_TEXT, [payload]);
}
