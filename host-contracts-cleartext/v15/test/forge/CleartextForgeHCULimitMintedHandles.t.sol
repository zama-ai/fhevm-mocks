// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ForgeFhevmDeploy} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {
    CLEARTEXT_DB_ADDRESS,
    FHEVM_EXECUTOR_ADDRESS,
    HCU_LIMIT_ADDRESS
} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextDB, ICleartextFHEVMExecutor} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {FheType} from "../../pkg/forge/src/shared/LibFheType.sol";
import {CleartextForgeHCULimit} from "../../pkg/src/cleartext/CleartextForgeHCULimit.sol";

/**
 * "DID THIS STACK MINT THIS HANDLE?" -- the question that separates a handle older than the cleartext
 * layer from one the layer should have recorded and did not.
 *
 * WHY IT MATTERS. A store miss has two causes with opposite meanings. On a fork, most misses are handles
 * minted before the cleartext layer existed, and the per-type unknown-handle policy is the right answer
 * for those. The other cause is an operator upstream added that the cleartext executor does not override:
 * `super` runs, a handle is minted, nothing records it, and nothing fails to compile. With a policy set,
 * that bug reads back as a plausible number. The HCU limit is what tells them apart, because every handle
 * the executor computes is metered -- all ten minting sites in `FHEVMExecutor` are paired with an HCU
 * call.
 *
 * WHAT IS NOT TESTED HERE. The bug case itself: producing it needs an executor with an unmirrored
 * operator, which does not exist in this package by construction. What this file pins is the SIGNAL --
 * that minted handles are marked, that foreign ones are not, and that the mark survives the two things
 * that would otherwise desynchronise it from the store.
 */
contract CleartextForgeHCULimitMintedHandlesTest is Test, ForgeFhevmDeploy {
    CleartextForgeHCULimit internal hcuLimit;
    ICleartextFHEVMExecutor internal executor;
    ICleartextDB internal db;

    function setUp() public {
        deployLocalFhevm();
        hcuLimit = CleartextForgeHCULimit(HCU_LIMIT_ADDRESS);
        executor = ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS);
        db = ICleartextDB(CLEARTEXT_DB_ADDRESS);
    }

    /// A computed handle is marked, and its cleartext is in the store: the ordinary case, both agree.
    function test_aComputedHandleIsMarkedAndStored() public {
        bytes32 handle = executor.trivialEncrypt(7, FheType.Uint32);

        assertTrue(hcuLimit.wasMintedHere(handle), "the stack minted it");
        assertTrue(db.has(handle), "and recorded it");
    }

    /**
     * THE MARK IS THE COST, which is what lets one mapping answer both questions. It also outlives the
     * base's own reading: that one is transient and gone at the end of the transaction, so this is the
     * only place a test can ask afterwards what a given handle cost.
     */
    function test_theMarkIsTheHandlesOwnHcu() public {
        bytes32 handle = executor.trivialEncrypt(7, FheType.Uint32);

        uint256 cost = hcuLimit.hcuOf(handle);
        assertGt(cost, 0, "a metered operation never costs nothing -- that is what makes zero mean absent");
        assertEq(cost, hcuLimit.maxHandleHCU(), "and it is the reading the base took for this one handle");
    }

    /// Two operations of different weight are recorded apart, so the value is the handle's own.
    function test_eachHandleKeepsItsOwnCost() public {
        bytes32 cheap = executor.trivialEncrypt(1, FheType.Bool);
        bytes32 dearer = executor.trivialEncrypt(1, FheType.Uint256);

        assertGt(hcuLimit.hcuOf(cheap), 0, "the cheap one was metered");
        assertGt(hcuLimit.hcuOf(dearer), 0, "and so was the wider one");
        assertTrue(hcuLimit.hcuOf(dearer) >= hcuLimit.hcuOf(cheap), "a wider type never costs less");
    }

    /// Every op is metered, so this holds for computed results too, not only for the simplest mint.
    function test_aResultOfAnOperationIsMarkedToo() public {
        bytes32 lhs = executor.trivialEncrypt(10, FheType.Uint32);
        bytes32 rhs = executor.trivialEncrypt(3, FheType.Uint32);
        bytes32 sum = executor.fheAdd(lhs, rhs, 0x00);

        assertTrue(hcuLimit.wasMintedHere(sum), "the sum was minted here");
        assertEq(db.get(sum), 13, "and its cleartext is the sum");
    }

    /// A handle this stack never produced is not marked -- which is what makes the mark worth reading.
    function test_aForeignHandleIsNotMarked() public view {
        bytes32 foreign = keccak256("a handle from somewhere else");

        assertFalse(hcuLimit.wasMintedHere(foreign), "never minted here");
        assertEq(hcuLimit.hcuOf(foreign), 0, "zero is how absence is spelled");
        assertFalse(db.has(foreign), "and no cleartext for it either");
    }

    /**
     * THE REASON IT IS PERSISTENT. `revertToState` wipes transient storage rather than restoring it, so a
     * mark kept there would disagree with the store after a revert -- the store comes back, the mark does
     * not. Ordinary storage reverts WITH the store, so the two stay consistent, which is the whole basis
     * of comparing them.
     */
    function test_theMarkAndTheStoreRevertTogether() public {
        uint256 snapshot = vm.snapshotState();

        bytes32 handle = executor.trivialEncrypt(7, FheType.Uint32);
        assertTrue(hcuLimit.wasMintedHere(handle), "marked before the revert");
        assertTrue(db.has(handle), "stored before the revert");

        vm.revertToState(snapshot);

        assertFalse(hcuLimit.wasMintedHere(handle), "the mark went back with the state");
        assertFalse(db.has(handle), "and so did the store -- they agree either way");
    }

    /// And a mark taken before a snapshot survives a revert to it, together with the store.
    function test_aMarkFromBeforeTheSnapshotSurvives() public {
        bytes32 handle = executor.trivialEncrypt(7, FheType.Uint32);
        uint256 snapshot = vm.snapshotState();

        executor.trivialEncrypt(8, FheType.Uint32);
        vm.revertToState(snapshot);

        assertTrue(hcuLimit.wasMintedHere(handle), "still marked");
        assertTrue(db.has(handle), "still stored");
    }
}
