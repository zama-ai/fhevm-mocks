// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";
import {euint32, externalEuint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {ForgeFhevmEventProcessor} from "../../pkg/src/_host/ForgeFhevmEventProcessor.sol";
import {fhevm} from "../../pkg/src/FhevmVm.sol";
import {FHEVM_EXECUTOR_ADDRESS} from "../../pkg/src/_host/_internal/LocalHostAddresses.sol";

import {FHECounterPublicDecrypt} from "../examples/contracts/FHECounterPublicDecrypt.sol";

/// The one allowed read of the recorded-log buffer serves BOTH readers: the test gets every log, and the
/// replay gets the FHE events among them.
contract RecordedLogsTest is TestFhevm {
    event Probe(uint256 value);

    /// A dApp call's FHE events and this test's own event share one buffer; `fhevm.getRecordedLogs()` hands
    /// the test all of them AND the replay's store now holds the handle the executor announced.
    function test_getRecordedLogsServesTheTestAndTheReplay() public {
        FHECounterPublicDecrypt counter = new FHECounterPublicDecrypt();
        address alice = makeAddr("alice");
        (externalEuint32 v, bytes memory proof) = encryptUint32(5, address(counter), alice);
        vm.prank(alice);
        counter.increment(v, proof);
        emit Probe(42);
        euint32 count = counter.getCount();

        Vm.Log[] memory logs = fhevm.getRecordedLogs();

        bool sawProbe;
        bool sawExecutor;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(this)) sawProbe = true;
            if (logs[i].emitter == FHEVM_EXECUTOR_ADDRESS) sawExecutor = true;
        }
        assertTrue(sawProbe, "the test's own event is in the array");
        assertTrue(sawExecutor, "and so are the executor's");
        assertTrue(
            ForgeFhevmEventProcessor(fhevm.eventProcessor()).dbOf(FHEVM_EXECUTOR_ADDRESS).has(euint32.unwrap(count)),
            "the replay saw the FHE events the read drained"
        );
    }
}
