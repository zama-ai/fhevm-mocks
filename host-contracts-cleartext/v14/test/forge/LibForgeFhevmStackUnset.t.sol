// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ForgeFhevmDeploy} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {
    ACL_ADDRESS,
    CLEARTEXT_ARITHMETIC_ADDRESS,
    CLEARTEXT_DB_ADDRESS,
    FHEVM_EXECUTOR_ADDRESS
} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextDB, ICleartextFHEVMExecutor} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {IACL} from "../../pkg/forge/src/_internal/interfaces/IACL.sol";
import {LibForgeFhevmStack} from "../../pkg/forge/src/LibForgeFhevmStack.sol";
import {FheType as PayloadFheType} from "../../pkg/forge/src/shared/LibFheType.sol";
import {FheType} from "../../pkg/src/cleartext/shared/LibFheType.sol";
import {CleartextForgeArithmetic} from "../../pkg/src/cleartext/CleartextForgeArithmetic.sol";

/**
 * MAKING A HANDLE UNKNOWN AGAIN, which the store has no function for.
 *
 * `CleartextDB.set` marks a handle written and nothing clears it, and `set(handle, 0)` would mean WORTH
 * ZERO rather than unknown. So `unsetCleartext` writes the store's slots directly -- and that is the one
 * thing in the payload that knows another contract's storage layout by heart.
 *
 * THIS FILE IS THE PRICE OF THAT. The derivation and the field order are checked against what the store
 * ACTUALLY DOES rather than against themselves: the test writes through `set`, then reads the slot the
 * library would write, and fails if they are not the same place. Field 1 is `writers`, so a layout that
 * shifted by one would make an unset zero a writer flag instead and the arithmetic would quietly lose its
 * access -- `test_theWriterFlagsAreNotInTheLineOfFire` is there for exactly that.
 */
contract LibForgeFhevmStackUnsetTest is Test, ForgeFhevmDeploy {
    CleartextForgeArithmetic internal arithmetic;
    address internal owner;

    /// @dev The metadata a handle carries in its low 11 bytes: index, chain id, type, version.
    uint256 private constant METADATA_MASK = (uint256(1) << 88) - 1;

    /// @dev Stated here INDEPENDENTLY of the library, from the namespace `CleartextDB` declares. A test
    ///      that imported the library's own constant would agree with it by construction and prove
    ///      nothing; this one agrees with the CONTRACT or fails.
    bytes32 private constant DB_ROOT =
        keccak256(abi.encode(uint256(keccak256("fhevm.storage.CleartextDB")) - 1)) & ~bytes32(uint256(0xff));

    function setUp() public {
        deployLocalFhevm();
        arithmetic = CleartextForgeArithmetic(CLEARTEXT_ARITHMETIC_ADDRESS);
        owner = IACL(ACL_ADDRESS).owner();
    }

    // -- 1. the slots this rests on are the slots the store uses -------------------------------------

    /**
     * THE TEST THAT MATTERS. Everything else here would still pass against a layout that had moved; this
     * one writes through the store's own `set` and then reads the two slots back out with `vm.load`. If
     * the namespace, the root formula or the field order ever change, it fails here -- where the message
     * says what happened -- rather than in a test that mysteriously stops unsetting anything.
     */
    function test_theDerivedSlotsAreWhereTheStoreActuallyWrites() public {
        bytes32 handle = _inheritedHandle(FheType.Uint64, 1);

        vm.prank(CLEARTEXT_ARITHMETIC_ADDRESS);
        ICleartextDB(CLEARTEXT_DB_ADDRESS).set(handle, 4242);

        assertEq(
            uint256(vm.load(CLEARTEXT_DB_ADDRESS, _slot(handle, 0))),
            4242,
            "field 0 must be `plaintexts`: the value the store just wrote is not where the library looks"
        );
        assertEq(
            uint256(vm.load(CLEARTEXT_DB_ADDRESS, _slot(handle, 2))),
            1,
            "field 2 must be `has`: the written flag is not where the library looks"
        );
    }

    /**
     * AND THE FIELD BESIDE THEM IS THE DANGEROUS ONE. `writers` is field 1, between the two the library
     * clears. A layout that shifted would send an unset into it, revoking the arithmetic's write access
     * -- a failure that would surface as the stack refusing to record anything, far from here.
     */
    function test_theWriterFlagsAreNotInTheLineOfFire() public {
        bytes32 handle = _inheritedHandle(FheType.Uint64, 2);
        bytes32 writerSlot = keccak256(abi.encode(CLEARTEXT_ARITHMETIC_ADDRESS, uint256(DB_ROOT) + 1));

        assertEq(uint256(vm.load(CLEARTEXT_DB_ADDRESS, writerSlot)), 1, "field 1 must be `writers`");
        assertTrue(writerSlot != _slot(handle, 0), "an unset must not touch the writer flags");
        assertTrue(writerSlot != _slot(handle, 2), "nor with its second write");

        LibForgeFhevmStack.unsetCleartext(FHEVM_EXECUTOR_ADDRESS, handle);

        assertTrue(ICleartextDB(CLEARTEXT_DB_ADDRESS).isWriter(CLEARTEXT_ARITHMETIC_ADDRESS), "still a writer");
    }

    // -- 2. what it does ------------------------------------------------------------------------------

    function test_aStatedValueIsForgotten() public {
        bytes32 handle = _inheritedHandle(FheType.Uint64, 3);

        LibForgeFhevmStack.seedCleartext(FHEVM_EXECUTOR_ADDRESS, handle, 7);
        assertTrue(ICleartextDB(CLEARTEXT_DB_ADDRESS).has(handle), "stated");

        LibForgeFhevmStack.unsetCleartext(FHEVM_EXECUTOR_ADDRESS, handle);
        assertFalse(ICleartextDB(CLEARTEXT_DB_ADDRESS).has(handle), "and forgotten -- not merely zeroed");
    }

    /// The point of forgetting it: the TYPE answers again, which is what "reset" has to mean.
    function test_theTypesPolicyAnswersAfterwards() public {
        bytes32 handle = _inheritedHandle(FheType.Uint64, 4);

        vm.prank(owner);
        arithmetic.setUnknownHandleDefault(FheType.Uint64, 999);
        LibForgeFhevmStack.seedCleartext(FHEVM_EXECUTOR_ADDRESS, handle, 7);
        assertEq(arithmetic.plaintexts(handle), 7, "the stated value wins while it is stated");

        LibForgeFhevmStack.unsetCleartext(FHEVM_EXECUTOR_ADDRESS, handle);
        assertEq(arithmetic.plaintexts(handle), 999, "and the default answers once it is not");
    }

    /// With no policy, back to refusing -- the state every type starts in.
    function test_withNoPolicyItRefusesAgain() public {
        bytes32 handle = _inheritedHandle(FheType.Uint32, 5);

        LibForgeFhevmStack.seedCleartext(FHEVM_EXECUTOR_ADDRESS, handle, 7);
        LibForgeFhevmStack.unsetCleartext(FHEVM_EXECUTOR_ADDRESS, handle);

        vm.expectRevert(
            abi.encodeWithSelector(
                CleartextForgeArithmetic.CleartextErrorUnknownHandle.selector, handle, FheType.Uint32
            )
        );
        arithmetic.plaintexts(handle);
    }

    function test_onlyTheHandleNamedIsForgotten() public {
        bytes32 kept = _inheritedHandle(FheType.Uint64, 6);
        bytes32 dropped = _inheritedHandle(FheType.Uint64, 7);

        LibForgeFhevmStack.seedCleartext(FHEVM_EXECUTOR_ADDRESS, kept, 11);
        LibForgeFhevmStack.seedCleartext(FHEVM_EXECUTOR_ADDRESS, dropped, 22);

        LibForgeFhevmStack.unsetCleartext(FHEVM_EXECUTOR_ADDRESS, dropped);

        assertEq(arithmetic.plaintexts(kept), 11, "its neighbour is untouched");
        assertFalse(ICleartextDB(CLEARTEXT_DB_ADDRESS).has(dropped), "and the named one is gone");
    }

    /// Forgetting something that was never stated is not an error: it is already the state being asked for.
    function test_forgettingAnUnstatedHandleIsANoOp() public {
        bytes32 handle = _inheritedHandle(FheType.Uint64, 8);

        LibForgeFhevmStack.unsetCleartext(FHEVM_EXECUTOR_ADDRESS, handle);
        assertFalse(ICleartextDB(CLEARTEXT_DB_ADDRESS).has(handle), "still unknown");
    }

    // -- 3. what it deliberately does NOT do ----------------------------------------------------------

    /**
     * A HANDLE THIS STACK COMPUTED DOES NOT FALL THROUGH TO THE POLICY. The HCU meter recorded the mint,
     * so losing the cleartext is a fault rather than a question: the stack made that value. Answering it
     * from a default would turn a missing operator into a plausible number, which is the whole reason
     * `CleartextErrorUnrecordedResult` exists.
     */
    function test_aHandleThisStackMintedReportsItselfInstead() public {
        bytes32 minted = ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS).trivialEncrypt(5, PayloadFheType.Uint64);

        vm.prank(owner);
        arithmetic.setUnknownHandleDefault(FheType.Uint64, 999);

        LibForgeFhevmStack.unsetCleartext(FHEVM_EXECUTOR_ADDRESS, minted);

        vm.expectRevert(
            abi.encodeWithSelector(
                CleartextForgeArithmetic.CleartextErrorUnrecordedResult.selector, minted, FheType.Uint64
            )
        );
        arithmetic.plaintexts(minted);
    }

    // -- helpers --------------------------------------------------------------------------------------

    /// @dev A well-formed handle of `fheType` that this stack never minted -- what a fork is full of.
    function _inheritedHandle(FheType fheType, uint8 salt) private returns (bytes32) {
        bytes32 minted =
            ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS).trivialEncrypt(0, PayloadFheType(uint8(fheType)));
        uint256 metadata = uint256(minted) & METADATA_MASK;
        uint256 entropy = uint256(keccak256(abi.encodePacked("inherited", fheType, salt))) & ~METADATA_MASK;
        return bytes32(entropy | metadata);
    }

    function _slot(bytes32 handle, uint256 field) private pure returns (bytes32) {
        return keccak256(abi.encode(handle, uint256(DB_ROOT) + field));
    }
}
