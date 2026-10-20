// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {fhevm} from "../../pkg/src/FhevmVm.sol";
import {ForkBlocks} from "../shared/ForkBlocks.sol";

interface IFHETest {
    function getEuint32Of(address account) external view returns (euint32);
}

/**
 * `resetForkUnknown` ON A FORK, which is the only place it means anything.
 *
 * @dev WHY THE LOCAL TESTS ARE NOT ENOUGH. `LibForgeFhevmStackUnset.t.sol` proves the storage arithmetic
 *      against the stack this package deploys: the derived slots, the field order, the policy taking over.
 *      None of that touches the cheat, and none of it forks. On a fork the store is a DIFFERENT contract
 *      -- `upgradeToCleartext` deploys a fresh `CleartextDB` proxy for every fork, and the library finds
 *      it by asking the executor for its arithmetic and the arithmetic for its store. A mistake there
 *      would write zeros into some other account and look exactly like a no-op.
 *
 * @dev SO THIS ASKS THE STACK, not the storage. It states a value for a handle the chain was already
 *      holding, reads it back through the stack, takes the statement away, and reads again -- first with
 *      a type default in place, then with none. What the stack answers is the only evidence that the
 *      write landed in the store the stack actually consults.
 *
 *          SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com forge test --match-contract ForkResetUnknown
 */
contract ForkResetUnknownTest is TestFhevm {
    IFHETest internal constant FHE_TEST = IFHETest(0x6Bc47f6A33c0E04235f79e1Fc9A3cCD6e7Bbb5fc);

    /// @dev An account already holding a euint32 on the real chain, minted long before any cleartext layer.
    address internal constant SENDER = 0x37AC010c1c566696326813b840319B58Bb5840E4;

    FhevmChain internal sepolia;
    uint256 internal blockA;
    bool internal forked;

    function setUp() public override {
        if (!ForkBlocks.enabled("sepolia")) return;
        sepolia = getFhevmChain("testnet", "sepolia");
        blockA = ForkBlocks.recent(sepolia.rpcUrl);
        forked = true;
    }

    /// THE ROUND TRIP, through the stack's own answer: stated, read, taken back, and the TYPE answers.
    function test_theTypesDefaultTakesOverOnceTheStatementIsGone() public {
        vm.skip(!forked);
        fhevm.createSelectFork(sepolia, blockA);

        euint32 inherited = FHE_TEST.getEuint32Of(SENDER);

        forkUnknownDefaultEuint32(777);
        forkUnknown(inherited, 1000);
        assertEq(decryptPublic(inherited), 1000, "the statement wins while it stands");

        resetForkUnknown(inherited);
        assertEq(decryptPublic(inherited), 777, "and the type answers once it does not");
    }

    /// With no policy behind it, the handle is genuinely unknown again rather than quietly zero.
    function test_withNoPolicyTheHandleIsUnknownAgain() public {
        vm.skip(!forked);
        fhevm.createSelectFork(sepolia, blockA);

        euint32 inherited = FHE_TEST.getEuint32Of(SENDER);

        forkUnknown(inherited, 1000);
        assertEq(decryptPublic(inherited), 1000, "stated");

        resetForkUnknown(inherited);
        vm.expectRevert();
        this.decryptPublicExternally(inherited);
    }

    /**
     * EACH FORK HAS ITS OWN STORE, and this is what proves the library finds the right one. Both forks
     * are upgraded independently and each gets a `CleartextDB` of its own, so a reset on the second must
     * leave the first exactly as it was. A library that resolved the store once, or cached it, would pass
     * every local test in this repository and fail here.
     */
    function test_aResetOnOneForkLeavesTheOtherAlone() public {
        vm.skip(!forked);

        uint256 forkA = fhevm.createSelectFork(sepolia, blockA);
        euint32 onA = FHE_TEST.getEuint32Of(SENDER);
        forkUnknown(onA, 1000);
        assertEq(decryptPublic(onA), 1000, "stated on A");

        uint256 forkB = fhevm.createSelectFork(sepolia, blockA - 1024);
        assertTrue(forkB != forkA, "two forks, not one");

        euint32 onB = FHE_TEST.getEuint32Of(SENDER);
        forkUnknown(onB, 2000);
        assertEq(decryptPublic(onB), 2000, "stated on B");

        resetForkUnknown(onB);
        // THE HALF THAT CATCHES A MISDIRECTED WRITE: B must have CHANGED. Asserting only that A is
        // untouched passes for a reset that did nothing at all, which is the failure this is here for.
        vm.expectRevert();
        this.decryptPublicExternally(onB);

        fhevm.selectFork(forkA);
        assertEq(decryptPublic(onA), 1000, "and A never heard about it");
    }

    /// External so `vm.expectRevert` has a call frame to catch.
    function decryptPublicExternally(euint32 value) external returns (uint32) {
        return decryptPublic(value);
    }
}
