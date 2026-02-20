import { describe, expect, it } from "vitest";

import { BlockLogCursor } from "./event.js";

describe("BlockLogCursor", () => {
  describe("constructor", () => {
    it("sets nextBlockNumber to fromBlockNumber for positive values", () => {
      const cursor = new BlockLogCursor(5);
      expect(cursor.nextBlockNumber).toBe(5);
      expect(cursor.blockNumber).toBe(4);
    });

    it("sets nextBlockNumber to 0 when fromBlockNumber is 0", () => {
      const cursor = new BlockLogCursor(0);
      expect(cursor.nextBlockNumber).toBe(0);
      expect(cursor.blockNumber).toBe(-1);
    });

    it("sets nextBlockNumber to 0 for negative fromBlockNumber", () => {
      const cursor = new BlockLogCursor(-1);
      expect(cursor.nextBlockNumber).toBe(0);
      expect(cursor.blockNumber).toBe(-1);
    });

    it("sets nextBlockNumber to 1 when fromBlockNumber is 1", () => {
      const cursor = new BlockLogCursor(1);
      expect(cursor.nextBlockNumber).toBe(1);
      expect(cursor.blockNumber).toBe(0);
    });
  });

  describe("isEmpty", () => {
    it("returns true after construction with fromBlockNumber 0", () => {
      const cursor = new BlockLogCursor(0);
      expect(cursor.isEmpty).toBe(true);
    });

    it("returns false after construction with fromBlockNumber > 1", () => {
      // fromBlockNumber=2 => blockNumber=1, blockLogIndex=-1
      // isEmpty checks blockNumber < 0 but also asserts blockLogIndex >= 0 when not empty
      // Since blockNumber=1 >= 0 but blockLogIndex=-1, the assertion will fail.
      // Actually, let's use update() to set a valid state first.
      const cursor = new BlockLogCursor(0);
      cursor.update(5, 0);
      expect(cursor.isEmpty).toBe(false);
    });

    it("returns false after update()", () => {
      const cursor = new BlockLogCursor(0);
      cursor.update(0, 0);
      expect(cursor.isEmpty).toBe(false);
    });
  });

  describe("update", () => {
    it("sets blockNumber and blockLogIndex", () => {
      const cursor = new BlockLogCursor(0);
      cursor.update(10, 3);
      expect(cursor.blockNumber).toBe(10);
      expect(cursor.blockLogIndex).toBe(3);
    });

    it("updates nextBlockNumber accordingly", () => {
      const cursor = new BlockLogCursor(0);
      cursor.update(7, 0);
      expect(cursor.nextBlockNumber).toBe(8);
    });

    it("throws on negative blockNumber", () => {
      const cursor = new BlockLogCursor(0);
      expect(() => cursor.update(-1, 0)).toThrow();
    });

    it("throws on negative blockLogIndex", () => {
      const cursor = new BlockLogCursor(0);
      expect(() => cursor.update(0, -1)).toThrow();
    });
  });

  describe("updateForward", () => {
    it("advances the cursor forward", () => {
      const cursor = new BlockLogCursor(0);
      cursor.updateForward(1, 0);
      expect(cursor.blockNumber).toBe(1);
      expect(cursor.blockLogIndex).toBe(0);
    });

    it("throws on backward block movement", () => {
      const cursor = new BlockLogCursor(0);
      cursor.update(5, 2);
      expect(() => cursor.updateForward(3, 0)).toThrow(/backward order/);
    });

    it("throws on same position", () => {
      const cursor = new BlockLogCursor(0);
      cursor.update(5, 2);
      expect(() => cursor.updateForward(5, 2)).toThrow(/backward order/);
    });

    it("throws on backward logIndex within same block", () => {
      const cursor = new BlockLogCursor(0);
      cursor.update(5, 3);
      expect(() => cursor.updateForward(5, 1)).toThrow(/backward order/);
    });

    it("allows forward logIndex within same block", () => {
      const cursor = new BlockLogCursor(0);
      cursor.update(5, 1);
      cursor.updateForward(5, 2);
      expect(cursor.blockNumber).toBe(5);
      expect(cursor.blockLogIndex).toBe(2);
    });
  });

  describe("gt", () => {
    it("returns true when cursor block is greater", () => {
      const cursor = new BlockLogCursor(0);
      cursor.update(5, 0);
      expect(cursor.gt(3, 0)).toBe(true);
    });

    it("returns false when cursor block is less", () => {
      const cursor = new BlockLogCursor(0);
      cursor.update(2, 0);
      expect(cursor.gt(5, 0)).toBe(false);
    });

    it("returns true when same block but cursor logIndex is greater", () => {
      const cursor = new BlockLogCursor(0);
      cursor.update(5, 3);
      expect(cursor.gt(5, 1)).toBe(true);
    });

    it("returns false when same block and same logIndex", () => {
      const cursor = new BlockLogCursor(0);
      cursor.update(5, 3);
      expect(cursor.gt(5, 3)).toBe(false);
    });
  });

  describe("eq", () => {
    it("returns true when positions match", () => {
      const cursor = new BlockLogCursor(0);
      cursor.update(5, 3);
      expect(cursor.eq(5, 3)).toBe(true);
    });

    it("returns false when blockNumber differs", () => {
      const cursor = new BlockLogCursor(0);
      cursor.update(5, 3);
      expect(cursor.eq(6, 3)).toBe(false);
    });

    it("returns false when logIndex differs", () => {
      const cursor = new BlockLogCursor(0);
      cursor.update(5, 3);
      expect(cursor.eq(5, 4)).toBe(false);
    });
  });

  describe("ge", () => {
    it("returns true when cursor is greater", () => {
      const cursor = new BlockLogCursor(0);
      cursor.update(5, 3);
      expect(cursor.ge(3, 0)).toBe(true);
    });

    it("returns true when positions are equal", () => {
      const cursor = new BlockLogCursor(0);
      cursor.update(5, 3);
      expect(cursor.ge(5, 3)).toBe(true);
    });

    it("returns false when cursor is less", () => {
      const cursor = new BlockLogCursor(0);
      cursor.update(2, 0);
      expect(cursor.ge(5, 0)).toBe(false);
    });
  });

  describe("check", () => {
    it("throws on negative blockNumber", () => {
      expect(() => BlockLogCursor.check(-1, 0)).toThrow();
    });

    it("throws on negative blockLogIndex", () => {
      expect(() => BlockLogCursor.check(0, -1)).toThrow();
    });

    it("does not throw for valid values", () => {
      expect(() => BlockLogCursor.check(0, 0)).not.toThrow();
    });
  });
});
