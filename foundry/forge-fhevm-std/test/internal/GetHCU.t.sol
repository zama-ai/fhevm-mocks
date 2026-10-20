// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";

import {FHETest} from "../fheTest/FHETest.sol";

/**
 * WHAT ONE VALUE COST, asked of the value itself.
 *
 * `lastHCU()` answers for a whole transaction and is kept transiently, so it is gone once that
 * transaction ends and says nothing about which handle spent what. `getHCU(value)` is the other question:
 * a per-handle reading, in ordinary storage, still answerable long after the call that produced it and
 * across a snapshot revert.
 *
 * ZERO IS AN ANSWER, AND IT IS NOT "FREE". Every metered operation costs something, so no reading means
 * the handle did not come from this stack -- on a fork, one the chain was already holding. That is the
 * distinction the reading exists to make, and the last test here is the one that states it.
 */
contract GetHCUTest is TestFhevm {
    FHETest internal dapp;

    function setUp() public override {
        super.setUp();
        dapp = new FHETest();
    }

    /// @dev A value this stack computed. `setClear*` is the dApp's way of minting one without an input
    ///      proof, so each call here is a real computation the meter sees.
    function _mint32(uint32 value) private returns (euint32) {
        resetHCU(); // each mint is its own transaction's worth of work; the cap is per transaction
        return dapp.setClearEuint32(value, false);
    }

    function test_aComputedValueHasACost() public {
        euint32 v = _mint32(7);

        assertGt(getHCU(v), 0, "the stack computed it, so it cost something");
    }

    /// The reading belongs to the HANDLE, not to the last thing that happened.
    function test_eachValueKeepsItsOwnCost() public {
        euint32 first = _mint32(1);
        uint256 costOfFirst = getHCU(first);

        euint32 second = _mint32(2);

        assertEq(getHCU(first), costOfFirst, "the first value's cost did not move");
        assertGt(getHCU(second), 0, "and the second has one of its own");
    }

    /// Every type answers, and a wider one never costs less than a narrower one.
    function test_everyTypeAnswers() public {
        resetHCU();
        assertGt(getHCU(dapp.setClearEbool(true, false)), 0, "ebool");
        resetHCU();
        assertGt(getHCU(dapp.setClearEuint8(1, false)), 0, "euint8");
        resetHCU();
        assertGt(getHCU(dapp.setClearEuint64(1, false)), 0, "euint64");
    }

    /**
     * IT OUTLIVES THE TRANSACTION READING, which is the whole reason it is stored rather than transient.
     * `resetHCU()` zeroes what `lastHCU()` reports; a value's own cost is untouched by it.
     */
    function test_aResetDoesNotErasePerHandleCosts() public {
        euint32 v = _mint32(7);
        uint256 cost = getHCU(v);

        resetHCU();

        assertEq(lastHCU().transaction, 0, "the transaction reading was cleared");
        assertEq(getHCU(v), cost, "the value's own cost was not");
    }

    /// A handle this stack never minted reads as zero -- the case the whole reading exists to separate.
    function test_aHandleFromNowhereReadsAsZero() public {
        euint32 mine = _mint32(7);
        euint32 foreign = euint32.wrap(keccak256("a handle this stack never minted"));

        assertGt(getHCU(mine), 0, "this one is ours");
        assertEq(getHCU(foreign), 0, "and this one is not, which is what zero says");
    }
}
