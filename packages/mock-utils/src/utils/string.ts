import { FhevmError, assertFhevm } from "./error.js";

export function removePrefix(s: string, prefix: string): string {
  return s.startsWith(prefix) ? s.substring(prefix.length) : s;
}

export function removeSuffix(s: string, suffix: string): string {
  return s.endsWith(suffix) ? s.substring(0, s.length - suffix.length) : s;
}

export function ensure0x(s: string): `0x${string}` {
  return !s.startsWith("0x") ? `0x${s}` : (s as `0x${string}`);
}

export function remove0x(s: string): string {
  return s.startsWith("0x") ? s.substring(2) : s;
}

export function ensurePrefix(s: string, prefix: string): string {
  return !s.startsWith(prefix) ? prefix + s : s;
}

export function ensureSuffix(s: string, suffix: string): string {
  return !s.endsWith(suffix) ? s + suffix : s;
}

export function assertIsString(value: unknown, valueName?: string): asserts value is string {
  assertFhevm(typeof value === "string", `${valueName ?? "value"} is not of type string, got ${typeof value} instead`);
}

export function assertIsStringArray(value: unknown, valueName?: string): asserts value is string[] {
  if (!Array.isArray(value)) {
    throw new FhevmError(`${valueName ?? "value"} is not an array of string`);
  }
  for (let i = 0; i < value.length; ++i) {
    assertFhevm(
      typeof value[i] === "string",
      `${valueName ?? "value"}[${i}] is not of type string, got ${typeof value[i]} instead`,
    );
  }
}

export function assertIsStringProperty<K extends string>(
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
      throw new FhevmError(`Expected '${key}' in ${typeName} to be a string, but got ${typeof prop} instead.`);
    }
  }
}

export function assertIsStringArrayProperty<K extends string>(
  value: unknown,
  propertyNames: K[],
  typeName?: string,
): asserts value is { [P in K]: string[] } {
  if (typeof value !== "object" || value === null) {
    throw new FhevmError(`${typeName} must be a non-null object.`);
  }

  for (const key of propertyNames) {
    const prop = (value as any)[key];
    assertIsStringArray(prop, ` ${typeName}.${key}`);
  }
}

export function toLowerCaseSet(array: string[]): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i < array.length; ++i) {
    const item = array[i];
    if (item) {
      s.add(item.toLowerCase());
    }
  }
  return s;
}
