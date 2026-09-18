// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {externalEuint16, externalEuint64} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm, EncryptedInput} from "../../pkg/src/TestFhevm.sol";

import {FHEVMPublicDecryptTestSuite4} from "./contracts/FHEVMPublicDecryptTestSuite4.sol";

/// Port of hardhat/v3/e2e/test/operators-public-decrypt/fhevmOperations54.ts.
///
///   fhevm.client.encryptValues({values:[a, b], ...})  -> encryptValues(asUint64(a), asUint16(b), ...)
///   fhevm.helpers.encryptUint16({value, ...})         -> encryptUint16(value, ...)
///   encrypted.encryptedValues[i]                      -> e.externalEuint16At(i), which checks the type
///   fhevm.helpers.decryptPublicUint64({euint64})      -> decryptPublic(euint64)
///
/// Every case is one operator over the cleartext host: encrypt the operands, run the op on chain, then
/// publicly decrypt the result the contract stored.
contract FHEVMPublicDecrypt54Test is TestFhevm {
    FHEVMPublicDecryptTestSuite4 internal suite;
    address internal alice;

    function setUp() public override {
        super.setUp();
        alice = makeAddr("alice");
        suite = new FHEVMPublicDecryptTestSuite4();
    }

    /// hardhat: 'test operator "max" overload (euint64, euint16) => euint64 test 1 (18446307955039574325, 45271)'
    function test_max_euint64_euint16_1() public {
        EncryptedInput memory e = encryptValues(asUint64(18446307955039574325), asUint16(45271), address(suite), alice);

        vm.prank(alice);
        suite.max_euint64_euint16(e.externalEuint64At(0), e.externalEuint16At(1), e.inputProof());

        assertEq(decryptPublic(suite.resEuint64()), 18446307955039574325);
    }

    /// hardhat: 'test operator "max" overload (euint64, euint16) => euint64 test 2 (45267, 45271)'
    function test_max_euint64_euint16_2() public {
        EncryptedInput memory e = encryptValues(asUint64(45267), asUint16(45271), address(suite), alice);

        vm.prank(alice);
        suite.max_euint64_euint16(e.externalEuint64At(0), e.externalEuint16At(1), e.inputProof());

        assertEq(decryptPublic(suite.resEuint64()), 45271);
    }

    /// hardhat: 'test operator "max" overload (euint64, euint16) => euint64 test 3 (45271, 45271)'
    function test_max_euint64_euint16_3() public {
        EncryptedInput memory e = encryptValues(asUint64(45271), asUint16(45271), address(suite), alice);

        vm.prank(alice);
        suite.max_euint64_euint16(e.externalEuint64At(0), e.externalEuint16At(1), e.inputProof());

        assertEq(decryptPublic(suite.resEuint64()), 45271);
    }

    /// hardhat: 'test operator "max" overload (euint64, euint16) => euint64 test 4 (45271, 45267)'
    function test_max_euint64_euint16_4() public {
        EncryptedInput memory e = encryptValues(asUint64(45271), asUint16(45267), address(suite), alice);

        vm.prank(alice);
        suite.max_euint64_euint16(e.externalEuint64At(0), e.externalEuint16At(1), e.inputProof());

        assertEq(decryptPublic(suite.resEuint64()), 45271);
    }

    /// hardhat: 'test operator "or" overload (euint8, euint8) => euint8 test 1 (213, 26)'
    function test_or_euint8_euint8_1() public {
        EncryptedInput memory e = encryptValues(asUint8(213), asUint8(26), address(suite), alice);

        vm.prank(alice);
        suite.or_euint8_euint8(e.externalEuint8At(0), e.externalEuint8At(1), e.inputProof());

        assertEq(decryptPublic(suite.resEuint8()), 223);
    }

    /// hardhat: 'test operator "or" overload (euint8, euint8) => euint8 test 2 (22, 26)'
    function test_or_euint8_euint8_2() public {
        EncryptedInput memory e = encryptValues(asUint8(22), asUint8(26), address(suite), alice);

        vm.prank(alice);
        suite.or_euint8_euint8(e.externalEuint8At(0), e.externalEuint8At(1), e.inputProof());

        assertEq(decryptPublic(suite.resEuint8()), 30);
    }

    /// hardhat: 'test operator "or" overload (euint8, euint8) => euint8 test 3 (26, 26)'
    function test_or_euint8_euint8_3() public {
        EncryptedInput memory e = encryptValues(asUint8(26), asUint8(26), address(suite), alice);

        vm.prank(alice);
        suite.or_euint8_euint8(e.externalEuint8At(0), e.externalEuint8At(1), e.inputProof());

        assertEq(decryptPublic(suite.resEuint8()), 26);
    }

    /// hardhat: 'test operator "or" overload (euint8, euint8) => euint8 test 4 (26, 22)'
    function test_or_euint8_euint8_4() public {
        EncryptedInput memory e = encryptValues(asUint8(26), asUint8(22), address(suite), alice);

        vm.prank(alice);
        suite.or_euint8_euint8(e.externalEuint8At(0), e.externalEuint8At(1), e.inputProof());

        assertEq(decryptPublic(suite.resEuint8()), 30);
    }

    /// hardhat: 'test operator "shr" overload (euint16, uint8) => euint16 test 1 (41810, 8)'
    function test_shr_euint16_uint8_1() public {
        (externalEuint16 v, bytes memory proof) = encryptUint16(41810, address(suite), alice);

        vm.prank(alice);
        suite.shr_euint16_uint8(v, 8, proof);

        assertEq(decryptPublic(suite.resEuint16()), 163);
    }

    /// hardhat: 'test operator "shr" overload (euint16, uint8) => euint16 test 2 (4, 8)'
    function test_shr_euint16_uint8_2() public {
        (externalEuint16 v, bytes memory proof) = encryptUint16(4, address(suite), alice);

        vm.prank(alice);
        suite.shr_euint16_uint8(v, 8, proof);

        assertEq(decryptPublic(suite.resEuint16()), 0);
    }

    /// hardhat: 'test operator "shr" overload (euint16, uint8) => euint16 test 3 (8, 8)'
    function test_shr_euint16_uint8_3() public {
        (externalEuint16 v, bytes memory proof) = encryptUint16(8, address(suite), alice);

        vm.prank(alice);
        suite.shr_euint16_uint8(v, 8, proof);

        assertEq(decryptPublic(suite.resEuint16()), 0);
    }

    /// hardhat: 'test operator "shr" overload (euint16, uint8) => euint16 test 4 (8, 4)'
    function test_shr_euint16_uint8_4() public {
        (externalEuint16 v, bytes memory proof) = encryptUint16(8, address(suite), alice);

        vm.prank(alice);
        suite.shr_euint16_uint8(v, 4, proof);

        assertEq(decryptPublic(suite.resEuint16()), 0);
    }

    /// hardhat: 'test operator "max" overload (uint64, euint64) => euint64 test 1 (18445863906332305427, 18443180247415512627)'
    function test_max_uint64_euint64_1() public {
        (externalEuint64 v, bytes memory proof) = encryptUint64(18443180247415512627, address(suite), alice);

        vm.prank(alice);
        suite.max_uint64_euint64(18445863906332305427, v, proof);

        assertEq(decryptPublic(suite.resEuint64()), 18445863906332305427);
    }

    /// hardhat: 'test operator "max" overload (uint64, euint64) => euint64 test 2 (18439875117400843375, 18439875117400843379)'
    function test_max_uint64_euint64_2() public {
        (externalEuint64 v, bytes memory proof) = encryptUint64(18439875117400843379, address(suite), alice);

        vm.prank(alice);
        suite.max_uint64_euint64(18439875117400843375, v, proof);

        assertEq(decryptPublic(suite.resEuint64()), 18439875117400843379);
    }

    /// hardhat: 'test operator "max" overload (uint64, euint64) => euint64 test 3 (18439875117400843379, 18439875117400843379)'
    function test_max_uint64_euint64_3() public {
        (externalEuint64 v, bytes memory proof) = encryptUint64(18439875117400843379, address(suite), alice);

        vm.prank(alice);
        suite.max_uint64_euint64(18439875117400843379, v, proof);

        assertEq(decryptPublic(suite.resEuint64()), 18439875117400843379);
    }

    /// hardhat: 'test operator "max" overload (uint64, euint64) => euint64 test 4 (18439875117400843379, 18439875117400843375)'
    function test_max_uint64_euint64_4() public {
        (externalEuint64 v, bytes memory proof) = encryptUint64(18439875117400843375, address(suite), alice);

        vm.prank(alice);
        suite.max_uint64_euint64(18439875117400843379, v, proof);

        assertEq(decryptPublic(suite.resEuint64()), 18439875117400843379);
    }

    /// hardhat: 'test operator "eq" overload (euint8, euint256) => ebool test 1 (34, 115792089237316195423570985008687907853269984665640564039457577752723022763875)'
    function test_eq_euint8_euint256_1() public {
        EncryptedInput memory e = encryptValues(
            asUint8(34),
            asUint256(115792089237316195423570985008687907853269984665640564039457577752723022763875),
            address(suite),
            alice
        );

        vm.prank(alice);
        suite.eq_euint8_euint256(e.externalEuint8At(0), e.externalEuint256At(1), e.inputProof());

        assertEq(decryptPublic(suite.resEbool()), false);
    }

    /// hardhat: 'test operator "eq" overload (euint8, euint256) => ebool test 2 (30, 34)'
    function test_eq_euint8_euint256_2() public {
        EncryptedInput memory e = encryptValues(asUint8(30), asUint256(34), address(suite), alice);

        vm.prank(alice);
        suite.eq_euint8_euint256(e.externalEuint8At(0), e.externalEuint256At(1), e.inputProof());

        assertEq(decryptPublic(suite.resEbool()), false);
    }

    /// hardhat: 'test operator "eq" overload (euint8, euint256) => ebool test 3 (34, 34)'
    function test_eq_euint8_euint256_3() public {
        EncryptedInput memory e = encryptValues(asUint8(34), asUint256(34), address(suite), alice);

        vm.prank(alice);
        suite.eq_euint8_euint256(e.externalEuint8At(0), e.externalEuint256At(1), e.inputProof());

        assertEq(decryptPublic(suite.resEbool()), true);
    }

    /// hardhat: 'test operator "eq" overload (euint8, euint256) => ebool test 4 (34, 30)'
    function test_eq_euint8_euint256_4() public {
        EncryptedInput memory e = encryptValues(asUint8(34), asUint256(30), address(suite), alice);

        vm.prank(alice);
        suite.eq_euint8_euint256(e.externalEuint8At(0), e.externalEuint256At(1), e.inputProof());

        assertEq(decryptPublic(suite.resEbool()), false);
    }

    /// hardhat: 'test operator "mul" overload (euint16, euint8) => euint16 test 1 (91, 2)'
    function test_mul_euint16_euint8_1() public {
        EncryptedInput memory e = encryptValues(asUint16(91), asUint8(2), address(suite), alice);

        vm.prank(alice);
        suite.mul_euint16_euint8(e.externalEuint16At(0), e.externalEuint8At(1), e.inputProof());

        assertEq(decryptPublic(suite.resEuint16()), 182);
    }

    /// hardhat: 'test operator "mul" overload (euint16, euint8) => euint16 test 2 (14, 16)'
    function test_mul_euint16_euint8_2() public {
        EncryptedInput memory e = encryptValues(asUint16(14), asUint8(16), address(suite), alice);

        vm.prank(alice);
        suite.mul_euint16_euint8(e.externalEuint16At(0), e.externalEuint8At(1), e.inputProof());

        assertEq(decryptPublic(suite.resEuint16()), 224);
    }

    /// hardhat: 'test operator "mul" overload (euint16, euint8) => euint16 test 3 (9, 9)'
    function test_mul_euint16_euint8_3() public {
        EncryptedInput memory e = encryptValues(asUint16(9), asUint8(9), address(suite), alice);

        vm.prank(alice);
        suite.mul_euint16_euint8(e.externalEuint16At(0), e.externalEuint8At(1), e.inputProof());

        assertEq(decryptPublic(suite.resEuint16()), 81);
    }

    /// hardhat: 'test operator "mul" overload (euint16, euint8) => euint16 test 4 (16, 14)'
    function test_mul_euint16_euint8_4() public {
        EncryptedInput memory e = encryptValues(asUint16(16), asUint8(14), address(suite), alice);

        vm.prank(alice);
        suite.mul_euint16_euint8(e.externalEuint16At(0), e.externalEuint8At(1), e.inputProof());

        assertEq(decryptPublic(suite.resEuint16()), 224);
    }
}
