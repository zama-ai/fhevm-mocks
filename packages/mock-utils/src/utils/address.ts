import { ethers as EthersT } from "ethers";

import { FhevmError, assertFhevm, assertIsArray } from "./error.js";
import { assertIsString, toLowerCaseSet } from "./string.js";

export function assertIsAddress(value: unknown, valueName?: string): asserts value is string {
  assertIsString(value, valueName);
  assertFhevm(EthersT.isAddress(value), `${valueName ?? "value"}: '${value}' is not a valid address`);
}

export function assertIsAddressArray(value: unknown, valueName?: string): asserts value is string[] {
  assertIsArray(value, valueName);
  for (let i = 0; i < value.length; ++i) {
    assertIsAddress(value[i], valueName ? `${valueName}[${i}]` : undefined);
  }
}

export function assertIsAddressProperty<K extends string>(
  value: unknown,
  propertyNames: K[],
  typeName?: string,
): asserts value is { [P in K]: string } {
  if (typeof value !== "object" || value === null) {
    throw new FhevmError(`${typeName} must be a non-null object.`);
  }

  for (const key of propertyNames) {
    const prop = (value as any)[key];
    if (typeof prop !== "string") {
      throw new FhevmError(`Expected '${key}' in ${typeName} to be a valid address, but got ${typeof prop} instead.`);
    }
    if (!EthersT.isAddress(prop)) {
      throw new FhevmError(`Expected '${key}' in ${typeName} to be a valid address, but got ${typeof prop} instead.`);
    }
  }
}

export function addressToBytes(value: string, valueName?: string): Uint8Array {
  assertIsAddress(value, valueName);
  // Debug
  assertFhevm(EthersT.zeroPadValue(value, 20).toLocaleLowerCase() === EthersT.toBeHex(value, 20));
  // Should use this line of code instead (faster)
  //return EthersT.getBytes(EthersT.zeroPadValue(value, 20));
  return EthersT.getBytes(EthersT.toBeHex(value, 20));
}

export function addressesInAddressList(addresses: string[], addressList: string[]): boolean {
  const s = toLowerCaseSet(addressList);

  for (let i = 0; i < addresses.length; ++i) {
    if (!s.has(addresses[i].toLowerCase())) {
      return false;
    }
  }

  return true;
}
