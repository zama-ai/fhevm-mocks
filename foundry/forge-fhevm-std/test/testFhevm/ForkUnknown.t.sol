// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {LibFhevmFail} from "../../pkg/src/LibFhevmFail.sol";
import {FHEVM_EXECUTOR_ADDRESS} from "../../pkg/src/_host/ForgeFhevmDeploy.sol";

/// `forkUnknown` and `forkUnknownDefault` are fork-only cheats, and the name is enforced: on the local
/// cleartext stack every value is known, so the call is refused by name rather than silently accepted.
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

    /// External so `vm.expectRevert` has a call frame to catch.
    function forkUnknownExternally(euint32 value) external {
        forkUnknown(value, 1);
    }

    function forkUnknownDefaultExternally(uint256 clear) external {
        forkUnknownDefault(clear);
    }
}
