import { assertIsAddress } from "../utils/address.js";
import { assertIsBytesString } from "../utils/bytes.js";
import { FhevmError, assertFhevm } from "../utils/error.js";
import { assertIsBigUint8, assertIsBigUint256 } from "../utils/math.js";

export function assertEventArgIsBigUint8(value: unknown, eventName: string, argIndex: number): asserts value is bigint {
  assertIsBigUint8(value, `${eventName} event arg #${argIndex}`);
}

export function assertEventArgIsBigUint256(
  value: unknown,
  eventName: string,
  argIndex: number,
): asserts value is bigint {
  assertIsBigUint256(value, `${eventName} event arg #${argIndex}`);
}

export function assertEventArgIsBytes1String(
  value: unknown,
  eventName: string,
  argIndex: number,
): asserts value is string {
  _assertEventArgIsBytesString(value, eventName, argIndex, 1);
}

export function assertEventArgIsBytes4String(
  value: unknown,
  eventName: string,
  argIndex: number,
): asserts value is string {
  _assertEventArgIsBytesString(value, eventName, argIndex, 4);
}

export function assertEventArgIsBytes8String(
  value: unknown,
  eventName: string,
  argIndex: number,
): asserts value is string {
  _assertEventArgIsBytesString(value, eventName, argIndex, 8);
}

export function assertEventArgIsBytes16String(
  value: unknown,
  eventName: string,
  argIndex: number,
): asserts value is string {
  _assertEventArgIsBytesString(value, eventName, argIndex, 16);
}

export function assertEventArgIsBytes32String(
  value: unknown,
  eventName: string,
  argIndex: number,
): asserts value is string {
  _assertEventArgIsBytesString(value, eventName, argIndex, 32);
}

export function assertEventArgIsBytesString(
  value: unknown,
  eventName: string,
  argIndex: number,
): asserts value is string {
  _assertEventArgIsBytesString(value, eventName, argIndex);
}

function _assertEventArgIsBytesString(
  value: unknown,
  eventName: string,
  argIndex: number,
  width?: number,
): asserts value is string {
  assertIsBytesString(value, width, `${eventName} event arg #${argIndex}`);
}

export function assertEventArgIsAddress(value: unknown, eventName: string, argIndex: number): asserts value is string {
  assertIsAddress(value, `${eventName} event arg #${argIndex}`);
}

export class BlockLogCursor {
  #blockNumber: number = -1;
  #blockLogIndex: number = -1;

  constructor(fromBlockNumber: number) {
    // We want the next block number to be `fromBlockNumber`
    // This usually happens when running tests in Anvil. The node is running with
    // plenty of old handles. So we need to start parsing events at a specific block number.
    // All events prior to this block number should be ignored
    this.#blockNumber = fromBlockNumber <= 0 ? -1 : fromBlockNumber - 1;
  }

  static check(blockNumber: number, blockLogIndex: number) {
    if (blockNumber < 0 || blockLogIndex < 0) {
      throw new FhevmError(`Invalid event at blockNumber=${blockNumber}, logIndex=${blockLogIndex}.`);
    }
  }

  public get isEmpty(): boolean {
    const empty = this.#blockNumber < 0;
    if (empty) {
      assertFhevm(this.#blockLogIndex < 0);
    } else {
      assertFhevm(this.#blockLogIndex >= 0);
    }
    return empty;
  }

  public get nextBlockNumber(): number {
    if (this.#blockNumber < 0) {
      return 0;
    }
    return this.#blockNumber + 1;
  }

  public get blockNumber(): number {
    return this.#blockNumber;
  }

  public get blockLogIndex(): number {
    return this.#blockLogIndex;
  }

  /*
    Returns `true` if this > {blockNumber, blockLogIndex}
  */
  gt(blockNumber: number, blockLogIndex: number) {
    BlockLogCursor.check(blockNumber, blockLogIndex);
    if (this.#blockNumber === blockNumber) {
      return this.#blockLogIndex > blockLogIndex;
    }
    return this.#blockNumber > blockNumber;
  }

  /*
    Returns `true` if this == {blockNumber, blockLogIndex}
  */
  eq(blockNumber: number, blockLogIndex: number) {
    BlockLogCursor.check(blockNumber, blockLogIndex);
    return this.#blockNumber === blockNumber && this.#blockLogIndex === blockLogIndex;
  }

  /*
    Returns `true` if this >= {blockNumber, blockLogIndex}
  */
  ge(blockNumber: number, blockLogIndex: number) {
    return this.gt(blockNumber, blockLogIndex) || this.eq(blockNumber, blockLogIndex);
  }

  /*
    throws an error if this >= {blockNumber, blockLogIndex}
  */
  updateForward(blockNumber: number, blockLogIndex: number) {
    BlockLogCursor.check(blockNumber, blockLogIndex);
    if (this.ge(blockNumber, blockLogIndex)) {
      throw new FhevmError(
        `Parse event at blockNumber=${blockNumber}, logIndex=${blockLogIndex} in backward order. Current blockNumber=${this.#blockNumber}, logIndex=${this.#blockLogIndex}`,
      );
    }
    this.#blockNumber = blockNumber;
    this.#blockLogIndex = blockLogIndex;
  }

  /*
    throws an error if this == {blockNumber, blockLogIndex}
  */
  updateForwardOrBackward(blockNumber: number, blockLogIndex: number) {
    BlockLogCursor.check(blockNumber, blockLogIndex);
    if (this.eq(blockNumber, blockLogIndex)) {
      throw new FhevmError(
        `Expecting event at a different position (blockNumber=${blockNumber}, logIndex=${blockLogIndex}).`,
      );
    }
    this.#blockNumber = blockNumber;
    this.#blockLogIndex = blockLogIndex;
  }

  update(blockNumber: number, blockLogIndex: number) {
    BlockLogCursor.check(blockNumber, blockLogIndex);
    this.#blockNumber = blockNumber;
    this.#blockLogIndex = blockLogIndex;
  }
}
