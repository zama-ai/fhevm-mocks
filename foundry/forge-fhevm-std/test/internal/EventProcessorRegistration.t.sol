// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {LibFhevmProtocol} from "../../pkg/src/LibFhevmProtocol.sol";
import {fhevm} from "../../pkg/src/FhevmVm.sol";
import {ForgeFhevmEventProcessor} from "../../pkg/src/_host/ForgeFhevmEventProcessor.sol";
import {FHEVM_EXECUTOR_ADDRESS} from "../../pkg/src/_host/_internal/LocalHostAddresses.sol";

/// One processor per execution context, knowing exactly the executors of the stacks pointed there; the
/// in-memory chain is a context like any other.
contract EventProcessorRegistrationTest is TestFhevm {
    /// The in-memory context has a processor from the constructor, with ONE executor: the local stack's.
    function test_theInMemoryContextHasItsOwnProcessor() public view {
        ForgeFhevmEventProcessor processor = ForgeFhevmEventProcessor(fhevm.eventProcessor());
        assertTrue(address(processor) != address(0));
        assertFalse(vm.isPersistent(address(processor)), "a replay is never persistent");
        assertEq(processor.executors().length, 1, "the local executor, nothing else");
        assertEq(processor.selectedExecutor(), FHEVM_EXECUTOR_ADDRESS);
    }

    /// Declaring another stack in the same context registers its executor on THIS context's processor
    /// and selects it; declaring again re-selects. Reads go to the selected store.
    function test_declaringAStackRegistersAndSelectsItsExecutor() public {
        FhevmChain memory sepolia = getFhevmChain("testnet", "sepolia");
        address processorBefore = address(ForgeFhevmEventProcessor(fhevm.eventProcessor()));

        fhevm.setProtocol(sepolia.acl, sepolia.fhevmExecutor, sepolia.kmsVerifier);
        assertEq(
            address(ForgeFhevmEventProcessor(fhevm.eventProcessor())), processorBefore, "same context, same processor"
        );
        assertTrue(
            ForgeFhevmEventProcessor(fhevm.eventProcessor()).isExecutor(sepolia.fhevmExecutor),
            "registered on declaration"
        );
        assertEq(
            ForgeFhevmEventProcessor(fhevm.eventProcessor()).selectedExecutor(), sepolia.fhevmExecutor, "and selected"
        );

        fhevm.setProtocol(address(0), FHEVM_EXECUTOR_ADDRESS, address(0));
        assertEq(
            ForgeFhevmEventProcessor(fhevm.eventProcessor()).selectedExecutor(), FHEVM_EXECUTOR_ADDRESS, "re-selected"
        );
        assertEq(ForgeFhevmEventProcessor(fhevm.eventProcessor()).executors().length, 2, "no duplicate registration");
    }

    /// `useStack` runs the fork's pointing path IN MEMORY: describing the local stack itself is a no-op
    /// change, and proves the path runs there (cleartext: no gate, no swap, same processor).
    function test_useStackInMemory() public {
        address before = fhevm.eventProcessor();
        FhevmChain memory local = getFhevmChain("local", "anvil"); // the local addresses, described

        fhevm.useStack(local);

        assertEq(LibFhevmProtocol.currentConfig().executor, FHEVM_EXECUTOR_ADDRESS);
        assertTrue(LibFhevmProtocol.currentConfig().isCleartext);
        assertEq(fhevm.eventProcessor(), before, "same context, same processor");
    }

    /// THE IN-MEMORY CONTEXT CAN HOST A NON-CLEARTEXT STACK. Nothing deploys one today, but the read path
    /// is the stack's property, not the context's: an executor that does not answer `IS_CLEARTEXT` makes
    /// this context's processor the plaintext source — exactly as on a fork.
    function test_aNonCleartextStackInMemoryReadsThisContextsProcessor() public {
        address executorWithoutCode = makeAddr("production-executor-stub");
        fhevm.setProtocol(makeAddr("acl"), executorWithoutCode, makeAddr("kms"));

        assertFalse(LibFhevmProtocol.currentConfig().isCleartext, "not cleartext");
        assertEq(LibFhevmProtocol.currentConfig().plaintexts, fhevm.eventProcessor(), "read from the replay");
        assertEq(ForgeFhevmEventProcessor(fhevm.eventProcessor()).selectedExecutor(), executorWithoutCode);
    }
}
