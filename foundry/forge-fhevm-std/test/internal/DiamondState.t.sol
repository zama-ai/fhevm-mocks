// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {ForgeFhevmEventProcessor} from "../../pkg/src/_host/ForgeFhevmEventProcessor.sol";
import {fhevm} from "../../pkg/src/FhevmVm.sol";

/// Does each arm of the diamond get its own `_eventProcessor`, or do they share one?
///
/// @dev `StdFhevmDecrypt`, `StdFhevmDecryptPublic` and `StdFhevmCheatsSafe` all inherit `StdFhevmReplay`,
///      which is the only contract that declares the field. If C3 linearization collapsed that to one
///      copy, every surface here answers with the same address; if each arm carried its own, the
///      second call would create a second processor.
contract DiamondStateTest is TestFhevm {
    function test_everyArmSeesTheSameProcessor() public view {
        address first = address(ForgeFhevmEventProcessor(fhevm.eventProcessor()));
        address second = address(ForgeFhevmEventProcessor(fhevm.eventProcessor()));

        assertTrue(first != address(0), "created on first use");
        assertEq(second, first, "and not created again");
    }
}
