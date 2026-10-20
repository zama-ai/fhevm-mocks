// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {LibFhevmFail} from "../../pkg/src/LibFhevmFail.sol";
import {FHEVM_EXECUTOR_ADDRESS} from "../../pkg/src/_host/ForgeFhevmDeploy.sol";

/// `forkUnknown`, the `forkUnknownDefaultE*` family and `resetForkUnknown` are fork-only cheats, and the
/// name is enforced: on the local cleartext stack every value is known, so the call is refused by name
/// rather than silently accepted.
contract ForkUnknownTest is TestFhevm {
    function test_RevertIf_ForkUnknownOnCleartextStack() public {
        euint32 value = euint32.wrap(bytes32(uint256(1)));
        vm.expectRevert(bytes(LibFhevmFail.notAFork(FHEVM_EXECUTOR_ADDRESS)));
        this.forkUnknownExternally(value);
    }

    function test_RevertIf_ForkUnknownDefaultOnCleartextStack() public {
        vm.expectRevert(bytes(LibFhevmFail.notAFork(FHEVM_EXECUTOR_ADDRESS)));
        this.forkUnknownDefaultExternally(1000);
    }

    /// Undoing a statement is fork-only for the same reason making one is: on a local stack there was
    /// never anything to undo.
    function test_RevertIf_ResetForkUnknownOnCleartextStack() public {
        euint32 value = euint32.wrap(bytes32(uint256(1)));
        vm.expectRevert(bytes(LibFhevmFail.notAFork(FHEVM_EXECUTOR_ADDRESS)));
        this.resetForkUnknownExternally(value);
    }

    /// External so `vm.expectRevert` has a call frame to catch.
    function forkUnknownExternally(euint32 value) external {
        forkUnknown(value, 1);
    }

    function resetForkUnknownExternally(euint32 value) external {
        resetForkUnknown(value);
    }

    function forkUnknownDefaultExternally(uint32 clear) external {
        forkUnknownDefaultEuint32(clear);
    }
}
