// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {TestFhevm, EncryptedInput} from "../../pkg/src/TestFhevm.sol";

import {Vault} from "../encrypt/Vault.sol";

/// One `decryptPublic` per encrypted type, and the `WithSignatures` twin beside it. The value goes
/// out through `encrypt*` and comes back through `decryptPublic` — same value, same width.
contract DecryptPublicTypesTest is TestFhevm {
    Vault internal vault;
    address internal alice;

    function setUp() public override {
        super.setUp();
        vault = new Vault();
        alice = makeAddr("alice");
    }

    function test_bool() public {
        EncryptedInput memory e = encryptValues(asBool(true), address(vault), alice);
        vm.prank(alice);
        vault.setEBool(e.externalEboolAt(0), e.inputProof);

        assertTrue(decryptPublic(vault.eBool()));
        (bool clear, bytes memory proof) = decryptPublicWithSignatures(vault.eBool());
        assertTrue(clear);
        assertGt(proof.length, 0);
    }

    function test_uint8() public {
        EncryptedInput memory e = encryptValues(asUint8(255), address(vault), alice);
        vm.prank(alice);
        vault.setEUint8(e.externalEuint8At(0), e.inputProof);

        assertEq(decryptPublic(vault.eUint8()), 255);
        (uint8 clear,) = decryptPublicWithSignatures(vault.eUint8());
        assertEq(clear, 255);
    }

    function test_uint16() public {
        EncryptedInput memory e = encryptValues(asUint16(65_535), address(vault), alice);
        vm.prank(alice);
        vault.setEUint16(e.externalEuint16At(0), e.inputProof);

        assertEq(decryptPublic(vault.eUint16()), 65_535);
        (uint16 clear,) = decryptPublicWithSignatures(vault.eUint16());
        assertEq(clear, 65_535);
    }

    function test_uint32() public {
        EncryptedInput memory e = encryptValues(asUint32(70_000), address(vault), alice);
        vm.prank(alice);
        vault.setEUint32(e.externalEuint32At(0), e.inputProof);

        assertEq(decryptPublic(vault.eUint32()), 70_000);
        (uint32 clear,) = decryptPublicWithSignatures(vault.eUint32());
        assertEq(clear, 70_000);
    }

    function test_uint64() public {
        EncryptedInput memory e = encryptValues(asUint64(1 << 40), address(vault), alice);
        vm.prank(alice);
        vault.setEUint64(e.externalEuint64At(0), e.inputProof);

        assertEq(decryptPublic(vault.eUint64()), 1 << 40);
        (uint64 clear,) = decryptPublicWithSignatures(vault.eUint64());
        assertEq(clear, 1 << 40);
    }

    function test_uint128() public {
        EncryptedInput memory e = encryptValues(asUint128(1e30), address(vault), alice);
        vm.prank(alice);
        vault.setEUint128(e.externalEuint128At(0), e.inputProof);

        assertEq(decryptPublic(vault.eUint128()), 1e30);
        (uint128 clear,) = decryptPublicWithSignatures(vault.eUint128());
        assertEq(clear, 1e30);
    }

    function test_uint256() public {
        EncryptedInput memory e = encryptValues(asUint256(type(uint256).max), address(vault), alice);
        vm.prank(alice);
        vault.setEUint256(e.externalEuint256At(0), e.inputProof);

        assertEq(decryptPublic(vault.eUint256()), type(uint256).max);
        (uint256 clear,) = decryptPublicWithSignatures(vault.eUint256());
        assertEq(clear, type(uint256).max);
    }

    function test_address() public {
        EncryptedInput memory e = encryptValues(asAddress(alice), address(vault), alice);
        vm.prank(alice);
        vault.setEAddress(e.externalEaddressAt(0), e.inputProof);

        assertEq(decryptPublic(vault.eAddress()), alice);
        (address clear,) = decryptPublicWithSignatures(vault.eAddress());
        assertEq(clear, alice);
    }
}
