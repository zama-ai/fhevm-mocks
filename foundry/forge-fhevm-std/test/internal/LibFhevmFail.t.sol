// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {LibFhevmFail} from "../../pkg/src/LibFhevmFail.sol";
import {NO_FORK} from "../../pkg/src/FhevmVm.sol";

/// Every setup-error message, rendered once so a human can read them (`forge test --match-contract
/// LibFhevmFail -vv`), and the shape a user relies on: a title bar, the facts, then a `FIX` line.
contract LibFhevmFailTest is Test {
    function test_everyMessageHasATitleAndAFix() public pure {
        string[] memory groups = new string[](2);
        groups[0] = "testnet";
        groups[1] = "devnet";

        _check(LibFhevmFail.forkDrift(0, NO_FORK), "FORK DRIFT", "fhevm.createSelectFork(");
        _check(LibFhevmFail.ambiguousGroup(11155111, groups), "AMBIGUOUS FHEVM GROUP", "getFhevmChain(\"testnet\"");
        _check(LibFhevmFail.unknownChain(424242), "UNKNOWN FHEVM CHAIN", "setFhevmChain(");
        _check(
            LibFhevmFail.versionMismatch("devnet", "sepolia", "ACL", "ACL v0.4.0", "ACL v0.5.0"),
            "UNSUPPORTED PROTOCOL VERSION",
            "upgrade forge-fhevm-std"
        );
        _check(LibFhevmFail.registeredForkNotActive(1, 0), "REGISTERED FORK IS NOT ACTIVE", "fhevm.selectFork(id)");
        _check(LibFhevmFail.noRpcUrl("testnet", "sepolia"), "NO RPC URL", "SEPOLIA_RPC_URL=");
        _check(LibFhevmFail.notAFork(address(0xBEEF)), "NOT A FORK", "plaintextOf(value)");
        _check(LibFhevmFail.localStackCannotDeploy(address(0xD0), 0, 7), "LOCAL STACK CANNOT DEPLOY HERE", "anvil");
        _check(LibFhevmFail.noCurrentStack(), "NO CURRENT STACK", "fhevm.createSelectFork(");
        _check(LibFhevmFail.stackMissing("local", "anvil", address(0xE0)), "NO FHEVM STACK ON THIS CHAIN", "anvil");
        _check(LibFhevmFail.anvilMirrorFailed(address(0xAC)), "ANVIL MIRROR FAILED", "setAnvilMirror(false)");
        _check(LibFhevmFail.handleMissing(), "FHEVM HANDLE MISSING", "inherit TestFhevm");
    }

    /// `setupError` reverts with EXACTLY what `render` returns, so tests can expect the rendered string.
    function test_setupErrorRevertsWithTheRenderedMessage() public {
        string[] memory what = new string[](1);
        what[0] = "something is off";
        string[] memory fix = new string[](1);
        fix[0] = "do this";

        vm.expectRevert(bytes(LibFhevmFail.render("A TITLE", what, fix)));
        this.failWith("A TITLE", what, fix);
    }

    function failWith(string memory title, string[] memory what, string[] memory fix) external pure {
        LibFhevmFail.setupError(title, what, fix);
    }

    /// Numbers and addresses render in decimal and lowercase hex, with `NO_FORK` spelled out.
    function test_formatting() public pure {
        string memory m = LibFhevmFail.forkDrift(12345, NO_FORK);
        assertTrue(_contains(m, "(id 12345)"), "decimal fork id");
        assertTrue(_contains(m, "switched to NO_FORK"), "NO_FORK spelled out");
        string memory n = LibFhevmFail.notAFork(0xdEAD000000000000000042069420694206942069);
        assertTrue(_contains(n, "0xdead000000000000000042069420694206942069"), "lowercase hex address");
    }

    function _check(string memory message, string memory title, string memory fixFragment) private pure {
        console.log(message);
        assertTrue(_contains(message, "forge-fhevm-std "), "brand");
        assertTrue(_contains(message, title), title);
        assertTrue(_contains(message, "|  FIX  "), "a FIX line");
        assertTrue(_contains(message, fixFragment), fixFragment);
    }

    function _contains(string memory haystack, string memory needle) private pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length > h.length) return false;
        for (uint256 i = 0; i + n.length <= h.length; i++) {
            bool ok = true;
            for (uint256 j = 0; j < n.length; j++) {
                if (h[i + j] != n[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return true;
        }
        return false;
    }
}
