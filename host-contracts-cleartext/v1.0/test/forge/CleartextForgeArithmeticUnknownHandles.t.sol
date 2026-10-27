// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ForgeFhevmDeploy} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {
    ACL_ADDRESS,
    CLEARTEXT_ARITHMETIC_ADDRESS,
    FHEVM_EXECUTOR_ADDRESS
} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextFHEVMExecutor} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {IACL} from "../../pkg/forge/src/_internal/interfaces/IACL.sol";
// TWO ENUMS, one per side of the payload boundary: the executor is reached through the payload's
// interface, the arithmetic is the contract itself. Same members in the same order, distinct types.
import {FheType as PayloadFheType} from "../../pkg/forge/src/shared/LibFheType.sol";
import {FheType} from "../../pkg/src/cleartext/shared/LibFheType.sol";
import {ACLOwnable} from "../../pkg/src/contracts/shared/ACLOwnable.sol";
import {CleartextArithmeticBase} from "../../pkg/src/cleartext/shared/CleartextArithmeticBase.sol";
import {CleartextForgeArithmetic} from "../../pkg/src/cleartext/CleartextForgeArithmetic.sol";

/**
 * WHAT THIS STACK ANSWERS FOR A HANDLE IT NEVER MINTED.
 *
 * On a local stack the question never arises -- everything was minted here. On a FORK it is the normal
 * case, and it cannot be answered by the SDK: when a dApp computes with an old handle, the operand is read
 * inside the stack with no test code in the frame. So the policy lives here, and this file is what pins it.
 *
 * THE ORDER IS THE WHOLE POINT, so each step is tested against the one below it: a stored value beats a
 * default, a default beats the derivation, and with none of them set it refuses rather than inventing a
 * zero. `test_aStoredValueBeatsEveryPolicy` is the one that matters most -- a policy that could override a
 * seeded value would quietly corrupt a fuzz run.
 */
contract CleartextForgeArithmeticUnknownHandlesTest is Test, ForgeFhevmDeploy {
    CleartextForgeArithmetic internal arithmetic;
    address internal owner;

    /// @dev The metadata a handle carries in its low 11 bytes: index, chain id, type, version.
    uint256 private constant METADATA_MASK = (uint256(1) << 88) - 1;

    function setUp() public {
        deployLocalFhevm();
        arithmetic = CleartextForgeArithmetic(CLEARTEXT_ARITHMETIC_ADDRESS);
        owner = IACL(ACL_ADDRESS).owner();
    }

    // -- 1. a stored value wins ---------------------------------------------------------------------

    function test_aStoredValueBeatsEveryPolicy() public {
        bytes32 known = ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS).trivialEncrypt(7, PayloadFheType.Uint32);

        vm.prank(owner);
        arithmetic.setUnknownHandleDefault(FheType.Uint32, 999);
        assertEq(arithmetic.plaintexts(known), 7, "the minted value, not the default");

        vm.prank(owner);
        arithmetic.setUnknownHandleFromHandle(FheType.Uint32);
        assertEq(arithmetic.plaintexts(known), 7, "nor the derivation");
    }

    // -- 2. defaults are per type -------------------------------------------------------------------

    function test_everyTypeCarriesItsOwnDefault() public {
        bytes32 small = _unknownHandleOf(FheType.Uint8, 1);
        bytes32 wide = _unknownHandleOf(FheType.Uint64, 2);

        vm.startPrank(owner);
        arithmetic.setUnknownHandleDefault(FheType.Uint8, 3);
        arithmetic.setUnknownHandleDefault(FheType.Uint64, 1 << 40);
        vm.stopPrank();

        assertEq(arithmetic.plaintexts(small), 3, "the uint8 default");
        assertEq(arithmetic.plaintexts(wide), 1 << 40, "and the uint64 one, independently");
    }

    /// A type nobody configured still refuses, even while its neighbours answer.
    function test_aTypeWithNoPolicyStillRefuses() public {
        vm.prank(owner);
        arithmetic.setUnknownHandleDefault(FheType.Uint8, 3);

        bytes32 unconfigured = _unknownHandleOf(FheType.Uint32, 3);
        vm.expectRevert(
            abi.encodeWithSelector(
                CleartextForgeArithmetic.CleartextErrorUnknownHandle.selector, unconfigured, FheType.Uint32
            )
        );
        arithmetic.plaintexts(unconfigured);
    }

    // -- 3. derived from the handle -------------------------------------------------------------------

    function test_theDerivationIsKeccakOfTheHandle() public {
        bytes32 handle = _unknownHandleOf(FheType.Uint32, 4);
        vm.prank(owner);
        arithmetic.setUnknownHandleFromHandle(FheType.Uint32);

        uint256 expected = uint256(keccak256(abi.encodePacked(handle))) & type(uint32).max;
        assertEq(arithmetic.plaintexts(handle), expected, "keccak of the handle, cut to the type");
        assertEq(arithmetic.derivedValueFor(handle), expected, "and the getter agrees");
    }

    /// The reason it is keccak and not the handle's own bytes: those are mostly metadata, identical
    /// across handles of a type, so two handles would derive the same value.
    function test_twoHandlesOfOneTypeDeriveDifferentValues() public {
        bytes32 first = _unknownHandleOf(FheType.Uint32, 5);
        bytes32 second = _unknownHandleOf(FheType.Uint32, 6);
        vm.prank(owner);
        arithmetic.setUnknownHandleFromHandle(FheType.Uint32);

        assertTrue(arithmetic.plaintexts(first) != arithmetic.plaintexts(second), "not collapsed to one value");
    }

    function test_everyDerivedValueFitsItsType() public {
        vm.startPrank(owner);
        arithmetic.setUnknownHandleFromHandle(FheType.Bool);
        arithmetic.setUnknownHandleFromHandle(FheType.Uint8);
        arithmetic.setUnknownHandleFromHandle(FheType.Uint32);
        vm.stopPrank();

        for (uint8 i = 0; i < 8; i++) {
            uint256 boolean = arithmetic.plaintexts(_unknownHandleOf(FheType.Bool, i));
            assertTrue(boolean == 0 || boolean == 1, "a bool is one bit, not a truncation");
            assertLe(arithmetic.plaintexts(_unknownHandleOf(FheType.Uint8, i)), type(uint8).max, "uint8");
            assertLe(arithmetic.plaintexts(_unknownHandleOf(FheType.Uint32, i)), type(uint32).max, "uint32");
        }
    }

    /// Deterministic, which is what makes a failing run reproducible.
    function test_theDerivationIsStable() public {
        bytes32 handle = _unknownHandleOf(FheType.Uint32, 7);
        vm.prank(owner);
        arithmetic.setUnknownHandleFromHandle(FheType.Uint32);
        assertEq(arithmetic.plaintexts(handle), arithmetic.plaintexts(handle), "same answer twice");
    }

    // -- 4. otherwise it refuses ----------------------------------------------------------------------

    function test_RevertIf_nothingSaysWhatAnUnknownHandleIs() public {
        bytes32 handle = _unknownHandleOf(FheType.Uint32, 8);
        vm.expectRevert(
            abi.encodeWithSelector(
                CleartextForgeArithmetic.CleartextErrorUnknownHandle.selector, handle, FheType.Uint32
            )
        );
        arithmetic.plaintexts(handle);
    }

    function test_clearingAPolicyBringsTheRefusalBack() public {
        bytes32 handle = _unknownHandleOf(FheType.Uint32, 9);

        vm.prank(owner);
        arithmetic.setUnknownHandleDefault(FheType.Uint32, 42);
        assertEq(arithmetic.plaintexts(handle), 42);

        vm.prank(owner);
        arithmetic.clearUnknownHandlePolicy(FheType.Uint32);
        vm.expectRevert(
            abi.encodeWithSelector(
                CleartextForgeArithmetic.CleartextErrorUnknownHandle.selector, handle, FheType.Uint32
            )
        );
        arithmetic.plaintexts(handle);
    }

    // -- a default has to fit the type it is set against ---------------------------------------------

    /**
     * REFUSED WHEN IT IS SET, not truncated when it is read. This is the whole argument for per-type
     * defaults: the global one the event processor carries clamps a fixed value to each handle's width,
     * so one number set as an address reads back as its last byte for every `euint8` -- a value nobody
     * chose and nothing reported.
     */
    function test_RevertIf_aDefaultDoesNotFitItsType() public {
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(CleartextArithmeticBase.CleartextErrorPlaintextTooWide.selector, 300, FheType.Uint8)
        );
        arithmetic.setUnknownHandleDefault(FheType.Uint8, 300);
    }

    /// A bool is 0 or 1; 2 is a malformed value rather than one to fold into `true`.
    function test_RevertIf_aBooleanDefaultIsNotABoolean() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(CleartextArithmeticBase.CleartextErrorNotABoolean.selector, 2));
        arithmetic.setUnknownHandleDefault(FheType.Bool, 2);
    }

    /// And the widest value each type does admit is accepted, so the check is a boundary and not a veto.
    function test_theLargestValueOfATypeIsAccepted() public {
        vm.startPrank(owner);
        arithmetic.setUnknownHandleDefault(FheType.Uint8, type(uint8).max);
        arithmetic.setUnknownHandleDefault(FheType.Bool, 1);
        vm.stopPrank();

        assertEq(arithmetic.plaintexts(_unknownHandleOf(FheType.Uint8, 20)), type(uint8).max, "uint8 max");
        assertEq(arithmetic.plaintexts(_unknownHandleOf(FheType.Bool, 21)), 1, "true");
    }

    // -- who may set it -------------------------------------------------------------------------------

    function test_RevertIf_someoneElseSetsThePolicy() public {
        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ACLOwnable.NotHostOwner.selector, stranger));
        arithmetic.setUnknownHandleDefault(FheType.Uint32, 1);
    }

    function test_thePolicyIsReadableBack() public {
        vm.prank(owner);
        arithmetic.setUnknownHandleDefault(FheType.Uint16, 5);

        (CleartextForgeArithmetic.UnknownHandlePolicy policy, uint256 value) =
            arithmetic.unknownHandlePolicy(FheType.Uint16);
        assertEq(uint8(policy), uint8(CleartextForgeArithmetic.UnknownHandlePolicy.Fixed), "fixed");
        assertEq(value, 5, "and the value it answers");
    }

    // -- helper ---------------------------------------------------------------------------------------

    /// @dev A well-formed handle of `fheType` that this stack never minted: a real handle's metadata --
    ///      chain id, type, version, which `_checkHandleChainId` and `typeOf` read -- with fresh entropy
    ///      in the 21 bytes above it.
    function _unknownHandleOf(FheType fheType, uint8 salt) private returns (bytes32) {
        bytes32 minted =
            ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS).trivialEncrypt(0, PayloadFheType(uint8(fheType)));
        uint256 metadata = uint256(minted) & METADATA_MASK;
        uint256 entropy = uint256(keccak256(abi.encodePacked("unknown", fheType, salt))) & ~METADATA_MASK;
        return bytes32(entropy | metadata);
    }
}
