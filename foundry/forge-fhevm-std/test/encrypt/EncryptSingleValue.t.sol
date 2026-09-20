// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {
    externalEbool,
    externalEuint8,
    externalEuint16,
    externalEuint32,
    externalEuint64,
    externalEuint128,
    externalEuint256,
    externalEaddress
} from "encrypted-types/EncryptedTypes.sol";

import {StdFhevm} from "../../pkg/src/StdFhevm.sol";
import {Vault} from "./Vault.sol";

/// ONE value: `encryptUintN` hands back the typed handle and its proof directly, with no
/// `EncryptedInput` in between. This is the shortest path from a cleartext to a dApp call.
contract EncryptSingleValueTest is Test, StdFhevm {
    Vault internal vault;
    address internal alice;

    function setUp() public {
        vault = new Vault();
        alice = makeAddr("alice");
    }

    function test_encryptUint32() public {
        (externalEuint32 handle, bytes memory proof) = encryptUint32(7, address(vault), alice);

        vm.prank(alice);
        vault.setEUint32(handle, proof);

        assertEq(decryptPublic(vault.eUint32()), 7);
    }

    function test_encryptUint64() public {
        (externalEuint64 handle, bytes memory proof) = encryptUint64(1234567890123, address(vault), alice);

        vm.prank(alice);
        vault.setEUint64(handle, proof);

        assertEq(decryptPublic(vault.eUint64()), 1234567890123);
    }

    function test_encryptBool() public {
        (externalEbool handle, bytes memory proof) = encryptBool(true, address(vault), alice);
        vm.prank(alice);
        vault.setEBool(handle, proof);
        assertEq(decryptPublic(abi.encode(vault.eBool())), abi.encode(true));
    }

    function test_encryptUint8() public {
        (externalEuint8 handle, bytes memory proof) = encryptUint8(255, address(vault), alice);
        vm.prank(alice);
        vault.setEUint8(handle, proof);
        assertEq(decryptPublic(abi.encode(vault.eUint8())), abi.encode(uint8(255)));
    }

    function test_encryptUint16() public {
        (externalEuint16 handle, bytes memory proof) = encryptUint16(65_535, address(vault), alice);
        vm.prank(alice);
        vault.setEUint16(handle, proof);
        assertEq(decryptPublic(abi.encode(vault.eUint16())), abi.encode(uint16(65_535)));
    }

    function test_encryptUint128() public {
        (externalEuint128 handle, bytes memory proof) = encryptUint128(1e30, address(vault), alice);
        vm.prank(alice);
        vault.setEUint128(handle, proof);
        assertEq(decryptPublic(abi.encode(vault.eUint128())), abi.encode(uint128(1e30)));
    }

    function test_encryptUint256() public {
        (externalEuint256 handle, bytes memory proof) = encryptUint256(type(uint256).max, address(vault), alice);
        vm.prank(alice);
        vault.setEUint256(handle, proof);
        assertEq(decryptPublic(abi.encode(vault.eUint256())), abi.encode(type(uint256).max));
    }

    function test_encryptAddress() public {
        (externalEaddress handle, bytes memory proof) = encryptAddress(alice, address(vault), alice);
        vm.prank(alice);
        vault.setEAddress(handle, proof);
        assertEq(decryptPublic(abi.encode(vault.eAddress())), abi.encode(alice));
    }

    /// The proof is bound to ONE contract/user pair: nobody else may submit it.
    function test_theProofIsBoundToItsUser() public {
        (externalEuint32 handle, bytes memory proof) = encryptUint32(7, address(vault), alice);

        vm.prank(makeAddr("mallory"));
        vm.expectRevert();
        vault.setEUint32(handle, proof);
    }
}
