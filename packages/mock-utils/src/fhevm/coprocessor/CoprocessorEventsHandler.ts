import {
  assertEventArgIsAddress,
  assertEventArgIsBigUint8,
  assertEventArgIsBigUint256,
  assertEventArgIsBytes1String,
  assertEventArgIsBytes16String,
  assertEventArgIsBytes32String,
  assertEventArgIsBytesString,
} from "../../ethers/event.js";
import { FhevmError, assertFhevm } from "../../utils/error.js";
import { bitwiseNotUIntBits, getRandomBigInt, log2BigInt } from "../../utils/math.js";
import { FheType } from "../FheType.js";
import { FhevmHandle } from "../FhevmHandle.js";
import type { FhevmDB } from "../db/FhevmDB.js";
import type { CoprocessorEvent } from "./CoprocessorEvents.js";

export class CoprocessorEventsHandler {
  #db: FhevmDB;
  #counterRand: number;

  constructor(db: FhevmDB) {
    this.#db = db;
    this.#counterRand = 0;
  }

  public get counterRand(): number {
    return this.#counterRand;
  }

  public async handleEvent(coprocessorEvent: CoprocessorEvent) {
    // Should be properly handled by the event iterator
    assertFhevm(
      coprocessorEvent.blockNumber >= this.#db.fromBlockNumber,
      "coprocessorEvent.blockNumber < this.#db.fromBlockNumber",
    );
    // if (coprocessorEvent.blockNumber < this.#db.fromBlockNumber) {
    //   // ignore, the db exclusively contains handles generated from `firstBlockNumber` and above.
    //   console.log(
    //     `coprocessorEvent.blockNumber=${coprocessorEvent.blockNumber} < db.firstBlockNumber=${this.#db.fromBlockNumber}`,
    //   );
    //   return;
    // }
    if (coprocessorEvent.eventName === "VerifyCiphertext") {
      await this.verifyCipherText(coprocessorEvent.args);
    } else {
      const res = await this.executeCoprocessorEvent(coprocessorEvent);
      if (res) {
        await this.#db.insertHandleBytes32(
          res.resultBytes32,
          res.clearText,
          {
            index: coprocessorEvent.index,
            blockNumber: coprocessorEvent.blockNumber,
            transactionHash: coprocessorEvent.transactionHash,
          },
          res.replace !== undefined ? { replace: res.replace } : undefined,
        );

        if (coprocessorEvent.eventName === "FheRandBounded" || coprocessorEvent.eventName === "FheRand") {
          this.#counterRand++;
        }
      }
    }
  }

  private async executeCoprocessorEvent(event: CoprocessorEvent): Promise<
    | {
        resultBytes32: string;
        clearText: bigint | string;
        replace?: boolean;
      }
    | undefined
  > {
    switch (event.eventName) {
      case "TrivialEncrypt": {
        // event TrivialEncrypt(address indexed caller, uint256 pt, FheType toType, bytes32 result);
        const ptUint256: bigint = event.args[1 as keyof typeof event.args];
        const fheType: bigint = event.args[2 as keyof typeof event.args];
        const resultBytes32: string = event.args[3 as keyof typeof event.args];

        assertEventArgIsBigUint256(ptUint256, "TrivialEncrypt", 1);
        assertEventArgIsBigUint256(fheType, "TrivialEncrypt", 2);
        assertEventArgIsBytes32String(resultBytes32, "TrivialEncrypt", 3);

        return {
          resultBytes32,
          clearText: ptUint256,
        };
      }

      case "TrivialEncryptBytes": {
        // event TrivialEncryptBytes(address indexed caller, bytes pt, FheType toType, bytes32 result);
        const ptBytes: string = event.args[1 as keyof typeof event.args];
        const resultBytes32: string = event.args[3 as keyof typeof event.args];

        assertEventArgIsBytesString(ptBytes, "TrivialEncryptBytes", 1);
        assertEventArgIsBytes32String(resultBytes32, "TrivialEncrypt", 3);

        return {
          resultBytes32,
          clearText: ptBytes,
        };
      }

      case "FheAdd": {
        // event FheAdd(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
        const binaryOp = await this.parseBinaryOpEvent(event);

        let clearText: bigint = binaryOp.clearTextLhsBigInt + binaryOp.clearTextRhsBigInt;

        // Clamp
        clearText = clearText % 2n ** binaryOp.clearTextBitLength;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheSub": {
        // event FheSub(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
        const binaryOp = await this.parseBinaryOpEvent(event);

        let clearText: bigint = binaryOp.clearTextLhsBigInt - binaryOp.clearTextRhsBigInt;

        // Clamp
        if (clearText < 0n) clearText = clearText + 2n ** binaryOp.clearTextBitLength;
        clearText = clearText % 2n ** binaryOp.clearTextBitLength;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheMul": {
        // event FheMul(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
        const binaryOp = await this.parseBinaryOpEvent(event);

        let clearText: bigint = binaryOp.clearTextLhsBigInt * binaryOp.clearTextRhsBigInt;

        // Clamp
        clearText = clearText % 2n ** binaryOp.clearTextBitLength;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheDiv": {
        // event FheDiv(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);

        const binaryOp = await this.parseBinaryOpEvent(event);
        if (!binaryOp.scalar) {
          throw new Error("Non-scalar div not implemented yet");
        }

        // Check division by zero ?
        const clearText: bigint = binaryOp.clearTextLhsBigInt / binaryOp.clearTextRhsBigInt;

        // No Clamp needed
        // clearText = clearText % 2n ** binaryOp.numBits;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheRem": {
        //event FheRem(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);

        const binaryOp = await this.parseBinaryOpEvent(event);
        if (!binaryOp.scalar) {
          throw new Error("Non-scalar rem not implemented yet");
        }

        // Check division by zero ?
        const clearText: bigint = binaryOp.clearTextLhsBigInt % binaryOp.clearTextRhsBigInt;

        // No Clamp needed
        // clearText = clearText % 2n ** binaryOp.numBits;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheBitAnd": {
        // event FheBitAnd(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
        const binaryOp = await this.parseBinaryOpEvent(event);

        let clearText: bigint = binaryOp.clearTextLhsBigInt & binaryOp.clearTextRhsBigInt;

        // Clamp
        clearText = clearText % 2n ** binaryOp.clearTextBitLength;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheBitOr": {
        // event FheBitOr(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
        const binaryOp = await this.parseBinaryOpEvent(event);

        let clearText: bigint = binaryOp.clearTextLhsBigInt | binaryOp.clearTextRhsBigInt;

        // Clamp
        clearText = clearText % 2n ** binaryOp.clearTextBitLength;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheBitXor": {
        // event FheBitXor(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
        const binaryOp = await this.parseBinaryOpEvent(event);

        let clearText: bigint = binaryOp.clearTextLhsBigInt ^ binaryOp.clearTextRhsBigInt;

        // Clamp
        clearText = clearText % 2n ** binaryOp.clearTextBitLength;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheShl": {
        // event FheShl(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
        const binaryOp = await this.parseBinaryOpEvent(event);

        let clearText: bigint =
          binaryOp.clearTextLhsBigInt << binaryOp.clearTextRhsBigInt % binaryOp.clearTextBitLength;

        // Clamp
        clearText = clearText % 2n ** binaryOp.clearTextBitLength;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheShr": {
        // event FheShr(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
        const binaryOp = await this.parseBinaryOpEvent(event);

        let clearText: bigint =
          binaryOp.clearTextLhsBigInt >> binaryOp.clearTextRhsBigInt % binaryOp.clearTextBitLength;

        // Clamp
        clearText = clearText % 2n ** binaryOp.clearTextBitLength;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheRotl": {
        // "event FheRotl(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
        const binaryOp = await this.parseBinaryOpEvent(event);

        const shift = binaryOp.clearTextRhsBigInt % binaryOp.clearTextBitLength;

        let clearText =
          (binaryOp.clearTextLhsBigInt << shift) |
          (binaryOp.clearTextLhsBigInt >> (binaryOp.clearTextBitLength - shift));

        // Clamp
        clearText = clearText % 2n ** binaryOp.clearTextBitLength;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheRotr": {
        // "event FheRotr(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
        const binaryOp = await this.parseBinaryOpEvent(event);

        const shift = binaryOp.clearTextRhsBigInt % binaryOp.clearTextBitLength;

        let clearText =
          (binaryOp.clearTextLhsBigInt >> shift) |
          (binaryOp.clearTextLhsBigInt << (binaryOp.clearTextBitLength - shift));

        // Clamp
        clearText = clearText % 2n ** binaryOp.clearTextBitLength;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheEq": {
        // "event FheEq(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
        const binaryOp = await this.parseBinaryOpEvent(event);

        const clearText = binaryOp.clearTextLhsBigInt === binaryOp.clearTextRhsBigInt ? 1n : 0n;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheEqBytes": {
        // "event FheEqBytes(address indexed caller, bytes32 lhs, bytes rhs, bytes1 scalarByte, bytes32 result)",
        const binaryOp = await this.parseBinaryBytesOpEvent(event);

        const clearText = binaryOp.clearTextLhsBigInt === binaryOp.clearTextRhsBigInt ? 1n : 0n;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheNe": {
        // "event FheNe(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
        const binaryOp = await this.parseBinaryOpEvent(event);

        const clearText = binaryOp.clearTextLhsBigInt === binaryOp.clearTextRhsBigInt ? 0n : 1n;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheNeBytes": {
        // "event FheNeBytes(address indexed caller, bytes32 lhs, bytes rhs, bytes1 scalarByte, bytes32 result)",
        const binaryOp = await this.parseBinaryBytesOpEvent(event);

        const clearText = binaryOp.clearTextLhsBigInt !== binaryOp.clearTextRhsBigInt ? 1n : 0n;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheGe": {
        // "event FheGe(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
        const binaryOp = await this.parseBinaryOpEvent(event);

        const clearText = binaryOp.clearTextLhsBigInt >= binaryOp.clearTextRhsBigInt ? 1n : 0n;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheGt": {
        // "event FheGt(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
        const binaryOp = await this.parseBinaryOpEvent(event);

        const clearText = binaryOp.clearTextLhsBigInt > binaryOp.clearTextRhsBigInt ? 1n : 0n;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheLe": {
        // "event FheLe(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
        const binaryOp = await this.parseBinaryOpEvent(event);

        const clearText = binaryOp.clearTextLhsBigInt <= binaryOp.clearTextRhsBigInt ? 1n : 0n;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheLt": {
        // "event FheLt(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
        const binaryOp = await this.parseBinaryOpEvent(event);

        const clearText = binaryOp.clearTextLhsBigInt < binaryOp.clearTextRhsBigInt ? 1n : 0n;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheMin": {
        // "event FheMin(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
        const binaryOp = await this.parseBinaryOpEvent(event);

        const clearText =
          binaryOp.clearTextLhsBigInt < binaryOp.clearTextRhsBigInt
            ? binaryOp.clearTextLhsBigInt
            : binaryOp.clearTextRhsBigInt;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheMax": {
        // "event FheMax(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
        const binaryOp = await this.parseBinaryOpEvent(event);

        const clearText =
          binaryOp.clearTextLhsBigInt > binaryOp.clearTextRhsBigInt
            ? binaryOp.clearTextLhsBigInt
            : binaryOp.clearTextRhsBigInt;

        return {
          resultBytes32: binaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheNot": {
        // "event FheNot(address indexed caller, bytes32 ct, bytes32 result)",
        const unaryOp = await this.parseUnaryOpEvent(event);

        const clearText: bigint = bitwiseNotUIntBits(unaryOp.clearTextBigInt, unaryOp.clearTextBitLength);

        return {
          resultBytes32: unaryOp.resultBytes32,
          clearText,
        };
      }

      case "FheNeg": {
        // "event FheNeg(address indexed caller, bytes32 ct, bytes32 result)",
        const unaryOp = await this.parseUnaryOpEvent(event);

        let clearText: bigint = bitwiseNotUIntBits(unaryOp.clearTextBigInt, unaryOp.clearTextBitLength);

        // Clamp
        clearText = (clearText + 1n) % 2n ** unaryOp.clearTextBitLength;

        return {
          resultBytes32: unaryOp.resultBytes32,
          clearText,
        };
      }

      case "Cast": {
        // "event Cast(address indexed caller, bytes32 ct, uint8 toType, bytes32 result)",
        const ctBytes32: string = event.args[1 as keyof typeof event.args];
        const toTypeUint8: bigint = event.args[2 as keyof typeof event.args];
        const resultBytes32: string = event.args[3 as keyof typeof event.args];

        assertEventArgIsBytes32String(ctBytes32, event.eventName, 1);
        assertEventArgIsBigUint8(toTypeUint8, event.eventName, 2);
        assertEventArgIsBytes32String(resultBytes32, event.eventName, 3);

        const resultFhevmHandle: FhevmHandle = FhevmHandle.fromBytes32Hex(resultBytes32);
        const resultType: FheType = resultFhevmHandle.fheType;
        const clearTextBitLength = BigInt(resultFhevmHandle.fhevmTypeInfo.clearTextBitLength);

        assertFhevm(
          BigInt(resultType) === toTypeUint8,
          `Cast type mismatch, (resultType:${resultType}) !== (toTypeUint8:${toTypeUint8})`,
        );

        const ct: bigint = BigInt((await this.#db.queryHandleBytes32(ctBytes32)).clearTextHex);

        const clearText: bigint = ct % 2n ** clearTextBitLength;

        return {
          resultBytes32,
          clearText,
        };
      }

      case "FheIfThenElse": {
        // "event FheIfThenElse(address indexed caller, bytes32 control, bytes32 ifTrue, bytes32 ifFalse, bytes32 result)",
        const controlBytes32: string = event.args[1 as keyof typeof event.args];
        const ifTrueBytes32: string = event.args[2 as keyof typeof event.args];
        const ifFalseBytes32: string = event.args[3 as keyof typeof event.args];
        const resultBytes32: string = event.args[4 as keyof typeof event.args];

        assertEventArgIsBytes32String(controlBytes32, event.eventName, 1);
        assertEventArgIsBytes32String(ifTrueBytes32, event.eventName, 2);
        assertEventArgIsBytes32String(ifFalseBytes32, event.eventName, 3);
        assertEventArgIsBytes32String(resultBytes32, event.eventName, 4);

        const control: bigint = BigInt((await this.#db.queryHandleBytes32(controlBytes32)).clearTextHex);
        const ifTrue: bigint = BigInt((await this.#db.queryHandleBytes32(ifTrueBytes32)).clearTextHex);
        const ifFalse: bigint = BigInt((await this.#db.queryHandleBytes32(ifFalseBytes32)).clearTextHex);

        assertFhevm(
          control === 0n || control === 1n,
          `Unexpected FheIfThenElse control value. Got ${control}, expecting 0 or 1`,
        );

        const clearText: bigint = control === 1n ? ifTrue : ifFalse;

        return {
          resultBytes32,
          clearText,
        };
      }

      case "FheRand": {
        // "event FheRand(address indexed caller, uint8 randType, bytes16 seed, bytes32 result)",
        const randTypeUint8: bigint = event.args[1 as keyof typeof event.args];
        const seedBytes16: string = event.args[2 as keyof typeof event.args];
        const resultBytes32: string = event.args[3 as keyof typeof event.args];

        assertEventArgIsBigUint8(randTypeUint8, event.eventName, 1);
        assertEventArgIsBytes16String(seedBytes16, event.eventName, 2);
        assertEventArgIsBytes32String(resultBytes32, event.eventName, 3);

        const resultFhevmHandle: FhevmHandle = FhevmHandle.fromBytes32Hex(resultBytes32);
        const resultType: FheType = resultFhevmHandle.fheType;
        const clearTextBitLength = resultFhevmHandle.fhevmTypeInfo.clearTextBitLength;

        assertFhevm(
          BigInt(resultType) === randTypeUint8,
          `Rand type mismatch, (resultType:${resultType}) !== (randTypeUint8:${randTypeUint8})`,
        );

        //EthersT.randomBytes
        const clearText: bigint = getRandomBigInt(clearTextBitLength);

        return {
          resultBytes32,
          clearText,
          replace: true,
        };
      }

      case "FheRandBounded": {
        // "event FheRandBounded(address indexed caller, uint256 upperBound, uint8 randType, bytes16 seed, bytes32 result)",
        const upperBoundUint256: bigint = event.args[1 as keyof typeof event.args];
        const randTypeUint8: bigint = event.args[2 as keyof typeof event.args];
        const seedBytes16: string = event.args[3 as keyof typeof event.args];
        const resultBytes32: string = event.args[4 as keyof typeof event.args];

        assertEventArgIsBigUint256(upperBoundUint256, event.eventName, 1);
        assertEventArgIsBigUint8(randTypeUint8, event.eventName, 2);
        assertEventArgIsBytes16String(seedBytes16, event.eventName, 3);
        assertEventArgIsBytes32String(resultBytes32, event.eventName, 4);

        const resultFhevmHandle: FhevmHandle = FhevmHandle.fromBytes32Hex(resultBytes32);
        const resultType: FheType = resultFhevmHandle.fheType;

        assertFhevm(
          BigInt(resultType) === randTypeUint8,
          `Rand type mismatch, (resultType:${resultType}) !== (randTypeUint8:${randTypeUint8})`,
        );

        const clearText: bigint = getRandomBigInt(Number(log2BigInt(upperBoundUint256)));

        return {
          resultBytes32,
          clearText,
          replace: true,
        };
      }
    }

    throw new FhevmError(`Unknown fhevm coprocessor event: ${event.eventName}`);
  }

  private async verifyCipherText(eventArgs: object) {
    /*
      event VerifyCiphertext(
          address indexed caller,
          bytes32 inputHandle,
          address userAddress,
          bytes inputProof,
          FheType inputType,
          bytes32 result
      );
    */

    const inputHandleBytes32: string = eventArgs[1 as keyof typeof eventArgs];
    const userAddress: string = eventArgs[2 as keyof typeof eventArgs];
    const inputProofBytes: string = eventArgs[3 as keyof typeof eventArgs];
    const fheType: bigint = eventArgs[4 as keyof typeof eventArgs];
    const resultBytes32: string = eventArgs[5 as keyof typeof eventArgs];

    assertEventArgIsBytes32String(inputHandleBytes32, "VerifyCipherText", 1);
    assertEventArgIsAddress(userAddress, "VerifyCipherText", 2);
    assertEventArgIsBytesString(inputProofBytes, "VerifyCipherText", 3);
    assertEventArgIsBigUint256(fheType, "VerifyCipherText", 4);
    assertEventArgIsBytes32String(resultBytes32, "VerifyCipherText", 5);

    // At this point 'inputHandle' equals 'result'
    // See FHEVMExectuorNoEvents.sol + InputVerifier.sol
    assertFhevm(
      inputHandleBytes32 === resultBytes32,
      `VerifyCipherText: inputHandleBytes32=${inputHandleBytes32} differs from resultBytes32=${resultBytes32}`,
    );

    try {
      await this.#db.queryHandleBytes32(inputHandleBytes32);
    } catch {
      throw new FhevmError(`User input was not found in DB inputHandle=${inputHandleBytes32}`);
    }
  }

  private async parseUnaryOpEvent(event: CoprocessorEvent) {
    const ctBytes32: string = event.args[1 as keyof typeof event.args];
    const resultBytes32: string = event.args[2 as keyof typeof event.args];

    assertEventArgIsBytes32String(ctBytes32, event.eventName, 1);
    assertEventArgIsBytes32String(resultBytes32, event.eventName, 2);

    const resultFhevmHandle: FhevmHandle = FhevmHandle.fromBytes32Hex(resultBytes32);

    const clearTextBigInt: bigint = BigInt((await this.#db.queryHandleBytes32(ctBytes32)).clearTextHex);

    return {
      resultBytes32,
      clearTextBigInt,
      clearTextBitLength: BigInt(resultFhevmHandle.fhevmTypeInfo.clearTextBitLength),
    };
  }

  private async parseBinaryOpEvent(event: CoprocessorEvent) {
    const lhsBytes32: string = event.args[1 as keyof typeof event.args];
    const rhsBytes32: string = event.args[2 as keyof typeof event.args];
    const scalarBytes1: string = event.args[3 as keyof typeof event.args];
    const resultBytes32: string = event.args[4 as keyof typeof event.args];

    assertEventArgIsBytes32String(lhsBytes32, event.eventName, 1);
    assertEventArgIsBytes32String(rhsBytes32, event.eventName, 2);
    assertEventArgIsBytes1String(scalarBytes1, event.eventName, 3);
    assertEventArgIsBytes32String(resultBytes32, event.eventName, 4);

    const resultFhevmHandle: FhevmHandle = FhevmHandle.fromBytes32Hex(resultBytes32);

    const scalar: boolean = scalarBytes1 === "0x01";
    const clearTextLhsBigInt: bigint = BigInt((await this.#db.queryHandleBytes32(lhsBytes32)).clearTextHex);
    const clearTextRhsBigInt: bigint = scalar
      ? BigInt(rhsBytes32)
      : BigInt((await this.#db.queryHandleBytes32(rhsBytes32)).clearTextHex);

    return {
      resultBytes32,
      clearTextLhsBigInt,
      clearTextRhsBigInt,
      scalar,
      clearTextBitLength: BigInt(resultFhevmHandle.fhevmTypeInfo.clearTextBitLength),
    };
  }

  private async parseBinaryBytesOpEvent(event: CoprocessorEvent) {
    const lhsBytes32: string = event.args[1 as keyof typeof event.args];
    const rhsBytes: string = event.args[2 as keyof typeof event.args];
    const scalarBytes1: string = event.args[3 as keyof typeof event.args];
    const resultBytes32: string = event.args[4 as keyof typeof event.args];

    assertEventArgIsBytes32String(lhsBytes32, event.eventName, 1);
    assertEventArgIsBytesString(rhsBytes, event.eventName, 2);
    assertEventArgIsBytes1String(scalarBytes1, event.eventName, 3);
    assertEventArgIsBytes32String(resultBytes32, event.eventName, 4);

    const resultFhevmHandle: FhevmHandle = FhevmHandle.fromBytes32Hex(resultBytes32);

    const scalar: boolean = scalarBytes1 === "0x01";
    const clearTextLhsBigInt: bigint = BigInt((await this.#db.queryHandleBytes32(lhsBytes32)).clearTextHex);
    const clearTextRhsBigInt: bigint = scalar
      ? BigInt(rhsBytes)
      : BigInt((await this.#db.queryHandleBytes32(rhsBytes)).clearTextHex);

    return {
      resultBytes32,
      clearTextLhsBigInt,
      clearTextRhsBigInt,
      scalar,
      clearTextBitLength: BigInt(resultFhevmHandle.fhevmTypeInfo.clearTextBitLength),
    };
  }
}
