// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {FhevmDeploy} from "../pkg/forge/src/FhevmDeploy.sol";
import {CLEARTEXT_DB_ADDRESS, FHEVM_EXECUTOR_ADDRESS} from "../pkg/forge/src/FhevmDeploy.sol";
import {ICleartextDB} from "../pkg/forge/src/FhevmDeploy.sol";
import {ICleartextFHEVMExecutor} from "../pkg/forge/src/FhevmDeploy.sol";
import {FheType} from "../pkg/src/contracts/shared/FheType.sol";

/**
 * The v14 operator `fheMulDiv`, end to end: executor -> CleartextArithmetic -> CleartextDB.
 *
 * `(factor1 * factor2) / divisor` with a 256-bit intermediate, truncating division, and the result reduced
 * to the operand type — what the upstream mock coprocessor computes (`host-contracts/test/coprocessorUtils.ts`).
 * The cases mirror the canonical suite, `library-solidity/test/fhevmOperations/manual.ts`, plus the euint16
 * and euint32 variants; each names its upstream twin. Two cases are ours and are marked as such.
 *
 * The divisor is always plaintext. `scalarByte` is `0x01` when factor2 is encrypted and `0x03` when it is
 * a scalar; a zero divisor is refused by the vendored executor before any cleartext code runs.
 *
 * Foundry rather than test/ts for the reason `CleartextNaryOps.t.sol` gives: `trivialEncrypt` grants only
 * a transient allowance, so composing handles has to happen inside one transaction.
 */
contract CleartextMulDivTest is Test, FhevmDeploy {
    bytes1 internal constant FACTOR2_ENCRYPTED = 0x01;
    bytes1 internal constant FACTOR2_SCALAR = 0x03;

    ICleartextFHEVMExecutor internal executor;
    ICleartextDB internal db;

    function setUp() public {
        deployFhevm();
        executor = ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS);
        db = ICleartextDB(CLEARTEXT_DB_ADDRESS);
    }

    /// (a * b) / d with both factors encrypted.
    function _mulDivEnc(uint256 a, uint256 b, uint256 d, FheType t) internal returns (uint256) {
        bytes32 f1 = executor.trivialEncrypt(a, t);
        bytes32 f2 = executor.trivialEncrypt(b, t);
        return db.get(executor.fheMulDiv(f1, f2, bytes32(d), FACTOR2_ENCRYPTED));
    }

    /// (a * b) / d with `b` a scalar.
    function _mulDivScalar(uint256 a, uint256 b, uint256 d, FheType t) internal returns (uint256) {
        bytes32 f1 = executor.trivialEncrypt(a, t);
        return db.get(executor.fheMulDiv(f1, bytes32(b), bytes32(d), FACTOR2_SCALAR));
    }

    // -----------------------------------------------------------------------
    // Widening: the intermediate overflows the type, the result does not
    // -----------------------------------------------------------------------

    /// Upstream: mulDiv euint8 enc*enc: (200 * 200) / 200 = 200 (intermediate overflows uint8).
    function test_mulDiv_euint8_encEnc_widens() public {
        assertEq(_mulDivEnc(200, 200, 200, FheType.Uint8), 200);
    }

    /// Upstream: mulDiv euint8 enc*scalar: (50 * 3) / 5 = 30.
    function test_mulDiv_euint8_encScalar() public {
        assertEq(_mulDivScalar(50, 3, 5, FheType.Uint8), 30);
    }

    /// Ours (spec): euint16 enc*enc, (60000 * 60000) / 60000 = 60000 (intermediate overflows uint16).
    function test_mulDiv_euint16_encEnc_widens() public {
        assertEq(_mulDivEnc(60000, 60000, 60000, FheType.Uint16), 60000);
    }

    /// Ours (spec): euint16 enc*scalar, (1000 * 3) / 5 = 600.
    function test_mulDiv_euint16_encScalar() public {
        assertEq(_mulDivScalar(1000, 3, 5, FheType.Uint16), 600);
    }

    /// Ours (spec): euint32 enc*enc, (300000 * 300000) / 300000 = 300000 (intermediate overflows uint32).
    function test_mulDiv_euint32_encEnc_widens() public {
        assertEq(_mulDivEnc(300000, 300000, 300000, FheType.Uint32), 300000);
    }

    /// Ours (spec): euint32 enc*scalar, (1000000 * 3) / 5 = 600000.
    function test_mulDiv_euint32_encScalar() public {
        assertEq(_mulDivScalar(1000000, 3, 5, FheType.Uint32), 600000);
    }

    /// Upstream: mulDiv euint64 enc*enc: (10^10 * 10^10) / 10^10 = 10^10 (intermediate overflows uint64).
    function test_mulDiv_euint64_encEnc_widens() public {
        assertEq(_mulDivEnc(1e10, 1e10, 1e10, FheType.Uint64), 1e10);
    }

    /// Upstream: mulDiv euint64 enc*scalar: (10^9 * 3) / 5 = 6*10^8.
    function test_mulDiv_euint64_encScalar() public {
        assertEq(_mulDivScalar(1e9, 3, 5, FheType.Uint64), 6e8);
    }

    // -----------------------------------------------------------------------
    // Edge cases
    // -----------------------------------------------------------------------

    /// Upstream: mulDiv euint8 - division by zero reverts. The vendored executor refuses it; nothing is recorded.
    function test_mulDiv_divisionByZeroReverts() public {
        bytes32 f1 = executor.trivialEncrypt(100, FheType.Uint8);
        bytes32 f2 = executor.trivialEncrypt(100, FheType.Uint8);
        vm.expectRevert(abi.encodeWithSignature("DivisionByZero()"));
        executor.fheMulDiv(f1, f2, bytes32(0), FACTOR2_ENCRYPTED);
    }

    /// Upstream: mulDiv euint8 enc*enc: (0 * 100) / 50 = 0 (zero factor1).
    function test_mulDiv_euint8_zeroFactor1() public {
        assertEq(_mulDivEnc(0, 100, 50, FheType.Uint8), 0);
    }

    /// Ours (spec): euint8 enc*enc, (100 * 0) / 50 = 0 (zero factor2, encrypted).
    function test_mulDiv_euint8_zeroFactor2Encrypted() public {
        assertEq(_mulDivEnc(100, 0, 50, FheType.Uint8), 0);
    }

    /// Ours (spec): euint8 enc*scalar, (100 * 0) / 50 = 0 (zero factor2, scalar).
    function test_mulDiv_euint8_zeroFactor2Scalar() public {
        assertEq(_mulDivScalar(100, 0, 50, FheType.Uint8), 0);
    }

    /// Upstream: mulDiv euint8 enc*scalar: (7 * 3) / 4 = 5 (truncating division).
    function test_mulDiv_euint8_truncates() public {
        assertEq(_mulDivScalar(7, 3, 4, FheType.Uint8), 5);
    }

    /// Upstream: mulDiv euint8 enc*scalar: (1 * 1) / 2 = 0 (truncation to zero).
    function test_mulDiv_euint8_truncatesToZero() public {
        assertEq(_mulDivScalar(1, 1, 2, FheType.Uint8), 0);
    }

    /// Ours: the result wraps at the type width like every other operator — (255 * 255) / 1 = 65025 = 1 mod 256.
    function test_mulDiv_euint8_wrapsAtTheResultTypeBitWidth() public {
        assertEq(_mulDivScalar(255, 255, 1, FheType.Uint8), 1);
    }
}
