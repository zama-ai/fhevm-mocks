// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {FHEVMExecutor as Vendored} from "../../pkg/src/contracts/FHEVMExecutor.sol";
import {Operators} from "../../pkg/src/cleartext/shared/FhevmOperators.sol";

/// `cleartext/shared/FhevmOperators.sol` re-declares the vendored executor's operator list so the
/// cleartext layer need not import the executor itself. Two declarations of one list is only safe while
/// they agree, and they agree by POSITION, not by name: the wire carries a `uint8` and
/// `_computeBinaryOp` dispatches on equality. An upstream release inserting or reordering a member
/// would not fail to compile anywhere — it would map `fheAdd` onto `fheSub` and compute wrong answers
/// in silence. This suite is the only thing standing between that and a green run.
contract FhevmOperatorsTest is Test {
    /// Spelled out member by member, deliberately. A loop over indices would compare each position with
    /// itself and pass while the NAMES had shifted underneath, which is the failure being guarded.
    function test_everyOperatorHasTheSamePosition() public pure {
        assertEq(uint8(Operators.fheAdd), uint8(Vendored.Operators.fheAdd), "fheAdd");
        assertEq(uint8(Operators.fheSub), uint8(Vendored.Operators.fheSub), "fheSub");
        assertEq(uint8(Operators.fheMul), uint8(Vendored.Operators.fheMul), "fheMul");
        assertEq(uint8(Operators.fheDiv), uint8(Vendored.Operators.fheDiv), "fheDiv");
        assertEq(uint8(Operators.fheRem), uint8(Vendored.Operators.fheRem), "fheRem");
        assertEq(uint8(Operators.fheBitAnd), uint8(Vendored.Operators.fheBitAnd), "fheBitAnd");
        assertEq(uint8(Operators.fheBitOr), uint8(Vendored.Operators.fheBitOr), "fheBitOr");
        assertEq(uint8(Operators.fheBitXor), uint8(Vendored.Operators.fheBitXor), "fheBitXor");
        assertEq(uint8(Operators.fheShl), uint8(Vendored.Operators.fheShl), "fheShl");
        assertEq(uint8(Operators.fheShr), uint8(Vendored.Operators.fheShr), "fheShr");
        assertEq(uint8(Operators.fheRotl), uint8(Vendored.Operators.fheRotl), "fheRotl");
        assertEq(uint8(Operators.fheRotr), uint8(Vendored.Operators.fheRotr), "fheRotr");
        assertEq(uint8(Operators.fheEq), uint8(Vendored.Operators.fheEq), "fheEq");
        assertEq(uint8(Operators.fheNe), uint8(Vendored.Operators.fheNe), "fheNe");
        assertEq(uint8(Operators.fheGe), uint8(Vendored.Operators.fheGe), "fheGe");
        assertEq(uint8(Operators.fheGt), uint8(Vendored.Operators.fheGt), "fheGt");
        assertEq(uint8(Operators.fheLe), uint8(Vendored.Operators.fheLe), "fheLe");
        assertEq(uint8(Operators.fheLt), uint8(Vendored.Operators.fheLt), "fheLt");
        assertEq(uint8(Operators.fheMin), uint8(Vendored.Operators.fheMin), "fheMin");
        assertEq(uint8(Operators.fheMax), uint8(Vendored.Operators.fheMax), "fheMax");
        assertEq(uint8(Operators.fheNeg), uint8(Vendored.Operators.fheNeg), "fheNeg");
        assertEq(uint8(Operators.fheNot), uint8(Vendored.Operators.fheNot), "fheNot");
        assertEq(uint8(Operators.verifyInput), uint8(Vendored.Operators.verifyInput), "verifyInput");
        assertEq(uint8(Operators.cast), uint8(Vendored.Operators.cast), "cast");
        assertEq(uint8(Operators.trivialEncrypt), uint8(Vendored.Operators.trivialEncrypt), "trivialEncrypt");
        assertEq(uint8(Operators.fheIfThenElse), uint8(Vendored.Operators.fheIfThenElse), "fheIfThenElse");
        assertEq(uint8(Operators.fheRand), uint8(Vendored.Operators.fheRand), "fheRand");
        assertEq(uint8(Operators.fheRandBounded), uint8(Vendored.Operators.fheRandBounded), "fheRandBounded");
        assertEq(uint8(Operators.fheSum), uint8(Vendored.Operators.fheSum), "fheSum");
        assertEq(uint8(Operators.fheIsIn), uint8(Vendored.Operators.fheIsIn), "fheIsIn");
    }

    /// Catches an append on either side, which the per-member checks above cannot see.
    function test_neitherSideHasGrownAMember() public pure {
        assertEq(uint8(type(Operators).max), uint8(type(Vendored.Operators).max), "member count");
        assertEq(uint8(type(Operators).max), 29, "and the count is the one this file was written against");
    }
}
