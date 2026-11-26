// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

/**
 * @notice The block a fork suite forks a live chain at.
 *
 * @dev `<CHAIN>_FORK_BLOCK`, as in `MAINNET_FORK_BLOCK`. The test engine sets it when the inventory pins
 *      the chain's fork to a block (`"block"` in ALL_TESTS.json), and only then. Unset: the latest block.
 *
 *      TWO RUNS OF ONE SUITE. Pinned, the run cannot fail because the live chain moved: it guards this
 *      code. At the latest block, it tells whether this code still matches the chain as it is now, and
 *      fails when the chain is upgraded past what the code knows.
 */
library ForkBlock {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    /// @notice Creates and selects a fork of `rpcUrl`, at the block `blockVariable` pins, else at the latest.
    function createSelectFork(string memory rpcUrl, string memory blockVariable) internal returns (uint256) {
        uint256 blockNumber = VM.envOr(blockVariable, uint256(0));
        return blockNumber == 0 ? VM.createSelectFork(rpcUrl) : VM.createSelectFork(rpcUrl, blockNumber);
    }
}
