// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {ForgeFhevmEventProcessor} from "../../pkg/src/_host/ForgeFhevmEventProcessor.sol";
import {FHEVM_VM_ADDRESS, fhevm} from "../../pkg/src/FhevmVm.sol";
import {externalEuint32} from "encrypted-types/EncryptedTypes.sol";
import {FHECounterPublicDecrypt} from "../examples/contracts/FHECounterPublicDecrypt.sol";
import {ForkBlocks} from "../shared/ForkBlocks.sol";

/// The `fhevm` handle is in place after `setUp`, and is one object in every fork.
contract FhevmVmTest is TestFhevm {
    function test_isEtchedAndInitializedAfterSetUp() public view {
        assertGt(FHEVM_VM_ADDRESS.code.length, 0, "etched");
        assertTrue(fhevm.initialized(), "initialized");
        assertTrue(vm.isPersistent(FHEVM_VM_ADDRESS), "persistent");
    }

    function test_initializeTwiceIsANoOp() public {
        fhevm.initialize();
        assertTrue(fhevm.initialized());
    }

    /// The whole point of a persistent account: the same instance, with its state, after a fork, after a
    /// second fork, and after switching back.
    ///
    /// SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com forge test --match-contract FhevmVmTest
    function test_isOneObjectInEveryFork() public {
        // Opt in, not the URL (rules.md §7.3): see SepoliaFHETestAdd.t.sol.
        vm.skip(!ForkBlocks.enabled("sepolia"));
        FhevmChain memory sepolia = getFhevmChain("testnet", "sepolia");

        (uint256 blockA, uint256 blockB) = ForkBlocks.recentPair(sepolia.rpcUrl);

        uint256 forkA = vm.createSelectFork(sepolia.rpcUrl, blockA);
        assertTrue(fhevm.initialized(), "carried into fork A");

        uint256 forkB = vm.createSelectFork(sepolia.rpcUrl, blockB);
        assertTrue(fhevm.initialized(), "carried into fork B");

        vm.selectFork(forkA);
        assertTrue(fhevm.initialized(), "still there back on fork A");
        assertTrue(forkA != forkB, "two forks");
    }

    /// ONE PROCESSOR PER CONTEXT. Each fork gets its own on first contact, not persistent; switching back
    /// finds the same one, with exactly the executor of the stack pointed there.
    function test_eachContextHasItsOwnProcessor() public {
        vm.skip(!ForkBlocks.enabled("sepolia"));
        FhevmChain memory sepolia = getFhevmChain("testnet", "sepolia");
        address inMemory = fhevm.eventProcessor();
        assertTrue(inMemory != address(0), "the in-memory context has one from the constructor");

        (uint256 blockA, uint256 blockB) = ForkBlocks.recentPair(sepolia.rpcUrl);

        uint256 forkA = fhevm.createSelectFork(sepolia, blockA);
        address onA = fhevm.eventProcessor();
        assertTrue(onA != address(0) && onA != inMemory, "A has its own");
        assertFalse(vm.isPersistent(onA), "and it is not persistent");
        assertEq(ForgeFhevmEventProcessor(fhevm.eventProcessor()).executors().length, 1, "exactly Sepolia's executor");
        assertEq(ForgeFhevmEventProcessor(fhevm.eventProcessor()).selectedExecutor(), sepolia.fhevmExecutor);

        fhevm.createSelectFork(sepolia, blockB);
        address onB = fhevm.eventProcessor();
        assertTrue(onB != onA && onB != inMemory, "B has its own");

        fhevm.selectFork(forkA);
        assertEq(fhevm.eventProcessor(), onA, "A's is A's again");
        assertGt(onA.code.length, 0, "and it has code here");
    }

    // -- The one predicate: ask the cleartext verifier, or rebuild ----------------------------------------

    /// On the local cleartext stack the verifier is asked directly, unless the run forces the rebuilt path.
    /// Forced through the setter, never `vm.setEnv` (rules.md 7.5).
    function test_useCleartextVerifierFollowsTheStackAndTheFlag() public {
        assertTrue(fhevm.useCleartextVerifier(), "local cleartext: ask it");

        fhevm.setForceProductionPath(true);
        assertFalse(fhevm.useCleartextVerifier(), "forced: rebuild");
        fhevm.setForceProductionPath(false);
        assertTrue(fhevm.useCleartextVerifier(), "and back");

        fhevm.setProtocol(makeAddr("acl"), makeAddr("production-executor"), makeAddr("kms"));
        assertFalse(fhevm.useCleartextVerifier(), "a stack that is not cleartext is never asked directly");
    }

    /// The rebuilt path WORKS on the cleartext stack too: forced, encrypt and public decrypt still agree —
    /// the cleartext stack registers the cleartext signers this package holds, so the rebuilt proofs pass.
    function test_theRebuiltPathWorksOnTheCleartextStack() public {
        fhevm.setForceProductionPath(true);
        FHECounterPublicDecrypt counter = new FHECounterPublicDecrypt();
        address alice = makeAddr("alice");
        (externalEuint32 v, bytes memory proof) = encryptUint32(9, address(counter), alice);
        vm.prank(alice);
        counter.increment(v, proof);
        assertEq(decryptPublic(counter.getCount()), 9);
    }
}
