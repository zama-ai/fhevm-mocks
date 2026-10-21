// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {aclAdd, fhevmExecutorAdd} from "../../pkg/src/addresses/FHEVMHostAddresses.sol";
import {CleartextForgeHCULimit} from "../../pkg/src/cleartext/CleartextForgeHCULimit.sol";
import {FheType} from "../../pkg/src/contracts/shared/FheType.sol";

/// The meter clears itself at every transaction, so a test reads the cost of ITS OWN work with no
/// bookkeeping. `setUp` is a separate transaction and deliberately meters expensive work there, so every
/// reading below would be wrong if the clear did not happen.
///
/// The meter is driven directly rather than through a deployed stack: its metering entry points take the
/// executor as their caller, and its owner check reads an ACL this test stands in for.
contract CleartextForgeHCULimitTest is Test {
    CleartextForgeHCULimit internal meter;
    address internal dApp = makeAddr("dApp");
    uint256 internal minted;

    /// What `setUp` metered, read from the test before the test meters anything of its own.
    uint256 internal setUpTransactionHCU;
    uint256 internal setUpMaxHandleHCU;

    function setUp() public {
        meter = new CleartextForgeHCULimit();

        // Stand in for the ACL the owner check reads, and own it, so the caps can be set from here.
        vm.etch(aclAdd, hex"00");
        vm.mockCall(aclAdd, abi.encodeWithSignature("owner()"), abi.encode(address(this)));
        meter.setHCUPerBlock(10_000_000);
        meter.setMaxHCUPerTx(5_000_000);
        meter.setMaxHCUDepthPerTx(1_000_000);

        _meterRand();
        _meterTrivialEncrypt(2);

        setUpTransactionHCU = meter.lastTransactionHCU();
        setUpMaxHandleHCU = meter.maxHandleHCU();
    }

    /// `setUp` really did meter something, and it is still readable until this transaction meters anything.
    function test_theSetUpReadingsSurviveIntoTheTestUntilItMetersSomething() public view {
        assertGt(setUpTransactionHCU, 0, "setUp metered");
        assertEq(meter.lastTransactionHCU(), setUpTransactionHCU, "and nothing cleared it yet");
        assertEq(meter.maxHandleHCU(), setUpMaxHandleHCU);
    }

    /// The total starts this transaction at zero and adds up within it. Were `setUp`'s operations still on
    /// the meter, the second reading would not come to four times the first.
    function test_theTotalStartsAtZeroAndAccumulatesWithinTheTransaction() public {
        _meterTrivialEncrypt(1);
        uint256 one = meter.lastTransactionHCU();
        _meterTrivialEncrypt(3);

        assertEq(meter.lastTransactionHCU(), 4 * one, "four of the same operation, counted from zero");
        assertLt(one, setUpTransactionHCU, "setUp's total is gone rather than added to");
    }

    /// The reading that would otherwise never come down: a running maximum in ordinary storage, which
    /// nothing but this clear resets. Removing the clear leaves `setUp`'s expensive operation standing here.
    function test_theDepthReadingIsTheOneThatNeedsTheClear() public {
        _meterTrivialEncrypt(1);

        assertGt(meter.maxHandleHCU(), 0, "this test's own operation is measured");
        assertLt(meter.maxHandleHCU(), setUpMaxHandleHCU, "setUp's expensive one is gone");
    }

    /// A metered operation that reverts takes its share of the meter with it, the transient flag included,
    /// so the operation after it still opens the transaction.
    function test_aRevertedOperationCountsForNothing() public {
        vm.expectRevert();
        this.meterAnUnsupportedType();

        _meterTrivialEncrypt(1);
        uint256 one = meter.lastTransactionHCU();
        _meterTrivialEncrypt(1);

        assertEq(meter.lastTransactionHCU(), 2 * one, "the failed attempt is not on the meter");
        assertLt(one, setUpTransactionHCU, "and the transaction still opened on a cleared meter");
    }

    /// External so the revert is caught without unwinding the test.
    function meterAnUnsupportedType() external {
        vm.prank(fhevmExecutorAdd);
        meter.checkHCUForTrivialEncrypt(FheType.Int8, _handle(), dApp);
    }

    function _meterTrivialEncrypt(uint256 n) private {
        for (uint256 i = 0; i < n; i++) {
            bytes32 handle = _handle();
            vm.prank(fhevmExecutorAdd);
            meter.checkHCUForTrivialEncrypt(FheType.Uint64, handle, dApp);
        }
    }

    function _meterRand() private {
        bytes32 handle = _handle();
        vm.prank(fhevmExecutorAdd);
        meter.checkHCUForFheRand(FheType.Uint64, handle, dApp);
    }

    /// A fresh non-zero handle; the base stores one reading per handle, so they must not repeat.
    function _handle() private returns (bytes32) {
        minted++;
        return keccak256(abi.encode("handle", minted));
    }
}
