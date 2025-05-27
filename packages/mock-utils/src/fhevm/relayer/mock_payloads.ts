import { assertIsArrayProperty, assertIsObjectProperty } from "../../utils/error.js";
import { assertIsStringProperty } from "../../utils/string.js";
import { FheType } from "../FheType.js";
import { FhevmType } from "../FhevmType.js";
import type { FhevmDBHandleMetadata } from "../db/FhevmDB.js";
import { type RelayerV1InputProofPayload, assertIsRelayerV1InputProofPayload } from "./payloads.js";

export type MockRelayerData = {
  clearTextValuesBigIntHex: string[];
  metadatas: FhevmDBHandleMetadata[];
  fheTypes: FheType[];
  fhevmTypes: FhevmType[];
  aclContractAddress: string;
  random32List: string[];
};

export type MockRelayerV1InputProofPayload = RelayerV1InputProofPayload & {
  mockData: MockRelayerData;
};

export function assertIsMockRelayerV1InputProofPayload(
  value: unknown,
): asserts value is MockRelayerV1InputProofPayload {
  const objectKeys: (keyof MockRelayerV1InputProofPayload)[] = ["mockData"];

  assertIsRelayerV1InputProofPayload(value);
  assertIsObjectProperty(value, objectKeys, "MockRelayerV1InputProofPayload");

  _assertIsMockRelayerData((value as any).mockData);
}

function _assertIsMockRelayerData(value: object): asserts value is MockRelayerData {
  const arrayKeys: (keyof MockRelayerData)[] = [
    "clearTextValuesBigIntHex",
    "metadatas",
    "fheTypes",
    "fhevmTypes",
    "random32List",
  ];
  const stringKeys: (keyof MockRelayerData)[] = ["aclContractAddress"];
  assertIsStringProperty(value, stringKeys, "MockRelayerData");
  assertIsArrayProperty(value, arrayKeys, "MockRelayerData");
}
