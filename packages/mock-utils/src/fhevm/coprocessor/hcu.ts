import { ethers as EthersT } from "ethers";

import {
  assertEventArgIsBigUint8,
  assertEventArgIsBigUint256,
  assertEventArgIsBytes1String,
  assertEventArgIsBytes16String,
  assertEventArgIsBytes32String,
} from "../../ethers/event.js";
import { FhevmError, assertFhevm } from "../../utils/error.js";
import { type FheTypeName, getFheTypeName } from "../FheType.js";
import { FhevmHandle } from "../FhevmHandle.js";
import { HCUByOperator } from "./HCUByOperator.js";

export type TransactionHCUInfo = {
  transactionHash: `0x${string}`;
  globalHCU: number;
  maxHCUDepth: number;
  HCUDepthByHandle: Record<`0x${string}`, number>;
};

function _getTypeOperatorHCU(
  op: { supportScalar: boolean; numberInputs: number; types: Partial<Record<FheTypeName, number>> },
  typeName: FheTypeName,
): number {
  if (!(typeName in op.types && op.types[typeName])) {
    return 0;
  }
  return op.types[typeName];
}

function _getOperatorHCU(
  op: {
    supportScalar: boolean;
    numberInputs: number;
    scalar: Partial<Record<FheTypeName, number>>;
    nonScalar: Partial<Record<FheTypeName, number>>;
  },
  scalar: boolean,
  typeName: FheTypeName,
): number {
  assertFhevm(op.supportScalar);
  const prices: Partial<Record<FheTypeName, number>> = scalar ? op.scalar : op.nonScalar;
  if (!(typeName in prices && prices[typeName])) {
    return 0;
  }
  return prices[typeName];
}

function _getScalarOperatorHCU(
  op: {
    supportScalar: boolean;
    numberInputs: number;
    scalar: Partial<Record<FheTypeName, number>>;
  },
  typeName: FheTypeName,
): number {
  if (!(typeName in op.scalar && op.scalar[typeName])) {
    return 0;
  }
  return op.scalar[typeName];
}

function _filterOperatorsHCUsLogs(
  coprocessorAddress: `0x${string}`,
  coprocessorContractInterface: EthersT.Interface,
  logs: readonly EthersT.Log[],
): { name: keyof typeof HCUByOperator; args: EthersT.Result }[] {
  const res: { name: keyof typeof HCUByOperator; args: EthersT.Result }[] = [];
  for (let i = 0; i < logs.length; ++i) {
    const log: EthersT.Log = logs[i];
    if (log.address.toLowerCase() !== coprocessorAddress.toLowerCase()) {
      continue;
    }
    try {
      const parsedLog: EthersT.LogDescription | null = coprocessorContractInterface.parseLog({
        topics: log.topics,
        data: log.data,
      });

      if (!parsedLog || !(parsedLog.name in HCUByOperator)) {
        continue;
      }

      const eventName = parsedLog.name as keyof typeof HCUByOperator;
      const opPrices = HCUByOperator[eventName];
      if (opPrices == null || typeof opPrices !== "object") {
        continue;
      }

      res.push({
        name: eventName,
        args: parsedLog.args,
      });
    } catch {
      //
    }
  }
  return res;
}

export function getTxHCUFromTxReceipt(
  coprocessorAddress: `0x${string}`,
  coprocessorContractInterface: EthersT.Interface,
  receipt: EthersT.TransactionReceipt,
): TransactionHCUInfo {
  if (receipt.status === 0) {
    throw new FhevmError("Transaction reverted");
  }

  function readFromHCUMap(handle: `0x${string}`): number {
    if (hcuMap[handle] === undefined) {
      return 0;
    }
    return hcuMap[handle];
  }

  let hcuMap: Record<string, number> = {};
  let handleSet: Set<string> = new Set();

  const FHELogs = _filterOperatorsHCUsLogs(coprocessorAddress, coprocessorContractInterface, receipt.logs);

  let totalHCUConsumed = 0;

  for (const event of FHELogs) {
    let hcuConsumed: number;

    switch (event.name) {
      case "TrivialEncrypt": {
        // event TrivialEncrypt(address indexed caller, uint256 pt, FheType toType, bytes32 result);
        const toFheType: bigint = event.args[2 as keyof typeof event.args];
        const resultBytes32: string = event.args[3 as keyof typeof event.args];

        assertEventArgIsBigUint256(toFheType, "TrivialEncrypt", 2);
        assertEventArgIsBytes32String(resultBytes32, "TrivialEncrypt", 3);

        // HCU is computed using the toType arg
        const toFheTypeName: FheTypeName = getFheTypeName(toFheType);

        hcuConsumed = _getTypeOperatorHCU(HCUByOperator[event.name], toFheTypeName);
        totalHCUConsumed += hcuConsumed;

        hcuMap[resultBytes32] = hcuConsumed;
        handleSet.add(resultBytes32);
        break;
      }

      case "Cast": {
        // "event Cast(address indexed caller, bytes32 ct, uint8 toType, bytes32 result)",
        const ctBytes32: string = event.args[1 as keyof typeof event.args];
        const toTypeUint8: bigint = event.args[2 as keyof typeof event.args];
        const resultBytes32: string = event.args[3 as keyof typeof event.args];

        assertEventArgIsBytes32String(ctBytes32, event.name, 1);
        assertEventArgIsBigUint8(toTypeUint8, event.name, 2);
        assertEventArgIsBytes32String(resultBytes32, event.name, 3);

        // HCU is computed using the ct bytes32 arg
        const ctFhevmHandle: FhevmHandle = FhevmHandle.fromBytes32Hex(ctBytes32);
        const ctFheTypeName: FheTypeName = ctFhevmHandle.fheTypeInfo.type;

        hcuConsumed = _getTypeOperatorHCU(HCUByOperator[event.name], ctFheTypeName);
        totalHCUConsumed += hcuConsumed;

        hcuMap[resultBytes32] = hcuConsumed + readFromHCUMap(ctBytes32);
        handleSet.add(resultBytes32);
        break;
      }

      case "FheAdd":
      case "FheSub":
      case "FheMul":
      case "FheBitAnd":
      case "FheBitOr":
      case "FheBitXor":
      case "FheShl":
      case "FheShr":
      case "FheRotl":
      case "FheRotr":
      case "FheMax":
      case "FheMin": {
        // event <Event Name>(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
        const lhsBytes32: string = event.args[1 as keyof typeof event.args];
        const rhsBytes32: string = event.args[2 as keyof typeof event.args];
        const scalarBytes1: string = event.args[3 as keyof typeof event.args];
        const resultBytes32: string = event.args[4 as keyof typeof event.args];

        assertEventArgIsBytes32String(lhsBytes32, event.name, 1);
        assertEventArgIsBytes32String(rhsBytes32, event.name, 2);
        assertEventArgIsBytes1String(scalarBytes1, event.name, 3);
        assertEventArgIsBytes32String(resultBytes32, event.name, 4);

        const scalar: boolean = scalarBytes1 === "0x01";

        // HCU is computed using the result bytes32 type
        const resultFhevmHandle: FhevmHandle = FhevmHandle.fromBytes32Hex(resultBytes32);
        const resultFheTypeName: FheTypeName = resultFhevmHandle.fheTypeInfo.type;

        hcuConsumed = _getOperatorHCU(HCUByOperator[event.name], scalar, resultFheTypeName);
        totalHCUConsumed += hcuConsumed;

        hcuMap[resultBytes32] =
          hcuConsumed + Math.max(readFromHCUMap(lhsBytes32), scalar ? 0 : readFromHCUMap(rhsBytes32));
        handleSet.add(resultBytes32);
        break;
      }

      // Return boolean
      case "FheEq":
      case "FheNe":
      case "FheGe":
      case "FheGt":
      case "FheLe":
      case "FheLt": {
        // event <Event Name>(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
        const lhsBytes32: string = event.args[1 as keyof typeof event.args];
        const rhsBytes32: string = event.args[2 as keyof typeof event.args];
        const scalarBytes1: string = event.args[3 as keyof typeof event.args];
        const resultBytes32: string = event.args[4 as keyof typeof event.args];

        assertEventArgIsBytes32String(lhsBytes32, event.name, 1);
        assertEventArgIsBytes32String(rhsBytes32, event.name, 2);
        assertEventArgIsBytes1String(scalarBytes1, event.name, 3);
        assertEventArgIsBytes32String(resultBytes32, event.name, 4);

        const scalar: boolean = scalarBytes1 === "0x01";

        // HCU is computed using lhs bytes32 type
        const lhsFhevmHandle: FhevmHandle = FhevmHandle.fromBytes32Hex(lhsBytes32);
        const lhsFheTypeName: FheTypeName = lhsFhevmHandle.fheTypeInfo.type;

        hcuConsumed = _getOperatorHCU(HCUByOperator[event.name], scalar, lhsFheTypeName);
        totalHCUConsumed += hcuConsumed;

        hcuMap[resultBytes32] =
          hcuConsumed + Math.max(readFromHCUMap(lhsBytes32), scalar ? 0 : readFromHCUMap(rhsBytes32));
        handleSet.add(resultBytes32);
        break;
      }

      case "FheDiv":
      case "FheRem": {
        // event <Event Name>(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
        const lhsBytes32: string = event.args[1 as keyof typeof event.args];
        const rhsBytes32: string = event.args[2 as keyof typeof event.args];
        const scalarBytes1: string = event.args[3 as keyof typeof event.args];
        const resultBytes32: string = event.args[4 as keyof typeof event.args];

        assertEventArgIsBytes32String(lhsBytes32, event.name, 1);
        assertEventArgIsBytes32String(rhsBytes32, event.name, 2);
        assertEventArgIsBytes1String(scalarBytes1, event.name, 3);
        assertEventArgIsBytes32String(resultBytes32, event.name, 4);

        const scalar: boolean = scalarBytes1 === "0x01";
        if (!scalar) {
          throw new FhevmError(`Non-scalar ${event.name} not implemented yet`);
        }

        // HCU is computed using the result bytes32 type
        const resultFhevmHandle: FhevmHandle = FhevmHandle.fromBytes32Hex(resultBytes32);
        const resultFheTypeName: FheTypeName = resultFhevmHandle.fheTypeInfo.type;

        hcuConsumed = _getScalarOperatorHCU(HCUByOperator[event.name], resultFheTypeName);
        totalHCUConsumed += hcuConsumed;

        hcuMap[resultBytes32] = hcuConsumed + readFromHCUMap(lhsBytes32);
        handleSet.add(resultBytes32);
        break;
      }

      case "FheNot":
      case "FheNeg": {
        // "event <Event Name>(address indexed caller, bytes32 ct, bytes32 result)",
        const ctBytes32: string = event.args[1 as keyof typeof event.args];
        const resultBytes32: string = event.args[2 as keyof typeof event.args];

        assertEventArgIsBytes32String(ctBytes32, event.name, 1);
        assertEventArgIsBytes32String(resultBytes32, event.name, 2);

        // HCU is computed using the ct bytes32 arg
        const ctFhevmHandle: FhevmHandle = FhevmHandle.fromBytes32Hex(ctBytes32);
        const ctFheTypeName: FheTypeName = ctFhevmHandle.fheTypeInfo.type;

        hcuConsumed = _getTypeOperatorHCU(HCUByOperator[event.name], ctFheTypeName);
        totalHCUConsumed += hcuConsumed;

        hcuMap[resultBytes32] = hcuConsumed + readFromHCUMap(ctBytes32);
        handleSet.add(resultBytes32);
        break;
      }

      case "FheIfThenElse": {
        // "event FheIfThenElse(address indexed caller, bytes32 control, bytes32 ifTrue, bytes32 ifFalse, bytes32 result)",
        const controlBytes32: string = event.args[1 as keyof typeof event.args];
        const ifTrueBytes32: string = event.args[2 as keyof typeof event.args];
        const ifFalseBytes32: string = event.args[3 as keyof typeof event.args];
        const resultBytes32: string = event.args[4 as keyof typeof event.args];

        assertEventArgIsBytes32String(controlBytes32, event.name, 1);
        assertEventArgIsBytes32String(ifTrueBytes32, event.name, 2);
        assertEventArgIsBytes32String(ifFalseBytes32, event.name, 3);
        assertEventArgIsBytes32String(resultBytes32, event.name, 4);

        // HCU is computed using the result bytes32 type
        const resultFhevmHandle: FhevmHandle = FhevmHandle.fromBytes32Hex(resultBytes32);
        const resultFheTypeName: FheTypeName = resultFhevmHandle.fheTypeInfo.type;

        hcuConsumed = _getTypeOperatorHCU(HCUByOperator[event.name], resultFheTypeName);
        totalHCUConsumed += hcuConsumed;

        hcuMap[resultBytes32] =
          hcuConsumed +
          Math.max(
            // Compute max
            readFromHCUMap(controlBytes32),
            readFromHCUMap(ifTrueBytes32),
            readFromHCUMap(ifFalseBytes32),
          );
        handleSet.add(resultBytes32);
        break;
      }

      case "FheRand": {
        // "event FheRand(address indexed caller, uint8 randType, bytes16 seed, bytes32 result)",
        const randTypeUint8: bigint = event.args[1 as keyof typeof event.args];
        const seedBytes16: string = event.args[2 as keyof typeof event.args];
        const resultBytes32: string = event.args[3 as keyof typeof event.args];

        assertEventArgIsBigUint8(randTypeUint8, event.name, 1);
        assertEventArgIsBytes16String(seedBytes16, event.name, 2);
        assertEventArgIsBytes32String(resultBytes32, event.name, 3);

        // HCU is computed using the randType uint8 arg
        const randTypeFheTypeName: FheTypeName = getFheTypeName(randTypeUint8);

        hcuConsumed = _getTypeOperatorHCU(HCUByOperator[event.name], randTypeFheTypeName);
        totalHCUConsumed += hcuConsumed;

        hcuMap[resultBytes32] = hcuConsumed;
        handleSet.add(resultBytes32);
        break;
      }

      case "FheRandBounded": {
        // "event FheRandBounded(address indexed caller, uint256 upperBound, uint8 randType, bytes16 seed, bytes32 result)",
        const upperBoundUint256: bigint = event.args[1 as keyof typeof event.args];
        const randTypeUint8: bigint = event.args[2 as keyof typeof event.args];
        const seedBytes16: string = event.args[3 as keyof typeof event.args];
        const resultBytes32: string = event.args[4 as keyof typeof event.args];

        assertEventArgIsBigUint256(upperBoundUint256, event.name, 1);
        assertEventArgIsBigUint8(randTypeUint8, event.name, 2);
        assertEventArgIsBytes16String(seedBytes16, event.name, 3);
        assertEventArgIsBytes32String(resultBytes32, event.name, 4);

        // Price is computed using the result bytes32 type
        const resultFhevmHandle: FhevmHandle = FhevmHandle.fromBytes32Hex(resultBytes32);
        const resultFheTypeName: FheTypeName = resultFhevmHandle.fheTypeInfo.type;

        hcuConsumed = _getTypeOperatorHCU(HCUByOperator[event.name], resultFheTypeName);
        totalHCUConsumed += hcuConsumed;

        hcuMap[resultBytes32] = hcuConsumed;
        handleSet.add(resultBytes32);
        break;
      }
    }
  }

  let maxDepthHCU = 0;

  handleSet.forEach((handle) => {
    const hcu = hcuMap[handle];
    if (hcu > maxDepthHCU) {
      maxDepthHCU = hcu;
    }
  });

  return {
    transactionHash: receipt.hash as `0x${string}`,
    globalHCU: totalHCUConsumed,
    maxHCUDepth: maxDepthHCU,
    HCUDepthByHandle: hcuMap,
  };
}
