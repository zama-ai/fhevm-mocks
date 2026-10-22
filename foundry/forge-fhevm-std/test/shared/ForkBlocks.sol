// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {console} from "forge-std/console.sol";
import {Vm} from "forge-std/Vm.sol";

import {fhevm} from "../../pkg/src/FhevmVm.sol";
import {FhevmGeneration, HostVersions, LibFhevmVersion} from "../../pkg/src/LibFhevmVersion.sol";
import {StdFhevmChains} from "../../pkg/src/StdFhevmChains.sol";

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

    // -- Is this chain on a line this package can fork? ------------------------------------------------

    /**
     * @notice Whether `chain`'s live stack is on a protocol line this forge-fhevm-std can fork -- this
     *         generation's (taken as is) or the previous one (upgraded in memory) -- and, when it is not, a
     *         loud banner saying so, for a suite to skip on.
     *
     * @dev WHY THIS EXISTS. A suite pinned to a real chain stops being runnable the day that chain is on
     *      another line: two generations behind, ahead of this one, or half-upgraded. Forking it anyway fails
     *      every test with the UNSUPPORTED PROTOCOL VERSION box, which reads like a regression in this
     *      package. This turns that state into a PARKED suite instead -- a skip with its reason -- and since
     *      it asks the chain rather than a flag, the suite runs again by itself once the chain moves to a
     *      line this package speaks.
     *
     * @dev NO FORK IS CREATED. The seven `getVersion()` readings come over `vm.rpc("eth_call", ...)`, so
     *      the caller's state -- the local stack `StdFhevm`'s constructor deployed -- is untouched. A contract
     *      that does not answer reads as "", which `classify` refuses, so an unreachable chain parks too.
     */
    function forkable(StdFhevmChains.FhevmChain memory chain) internal returns (bool) {
        address hcuLimit = _rpcAddress(chain.rpcUrl, chain.fhevmExecutor, "getHCULimitAddress()");
        HostVersions memory versions = HostVersions({
            acl: _rpcVersion(chain.rpcUrl, chain.acl),
            fhevmExecutor: _rpcVersion(chain.rpcUrl, chain.fhevmExecutor),
            kmsVerifier: _rpcVersion(chain.rpcUrl, chain.kmsVerifier),
            inputVerifier: _rpcVersion(chain.rpcUrl, chain.inputVerifier),
            hcuLimit: _rpcVersion(chain.rpcUrl, hcuLimit),
            protocolConfig: _rpcVersion(chain.rpcUrl, chain.protocolConfig),
            kmsGeneration: _rpcVersion(chain.rpcUrl, chain.kmsGeneration)
        });
        if (LibFhevmVersion.classify(versions) != FhevmGeneration.Unknown) return true;

        console.log("");
        console.log(
            "!!! FORK TEST PARKED: %s/%s is not on a line this forge-fhevm-std can fork",
            chain.fhevmGroup,
            chain.chainAlias
        );
        console.log("!!!   (this generation's line: used as is; the previous one: upgraded in memory)");
        console.log("!!!   %s | %s", versions.acl, versions.fhevmExecutor);
        console.log("!!!   %s | %s", versions.kmsVerifier, versions.inputVerifier);
        console.log("!!!   %s | %s", versions.hcuLimit, versions.protocolConfig);
        console.log("!!!   %s", versions.kmsGeneration);
        console.log("!!! it runs again by itself once the chain is on a supported line");
        console.log("");
        return false;
    }

    /// @dev `getVersion()` on `target` over `eth_call`, or "" when it does not answer.
    function _rpcVersion(string memory rpcUrl, address target) private returns (string memory) {
        if (target == address(0)) return "";
        try VM.rpc(rpcUrl, "eth_call", _callParams(target, abi.encodeWithSignature("getVersion()"))) returns (
            bytes memory ret
        ) {
            return ret.length >= 64 ? abi.decode(ret, (string)) : "";
        } catch {
            return "";
        }
    }

    /// @dev A zero-argument getter returning an address, over `eth_call`, or zero when it does not answer.
    function _rpcAddress(string memory rpcUrl, address target, string memory signature) private returns (address) {
        if (target == address(0)) return address(0);
        try VM.rpc(rpcUrl, "eth_call", _callParams(target, abi.encodeWithSignature(signature))) returns (
            bytes memory ret
        ) {
            return ret.length == 32 ? abi.decode(ret, (address)) : address(0);
        } catch {
            return address(0);
        }
    }

    /// @dev `[{"to":"0x…","data":"0x…"},"latest"]`, the JSON params of an `eth_call`.
    function _callParams(address target, bytes memory data) private pure returns (string memory) {
        return string.concat('[{"to":"', VM.toString(target), '","data":"', VM.toString(data), '"},"latest"]');
    }
}
