import { HardhatPluginError } from 'hardhat/plugins';
import { isAddress } from 'viem';
import { FhevmType } from '../types-p.js';
import { PLUGIN_ID } from './constants.js';

////////////////////////////////////////////////////////////////////////////////

export type ClearValue = boolean | bigint | number | string;

////////////////////////////////////////////////////////////////////////////////

/** The inclusive upper bound of each euint width; absent for `ebool` and `eaddress`. */
const MAX_UINT_FOR_TYPE: Readonly<Partial<Record<FhevmType, bigint>>> = Object.freeze({
  [FhevmType.euint4]: 0xfn,
  [FhevmType.euint8]: 0xffn,
  [FhevmType.euint16]: 0xffffn,
  [FhevmType.euint32]: 0xffffffffn,
  [FhevmType.euint64]: 2n ** 64n - 1n,
  [FhevmType.euint128]: 2n ** 128n - 1n,
  [FhevmType.euint256]: 2n ** 256n - 1n,
});

////////////////////////////////////////////////////////////////////////////////

/** The largest value `fhevmType` can hold, or undefined when it is not an integer type. */
export function maxUintForType(fhevmType: FhevmType): bigint | undefined {
  return MAX_UINT_FOR_TYPE[fhevmType];
}

function fail(method: string, detail: string): never {
  throw new HardhatPluginError(PLUGIN_ID, `${method}: ${detail}`);
}

////////////////////////////////////////////////////////////////////////////////
// Encrypt direction — the caller's value
////////////////////////////////////////////////////////////////////////////////

/** Fails when `value` cannot be represented by `fhevmType`, naming the bound that was broken. */
export function assertValueFitsType(method: string, fhevmType: FhevmType, value: ClearValue): void {
  const typeName = FhevmType[fhevmType];

  if (fhevmType === FhevmType.ebool) {
    if (typeof value !== 'boolean') fail(method, `the 'value' argument must be a boolean. Got '${String(value)}'.`);
    return;
  }

  if (fhevmType === FhevmType.eaddress) {
    if (typeof value !== 'string' || !isAddress(value)) {
      fail(method, `the 'value' argument is not a valid address. Got '${String(value)}' instead.`);
    }
    return;
  }

  const max = maxUintForType(fhevmType);
  if (max === undefined) fail(method, `'${typeName}' is not an encryptable type.`);

  if (typeof value !== 'number' && typeof value !== 'bigint') {
    fail(method, `the 'value' argument must be a number or a bigint for ${typeName}. Got a ${typeof value}.`);
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) fail(method, `the 'value' argument must be an integer. Got ${String(value)}.`);
    // Past 2**53 a number has already lost digits before we ever see it, so the check below would be
    // validating the wrong value. Only euint64 and wider can be given one.
    if (!Number.isSafeInteger(value)) {
      fail(method, `${String(value)} exceeds Number.MAX_SAFE_INTEGER and has lost precision — pass a bigint.`);
    }
  }

  const asBigInt = BigInt(value);
  if (asBigInt < 0n || asBigInt > max) {
    fail(method, `${String(asBigInt)} does not fit in ${typeName}: expected 0 to ${String(max)}.`);
  }
}

////////////////////////////////////////////////////////////////////////////////
// Decrypt direction — the stack's value
////////////////////////////////////////////////////////////////////////////////

/** Fails when the cleartext the stack returned is out of range for the type its handle claims. */
export function assertDecryptedFitsType(method: string, fhevmType: FhevmType, value: bigint, handle: string): bigint {
  const max = maxUintForType(fhevmType);
  if (max === undefined || value < 0n || value > max) {
    fail(
      method,
      `the stack returned ${String(value)} for handle '${handle}', which does not fit in ${FhevmType[fhevmType]} (expected 0 to ${String(max)}).`,
    );
  }
  return value;
}

/**
 * The same check, then down to a `number`. Only euint4/8/16/32 may use this: every value of those
 * widths is a safe integer, which is what lets the public API declare a `number` return at all.
 */
export function decryptedToNumber(method: string, fhevmType: FhevmType, value: bigint, handle: string): number {
  const checked = assertDecryptedFitsType(method, fhevmType, value, handle);
  // Unreachable while the bound table is right; the conversion below is only lossless because it is.
  if (!Number.isSafeInteger(Number(checked))) {
    fail(method, `${String(checked)} cannot be represented as a number — ${FhevmType[fhevmType]} is too wide.`);
  }
  return Number(checked);
}
