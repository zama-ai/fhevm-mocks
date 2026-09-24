// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";

/**
 * @notice What forge itself does with the recorded-log buffer, measured with none of this SDK involved.
 *
 * `fhevm.recordLogs()` ignores the call while a replay owns the buffer, and that decision rests entirely
 * on the first fact below. If a second `vm.recordLogs()` merely re-armed an already-armed recorder, the
 * SDK could forward it and this whole special case would be dead weight. It does not: it THROWS AWAY
 * everything captured so far, which on an FHEVM test is every executor event the replay has not yet
 * folded into its store.
 *
 * The second fact is why nothing needs re-arming afterwards: a drain empties the buffer without stopping
 * the recorder, so `initialize()` arming it once covers the whole test.
 *
 * Kept as assertions rather than a note, because a note cannot fail when forge changes its mind.
 */
contract ForgeRecordLogsSemanticsTest is Test {
    event Probe(uint256 value);

    /// A SECOND `recordLogs()` DISCARDS what the first one captured. Not a no-op, not a re-arm.
    function test_aSecondRecordLogsDiscardsWhatWasCaptured() public {
        vm.recordLogs();
        emit Probe(1);
        vm.recordLogs();
        emit Probe(2);

        Vm.Log[] memory logs = vm.getRecordedLogs();

        assertEq(logs.length, 1, "the first event did not survive the second recordLogs()");
        assertEq(abi.decode(logs[0].data, (uint256)), 2, "and what is left is the one emitted after it");
    }

    /// A DRAIN DOES NOT DISARM. Recording carries on, so nothing has to arm it a second time.
    function test_drainingLeavesTheRecorderArmed() public {
        vm.recordLogs();
        emit Probe(1);
        assertEq(vm.getRecordedLogs().length, 1, "the drain returns what was captured");

        emit Probe(2); // no re-arm in between
        Vm.Log[] memory again = vm.getRecordedLogs();

        assertEq(again.length, 1, "still recording");
        assertEq(abi.decode(again[0].data, (uint256)), 2, "and the first drain emptied the buffer");
    }
}
