import { FhevmError } from "../utils/error.js";
import { isUInt } from "../utils/math.js";
import type { SolidityTypeName } from "./SolidityType.js";

export interface FheTypeInfo {
  type: FheTypeName;
  supportedOperators: FheTypeOperatorName[];
  bitLength: number;
  clearMatchingType: SolidityTypeName | "bytes memory" | "string memory";
  value: number;
}

export type FheTypeOperatorName =
  | "add"
  | "sub"
  | "mul"
  | "div"
  | "rem"
  | "and"
  | "or"
  | "xor"
  | "shl"
  | "shr"
  | "rotl"
  | "rotr"
  | "eq"
  | "ne"
  | "ge"
  | "gt"
  | "le"
  | "lt"
  | "min"
  | "max"
  | "neg"
  | "not"
  | "select"
  | "rand"
  | "randBounded";

export enum FheType {
  Bool = 0,
  Uint4 = 1,
  Uint8 = 2,
  Uint16 = 3,
  Uint32 = 4,
  Uint64 = 5,
  Uint128 = 6,
  Uint160 = 7,
  Uint256 = 8,
  Uint512 = 9,
  Uint1024 = 10,
  Uint2048 = 11,
  Uint2 = 12,
  Uint6 = 13,
  Uint10 = 14,
  Uint12 = 15,
  Uint14 = 16,
  Int2 = 17,
  Int4 = 18,
  Int6 = 19,
  Int8 = 20,
  Int10 = 21,
  Int12 = 22,
  Int14 = 23,
  Int16 = 24,
  Int32 = 25,
  Int64 = 26,
  Int128 = 27,
  Int160 = 28,
  Int256 = 29,
  AsciiString = 30,
  Int512 = 31,
  Int1024 = 32,
  Int2048 = 33,
  Uint24 = 34,
  Uint40 = 35,
  Uint48 = 36,
  Uint56 = 37,
  Uint72 = 38,
  Uint80 = 39,
  Uint88 = 40,
  Uint96 = 41,
  Uint104 = 42,
  Uint112 = 43,
  Uint120 = 44,
  Uint136 = 45,
  Uint144 = 46,
  Uint152 = 47,
  Uint168 = 48,
  Uint176 = 49,
  Uint184 = 50,
  Uint192 = 51,
  Uint200 = 52,
  Uint208 = 53,
  Uint216 = 54,
  Uint224 = 55,
  Uint232 = 56,
  Uint240 = 57,
  Uint248 = 58,
  Int24 = 59,
  Int40 = 60,
  Int48 = 61,
  Int56 = 62,
  Int72 = 63,
  Int80 = 64,
  Int88 = 65,
  Int96 = 66,
  Int104 = 67,
  Int112 = 68,
  Int120 = 69,
  Int136 = 70,
  Int144 = 71,
  Int152 = 72,
  Int168 = 73,
  Int176 = 74,
  Int184 = 75,
  Int192 = 76,
  Int200 = 77,
  Int208 = 78,
  Int216 = 79,
  Int224 = 80,
  Int232 = 81,
  Int240 = 82,
  Int248 = 83,
}

export type FheTypeName =
  | "Bool"
  | "Uint4"
  | "Uint8"
  | "Uint16"
  | "Uint32"
  | "Uint64"
  | "Uint128"
  | "Uint160"
  | "Uint256"
  | "Uint512"
  | "Uint1024"
  | "Uint2048"
  | "Uint2"
  | "Uint6"
  | "Uint10"
  | "Uint12"
  | "Uint14"
  | "Int2"
  | "Int4"
  | "Int6"
  | "Int8"
  | "Int10"
  | "Int12"
  | "Int14"
  | "Int16"
  | "Int32"
  | "Int64"
  | "Int128"
  | "Int160"
  | "Int256"
  | "AsciiString"
  | "Int512"
  | "Int1024"
  | "Int2048"
  | "Uint24"
  | "Uint40"
  | "Uint48"
  | "Uint56"
  | "Uint72"
  | "Uint80"
  | "Uint88"
  | "Uint96"
  | "Uint104"
  | "Uint112"
  | "Uint120"
  | "Uint136"
  | "Uint144"
  | "Uint152"
  | "Uint168"
  | "Uint176"
  | "Uint184"
  | "Uint192"
  | "Uint200"
  | "Uint208"
  | "Uint216"
  | "Uint224"
  | "Uint232"
  | "Uint240"
  | "Uint248"
  | "Int24"
  | "Int40"
  | "Int48"
  | "Int56"
  | "Int72"
  | "Int80"
  | "Int88"
  | "Int96"
  | "Int104"
  | "Int112"
  | "Int120"
  | "Int136"
  | "Int144"
  | "Int152"
  | "Int168"
  | "Int176"
  | "Int184"
  | "Int192"
  | "Int200"
  | "Int208"
  | "Int216"
  | "Int224"
  | "Int232"
  | "Int240"
  | "Int248";

/**
 * A constant array containing all Fully Homomorphic Encryption (FHE) types.
 * Each type is represented as an object with the following properties:
 *
 * - `type`: The name of the FHE type.
 * - `value`: A unique numeric identifier for the FHE type.
 * - `supportedOperators`: An array of strings representing the operators supported by the FHE type.
 * - `bitLength`: The bit length of the FHE type.
 * - `clearMatchingType`: The corresponding clear (non-encrypted) type in Solidity.
 *
 * The FHE types included that are currently implemented in the Solidity code generator are:
 *
 * - `Bool`: Boolean type with a bit length of 1.
 * - `Uint8`: Unsigned integer type with a bit length of 8.
 * - `Uint16`: Unsigned integer type with a bit length of 16.
 * - `Uint32`: Unsigned integer type with a bit length of 32.
 * - `Uint64`: Unsigned integer type with a bit length of 64.
 * - `Uint128`: Unsigned integer type with a bit length of 128.
 * - `Uint160`: Unsigned integer type with a bit length of 160.
 * - `Uint256`: Unsigned integer type with a bit length of 256.
 * - `Uint512`: Unsigned integer type with a bit length of 512.
 * - `Uint1024`: Unsigned integer type with a bit length of 1024.
 * - `Uint2048`: Unsigned integer type with a bit length of 2048.
 */
export const ALL_FHE_TYPES: FheTypeInfo[] = [
  {
    type: "Bool",
    value: 0,
    supportedOperators: ["and", "or", "xor", "eq", "ne", "not", "select", "rand"],
    bitLength: 2,
    clearMatchingType: "bool",
  },
  {
    type: "Uint4",
    value: 1,
    supportedOperators: [],
    bitLength: 4,
    clearMatchingType: "uint8",
  },
  {
    type: "Uint8",
    value: 2,
    supportedOperators: [
      "add",
      "sub",
      "mul",
      "div",
      "rem",
      "and",
      "or",
      "xor",
      "shl",
      "shr",
      "rotl",
      "rotr",
      "eq",
      "ne",
      "ge",
      "gt",
      "le",
      "lt",
      "min",
      "max",
      "neg",
      "not",
      "select",
      "rand",
      "randBounded",
    ],
    bitLength: 8,
    clearMatchingType: "uint8",
  },
  {
    type: "Uint16",
    value: 3,
    supportedOperators: [
      "add",
      "sub",
      "mul",
      "div",
      "rem",
      "and",
      "or",
      "xor",
      "shl",
      "shr",
      "rotl",
      "rotr",
      "eq",
      "ne",
      "ge",
      "gt",
      "le",
      "lt",
      "min",
      "max",
      "neg",
      "not",
      "select",
      "rand",
      "randBounded",
    ],
    bitLength: 16,
    clearMatchingType: "uint16",
  },
  {
    type: "Uint32",
    value: 4,
    supportedOperators: [
      "add",
      "sub",
      "mul",
      "div",
      "rem",
      "and",
      "or",
      "xor",
      "shl",
      "shr",
      "rotl",
      "rotr",
      "eq",
      "ne",
      "ge",
      "gt",
      "le",
      "lt",
      "min",
      "max",
      "neg",
      "not",
      "select",
      "rand",
      "randBounded",
    ],
    bitLength: 32,
    clearMatchingType: "uint32",
  },
  {
    type: "Uint64",
    value: 5,
    supportedOperators: [
      "add",
      "sub",
      "mul",
      "div",
      "rem",
      "and",
      "or",
      "xor",
      "shl",
      "shr",
      "rotl",
      "rotr",
      "eq",
      "ne",
      "ge",
      "gt",
      "le",
      "lt",
      "min",
      "max",
      "neg",
      "not",
      "select",
      "rand",
      "randBounded",
    ],
    bitLength: 64,
    clearMatchingType: "uint64",
  },
  {
    type: "Uint128",
    value: 6,
    supportedOperators: [
      "add",
      "sub",
      "mul",
      "div",
      "rem",
      "and",
      "or",
      "xor",
      "shl",
      "shr",
      "rotl",
      "rotr",
      "eq",
      "ne",
      "ge",
      "gt",
      "le",
      "lt",
      "min",
      "max",
      "neg",
      "not",
      "select",
      "rand",
      "randBounded",
    ],
    bitLength: 128,
    clearMatchingType: "uint128",
  },
  {
    type: "Uint160",
    value: 7,
    supportedOperators: [],
    bitLength: 160,
    clearMatchingType: "uint160",
  },
  {
    type: "Uint256",
    value: 8,
    supportedOperators: [
      "and",
      "or",
      "xor",
      "shl",
      "shr",
      "rotl",
      "rotr",
      "eq",
      "ne",
      "neg",
      "not",
      "select",
      "rand",
      "randBounded",
    ],
    bitLength: 256,
    clearMatchingType: "uint256",
  },
  {
    type: "Uint512",
    value: 9,
    supportedOperators: [],
    bitLength: 512,
    clearMatchingType: "bytes memory",
  },
  {
    type: "Uint1024",
    value: 10,
    supportedOperators: [],
    bitLength: 1024,
    clearMatchingType: "bytes memory",
  },
  {
    type: "Uint2048",
    value: 11,
    supportedOperators: [],
    bitLength: 2048,
    clearMatchingType: "bytes memory",
  },
  {
    type: "Uint2",
    value: 12,
    supportedOperators: [],
    bitLength: 2,
    clearMatchingType: "uint8",
  },
  {
    type: "Uint6",
    value: 13,
    supportedOperators: [],
    bitLength: 6,
    clearMatchingType: "uint8",
  },
  {
    type: "Uint10",
    value: 14,
    supportedOperators: [],
    bitLength: 10,
    clearMatchingType: "uint16",
  },
  {
    type: "Uint12",
    value: 15,
    supportedOperators: [],
    bitLength: 12,
    clearMatchingType: "uint16",
  },
  {
    type: "Uint14",
    value: 16,
    supportedOperators: [],
    bitLength: 14,
    clearMatchingType: "uint16",
  },
  {
    type: "Int2",
    value: 17,
    supportedOperators: [],
    bitLength: 2,
    clearMatchingType: "int8",
  },
  {
    type: "Int4",
    value: 18,
    supportedOperators: [],
    bitLength: 4,
    clearMatchingType: "int8",
  },
  {
    type: "Int6",
    value: 19,
    supportedOperators: [],
    bitLength: 6,
    clearMatchingType: "int8",
  },
  {
    type: "Int8",
    value: 20,
    supportedOperators: [],
    bitLength: 8,
    clearMatchingType: "int8",
  },
  {
    type: "Int10",
    value: 21,
    supportedOperators: [],
    bitLength: 10,
    clearMatchingType: "int16",
  },
  {
    type: "Int12",
    value: 22,
    supportedOperators: [],
    bitLength: 12,
    clearMatchingType: "int16",
  },
  {
    type: "Int14",
    value: 23,
    supportedOperators: [],
    bitLength: 14,
    clearMatchingType: "int16",
  },
  {
    type: "Int16",
    value: 24,
    supportedOperators: [],
    bitLength: 16,
    clearMatchingType: "int16",
  },
  {
    type: "Int32",
    value: 25,
    supportedOperators: [],
    bitLength: 32,
    clearMatchingType: "int32",
  },
  {
    type: "Int64",
    value: 26,
    supportedOperators: [],
    bitLength: 64,
    clearMatchingType: "int64",
  },
  {
    type: "Int128",
    value: 27,
    supportedOperators: [],
    bitLength: 128,
    clearMatchingType: "int128",
  },
  {
    type: "Int160",
    value: 28,
    supportedOperators: [],
    bitLength: 160,
    clearMatchingType: "int160",
  },
  {
    type: "Int256",
    value: 29,
    supportedOperators: [],
    bitLength: 256,
    clearMatchingType: "int256",
  },
  {
    type: "AsciiString",
    value: 30,
    supportedOperators: [],
    bitLength: 0,
    clearMatchingType: "string memory",
  },
  {
    type: "Int512",
    value: 31,
    supportedOperators: [],
    bitLength: 512,
    clearMatchingType: "bytes memory",
  },
  {
    type: "Int1024",
    value: 32,
    supportedOperators: [],
    bitLength: 1024,
    clearMatchingType: "bytes memory",
  },
  {
    type: "Int2048",
    value: 33,
    supportedOperators: [],
    bitLength: 2048,
    clearMatchingType: "bytes memory",
  },
  {
    type: "Uint24",
    value: 34,
    supportedOperators: [],
    bitLength: 24,
    clearMatchingType: "uint24",
  },
  {
    type: "Uint40",
    value: 35,
    supportedOperators: [],
    bitLength: 40,
    clearMatchingType: "uint40",
  },
  {
    type: "Uint48",
    value: 36,
    supportedOperators: [],
    bitLength: 48,
    clearMatchingType: "uint48",
  },
  {
    type: "Uint56",
    value: 37,
    supportedOperators: [],
    bitLength: 56,
    clearMatchingType: "uint56",
  },
  {
    type: "Uint72",
    value: 38,
    supportedOperators: [],
    bitLength: 72,
    clearMatchingType: "uint72",
  },
  {
    type: "Uint80",
    value: 39,
    supportedOperators: [],
    bitLength: 80,
    clearMatchingType: "uint80",
  },
  {
    type: "Uint88",
    value: 40,
    supportedOperators: [],
    bitLength: 88,
    clearMatchingType: "uint88",
  },
  {
    type: "Uint96",
    value: 41,
    supportedOperators: [],
    bitLength: 96,
    clearMatchingType: "uint96",
  },
  {
    type: "Uint104",
    value: 42,
    supportedOperators: [],
    bitLength: 104,
    clearMatchingType: "uint104",
  },
  {
    type: "Uint112",
    value: 43,
    supportedOperators: [],
    bitLength: 112,
    clearMatchingType: "uint112",
  },
  {
    type: "Uint120",
    value: 44,
    supportedOperators: [],
    bitLength: 120,
    clearMatchingType: "uint120",
  },
  {
    type: "Uint136",
    value: 45,
    supportedOperators: [],
    bitLength: 136,
    clearMatchingType: "uint136",
  },
  {
    type: "Uint144",
    value: 46,
    supportedOperators: [],
    bitLength: 144,
    clearMatchingType: "uint144",
  },
  {
    type: "Uint152",
    value: 47,
    supportedOperators: [],
    bitLength: 152,
    clearMatchingType: "uint152",
  },
  {
    type: "Uint168",
    value: 48,
    supportedOperators: [],
    bitLength: 168,
    clearMatchingType: "uint168",
  },
  {
    type: "Uint176",
    value: 49,
    supportedOperators: [],
    bitLength: 176,
    clearMatchingType: "uint176",
  },
  {
    type: "Uint184",
    value: 50,
    supportedOperators: [],
    bitLength: 184,
    clearMatchingType: "uint184",
  },
  {
    type: "Uint192",
    value: 51,
    supportedOperators: [],
    bitLength: 192,
    clearMatchingType: "uint192",
  },
  {
    type: "Uint200",
    value: 52,
    supportedOperators: [],
    bitLength: 200,
    clearMatchingType: "uint200",
  },
  {
    type: "Uint208",
    value: 53,
    supportedOperators: [],
    bitLength: 208,
    clearMatchingType: "uint208",
  },
  {
    type: "Uint216",
    value: 54,
    supportedOperators: [],
    bitLength: 216,
    clearMatchingType: "uint216",
  },
  {
    type: "Uint224",
    value: 55,
    supportedOperators: [],
    bitLength: 224,
    clearMatchingType: "uint224",
  },
  {
    type: "Uint232",
    value: 56,
    supportedOperators: [],
    bitLength: 232,
    clearMatchingType: "uint232",
  },
  {
    type: "Uint240",
    value: 57,
    supportedOperators: [],
    bitLength: 240,
    clearMatchingType: "uint240",
  },
  {
    type: "Uint248",
    value: 58,
    supportedOperators: [],
    bitLength: 248,
    clearMatchingType: "uint248",
  },
  {
    type: "Int24",
    value: 59,
    supportedOperators: [],
    bitLength: 24,
    clearMatchingType: "int24",
  },
  {
    type: "Int40",
    value: 60,
    supportedOperators: [],
    bitLength: 40,
    clearMatchingType: "int40",
  },
  {
    type: "Int48",
    value: 61,
    supportedOperators: [],
    bitLength: 48,
    clearMatchingType: "int48",
  },
  {
    type: "Int56",
    value: 62,
    supportedOperators: [],
    bitLength: 56,
    clearMatchingType: "int56",
  },
  {
    type: "Int72",
    value: 63,
    supportedOperators: [],
    bitLength: 72,
    clearMatchingType: "int72",
  },
  {
    type: "Int80",
    value: 64,
    supportedOperators: [],
    bitLength: 80,
    clearMatchingType: "int80",
  },
  {
    type: "Int88",
    value: 65,
    supportedOperators: [],
    bitLength: 88,
    clearMatchingType: "int88",
  },
  {
    type: "Int96",
    value: 66,
    supportedOperators: [],
    bitLength: 96,
    clearMatchingType: "int96",
  },
  {
    type: "Int104",
    value: 67,
    supportedOperators: [],
    bitLength: 104,
    clearMatchingType: "int104",
  },
  {
    type: "Int112",
    value: 68,
    supportedOperators: [],
    bitLength: 112,
    clearMatchingType: "int112",
  },
  {
    type: "Int120",
    value: 69,
    supportedOperators: [],
    bitLength: 120,
    clearMatchingType: "int120",
  },
  {
    type: "Int136",
    value: 70,
    supportedOperators: [],
    bitLength: 136,
    clearMatchingType: "int136",
  },
  {
    type: "Int144",
    value: 71,
    supportedOperators: [],
    bitLength: 144,
    clearMatchingType: "int144",
  },
  {
    type: "Int152",
    value: 72,
    supportedOperators: [],
    bitLength: 152,
    clearMatchingType: "int152",
  },
  {
    type: "Int168",
    value: 73,
    supportedOperators: [],
    bitLength: 168,
    clearMatchingType: "int168",
  },
  {
    type: "Int176",
    value: 74,
    supportedOperators: [],
    bitLength: 176,
    clearMatchingType: "int176",
  },
  {
    type: "Int184",
    value: 75,
    supportedOperators: [],
    bitLength: 184,
    clearMatchingType: "int184",
  },
  {
    type: "Int192",
    value: 76,
    supportedOperators: [],
    bitLength: 192,
    clearMatchingType: "int192",
  },
  {
    type: "Int200",
    value: 77,
    supportedOperators: [],
    bitLength: 200,
    clearMatchingType: "int200",
  },
  {
    type: "Int208",
    value: 78,
    supportedOperators: [],
    bitLength: 208,
    clearMatchingType: "int208",
  },
  {
    type: "Int216",
    value: 79,
    supportedOperators: [],
    bitLength: 216,
    clearMatchingType: "int216",
  },
  {
    type: "Int224",
    value: 80,
    supportedOperators: [],
    bitLength: 224,
    clearMatchingType: "int224",
  },
  {
    type: "Int232",
    value: 81,
    supportedOperators: [],
    bitLength: 232,
    clearMatchingType: "int232",
  },
  {
    type: "Int240",
    value: 82,
    supportedOperators: [],
    bitLength: 240,
    clearMatchingType: "int240",
  },
  {
    type: "Int248",
    value: 83,
    supportedOperators: [],
    bitLength: 248,
    clearMatchingType: "int248",
  },
];

export function checkFheType(fheType: unknown): asserts fheType is FheType {
  if (!isUInt(fheType)) {
    throw new FhevmError(`Invalid FheType ${fheType}`);
  }

  const theFheType = fheType as bigint | number;

  // Debug: defensive check, should never happen
  if (ALL_FHE_TYPES.length - 1 !== ALL_FHE_TYPES[ALL_FHE_TYPES.length - 1].value) {
    throw new FhevmError(`Internal error: Invalid ALL_FHE_TYPES array.`);
  }

  if (theFheType >= ALL_FHE_TYPES.length) {
    throw new FhevmError(`Invalid FheType ${fheType}`);
  }
}

export function getFheTypeByteLength(fheType: FheType): number {
  const fheBitLen = getFheTypeBitLength(fheType);
  return Math.ceil(fheBitLen / 8);
}

export function getFheTypeBitLength(fheType: FheType): number {
  return getFheTypeInfo(fheType).bitLength;
}

export function getFheTypeInfo(type: FheType): FheTypeInfo {
  const typeInfo = ALL_FHE_TYPES[type];
  // Debug: defensive check, should never happen
  if (typeInfo.value !== Number(type)) {
    throw new FhevmError(`Internal error: Invalid FheType ${type}`);
  }
  return typeInfo;
}

export function getFheTypeName(fheType: unknown): FheTypeName {
  checkFheType(fheType);
  return getFheTypeInfo(fheType).type;
}
