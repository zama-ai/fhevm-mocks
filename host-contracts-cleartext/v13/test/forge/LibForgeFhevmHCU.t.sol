// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ForgeFhevmDeploy} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {FHEVM_EXECUTOR_ADDRESS, HCU_LIMIT_ADDRESS} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextFHEVMExecutor, IHCULimit} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {LibForgeFhevmHCU} from "../../pkg/forge/src/LibForgeFhevmHCU.sol";
import {LocalHostBootstrap} from "../../pkg/forge/src/_internal/LocalHostBootstrap.sol";
import {FheType} from "../../pkg/forge/src/shared/LibFheType.sol";
import {HCULimit} from "../../pkg/src/contracts/HCULimit.sol";

/// A dApp that builds one long dependency chain in ONE call: `n` euint64 additions, each on the previous
/// result. The executor grants every result to its caller, so no ACL setup is needed. Each non-scalar
/// euint64 add costs 172_000 HCU of depth, so 30 of them pass the 5_000_000 depth cap and trip it.
contract DeepChain {
    ICleartextFHEVMExecutor private immutable EXECUTOR = ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS);

    function run(uint256 n) external returns (bytes32 h) {
        h = EXECUTOR.trivialEncrypt(1, FheType.Uint64);
        for (uint256 i = 0; i < n; i++) {
            h = EXECUTOR.fheAdd(h, h, 0x00);
        }
    }
}

/// The HCU caps, moved from a test as the ACL owner, in an order the contract's own invariant accepts.
contract LibForgeFhevmHCUTest is Test, ForgeFhevmDeploy {
    IHCULimit internal limit = IHCULimit(HCU_LIMIT_ADDRESS);
    DeepChain internal chain;

    /// Deep enough to exceed the depth cap, shallow enough to stay under the per-transaction cap (~6.9M of 20M).
    uint256 internal constant TOO_DEEP = 40;

    function setUp() public {
        deployLocalFhevm();
        chain = new DeepChain();
    }

    function test_theStackStartsAtItsBootstrapCaps() public view {
        assertEq(limit.getGlobalHCUCapPerBlock(), LocalHostBootstrap.HCU_CAP_PER_BLOCK);
        assertEq(limit.getMaxHCUPerTx(), LocalHostBootstrap.MAX_HCU_PER_TX);
        assertEq(limit.getMaxHCUDepthPerTx(), LocalHostBootstrap.MAX_HCU_DEPTH_PER_TX);
    }

    /// The guard this library exists to lift, proven live before it is lifted (rules 7.1).
    function test_aDeepChainTripsTheDepthCap() public {
        vm.expectRevert(HCULimit.HCUTransactionDepthLimitExceeded.selector);
        chain.run(TOO_DEEP);
    }

    /// Only the depth cap moves — to the transaction cap, where it can no longer bind on its own.
    function test_disableHCUDepthLimitLetsTheSameChainThroughAndKeepsTheOtherCaps() public {
        LibForgeFhevmHCU.disableHCUDepthLimit();

        assertEq(limit.getMaxHCUDepthPerTx(), LocalHostBootstrap.MAX_HCU_PER_TX, "depth == tx cap");
        assertEq(limit.getMaxHCUPerTx(), LocalHostBootstrap.MAX_HCU_PER_TX, "tx cap untouched");
        assertEq(limit.getGlobalHCUCapPerBlock(), LocalHostBootstrap.HCU_CAP_PER_BLOCK, "block cap untouched");

        assertTrue(chain.run(TOO_DEEP) != bytes32(0), "the depth cap no longer trips");
        // The transaction total still meters: a chain costing more than 20M in one call is still refused.
        vm.expectRevert();
        chain.run(TOO_DEEP * 3);
    }

    function test_disableHCULimitsLiftsEverything() public {
        LibForgeFhevmHCU.disableHCULimits();

        assertEq(limit.getMaxHCUDepthPerTx(), type(uint48).max);
        assertEq(limit.getMaxHCUPerTx(), type(uint48).max);
        assertEq(limit.getGlobalHCUCapPerBlock(), type(uint48).max);
        assertTrue(chain.run(TOO_DEEP * 3) != bytes32(0), "nothing meters any more");
    }

    /// Lowering goes depth → tx → block and raising block → tx → depth; `setCaps` must get both right.
    function test_setCapsLowersAndRaisesWithinTheInvariant() public {
        LibForgeFhevmHCU.setCaps(3_000_000, 2_000_000, 1_000_000);
        assertEq(limit.getGlobalHCUCapPerBlock(), 3_000_000);
        assertEq(limit.getMaxHCUPerTx(), 2_000_000);
        assertEq(limit.getMaxHCUDepthPerTx(), 1_000_000);

        LibForgeFhevmHCU.setCaps(30_000_000, 20_000_000, 10_000_000);
        assertEq(limit.getGlobalHCUCapPerBlock(), 30_000_000);
        assertEq(limit.getMaxHCUPerTx(), 20_000_000);
        assertEq(limit.getMaxHCUDepthPerTx(), 10_000_000);
    }

    /// A target that breaks the contract's own invariant is refused by the contract, by name.
    function test_RevertIf_TargetViolatesTheInvariant() public {
        vm.expectRevert(HCULimit.HCUPerBlockBelowMaxPerTx.selector);
        this.setCapsExternally(1_000_000, 2_000_000, 500_000);
    }

    function test_whitelistIsIdempotent() public {
        address dapp = makeAddr("dapp");
        assertFalse(limit.isBlockHCUWhitelisted(dapp));
        LibForgeFhevmHCU.whitelistForBlockCap(dapp);
        assertTrue(limit.isBlockHCUWhitelisted(dapp));
        LibForgeFhevmHCU.whitelistForBlockCap(dapp); // the contract would revert on a second add; the library does not
        assertTrue(limit.isBlockHCUWhitelisted(dapp));
    }

    /// External so `vm.expectRevert` has a call frame to catch.
    function setCapsExternally(uint48 perBlock, uint48 perTx, uint48 depth) external {
        LibForgeFhevmHCU.setCaps(perBlock, perTx, depth);
    }
}
