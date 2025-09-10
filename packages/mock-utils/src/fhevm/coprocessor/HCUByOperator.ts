import { FhevmError } from "../../utils/error.js";
import type { FheTypeName } from "../FheType.js";
import type { CoprocessorOperatorEventName } from "./CoprocessorEvents.js";

type HCUNoOp = {
  supportScalar: false;
  numberInputs: 0;
  types: Partial<Record<FheTypeName, number>>;
};

type HCUUnaryOp = {
  supportScalar: false;
  numberInputs: 1;
  types: Partial<Record<FheTypeName, number>>;
};

type HCUBinaryOp = {
  supportScalar: true;
  numberInputs: 2;
  scalar: Partial<Record<FheTypeName, number>>;
  nonScalar?: Partial<Record<FheTypeName, number>>;
};

type HCUTernaryOp = {
  supportScalar: false;
  numberInputs: 3;
  types: Partial<Record<FheTypeName, number>>;
};

type HCUOperator = HCUNoOp | HCUUnaryOp | HCUBinaryOp | HCUTernaryOp;

export type HCUOperatorName = CoprocessorOperatorEventName;
  
export const HCUByOperator = {
  FheAdd: {
    supportScalar: true,
    numberInputs: 2,
    scalar: {
      Uint8: 84000,
      Uint16: 93000,
      Uint32: 95000,
      Uint64: 133000,
      Uint128: 172000,
    },
    nonScalar: {
      Uint8: 88000,
      Uint16: 93000,
      Uint32: 125000,
      Uint64: 162000,
      Uint128: 259000,
    },
  },
  FheSub: {
    supportScalar: true,
    numberInputs: 2,
    scalar: {
      Uint8: 84000,
      Uint16: 93000,
      Uint32: 95000,
      Uint64: 133000,
      Uint128: 172000,
    },
    nonScalar: {
      Uint8: 91000,
      Uint16: 93000,
      Uint32: 125000,
      Uint64: 162000,
      Uint128: 260000,
    },
  },
  FheMul: {
    supportScalar: true,
    numberInputs: 2,
    scalar: {
      Uint8: 122000,
      Uint16: 193000,
      Uint32: 265000,
      Uint64: 365000,
      Uint128: 696000,
    },
    nonScalar: {
      Uint8: 150000,
      Uint16: 222000,
      Uint32: 328000,
      Uint64: 596000,
      Uint128: 1686000,
    },
  },
  FheDiv: {
    supportScalar: true,
    numberInputs: 2,
    scalar: {
      Uint8: 210000,
      Uint16: 302000,
      Uint32: 438000,
      Uint64: 715000,
      Uint128: 1225000,
    },
  },
  FheRem: {
    supportScalar: true,
    numberInputs: 2,
    scalar: {
      Uint8: 440000,
      Uint16: 580000,
      Uint32: 792000,
      Uint64: 1153000,
      Uint128: 1943000,
    },
  },
  FheBitAnd: {
    supportScalar: true,
    numberInputs: 2,
    scalar: {
      Bool: 22000,
      Uint8: 31000,
      Uint16: 31000,
      Uint32: 32000,
      Uint64: 34000,
      Uint128: 37000,
      Uint256: 38000,
    },
    nonScalar: {
      Bool: 25000,
      Uint8: 31000,
      Uint16: 31000,
      Uint32: 32000,
      Uint64: 34000,
      Uint128: 37000,
      Uint256: 38000,
    },
  },
  FheBitOr: {
    supportScalar: true,
    numberInputs: 2,
    scalar: {
      Bool: 22000,
      Uint8: 30000,
      Uint16: 30000,
      Uint32: 32000,
      Uint64: 34000,
      Uint128: 37000,
      Uint256: 38000,
    },
    nonScalar: {
      Bool: 24000,
      Uint8: 30000,
      Uint16: 31000,
      Uint32: 32000,
      Uint64: 34000,
      Uint128: 37000,
      Uint256: 38000,
    },
  },
  FheBitXor: {
    supportScalar: true,
    numberInputs: 2,
    scalar: {
      Bool: 22000,
      Uint8: 31000,
      Uint16: 31000,
      Uint32: 32000,
      Uint64: 34000,
      Uint128: 37000,
      Uint256: 39000,
    },
    nonScalar: {
      Bool: 22000,
      Uint8: 31000,
      Uint16: 31000,
      Uint32: 32000,
      Uint64: 34000,
      Uint128: 37000,
      Uint256: 39000,
    },
  },
  FheShl: {
    supportScalar: true,
    numberInputs: 2,
    scalar: {
      Uint8: 32000,
      Uint16: 32000,
      Uint32: 32000,
      Uint64: 34000,
      Uint128: 37000,
      Uint256: 39000,
    },
    nonScalar: {
      Uint8: 92000,
      Uint16: 125000,
      Uint32: 162000,
      Uint64: 208000,
      Uint128: 272000,
      Uint256: 378000,
    },
  },
  FheShr: {
    supportScalar: true,
    numberInputs: 2,
    scalar: {
      Uint8: 32000,
      Uint16: 32000,
      Uint32: 32000,
      Uint64: 34000,
      Uint128: 37000,
      Uint256: 38000,
    },
    nonScalar: {
      Uint8: 91000,
      Uint16: 123000,
      Uint32: 163000,
      Uint64: 209000,
      Uint128: 272000,
      Uint256: 369000,
    },
  },
  FheRotl: {
    supportScalar: true,
    numberInputs: 2,
    scalar: {
      Uint8: 31000,
      Uint16: 31000,
      Uint32: 32000,
      Uint64: 34000,
      Uint128: 37000,
      Uint256: 38000,
    },
    nonScalar: {
      Uint8: 91000,
      Uint16: 125000,
      Uint32: 163000,
      Uint64: 209000,
      Uint128: 278000,
      Uint256: 378000,
    },
  },
  FheRotr: {
    supportScalar: true,
    numberInputs: 2,
    scalar: {
      Uint8: 31000,
      Uint16: 31000,
      Uint32: 32000,
      Uint64: 34000,
      Uint128: 37000,
      Uint256: 40000,
    },
    nonScalar: {
      Uint8: 93000,
      Uint16: 125000,
      Uint32: 160000,
      Uint64: 209000,
      Uint128: 283000,
      Uint256: 375000,
    },
  },
  FheEq: {
    supportScalar: true,
    numberInputs: 2,
    scalar: {
      Bool: 25000,
      Uint8: 55000,
      Uint16: 55000,
      Uint32: 82000,
      Uint64: 83000,
      Uint128: 117000,
      Uint160: 117000,
      Uint256: 118000,
    },
    nonScalar: {
      Bool: 26000,
      Uint8: 55000,
      Uint16: 83000,
      Uint32: 86000,
      Uint64: 120000,
      Uint128: 122000,
      Uint160: 137000,
      Uint256: 152000,
    },
  },
  FheNe: {
    supportScalar: true,
    numberInputs: 2,
    scalar: {
      Bool: 23000,
      Uint8: 55000,
      Uint16: 55000,
      Uint32: 83000,
      Uint64: 84000,
      Uint128: 117000,
      Uint160: 117000,
      Uint256: 117000,
    },
    nonScalar: {
      Bool: 23000,
      Uint8: 55000,
      Uint16: 83000,
      Uint32: 85000,
      Uint64: 118000,
      Uint128: 122000,
      Uint160: 136000,
      Uint256: 150000,
    },
  },
  FheGe: {
    supportScalar: true,
    numberInputs: 2,
    scalar: {
      Uint8: 52000,
      Uint16: 55000,
      Uint32: 84000,
      Uint64: 116000,
      Uint128: 149000,
    },
    nonScalar: {
      Uint8: 63000,
      Uint16: 84000,
      Uint32: 118000,
      Uint64: 152000,
      Uint128: 210000,
    },
  },
  FheGt: {
    supportScalar: true,
    numberInputs: 2,
    scalar: {
      Uint8: 52000,
      Uint16: 55000,
      Uint32: 84000,
      Uint64: 117000,
      Uint128: 150000,
    },
    nonScalar: {
      Uint8: 59000,
      Uint16: 84000,
      Uint32: 118000,
      Uint64: 152000,
      Uint128: 218000,
    },
  },
  FheLe: {
    supportScalar: true,
    numberInputs: 2,
    scalar: {
      Uint8: 58000,
      Uint16: 58000,
      Uint32: 84000,
      Uint64: 119000,
      Uint128: 150000,
    },
    nonScalar: {
      Uint8: 58000,
      Uint16: 83000,
      Uint32: 117000,
      Uint64: 149000,
      Uint128: 218000,
    },
  },
  FheLt: {
    supportScalar: true,
    numberInputs: 2,
    scalar: {
      Uint8: 52000,
      Uint16: 58000,
      Uint32: 83000,
      Uint64: 118000,
      Uint128: 149000,
    },
    nonScalar: {
      Uint8: 59000,
      Uint16: 84000,
      Uint32: 117000,
      Uint64: 146000,
      Uint128: 215000,
    },
  },
  FheMin: {
    supportScalar: true,
    numberInputs: 2,
    scalar: {
      Uint8: 84000,
      Uint16: 88000,
      Uint32: 117000,
      Uint64: 150000,
      Uint128: 186000,
    },
    nonScalar: {
      Uint8: 119000,
      Uint16: 146000,
      Uint32: 182000,
      Uint64: 219000,
      Uint128: 289000,
    },
  },
  FheMax: {
    supportScalar: true,
    numberInputs: 2,
    scalar: {
      Uint8: 89000,
      Uint16: 89000,
      Uint32: 117000,
      Uint64: 149000,
      Uint128: 180000,
    },
    nonScalar: {
      Uint8: 121000,
      Uint16: 145000,
      Uint32: 180000,
      Uint64: 218000,
      Uint128: 290000,
    },
  },
  FheNeg: {
    supportScalar: false,
    numberInputs: 1,
    types: {
      Uint8: 79000,
      Uint16: 93000,
      Uint32: 95000,
      Uint64: 131000,
      Uint128: 168000,
      Uint256: 269000,
    },
  },
  FheNot: {
    supportScalar: false,
    numberInputs: 1,
    types: {
      Bool: 2,
      Uint8: 9,
      Uint16: 16,
      Uint32: 32,
      Uint64: 63,
      Uint128: 130,
      Uint256: 130,
    },
  },
  Cast: {
    supportScalar: false,
    numberInputs: 1,
    types: {
      Bool: 32,
      Uint8: 32,
      Uint16: 32,
      Uint32: 32,
      Uint64: 32,
      Uint128: 32,
      Uint256: 32,
    },
  },
  TrivialEncrypt: {
    supportScalar: false,
    numberInputs: 0,
    types: {
      Bool: 32,
      Uint8: 32,
      Uint16: 32,
      Uint32: 32,
      Uint64: 32,
      Uint128: 32,
      Uint160: 32,
      Uint256: 32,
    },
  },
  FheIfThenElse: {
    supportScalar: false,
    numberInputs: 3,
    types: {
      Bool: 55000,
      Uint8: 55000,
      Uint16: 55000,
      Uint32: 55000,
      Uint64: 55000,
      Uint128: 57000,
      Uint160: 83000,
      Uint256: 108000,
    },
  },
  FheRand: {
    supportScalar: false,
    numberInputs: 0,
    types: {
      Bool: 19000,
      Uint8: 23000,
      Uint16: 23000,
      Uint32: 24000,
      Uint64: 24000,
      Uint128: 25000,
      Uint256: 30000,
    },
  },
  FheRandBounded: {
    supportScalar: false,
    numberInputs: 0,
    types: Object.freeze({
      Uint8: 23000,
      Uint16: 23000,
      Uint32: 24000,
      Uint64: 24000,
      Uint128: 25000,
      Uint256: 30000,
    }),
  },
} as const satisfies Record<HCUOperatorName, HCUOperator>;

export function getHCU(
  opName: HCUOperatorName,
  type: FheTypeName,
  opts?: { scalar: boolean }
): number {
  const hcuOperator: HCUOperator = HCUByOperator[opName];
  
  if (!hcuOperator) {
    throw new FhevmError(`Unknown HCU operator '${opName}'`);
  }

  let m: Partial<Record<FheTypeName, number>>;
  if ("types" in hcuOperator) {
    m = hcuOperator.types;
  } else {
    m = (opts?.scalar ?? false) ? hcuOperator.scalar : (hcuOperator.nonScalar ?? hcuOperator.scalar);
  }

  if (!m[type]) {
    throw new FhevmError(`Type ${type} not supported by HCU operator '${opName}'`);
  }

  return m[type] ?? 0;
}
