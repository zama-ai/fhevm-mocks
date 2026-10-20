// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {externalEuint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {FhevmHCUMeter} from "../../pkg/src/FhevmVm.sol";

import {FHECounterPublicDecrypt} from "../examples/contracts/FHECounterPublicDecrypt.sol";

/**
 * THE METER MEASURES SINCE THE LAST RESET, not since the last transaction -- because under forge those
 * are not the same thing.
 *
 * `HCULimit` clears its readings on the first metered operation of a new TRANSACTION, which is right on a
 * chain. A forge test function IS one transaction (`ForgeTransientStorageSemantics.t.sol` measures it), so
 * the clear fires once and every later call in the test adds to the same total. A test with a single FHE
 * call reads correctly; a test with two silently reads their sum. `resetHCU()` is what makes the second
 * case measurable, and this file is what stops the behaviour drifting back.
 */
contract ResetHCUTest is TestFhevm {
    FHECounterPublicDecrypt internal counter;
    address internal alice;

    function setUp() public override {
        super.setUp();
        counter = new FHECounterPublicDecrypt();
        alice = makeAddr("alice");
    }

    /// WITHOUT A RESET the second call's reading includes the first: this is the trap, stated.
    function test_theMeterAccumulatesAcrossCallsInOneTest() public {
        _increment(1);
        uint256 afterFirst = lastHCU().transaction;
        assertGt(afterFirst, 0, "the first call was metered");

        _increment(1);
        uint256 afterSecond = lastHCU().transaction;

        assertGt(afterSecond, afterFirst, "the second reading carries the first call's cost too");
    }

    /**
     * WITH A RESET each call is measured alone, and two identical calls then cost exactly the same.
     *
     * The warm-up is not ceremony: the FIRST increment on a fresh counter also trivially encrypts the zero
     * it adds to, which costs 32 HCU the later ones do not pay. Measuring from the second call on compares
     * like with like -- and the difference is small enough (125032 against 125000) that a test written
     * without it would look like a rounding quirk rather than a real one.
     */
    function test_aResetMakesEachCallMeasurableOnItsOwn() public {
        _increment(1); // warm-up: initialises the counter, so the measured calls do equal work

        resetHCU();
        _increment(1);
        uint256 first = lastHCU().transaction;

        resetHCU();
        _increment(1);
        uint256 second = lastHCU().transaction;

        assertGt(first, 0, "something was measured");
        assertEq(second, first, "the same work costs the same, once each is measured alone");
    }

    /// A reset with nothing after it reads zero -- it clears rather than merely re-arming.
    function test_aResetLeavesTheMeterAtZero() public {
        _increment(1);
        assertGt(lastHCU().transaction, 0, "metered");

        resetHCU();

        FhevmHCUMeter memory meter = lastHCU();
        assertEq(meter.transaction, 0, "transaction reading cleared");
        assertEq(meter.maxHandle, 0, "and the per-handle one with it");
    }

    /**
     * AND THE STACK STILL WORKS AFTERWARDS. The reset clears a transient flag as well as the numbers; if
     * it cleared only the numbers, the next operation would skip its own clearing step and quietly add
     * itself to whatever came before. Decrypting proves the stack is unharmed either way.
     */
    function test_theStackIsUnharmedByAReset() public {
        resetHCU();
        _increment(7);
        assertEq(decryptPublic(counter.getCount()), 7, "the value is still right");
        assertGt(lastHCU().transaction, 0, "and the meter still meters");
    }

    function _increment(uint32 by) private {
        (externalEuint32 input, bytes memory proof) = encryptUint32(by, address(counter), alice);
        vm.prank(alice);
        counter.increment(input, proof);
    }
}
