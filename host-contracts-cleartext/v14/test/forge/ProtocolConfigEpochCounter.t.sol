// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ForgeFhevmDeploy} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ACL_ADDRESS, KMS_VERIFIER_ADDRESS, PROTOCOL_CONFIG_ADDRESS} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {LibForgeFhevmStack} from "../../pkg/forge/src/LibForgeFhevmStack.sol";
import {IProtocolConfig} from "../../pkg/forge/src/_internal/interfaces/IProtocolConfig.sol";

/**
 * `LibForgeFhevmStack.epochCounter`, which reads `ProtocolConfig`'s epoch counter straight out of
 * storage.
 *
 * WHY IT READS STORAGE AT ALL. Swapping the KMS signers on a fork ends by activating the epoch the
 * creation quorum just opened, and that call has to name the epoch by id. The contract mints the id
 * from a counter of its own and announces it only in an event; there is no getter for a pending epoch,
 * and the recorded-log buffer belongs to the replay (rule 2.3), so draining it here would break the
 * next decryption. The counter is therefore read where it lives.
 *
 * WHAT THIS FILE IS FOR. A storage offset is a fact about someone else's source, copied into ours. If
 * upstream inserts a field into `ProtocolConfigStorage`, the constant silently starts naming a
 * different value and the swap breaks in a way no other test would explain.
 * `test_theSlotHoldsTheEpochCounter` is the tripwire: it reads the slot on a freshly deployed stack and
 * checks it against the epoch the contract itself reports.
 */
contract ProtocolConfigEpochCounterTest is Test, ForgeFhevmDeploy {
    IProtocolConfig internal protocolConfig;

    function setUp() public {
        deployLocalFhevm();
        protocolConfig = IProtocolConfig(PROTOCOL_CONFIG_ADDRESS);
    }

    /// THE TRIPWIRE. On a stack that has just been deployed, no epoch has ever been abandoned, so the
    /// counter and the active epoch are the same number. Reading a different slot gives something else
    /// entirely — a threshold, a context id, or zero — and this fails.
    function test_theSlotHoldsTheEpochCounter() public view {
        (, uint256 activeEpoch) = protocolConfig.getCurrentKmsContextAndEpoch();

        assertEq(
            LibForgeFhevmStack.epochCounter(PROTOCOL_CONFIG_ADDRESS),
            activeEpoch,
            "the slot must hold the epoch counter, which on a fresh stack is the active epoch"
        );
        // Not zero, so the assertion above cannot pass by reading an empty slot.
        assertGt(activeEpoch, 0, "a deployed stack has an epoch");
    }

    /// The counter moves when an epoch is opened, and the active epoch does not follow it. This is the
    /// divergence that made the old code wrong, reproduced locally: `defineNewEpochForCurrentKmsContext`
    /// opens a PENDING epoch, which nothing here activates.
    function test_theCounterMovesAheadOfTheActiveEpoch() public {
        (, uint256 activeBefore) = protocolConfig.getCurrentKmsContextAndEpoch();
        uint256 counterBefore = LibForgeFhevmStack.epochCounter(PROTOCOL_CONFIG_ADDRESS);

        vm.prank(fhevmACLOwner());
        protocolConfig.defineNewEpochForCurrentKmsContext();

        (, uint256 activeAfter) = protocolConfig.getCurrentKmsContextAndEpoch();
        uint256 counterAfter = LibForgeFhevmStack.epochCounter(PROTOCOL_CONFIG_ADDRESS);

        assertEq(activeAfter, activeBefore, "the active epoch does not move: the new one is pending");
        assertEq(counterAfter, counterBefore + 1, "but the counter does");
        // And this is exactly the gap the old `activeEpochId + 1` guess fell into.
        assertTrue(counterAfter != activeAfter, "counter and active epoch have diverged");
    }

    /**
     * THE REGRESSION. With the counter ahead of the active epoch, swapping in the cleartext KMS context
     * must still work.
     *
     * This is the devnet Sepolia failure, reproduced without a fork. The old code named the epoch as
     * "the active one plus one", which on this state points at an epoch that is already spoken for, and
     * `confirmEpochActivation` answered `InvalidKmsEpoch`. Reading the counter names the epoch the
     * quorum actually opened, whatever the history before it.
     */
    function test_theSignerSwapWorksWithTheCounterAhead() public {
        // Open an epoch and then destroy it, which is how a chain ends up with its counter ahead and
        // nothing in flight: a rotation that was started and abandoned. Destroying it matters — the
        // contract refuses a new proposal while an epoch is still pending
        // (`KmsLifecycleOperationInFlight`), so an advanced counter can only be reached this way.
        vm.startPrank(fhevmACLOwner());
        protocolConfig.defineNewEpochForCurrentKmsContext();
        protocolConfig.destroyKmsEpoch(LibForgeFhevmStack.epochCounter(PROTOCOL_CONFIG_ADDRESS));
        vm.stopPrank();

        (, uint256 activeEpoch) = protocolConfig.getCurrentKmsContextAndEpoch();
        assertTrue(LibForgeFhevmStack.epochCounter(PROTOCOL_CONFIG_ADDRESS) > activeEpoch, "counter is ahead");

        LibForgeFhevmStack.defineCleartextKmsContext(PROTOCOL_CONFIG_ADDRESS, ACL_ADDRESS);

        assertTrue(
            LibForgeFhevmStack.hasCleartextKmsContext(KMS_VERIFIER_ADDRESS),
            "the verifier answers with the cleartext context"
        );
        (, uint256 epochAfter) = protocolConfig.getCurrentKmsContextAndEpoch();
        assertTrue(epochAfter > activeEpoch, "and an epoch was actually activated");
    }
}
