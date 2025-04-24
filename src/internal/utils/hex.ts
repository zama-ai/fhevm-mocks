export function uint8ArrayToHexNoPrefix(uint8Array: Uint8Array): string {
  //return EthersT.hexlify(uint8Array).slice(2);
  return Array.from(uint8Array)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function numberToHex(num: number): string {
  const hex = num.toString(16);
  return hex.length % 2 ? "0" + hex : hex;
}

// Unused
export function numberToEvenHexString(num: number): string {
  if (typeof num !== "number" || num < 0) {
    throw new Error("Input should be a non-negative number.");
  }
  let hexString = num.toString(16);
  if (hexString.length % 2 !== 0) {
    hexString = "0" + hexString;
  }
  return hexString;
}

export function removePrefix(hex: string, prefix: string): string {
  return hex.startsWith(prefix) ? hex.substring(prefix.length) : hex;
}

export function ensurePrefix(hex: string, prefix: string): string {
  return !hex.startsWith(prefix) ? prefix + hex : hex;
}

export function ensureSuffix(str: string, suffix: string): string {
  return !str.endsWith(suffix) ? str + suffix : str;
}
