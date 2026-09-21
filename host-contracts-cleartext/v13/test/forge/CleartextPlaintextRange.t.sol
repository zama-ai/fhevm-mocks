// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ForgeFhevmDeploy} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {CLEARTEXT_DB_ADDRESS, FHEVM_EXECUTOR_ADDRESS} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextDB} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextFHEVMExecutor} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {FheType} from "../../pkg/forge/src/shared/LibFheType.sol";
import {FHEVMExecutor} from "../../pkg/src/contracts/FHEVMExecutor.sol";

/**
 * A PLAINTEXT asserts its own type: `trivialEncrypt(v, Uint8)` says "this is a uint8", and
 * `verifyInput` says the same of a proof's cleartext. One that is not — an `ebool` outside {0,1}, or a
 * value too wide for its type — is REFUSED rather than silently narrowed to a number the caller never
 * wrote.
 *
 * WHOSE REFUSAL. Since fhevm v0.13.6 the vendored `FHEVMExecutor.trivialEncrypt` checks the range
 * itself (`_checkScalarRange`) and reverts `ScalarOutOfRange()` before the cleartext layer runs, so
 * that is the error a caller sees — here exactly as on a real chain, which is what a mock is for. The
 * cleartext layer's own `_normalizePlaintextToType` still guards `verifyInput`, which upstream does
 * not gate, and would catch a regression upstream; it is simply no longer first on this path.
 *
 * ARITHMETIC is the opposite and stays modular: `euint8(200) + euint8(100)` really is 44 on the
 * coprocessor, so a mock that reverted would reject programs the real stack accepts.
 *
 * Scalar operands are the other exception and are not covered here: they are not declared boolean, so
 * `normalizeScalarToType` follows the coprocessor's own `arr_non_zero` rule instead.
 */
contract CleartextPlaintextRangeTest is Test, ForgeFhevmDeploy {
    ICleartextFHEVMExecutor internal executor;
    ICleartextDB internal db;

    function setUp() public {
        deployLocalFhevm();
        executor = ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS);
        db = ICleartextDB(CLEARTEXT_DB_ADDRESS);
    }

    function test_zeroAndOneAreAccepted() public {
        assertEq(db.get(executor.trivialEncrypt(0, FheType.Bool)), 0);
        assertEq(db.get(executor.trivialEncrypt(1, FheType.Bool)), 1);
    }

    function test_twoIsRefused() public {
        vm.expectRevert(FHEVMExecutor.ScalarOutOfRange.selector);
        executor.trivialEncrypt(2, FheType.Bool);
    }

    /// The old rule truncated to the low byte first, so 256 read as `false`. Now it is refused.
    function test_aValueWhoseLowByteIsZeroIsAlsoRefused() public {
        vm.expectRevert(FHEVMExecutor.ScalarOutOfRange.selector);
        executor.trivialEncrypt(256, FheType.Bool);
    }

    function test_theMaximumIsRefused() public {
        vm.expectRevert(FHEVMExecutor.ScalarOutOfRange.selector);
        executor.trivialEncrypt(type(uint256).max, FheType.Bool);
    }

    // -- Every other type: out of range is refused too -------------------------

    /// The widest value the type holds is fine.
    function test_theWidestValueForATypeIsAccepted() public {
        assertEq(db.get(executor.trivialEncrypt(255, FheType.Uint8)), 255);
        assertEq(db.get(executor.trivialEncrypt(65_535, FheType.Uint16)), 65_535);
        assertEq(db.get(executor.trivialEncrypt(type(uint256).max, FheType.Uint256)), type(uint256).max);
    }

    /// One over is not. It used to be clamped to 44, a number the caller never wrote.
    function test_oneOverTheTypeIsRefused() public {
        vm.expectRevert(FHEVMExecutor.ScalarOutOfRange.selector);
        executor.trivialEncrypt(256, FheType.Uint8);
    }

    function test_aWideValueForANarrowTypeIsRefused() public {
        vm.expectRevert(FHEVMExecutor.ScalarOutOfRange.selector);
        executor.trivialEncrypt(300, FheType.Uint8);
    }

    /// An address is 160 bits, so the type's own maximum is accepted and one more is not.
    function test_theAddressWidthIsExact() public {
        uint256 max160 = (uint256(1) << 160) - 1;
        assertEq(db.get(executor.trivialEncrypt(max160, FheType.Uint160)), max160);

        vm.expectRevert(FHEVMExecutor.ScalarOutOfRange.selector);
        executor.trivialEncrypt(max160 + 1, FheType.Uint160);
    }

    /// ARITHMETIC still wraps — the refusal is for plaintexts only, because real TFHE is modular.
    function test_arithmeticStillWraps() public {
        bytes32 a = executor.trivialEncrypt(200, FheType.Uint8);
        bytes32 b = executor.trivialEncrypt(100, FheType.Uint8);

        assertEq(db.get(executor.fheAdd(a, b, 0x00)), 44, "200 + 100 as euint8");
    }
}
