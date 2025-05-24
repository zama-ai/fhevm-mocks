export function assertFhevm(check: unknown, message?: string): asserts check {
  if (!check) {
    const title = "Fhevm assertion failed";
    message = message ? title + ": " + message : title;
    throw new FhevmError(message);
  }
}

export function assertFhevmFailed(message?: string): never {
  const title = "Fhevm assertion failed";
  message = message ? title + ": " + message : title;
  throw new FhevmError(message);
}

export function assertIsArray(value: unknown, valueName?: string): asserts value is string {
  assertFhevm(Array.isArray(value), `${valueName ?? "value"} is not an array`);
}

export function assertIsArrayProperty<K extends string>(
  value: unknown,
  propertyNames: K[],
  typeName?: string,
): asserts value is { [P in K]: any[] } {
  if (typeof value !== "object" || value === null) {
    throw new FhevmError(`${typeName} must be a non-null object.`);
  }

  for (const key of propertyNames) {
    const prop = (value as any)[key];
    if (prop === undefined || prop === null) {
      throw new FhevmError(`Invalid ${typeName}. Missing '${key}' property.`);
    }
    if (!Array.isArray(prop)) {
      throw new FhevmError(`Expected '${key}' in ${typeName} to be an array.`);
    }
  }
}

export function assertUint8ArrayDeepEqual(a1: Uint8Array, a2: Uint8Array) {
  assertFhevm(a1.length === a2.length, "Arrays do not have the same length");
  for (let i = 0; i < a1.length; ++i) {
    assertFhevm(a1[i] === a2[i], `Arrays are different. a1[${i}]=${a1[i]} !== a2[${i}]=${a2[i]}`);
  }
}

export function assertArrayOfUint8ArrayDeepEqual(a1: Uint8Array[], a2: Uint8Array[]) {
  assertFhevm(a1.length === a2.length, "Arrays do not have the same length");
  for (let i = 0; i < a1.length; ++i) {
    assertUint8ArrayDeepEqual(a1[i], a2[i]);
  }
}

export function assertIsObjectProperty<K extends string>(
  value: unknown,
  propertyNames: K[],
  typeName?: string,
): asserts value is { [P in K]: any[] } {
  if (typeof value !== "object" || value === null) {
    throw new FhevmError(`${typeName} must be a non-null object.`);
  }

  for (const key of propertyNames) {
    const prop = (value as any)[key];
    if (prop === undefined || prop === null) {
      throw new FhevmError(`Invalid ${typeName}. Missing '${key}' property.`);
    }
    if (typeof prop !== "object") {
      throw new FhevmError(`Expected '${key}' in ${typeName} to be an object. Got ${typeof prop} instead.`);
    }
  }
}

export class FhevmError extends Error {}
