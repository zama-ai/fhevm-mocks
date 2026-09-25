// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {FhevmHCUMeter} from "../../pkg/src/FhevmVm.sol";
import {
    FHEVM_EXECUTOR_ADDRESS,
    ICleartextFHEVMExecutor,
    ICleartextHCULimit
} from "../../pkg/src/_host/ForgeFhevmDeploy.sol";
import {FheType} from "../../pkg/src/_host/shared/FheType.sol";

/// A dApp that builds one long dependency chain in ONE call: `n` euint64 additions, each on the previous
/// result. The executor grants each result to its caller, so no ACL setup is needed. A non-scalar euint64
/// add is 172_000 HCU of depth, so 30 of them pass the 5_000_000 depth cap.
contract DeepChain {
    ICleartextFHEVMExecutor private immutable EXECUTOR = ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS);

    function run(uint256 n) external returns (bytes32 h) {
        h = EXECUTOR.trivialEncrypt(1, FheType.Uint64);
        for (uint256 i = 0; i < n; i++) {
            h = EXECUTOR.fheAdd(h, h, 0x00);
        }
    }
}

/// `disableHCUDepthLimit` is a cheat on the CURRENT stack's HCULimit, applied through `fhevm` as the ACL
/// owner. Proven the way rule 7.1 asks: the cap trips live first, then the same chain goes through.
contract DisableHCUDepthLimitTest is TestFhevm {
    /// `HCULimit.HCUTransactionDepthLimitExceeded()`, spelled as a selector: the test must not import the host source.
    bytes4 internal constant DEPTH_EXCEEDED = bytes4(keccak256("HCUTransactionDepthLimitExceeded()"));
    uint256 internal constant TOO_DEEP = 40;

    DeepChain internal chain;
    ICleartextHCULimit internal limit;

    function setUp() public override {
        super.setUp();
        chain = new DeepChain();
        limit = ICleartextHCULimit(ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS).getHCULimitAddress());
    }

    function test_theLocalStackCapsDepth() public {
        vm.expectRevert(DEPTH_EXCEEDED);
        chain.run(TOO_DEEP);
    }

    function test_disableHCUDepthLimitLetsTheChainThrough() public {
        disableHCUDepthLimit();

        uint48 txCap = limit.getMaxHCUPerTx();
        assertEq(limit.getMaxHCUDepthPerTx(), txCap, "depth == tx cap: it cannot bind on its own any more");
        assertEq(txCap, 20_000_000, "tx cap untouched");
        assertTrue(chain.run(TOO_DEEP) != bytes32(0), "the depth cap no longer trips");
        vm.expectRevert();
        chain.run(TOO_DEEP * 3); // > 20M in one call: the transaction cap still meters
    }

    /// The blunt form: every cap to the ceiling, so even a chain past the transaction cap goes through.
    function test_disableHCULimitsLiftsEverything() public {
        disableHCULimits();

        assertEq(limit.getGlobalHCUCapPerBlock(), type(uint48).max);
        assertEq(limit.getMaxHCUPerTx(), type(uint48).max);
        assertEq(limit.getMaxHCUDepthPerTx(), type(uint48).max);
        assertTrue(chain.run(TOO_DEEP * 3) != bytes32(0), "> 20M in one call, no longer refused");
    }

    /// The meter reads what the call actually cost. Asserted as a RELATION, not a constant: the exact
    /// figure is the HCU table's to change, but one handle's chain can never cost more than the whole
    /// transaction it is part of.
    function test_lastHCUReadsWhatTheCallCost() public {
        chain.run(10);

        FhevmHCUMeter memory hcu = lastHCU();

        assertGt(hcu.transaction, 0, "the transaction metered something");
        assertGt(hcu.maxHandle, 0, "and so did its deepest handle");
        assertLe(hcu.maxHandle, hcu.transaction, "one chain cannot cost more than the whole transaction");
    }

    /// `maxHandle` IS the number the depth cap is applied to, shown against the cap this suite already
    /// proves trips: at `TOO_DEEP` the reading is past 5_000_000, which is why `test_theLocalStackCapsDepth`
    /// reverts and why lifting the cap is what lets the same chain through.
    function test_theDepthReadingIsTheNumberTheCapChecks() public {
        uint48 depthCap = limit.getMaxHCUDepthPerTx();
        disableHCUDepthLimit(); // the cap would refuse the chain before it could be measured

        chain.run(TOO_DEEP);

        assertGt(lastHCU().maxHandle, depthCap, "TOO_DEEP is over the cap it trips when the cap is in force");
    }

    /// A shallower chain reads lower, so the number tracks the work rather than being a constant.
    function test_aShallowerChainReadsLower() public {
        chain.run(TOO_DEEP / 4);
        uint256 shallow = lastHCU().maxHandle;

        disableHCUDepthLimit();
        chain.run(TOO_DEEP);

        assertGt(lastHCU().maxHandle, shallow, "more additions, deeper chain");
    }

    /// Idempotent, and it leaves no prank behind: the caller's own pranks still work afterwards.
    function test_callingItTwiceIsFineAndLeavesNoPrank() public {
        disableHCUDepthLimit();
        disableHCUDepthLimit();
        address alice = makeAddr("alice");
        vm.prank(alice);
        assertTrue(chain.run(1) != bytes32(0));
    }
}
