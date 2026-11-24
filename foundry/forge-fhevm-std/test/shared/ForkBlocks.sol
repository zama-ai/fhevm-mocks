// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

import {fhevm} from "../../pkg/src/FhevmVm.sol";
import {StdFhevmChains} from "../../pkg/src/StdFhevmChains.sol";

/**
 * @notice What a test needs before it may fork a REAL network: whether this run wants to reach one at
 *         all, and — if it does — which blocks to pin, asked of the chain instead of written down.
 *
 * @dev Shared by `test/fork`, `test/internal` and `test/forkurl`, which is why it lives here rather than
 *      beside one of them. `test/anvil` deliberately does NOT use it: a local node is not a network.
 *
 * @dev WHY NOT A CONSTANT BLOCK. An ordinary node keeps state only for its most recent blocks and refuses
 *      anything older — `ethereum-sepolia-rpc.publicnode.com`, the default this repo configures, answers
 *      `403 Archive requests require a personal token`. It serves about the last 128 blocks every time,
 *      and older ones only some of the time: measured in November 2026, no refusal in 64 requests at 20
 *      and 100 blocks behind the head, one in six at 167, and one in two at 2048. A hardcoded block therefore
 *      passes for as long as it takes the chain to move past that window and then fails for everyone,
 *      whichever block was picked. Worse, it fails ASYMMETRICALLY: forge caches fork state per block
 *      under ~/.foundry/cache, so a machine that ran the suite while the block was live keeps passing
 *      from cache long after CI, which starts cold, has begun failing. None of these suites care WHICH
 *      block they fork — only that it is recent enough to be served, final enough not to move, and, for
 *      the two-fork suites, that there are two distinct ones — so they ask for the head and count back.
 *
 * @dev STRIDE AND LAG. `LAG` keeps the newer block that far behind the head, past any reorg seen on these
 *      chains. Rounding down to a multiple of `STRIDE` holds the answer still for a few minutes, so runs
 *      that follow each other hit forge's on-disk fork cache rather than refetching state from a public
 *      endpoint. BOTH ARE SMALL ON PURPOSE: the newer block is `LAG` to `LAG + STRIDE` behind the head and
 *      the older one a `STRIDE` further, and all of it, with the minutes a suite takes, must stay inside
 *      the 128 blocks the endpoint serves. With 128 and 1024, the values this had, the newer block was
 *      128 to 1152 blocks old and the older one up to 2176: always outside that window, so every read
 *      that forge had not cached could be refused. The price is a cache that is cold more often.
 */
library ForkBlocks {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant STRIDE = 32;
    uint256 private constant LAG = 32;

    /// @dev Set truthy to turn every REMOTE-rpc test in the suite into a skip.
    string private constant SKIP_VAR = "FHEVM_SKIP_RPC_TESTS";

    /**
     * @dev `FHEVM_FORK_FIXTURE_FLOOR=<block>` — the block a FIXTURE these suites read was deployed at.
     *      Unset (the default) is the behaviour that has always been here: blocks come from the head and
     *      nothing else.
     *
     *      WHY IT IS NEEDED AT ALL. The blocks above are counted back from the head, and a fixture
     *      deployed RECENTLY does not exist at them -- the suites then fail with
     *      `Contract 0x… does not exist on active fork`, which reads like a bug in the SDK and is not one.
     *      `recentPair` makes it worse: its older member is a whole STRIDE further back, so a fresh
     *      fixture takes ~3 hours of chain time to come into range even once `recent()` has cleared it.
     *
     *      Setting this floors both members at the fixture instead of waiting. It is a CEILING ON THE
     *      WAIT, not a pin: once the head has moved far enough that the ordinary blocks clear the floor,
     *      they are used and this changes nothing.
     */
    string private constant FLOOR_VAR = "FHEVM_FORK_FIXTURE_FLOOR";

    /// @dev The grid the floored block snaps up to. Finer than STRIDE on purpose: the whole point is to
    ///      land just ABOVE the fixture, and a 1024-grid would often have no boundary between the fixture
    ///      and the head at all. The cache is then colder than usual, which is the price of not waiting.
    uint256 private constant FLOOR_GRID = 64;

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

    /**
     * @notice The chain, with the private endpoint of this run in place of the configured one.
     *
     * @dev `<ALIAS>_RPC_URL`, as in `SEPOLIA_RPC_URL`: the URL of an endpoint to use for `chainAlias`
     *      in place of the one `foundry.toml` configures. It is the one name every test of the
     *      workspace reads for the URL of a chain, and the name the SDK itself documents. One variable
     *      per chain, because the URL of a provider is the URL of one chain. Unset or empty, which is the
     *      default, the chain comes back as it is.
     *
     *      WHY IT IS HERE AND NOT IN THE CONFIGURATION. `foundry.toml` commits a public endpoint for
     *      each chain these suites fork, and in the SDK a declared alias wins over the environment: on
     *      its own, `SEPOLIA_RPC_URL` would change nothing in this package. A public endpoint serves only
     *      recent state and refuses the rest when it likes, so a run that must not fail for that reason,
     *      as in CI, needs an endpoint of its own, with archive state. Its URL holds a key: it cannot be
     *      committed, and comes from the environment. A suite that forks wraps the chain it gets from
     *      `getFhevmChain` with this, and uses the result everywhere.
     */
    function withPrivateRpc(StdFhevmChains.FhevmChain memory chain, string memory chainAlias)
        internal
        view
        returns (StdFhevmChains.FhevmChain memory)
    {
        string memory url = VM.envOr(string.concat(VM.toUppercase(chainAlias), "_RPC_URL"), string(""));
        if (bytes(url).length != 0) chain.rpcUrl = url;
        return chain;
    }

    /// @notice One recent block, for a suite that forks a single time.
    function recent(string memory rpcUrl) internal returns (uint256) {
        uint256 newest = head(rpcUrl) - LAG;
        // dividing before multiplying IS the rounding: it snaps the head down to a STRIDE boundary.
        // forge-lint: disable-next-line(divide-before-multiply)
        uint256 snapped = (newest / STRIDE) * STRIDE;

        uint256 floorBlock = _floor();
        if (snapped >= floorBlock) return snapped;

        uint256 raised = _snapUp(floorBlock);
        // A FLOOR ABOVE THE HEAD IS A BLOCK THAT DOES NOT EXIST. Raising to the fixture is only possible
        // while the fixture is behind us: set the floor to something deployed minutes ago and this would
        // otherwise hand back a future block, which forge reports as a missing block with nothing in the
        // message about the floor that caused it.
        require(
            raised <= newest,
            string.concat(
                "FHEVM_FORK_FIXTURE_FLOOR=",
                VM.toString(floorBlock),
                " is newer than the newest forkable block ",
                VM.toString(newest),
                " (the head, less a ",
                VM.toString(LAG),
                "-block reorg margin): wait for the chain"
            )
        );
        return raised;
    }

    /// @notice Two distinct recent blocks, `newer` and the one a `STRIDE` before it.
    function recentPair(string memory rpcUrl) internal returns (uint256 newer, uint256 older) {
        newer = recent(rpcUrl);
        older = newer - STRIDE;

        uint256 floorBlock = _floor();
        if (older >= floorBlock) return (newer, older);

        older = _snapUp(floorBlock);
        // Two forks, and they must be two. When the floor is so close to the head that nothing fits below
        // it, say so here -- the alternative is two forks at one block and a suite that proves nothing.
        require(
            older < newer,
            string.concat(
                "FHEVM_FORK_FIXTURE_FLOOR=",
                VM.toString(floorBlock),
                " leaves no room for a second fork below ",
                VM.toString(newer),
                ": wait for the chain, or lower the floor"
            )
        );
    }

    /// @dev The floor, or zero when unset.
    function _floor() private view returns (uint256) {
        return VM.envOr(FLOOR_VAR, uint256(0));
    }

    /// @dev The first FLOOR_GRID boundary at or above `blockNumber`: at or above the fixture, never below.
    function _snapUp(uint256 blockNumber) private pure returns (uint256) {
        // rounding UP, so the division has to come first -- same shape as `recent`, other direction.
        // forge-lint: disable-next-line(divide-before-multiply)
        return ((blockNumber + FLOOR_GRID - 1) / FLOOR_GRID) * FLOOR_GRID;
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
