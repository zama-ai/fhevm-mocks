// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

/**
 * @notice Recent block numbers for the fork suites, asked of the chain instead of written down.
 *
 * @dev WHY NOT A CONSTANT. An ordinary node keeps state only for its most recent blocks and answers
 *      `state at block #N is pruned` for anything older — `ethereum-sepolia-rpc.publicnode.com`, the
 *      default this repo configures, keeps a few thousand (a day or so). A hardcoded block therefore
 *      passes for as long as it takes the chain to move past that window and then fails for everyone,
 *      whichever block was picked; the only pin that survives is an archive endpoint, which is not
 *      something a suite can assume. None of these suites care WHICH block they fork — only that it is
 *      recent enough to be served, final enough not to move, and, for the two-fork suites, that there
 *      are two distinct ones — so they ask for the head and count back from it.
 *
 * @dev STRIDE AND LAG. Rounding down to a multiple of `STRIDE` holds the answer still for ~3 hours at a
 *      time, so repeated `forge test` runs hit forge's on-disk fork cache rather than refetching state
 *      from a public endpoint on every run. `LAG` keeps the newer block at least that far behind the
 *      head, well past any reorg.
 */
library ForkBlocks {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant STRIDE = 1024;
    uint256 private constant LAG = 128;

    /// One recent block, for a suite that forks a single time.
    function recent(string memory rpcUrl) internal returns (uint256) {
        // dividing before multiplying IS the rounding: it snaps the head down to a STRIDE boundary.
        // forge-lint: disable-next-line(divide-before-multiply)
        return ((head(rpcUrl) - LAG) / STRIDE) * STRIDE;
    }

    /// Two distinct recent blocks, `newer` and the one a `STRIDE` before it.
    function recentPair(string memory rpcUrl) internal returns (uint256 newer, uint256 older) {
        newer = recent(rpcUrl);
        older = newer - STRIDE;
    }

    /// `eth_blockNumber`, without creating a fork to read `block.number` from: `vm.rpc` hands back the
    /// quantity as its big-endian bytes, minimally encoded.
    function head(string memory rpcUrl) private returns (uint256 value) {
        bytes memory raw = VM.rpc(rpcUrl, "eth_blockNumber", "[]");
        for (uint256 i = 0; i < raw.length; i++) {
            value = (value << 8) | uint8(raw[i]);
        }
    }
}
