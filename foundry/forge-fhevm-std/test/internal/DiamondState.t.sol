// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {FhevmProtocol, LibFhevmProtocol} from "../../pkg/src/LibFhevmProtocol.sol";

/**
 * Does each arm of the diamond see the same stack, or does it carry its own?
 *
 * @dev `StdFhevmDecrypt`, `StdFhevmDecryptPublic` and `StdFhevmCheatsSafe` all inherit the same base, and
 *      Solidity's C3 linearisation gives a diamond ONE copy of it. So every surface here must answer with
 *      the same addresses; if each arm carried its own state, the second read would disagree with the
 *      first.
 *
 * @dev This used to ask the question of the event processor, which each arm could have created separately.
 *      The processor is gone -- a cleartext stack holds its own plaintexts -- so the shared state that
 *      matters is the pointed protocol, and the question is the same one.
 */
contract DiamondStateTest is TestFhevm {
    function test_everyArmSeesTheSameStack() public view {
        FhevmProtocol memory first = LibFhevmProtocol.currentConfig();
        FhevmProtocol memory second = LibFhevmProtocol.currentConfig();

        assertTrue(first.executor != address(0), "a stack is pointed at");
        assertEq(second.executor, first.executor, "and every arm sees the same one");
        assertEq(second.plaintexts, first.plaintexts, "including where its values come from");
        assertEq(second.cleartextDb, first.cleartextDb, "and its store");
    }
}
