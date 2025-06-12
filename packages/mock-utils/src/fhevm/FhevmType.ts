import { FhevmError } from "../utils/error.js";
import { getMaxBigInt, isUInt } from "../utils/math.js";
import { ALL_FHE_TYPES, FheType, checkFheType, getFheTypeBitLength } from "./FheType.js";

export type FhevmTypeName =
  | "ebool"
  | "euint4"
  | "euint8"
  | "euint16"
  | "euint32"
  | "euint64"
  | "euint128"
  | "eaddress"
  | "euint256"
  | "ebytes64"
  | "ebytes128"
  | "ebytes256";

export type SolidityTypeName =
  | "bool"
  | "uint4"
  | "uint8"
  | "uint16"
  | "uint32"
  | "uint64"
  | "uint128"
  | "address"
  | "uint256"
  | "bytes"
  | "bytes"
  | "bytes";

export enum FhevmType {
  ebool = 0, // == FheTypes.Bool
  euint4 = 1,
  euint8 = 2,
  euint16 = 3,
  euint32 = 4,
  euint64 = 5,
  euint128 = 6,
  eaddress = 7,
  euint256 = 8,
  ebytes64 = 9,
  ebytes128 = 10,
  ebytes256 = 11,
}

export const FhevmTypeMap: Readonly<Record<FhevmTypeName, FhevmType>> = {
  ebool: FhevmType.ebool,
  euint4: FhevmType.euint4,
  euint8: FhevmType.euint8,
  euint16: FhevmType.euint16,
  euint32: FhevmType.euint32,
  euint64: FhevmType.euint64,
  euint128: FhevmType.euint128,
  eaddress: FhevmType.eaddress,
  euint256: FhevmType.euint256,
  ebytes64: FhevmType.ebytes64,
  ebytes128: FhevmType.ebytes128,
  ebytes256: FhevmType.ebytes256,
};
Object.freeze(FhevmTypeMap);

export const FhevmTypeNameMap: Readonly<Record<FhevmType, FhevmTypeName>> = {
  [FhevmType.ebool]: "ebool",
  [FhevmType.euint4]: "euint4",
  [FhevmType.euint8]: "euint8",
  [FhevmType.euint16]: "euint16",
  [FhevmType.euint32]: "euint32",
  [FhevmType.euint64]: "euint64",
  [FhevmType.euint128]: "euint128",
  [FhevmType.euint256]: "euint256",
  [FhevmType.eaddress]: "eaddress",
  [FhevmType.ebytes64]: "ebytes64",
  [FhevmType.ebytes128]: "ebytes128",
  [FhevmType.ebytes256]: "ebytes256",
};
Object.freeze(FhevmTypeNameMap);

export const allFhevmTypes: readonly Readonly<FhevmType>[] = [
  FhevmType.ebool,
  FhevmType.euint4,
  FhevmType.euint8,
  FhevmType.euint16,
  FhevmType.euint32,
  FhevmType.euint64,
  FhevmType.euint128,
  FhevmType.eaddress,
  FhevmType.euint256,
  FhevmType.ebytes64,
  FhevmType.ebytes128,
  FhevmType.ebytes256,
];
Object.freeze(allFhevmTypes);

export const allFhevmTypeNames: readonly Readonly<FhevmTypeName>[] = [
  "ebool",
  "euint4",
  "euint8",
  "euint16",
  "euint32",
  "euint64",
  "euint128",
  "eaddress",
  "euint256",
  "ebytes64",
  "ebytes128",
  "ebytes256",
];
Object.freeze(allFhevmTypeNames);

// FhevmEuint
export type FhevmTypeEuint =
  | FhevmType.euint4
  | FhevmType.euint8
  | FhevmType.euint16
  | FhevmType.euint32
  | FhevmType.euint64
  | FhevmType.euint128
  | FhevmType.euint256;

export type FhevmTypeEbytes = FhevmType.ebytes64 | FhevmType.ebytes128 | FhevmType.ebytes256;

// FhevmTypeInfo
export interface FhevmTypeInfo {
  name: FhevmTypeName;
  type: FhevmType;
  fheType: FheType;
  solidityTypeName: SolidityTypeName;
  clearTextBitLength: number;
}

/*
  Warning !
  assert(allFhevmTypeInfos[fhevmType].type === fhevmType);
  assert(allFhevmTypeInfos[fheType].fheType === fheType);
*/
export const allFhevmTypeInfos: readonly Readonly<FhevmTypeInfo>[] = Object.freeze([
  Object.freeze({
    type: FhevmType.ebool,
    fheType: FheType.Bool, // 0
    name: "ebool",
    solidityTypeName: "bool",
    clearTextBitLength: 1,
  }),
  Object.freeze({
    type: FhevmType.euint4,
    fheType: FheType.Uint4, // 1 (Deprecated ?)
    name: "euint4",
    solidityTypeName: "uint4",
    clearTextBitLength: 4,
  }),
  Object.freeze({
    type: FhevmType.euint8,
    fheType: FheType.Uint8, // 2
    name: "euint8",
    solidityTypeName: "uint8",
    clearTextBitLength: 8,
  }),
  Object.freeze({
    type: FhevmType.euint16,
    fheType: FheType.Uint16, // 3
    name: "euint16",
    solidityTypeName: "uint16",
    clearTextBitLength: 16,
  }),
  Object.freeze({
    type: FhevmType.euint32,
    fheType: FheType.Uint32, // 4
    name: "euint32",
    solidityTypeName: "uint32",
    clearTextBitLength: 32,
  }),
  Object.freeze({
    type: FhevmType.euint64,
    fheType: FheType.Uint64, // 5
    name: "euint64",
    solidityTypeName: "uint64",
    clearTextBitLength: 64,
  }),
  Object.freeze({
    name: "euint128",
    type: FhevmType.euint128,
    fheType: FheType.Uint128, // 6
    solidityTypeName: "uint128",
    clearTextBitLength: 128,
  }),
  Object.freeze({
    name: "eaddress",
    type: FhevmType.eaddress,
    fheType: FheType.Uint160, // 7
    solidityTypeName: "address",
    clearTextBitLength: 160,
  }),
  Object.freeze({
    name: "euint256",
    type: FhevmType.euint256,
    fheType: FheType.Uint256, // 8
    solidityTypeName: "uint256",
    clearTextBitLength: 256,
  }),
  Object.freeze({
    name: "ebytes64",
    type: FhevmType.ebytes64,
    fheType: FheType.Uint512, // 9
    solidityTypeName: "bytes",
    clearTextBitLength: 512,
  }),
  Object.freeze({
    name: "ebytes128",
    type: FhevmType.ebytes128,
    fheType: FheType.Uint1024, // 10
    solidityTypeName: "bytes",
    clearTextBitLength: 1024,
  }),
  Object.freeze({
    name: "ebytes256",
    type: FhevmType.ebytes256,
    fheType: FheType.Uint2048, // 11
    solidityTypeName: "bytes",
    clearTextBitLength: 2048,
  }),
]);

/**
 * Returns `true` if `fhevmType` is a valid `FhevmType`, `false` otherwise
 * @param fhevmType
 */
export function isFhevmType(fhevmType: unknown) {
  if (!isUInt(fhevmType)) {
    return false;
  }

  const theFhevmType = fhevmType as bigint | number;

  if (theFhevmType >= allFhevmTypeInfos.length) {
    return false;
  }
  return true;
}

/**
 * Returns `true` if `fhevmType` is a Fhevm bytes type, `false` otherwise
 * @param fhevmType
 */
export function isFhevmEbytes(fhevmType: FhevmType) {
  return fhevmType === FhevmType.ebytes64 || fhevmType === FhevmType.ebytes128 || fhevmType === FhevmType.ebytes256;
}

/**
 * Returns `true` if `fhevmType` is a Fhevm unsigned integer type, `false` otherwise
 * @param fhevmType
 */
export function isFhevmEuint(fhevmType: FhevmType) {
  return (
    fhevmType === FhevmType.euint4 ||
    fhevmType === FhevmType.euint8 ||
    fhevmType === FhevmType.euint16 ||
    fhevmType === FhevmType.euint32 ||
    fhevmType === FhevmType.euint64 ||
    fhevmType === FhevmType.euint128 ||
    fhevmType === FhevmType.euint256
  );
}

/**
 * Returns `true` if `fhevmType` is a Fhevm bool type, `false` otherwise
 * @param fhevmType
 */
export function isFhevmEbool(fhevmType: FhevmType): fhevmType is FhevmType.ebool {
  return fhevmType === FhevmType.ebool;
}

/**
 * Returns `true` if `fhevmType` is a Fhevm address type, `false` otherwise
 * @param fhevmType
 */
export function isFhevmEaddress(fhevmType: FhevmType): fhevmType is FhevmType.eaddress {
  return fhevmType === FhevmType.eaddress;
}

/**
 * Throws an internal error if `fhevmType` is not a valid `FhevmType`
 * @param fhevmType
 */
export function checkFhevmType(fhevmType: unknown): asserts fhevmType is FhevmType {
  if (!isFhevmType(fhevmType)) {
    throw new FhevmError(`Invalid FhevmType ${fhevmType}`);
  }
}

export function FheTypeToFhevmType(fheType: FheType): FhevmType {
  checkFheType(fheType);
  if (fheType >= allFhevmTypeInfos.length) {
    throw new FhevmError(`Cannot convert FheType ${fheType} to FhevmType`);
  }
  return fheType as unknown as FhevmType;
}

export function FhevmTypeToFheType(fhevmType: FhevmType): FheType {
  checkFhevmType(fhevmType);
  if (fhevmType >= ALL_FHE_TYPES.length) {
    throw new FhevmError(`Cannot convert FhevmType: ${fhevmType} to FheType`);
  }
  return fhevmType as unknown as FheType;
}

export function getFhevmTypeInfo(type: FhevmType | FhevmTypeName): FhevmTypeInfo {
  if (typeof type === "string") {
    return allFhevmTypeInfos[FhevmTypeMap[type]];
  }
  return allFhevmTypeInfos[type];
}

/**
 * Each primitive FHEVM type is encoded into a primitive FHE type.
 * The bit length of a clear (unencrypted) primitive FHEVM type may differ
 * from the number of encrypted bits used by the corresponding FHE type.
 *
 * For example, a clear boolean is typically represented using 1 bit,
 * but its encrypted FHE equivalent may use 2 encrypted bits.
 * @param fhevmType
 * @returns Then number of encrypted bits
 */
export function getFhevmTypeFheBitLength(fhevmType: FhevmType): number {
  const fheType = FhevmTypeToFheType(fhevmType);
  return getFheTypeBitLength(fheType);
}

export function getFhevmTypeMaxClearTextBigInt(fhevmType: FhevmType): bigint {
  const fhevmTypeInfo = getFhevmTypeInfo(fhevmType);
  const clearTextBitLen = fhevmTypeInfo.clearTextBitLength;
  return getMaxBigInt(clearTextBitLen);
}

export function tryParseFhevmType(name: string): FhevmType | undefined {
  if (typeof name !== "string") {
    return undefined;
  }
  if (!(name in FhevmTypeMap)) {
    return undefined;
  }
  try {
    return FhevmTypeMap[name as keyof typeof FhevmTypeMap];
  } catch {
    return undefined;
  }
}
