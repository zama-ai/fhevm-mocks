import assert from "assert";

import { HardhatFhevmError } from "../error";
import { FhevmEnvironment } from "./FhevmEnvironment";
import { getLastBlockSnapshot, setLastBlockSnapshot } from "./FhevmProviderExtender";
import { FheType } from "./handle/FheType";
import { FhevmHandle, getFhevmHandleClearTextBitLength, parseFhevmHandle } from "./handle/handle";
import {
  assertEventArgAddress,
  assertEventArgBytes,
  assertEventArgBytes1,
  assertEventArgBytes16,
  assertEventArgBytes32,
  assertEventArgUint8,
  assertEventArgUint256,
} from "./utils/ethers";
import { isSolidityCoverageRunning } from "./utils/hh";
import { bitwiseNotUIntBits, log2BigInt } from "./utils/math";
import { getRandomBigInt } from "./utils/random";

interface FhevmEvent {
  eventName:
    | "VerifyCiphertext"
    | "TrivialEncrypt"
    | "TrivialEncryptBytes"
    | "FheAdd"
    | "FheSub"
    | "FheMul"
    | "FheDiv"
    | "FheRem"
    | "FheBitAnd"
    | "FheBitOr"
    | "FheBitXor"
    | "FheShl"
    | "FheShr"
    | "FheRotl"
    | "FheRotr"
    | "FheEq"
    | "FheEqBytes"
    | "FheNe"
    | "FheNeBytes"
    | "FheGe"
    | "FheGt"
    | "FheLe"
    | "FheLt"
    | "FheMin"
    | "FheMax"
    | "FheRand"
    | "FheRandBounded"
    | "FheNot"
    | "FheNeg"
    | "Cast"
    | "FheIfThenElse";
  args: object;
}

// see FHEVMExecutor.sol
/*
const FHEVMExectuorEventsABI = [
  "event FheAdd(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
  "event FheSub(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
  "event FheMul(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
  "event FheDiv(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
  "event FheRem(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
  "event FheBitAnd(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
  "event FheBitOr(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
  "event FheBitXor(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
  "event FheShl(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
  "event FheShr(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
  "event FheRotl(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
  "event FheRotr(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
  "event FheEq(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
  "event FheEqBytes(address indexed caller, bytes32 lhs, bytes rhs, bytes1 scalarByte, bytes32 result)",
  "event FheNe(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
  "event FheNeBytes(address indexed caller, bytes32 lhs, bytes rhs, bytes1 scalarByte, bytes32 result)",
  "event FheGe(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
  "event FheGt(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
  "event FheLe(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
  "event FheLt(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
  "event FheMin(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
  "event FheMax(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result)",
  "event FheNeg(address indexed caller, bytes32 ct, bytes32 result)",
  "event FheNot(address indexed caller, bytes32 ct, bytes32 result)",
  "event VerifyCiphertext(address indexed caller, bytes32 inputHandle, address userAddress, bytes inputProof, uint8 inputType, bytes32 result)",
  "event Cast(address indexed caller, bytes32 ct, uint8 toType, bytes32 result)",
  "event TrivialEncrypt(address indexed caller, uint256 pt, uint8 toType, bytes32 result)",
  "event TrivialEncryptBytes(address indexed caller, bytes pt, uint8 toType, bytes32 result)",
  "event FheIfThenElse(address indexed caller, bytes32 control, bytes32 ifTrue, bytes32 ifFalse, bytes32 result)",
  "event FheRand(address indexed caller, uint8 randType, bytes16 seed, bytes32 result)",
  "event FheRandBounded(address indexed caller, uint256 upperBound, uint8 randType, bytes16 seed, bytes32 result)",
];
*/

export class MockFhevmCoprocessor {
  #fhevmEnv: FhevmEnvironment;
  #firstBlockListening: number = 0;
  #lastBlockSnapshot: number = 0;
  #lastCounterRand: number = 0;
  #counterRand: number = 0;

  /**
   * Constructor must be ultra-lightweight!
   */
  constructor(fhevmEnv: FhevmEnvironment) {
    this.#fhevmEnv = fhevmEnv;
  }

  public get counterRand(): number {
    return this.#counterRand;
  }

  private async parseUnaryOpEvent(event: FhevmEvent) {
    const ctBytes32: string = event.args[1 as keyof typeof event.args];
    const resultBytes32: string = event.args[2 as keyof typeof event.args];

    assertEventArgBytes32(ctBytes32, event.eventName, 1);
    assertEventArgBytes32(resultBytes32, event.eventName, 2);

    const resultFhevmHandle: FhevmHandle = parseFhevmHandle(resultBytes32);

    const clearTextBigInt: bigint = await this.#fhevmEnv.db.sqlQueryHandleBytes32AsBigInt(ctBytes32);

    return {
      resultBytes32,
      clearTextBigInt,
      clearTextBitLength: BigInt(getFhevmHandleClearTextBitLength(resultFhevmHandle)),
    };
  }

  private async parseBinaryOpEvent(event: FhevmEvent) {
    const lhsBytes32: string = event.args[1 as keyof typeof event.args];
    const rhsBytes32: string = event.args[2 as keyof typeof event.args];
    const scalarBytes1: string = event.args[3 as keyof typeof event.args];
    const resultBytes32: string = event.args[4 as keyof typeof event.args];

    assertEventArgBytes32(lhsBytes32, event.eventName, 1);
    assertEventArgBytes32(rhsBytes32, event.eventName, 2);
    assertEventArgBytes1(scalarBytes1, event.eventName, 3);
    assertEventArgBytes32(resultBytes32, event.eventName, 4);

    const resultFhevmHandle: FhevmHandle = parseFhevmHandle(resultBytes32);

    const scalar: boolean = scalarBytes1 === "0x01";
    const clearTextLhsBigInt: bigint = await this.#fhevmEnv.db.sqlQueryHandleBytes32AsBigInt(lhsBytes32);
    const clearTextRhsBigInt: bigint = scalar
      ? BigInt(rhsBytes32)
      : await this.#fhevmEnv.db.sqlQueryHandleBytes32AsBigInt(rhsBytes32);

    return {
      resultBytes32,
      clearTextLhsBigInt,
      clearTextRhsBigInt,
      scalar,
      clearTextBitLength: BigInt(getFhevmHandleClearTextBitLength(resultFhevmHandle)),
    };
  }

  private async parseBinaryBytesOpEvent(event: FhevmEvent) {
    const lhsBytes32: string = event.args[1 as keyof typeof event.args];
    const rhsBytes: string = event.args[2 as keyof typeof event.args];
    const scalarBytes1: string = event.args[3 as keyof typeof event.args];
    const resultBytes32: string = event.args[4 as keyof typeof event.args];

    assertEventArgBytes32(lhsBytes32, event.eventName, 1);
    assertEventArgBytes(rhsBytes, event.eventName, 2);
    assertEventArgBytes1(scalarBytes1, event.eventName, 3);
    assertEventArgBytes32(resultBytes32, event.eventName, 4);

    const resultFhevmHandle: FhevmHandle = parseFhevmHandle(resultBytes32);

    const scalar: boolean = scalarBytes1 === "0x01";
    const clearTextLhsBigInt: bigint = await this.#fhevmEnv.db.sqlQueryHandleBytes32AsBigInt(lhsBytes32);
    const clearTextRhsBigInt: bigint = scalar
      ? BigInt(rhsBytes)
      : await this.#fhevmEnv.db.sqlQueryHandleBytes32AsBigInt(rhsBytes);

    return {
      resultBytes32,
      clearTextLhsBigInt,
      clearTextRhsBigInt,
      scalar,
      clearTextBitLength: BigInt(getFhevmHandleClearTextBitLength(resultFhevmHandle)),
    };
  }

  public async awaitCoprocessor() {
    await this.processAllPastFHEVMExecutorEvents();
  }

  private async processAllPastFHEVMExecutorEvents() {
    //const networkProvider = this.#fhevmEnv.hre.network.provider;
    const provider = this.#fhevmEnv.hre.ethers.provider;
    const latestBlockNumber = await provider.getBlockNumber();
    const solidityCoverageRunning = isSolidityCoverageRunning(this.#fhevmEnv.hre);

    if (!solidityCoverageRunning) {
      // evm_snapshot is not supported in coverage mode
      //[this.#lastBlockSnapshot, this.#lastCounterRand] = await provider.send!("get_lastBlockSnapshot");
      //[this.#lastBlockSnapshot, this.#lastCounterRand] = await networkProvider.send("get_lastBlockSnapshot");
      const res = await getLastBlockSnapshot(this.#fhevmEnv.hre);
      this.#lastBlockSnapshot = res.lastBlockSnapshot;
      this.#lastCounterRand = res.lastCounterRand;

      assert(typeof this.#lastBlockSnapshot === "number");
      assert(typeof this.#lastCounterRand === "number");

      if (this.#lastBlockSnapshot < this.#firstBlockListening) {
        this.#firstBlockListening = this.#lastBlockSnapshot + 1;
        this.#counterRand = Number(this.#lastCounterRand);
      }
    }

    const coprocessorAddress = this.#fhevmEnv.getFHEVMExecutorAddress();
    const coprocessorContract = this.#fhevmEnv.getFHEVMExecutorReadOnly();

    // Fetch all events emitted by the contract
    const filter = {
      address: coprocessorAddress,
      fromBlock: this.#firstBlockListening,
      toBlock: latestBlockNumber,
    };

    const logs = await provider.getLogs(filter);

    const events = logs
      .map((log) => {
        try {
          const parsedLog = coprocessorContract.interface.parseLog(log)!;
          return {
            eventName: parsedLog.name,
            args: parsedLog.args,
          };
        } catch {
          // If the log cannot be parsed, skip it
          return null;
        }
      })
      .filter((event) => event !== null);

    this.#firstBlockListening = latestBlockNumber + 1;

    if (!solidityCoverageRunning) {
      // evm_snapshot is not supported in coverage mode
      //await provider.send!("set_lastBlockSnapshot", [this.#firstBlockListening]);
      //await networkProvider.send("set_lastBlockSnapshot", [this.#firstBlockListening]);
      await setLastBlockSnapshot(this.#fhevmEnv.hre, this.#firstBlockListening);
    }

    for (let i = 0; i < events.length; ++i) {
      const fhevmEvent = events[i] as FhevmEvent;
      if (fhevmEvent.eventName === "VerifyCiphertext") {
        await this.verifyCipherText(fhevmEvent.args);
      } else {
        const res = await this.executeCoprocessorEvent(fhevmEvent);
        if (res) {
          await this.#fhevmEnv.db.sqlInsertHandleBytes32(res.resultBytes32, res.clearText, res.replace);

          if (fhevmEvent.eventName === "FheRandBounded" || fhevmEvent.eventName === "FheRand") {
            this.#counterRand++;
          }
        }
      }
    }
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

    assertEventArgBytes32(inputHandleBytes32, "VerifyCipherText", 1);
    assertEventArgAddress(userAddress, "VerifyCipherText", 2);
    assertEventArgBytes(inputProofBytes, "VerifyCipherText", 3);
    assertEventArgUint256(fheType, "VerifyCipherText", 4);
    assertEventArgBytes32(resultBytes32, "VerifyCipherText", 5);

    // At this point 'inputHandle' equals 'result'
    // See FHEVMExectuorNoEvents.sol + InputVerifier.sol
    assert(
      inputHandleBytes32 === resultBytes32,
      `VerifyCipherText: inputHandleBytes32=${inputHandleBytes32} differs from resultBytes32=${resultBytes32}`,
    );

    try {
      await this.#fhevmEnv.db.sqlQueryHandleBytes32(inputHandleBytes32);
    } catch {
      throw new HardhatFhevmError("User input was not found in DB");
    }
  }

  private async executeCoprocessorEvent(event: FhevmEvent): Promise<
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

        assertEventArgUint256(ptUint256, "TrivialEncrypt", 1);
        assertEventArgUint256(fheType, "TrivialEncrypt", 2);
        assertEventArgBytes32(resultBytes32, "TrivialEncrypt", 3);

        return {
          resultBytes32,
          clearText: ptUint256,
        };
      }

      case "TrivialEncryptBytes": {
        // event TrivialEncryptBytes(address indexed caller, bytes pt, FheType toType, bytes32 result);
        const ptBytes: string = event.args[1 as keyof typeof event.args];
        const resultBytes32: string = event.args[3 as keyof typeof event.args];

        assertEventArgBytes(ptBytes, "TrivialEncryptBytes", 1);
        assertEventArgBytes32(resultBytes32, "TrivialEncrypt", 3);

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

        assertEventArgBytes32(ctBytes32, event.eventName, 1);
        assertEventArgUint8(toTypeUint8, event.eventName, 2);
        assertEventArgBytes32(resultBytes32, event.eventName, 3);

        const resultFhevmHandle: FhevmHandle = parseFhevmHandle(resultBytes32);
        const resultType: FheType = resultFhevmHandle.fheType;
        const clearTextBitLength = BigInt(getFhevmHandleClearTextBitLength(resultFhevmHandle));

        assert(
          BigInt(resultType) === toTypeUint8,
          `Cast type mismatch, (resultType:${resultType}) !== (toTypeUint8:${toTypeUint8})`,
        );

        const ct: bigint = await this.#fhevmEnv.db.sqlQueryHandleBytes32AsBigInt(ctBytes32);

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

        assertEventArgBytes32(controlBytes32, event.eventName, 1);
        assertEventArgBytes32(ifTrueBytes32, event.eventName, 2);
        assertEventArgBytes32(ifFalseBytes32, event.eventName, 3);
        assertEventArgBytes32(resultBytes32, event.eventName, 4);

        const control: bigint = await this.#fhevmEnv.db.sqlQueryHandleBytes32AsBigInt(controlBytes32);
        const ifTrue: bigint = await this.#fhevmEnv.db.sqlQueryHandleBytes32AsBigInt(ifTrueBytes32);
        const ifFalse: bigint = await this.#fhevmEnv.db.sqlQueryHandleBytes32AsBigInt(ifFalseBytes32);

        assert(
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

        assertEventArgUint8(randTypeUint8, event.eventName, 1);
        assertEventArgBytes16(seedBytes16, event.eventName, 2);
        assertEventArgBytes32(resultBytes32, event.eventName, 3);

        const resultFhevmHandle: FhevmHandle = parseFhevmHandle(resultBytes32);
        const resultType: FheType = resultFhevmHandle.fheType;
        const clearTextBitLength = getFhevmHandleClearTextBitLength(resultFhevmHandle);

        assert(
          BigInt(resultType) === randTypeUint8,
          `Rand type mismatch, (resultType:${resultType}) !== (randTypeUint8:${randTypeUint8})`,
        );

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

        assertEventArgUint256(upperBoundUint256, event.eventName, 1);
        assertEventArgUint8(randTypeUint8, event.eventName, 2);
        assertEventArgBytes16(seedBytes16, event.eventName, 3);
        assertEventArgBytes32(resultBytes32, event.eventName, 4);

        const resultFhevmHandle: FhevmHandle = parseFhevmHandle(resultBytes32);
        const resultType: FheType = resultFhevmHandle.fheType;

        assert(
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

    throw new HardhatFhevmError(`Unknown fhevm coprocessor event: ${event.eventName}`);
  }
}
