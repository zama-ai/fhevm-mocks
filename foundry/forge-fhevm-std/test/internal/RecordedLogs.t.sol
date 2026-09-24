// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";
import {euint32, externalEuint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {ForgeFhevmEventProcessor} from "../../pkg/src/_host/ForgeFhevmEventProcessor.sol";
import {fhevm} from "../../pkg/src/FhevmVm.sol";
import {ForkBlocks} from "../shared/ForkBlocks.sol";
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

    // -- `recordLogs()`: the pair ports as a pair ----------------------------------------------------

    /**
     * WITH A REPLAY RUNNING IT IS IGNORED, and that is the point rather than a shortcoming. The buffer is
     * the replay's; resetting it would throw away every FHE event recorded so far. So the window stays
     * where `initialize()` opened it and the test still gets its earlier log — a wider window than it
     * asked for, which costs it nothing, where a reset would have cost the replay everything.
     */
    function test_recordLogsIsIgnoredWhileAReplayOwnsTheBuffer() public {
        emit Probe(1);
        fhevm.recordLogs();
        emit Probe(2);

        Vm.Log[] memory logs = fhevm.getRecordedLogs();
        assertEq(_probes(logs), 2, "both events, including the one from before the call");
    }

    /**
     * AND IT COSTS THE REPLAY NOTHING, which is what ignoring buys. The executor announced this handle
     * BEFORE the call; had it been forwarded, that announcement would be in the bin and the decrypt below
     * would fail on a handle nothing ever saw.
     */
    function test_recordLogsKeepsTheFheEventsAReplayStillNeeds() public {
        FHECounterPublicDecrypt counter = new FHECounterPublicDecrypt();
        address alice = makeAddr("alice");
        (externalEuint32 v, bytes memory proof) = encryptUint32(5, address(counter), alice);
        vm.prank(alice);
        counter.increment(v, proof);

        fhevm.recordLogs();

        assertEq(decryptPublic(counter.getCount()), 5, "the handle still decrypts");
        assertTrue(
            ForgeFhevmEventProcessor(fhevm.eventProcessor()).dbOf(FHEVM_EXECUTOR_ADDRESS)
                .has(euint32.unwrap(counter.getCount())),
            "because its FHE events never went in the bin"
        );
    }

    /**
     * WITHOUT ONE IT IS THE REAL CHEAT. A URL-only fork has no processor until its first SDK entry names a
     * stack, so nothing is feeding on the buffer and there is nothing to starve. Ignoring here would be
     * the silent kind of wrong: the test would read logs from before its own `recordLogs()` and never know
     * why. So the window is the one it drew.
     *
     *          SEPOLIA_RPC_URL=... forge test --match-contract RecordedLogs
     */
    function test_recordLogsIsForwardedWhereNoReplayOwnsTheBuffer() public {
        vm.skip(!ForkBlocks.enabled("sepolia"));
        FhevmChain memory sepolia = getFhevmChain("testnet", "sepolia");
        fhevm.createSelectFork(sepolia.rpcUrl, ForkBlocks.recent(sepolia.rpcUrl)); // URL only: no stack, no processor

        emit Probe(1);
        fhevm.recordLogs();
        emit Probe(2);

        Vm.Log[] memory logs = fhevm.getRecordedLogs();
        assertEq(_probes(logs), 1, "only the event emitted after the call");
    }

    /// Arming is `initialize()`'s job, once per test, so repeating the call is not a way to lose anything.
    function test_recordLogsIsSafeToRepeat() public {
        fhevm.recordLogs();
        fhevm.recordLogs();
        emit Probe(7);
        assertEq(_probes(fhevm.getRecordedLogs()), 1, "the window is still open and still capturing");
    }

    /// @dev This test's own `Probe` events among a batch of logs.
    function _probes(Vm.Log[] memory logs) private view returns (uint256 count) {
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(this) && logs[i].topics[0] == Probe.selector) count++;
        }
    }
}
