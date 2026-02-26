import { ethers as EthersT } from "ethers";
import { describe, expect, it, vi } from "vitest";

import { CoprocessorEventsIterator } from "./CoprocessorEventsIterator.js";

function createMockProvider(blockNumber: number): EthersT.Provider {
  return {
    getBlockNumber: vi.fn().mockResolvedValue(blockNumber),
    getLogs: vi.fn().mockResolvedValue([]),
  } as unknown as EthersT.Provider;
}

// Minimal interface — we don't need real event parsing for these tests
const mockInterface = new EthersT.Interface([]);
const mockAddress: `0x${string}` = "0x0000000000000000000000000000000000000001";

describe("CoprocessorEventsIterator.revertToBlock", () => {
  it("after revertToBlock(N), next() fetches from block N+1", async () => {
    const provider = createMockProvider(20);
    const iterator = new CoprocessorEventsIterator(mockInterface, mockAddress, provider, 0);

    // Process initial events up to block 10
    (provider.getBlockNumber as ReturnType<typeof vi.fn>).mockResolvedValue(10);
    await iterator.next();

    // Revert to block 5 — next fetch should start at block 6
    iterator.revertToBlock(5);

    (provider.getBlockNumber as ReturnType<typeof vi.fn>).mockResolvedValue(15);
    await iterator.next();

    // The second next() call should have requested logs starting from block 6
    const getLogsCalls = (provider.getLogs as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = getLogsCalls[getLogsCalls.length - 1][0];
    expect(lastCall.fromBlock).toBe(6);
    expect(lastCall.toBlock).toBe(15);
  });

  it("revert to a lower block number after processing events", async () => {
    const provider = createMockProvider(10);
    const iterator = new CoprocessorEventsIterator(mockInterface, mockAddress, provider, 0);

    // First call processes blocks 0..10
    await iterator.next();

    // Revert to block 3
    iterator.revertToBlock(3);

    (provider.getBlockNumber as ReturnType<typeof vi.fn>).mockResolvedValue(8);
    await iterator.next();

    const getLogsCalls = (provider.getLogs as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = getLogsCalls[getLogsCalls.length - 1][0];
    expect(lastCall.fromBlock).toBe(4);
    expect(lastCall.toBlock).toBe(8);
  });

  it("revert to block 0", async () => {
    const provider = createMockProvider(5);
    const iterator = new CoprocessorEventsIterator(mockInterface, mockAddress, provider, 0);

    await iterator.next();

    // Revert all the way back to block 0
    iterator.revertToBlock(0);

    (provider.getBlockNumber as ReturnType<typeof vi.fn>).mockResolvedValue(3);
    await iterator.next();

    const getLogsCalls = (provider.getLogs as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = getLogsCalls[getLogsCalls.length - 1][0];
    expect(lastCall.fromBlock).toBe(1);
    expect(lastCall.toBlock).toBe(3);
  });

  it("next() returns empty when block has not advanced after revert", async () => {
    const provider = createMockProvider(5);
    const iterator = new CoprocessorEventsIterator(mockInterface, mockAddress, provider, 0);

    await iterator.next();

    // Revert to block 5 — same as provider's current block
    iterator.revertToBlock(5);

    // Provider still at block 5, cursor blockNumber is also 5
    const events = await iterator.next();
    expect(events).toEqual([]);
  });
});
