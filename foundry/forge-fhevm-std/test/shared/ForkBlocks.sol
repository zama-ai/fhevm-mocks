// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

import {fhevm} from "../../pkg/src/FhevmVm.sol";

/**
 * @notice What a test needs before it may fork a REAL network: whether this run wants to reach one at
 *         all, and — if it does — which blocks to pin, asked of the chain instead of written down.
 *
 * @dev Shared by `test/fork`, `test/internal` and `test/forkurl`, which is why it lives here rather than
 *      beside one of them. `test/anvil` deliberately does NOT use it: a local node is not a network.
 *
 * @dev WHY NOT A CONSTANT BLOCK. An ordinary node keeps state only for its most recent blocks and answers
 *      `state at block #N is pruned` for anything older — `ethereum-sepolia-rpc.publicnode.com`, the
 *      default this repo configures, keeps a few thousand (a day or so). A hardcoded block therefore
 *      passes for as long as it takes the chain to move past that window and then fails for everyone,
 *      whichever block was picked. Worse, it fails ASYMMETRICALLY: forge caches fork state per block
 *      under ~/.foundry/cache, so a machine that ran the suite while the block was live keeps passing
 *      from cache long after CI, which starts cold, has begun failing. None of these suites care WHICH
 *      block they fork — only that it is recent enough to be served, final enough not to move, and, for
 *      the two-fork suites, that there are two distinct ones — so they ask for the head and count back.
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

    /// @dev Set truthy to turn every REMOTE-rpc test in the suite into a skip.
    string private constant SKIP_VAR = "FHEVM_SKIP_RPC_TESTS";

    /**
     * @notice Whether this run may reach `chainAlias` over the network.
     *
     * @dev TWO conditions, and the second is why this exists. A URL must be configured — but this repo
     *      COMMITS one for `sepolia` in `foundry.toml`, so `fhevm.hasRpcUrlFor` alone is always true here
     *      and the opt-in rules.md 7.3 describes can never skip. Every network test in the default
     *      `forge test` lane therefore calls out to a public endpoint on every run, which is slow, rate
     *      limited, and fails for reasons that have nothing to do with the change under test.
     *      `FHEVM_SKIP_RPC_TESTS=true` is the way out: CI sets it on the offline lane and runs the
     *      network suites deliberately instead (`make test-forge-std-fork`).
     */
    function enabled(string memory chainAlias) internal view returns (bool) {
        if (VM.envOr(SKIP_VAR, false)) return false;
        return fhevm.hasRpcUrlFor(chainAlias);
    }

    /// @notice One recent block, for a suite that forks a single time.
    function recent(string memory rpcUrl) internal returns (uint256) {
        // dividing before multiplying IS the rounding: it snaps the head down to a STRIDE boundary.
        // forge-lint: disable-next-line(divide-before-multiply)
        return ((head(rpcUrl) - LAG) / STRIDE) * STRIDE;
    }

    /// @notice Two distinct recent blocks, `newer` and the one a `STRIDE` before it.
    function recentPair(string memory rpcUrl) internal returns (uint256 newer, uint256 older) {
        newer = recent(rpcUrl);
        older = newer - STRIDE;
    }

    /// @notice `eth_blockNumber`, without creating a fork to read `block.number` from: `vm.rpc` hands back
    ///         the quantity as its big-endian bytes, minimally encoded.
    function head(string memory rpcUrl) private returns (uint256 value) {
        bytes memory raw = VM.rpc(rpcUrl, "eth_blockNumber", "[]");
        for (uint256 i = 0; i < raw.length; i++) {
            value = (value << 8) | uint8(raw[i]);
        }
    }
}
