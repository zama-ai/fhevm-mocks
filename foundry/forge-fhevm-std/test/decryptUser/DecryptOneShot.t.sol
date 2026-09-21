// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint8, externalEbool, externalEuint8, externalEaddress} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm, EncryptedInput} from "../../pkg/src/TestFhevm.sol";

import {UserVault} from "./UserVault.sol";

/// The three-argument `decrypt`: no keypair, no permit, just the reader's key.
contract DecryptOneShotTest is TestFhevm {
    UserVault internal vault;
    address internal alice;
    uint256 internal aliceKey;

    function setUp() public override {
        super.setUp();
        vault = new UserVault();
        (alice, aliceKey) = makeAddrAndKey("alice");
    }

    function test_oneCallReadsTheValue() public {
        EncryptedInput memory e = encryptValues(tvUint32(70_000), address(vault), alice);
        vm.prank(alice);
        vault.setEUint32(e.externalEuint32At(0), e.inputProof(), alice);

        assertEq(decrypt(vault.eUint32(), address(vault), aliceKey), 70_000);
    }

    /// Every encrypted type has the same three-argument form. Handles come from the typed accessors,
    /// which check each one against the type the handle itself carries.
    function test_everyTypeHasTheShortFormViaTypedAccessors() public {
        EncryptedInput memory e = encryptValues(tvBool(true), tvUint8(255), tvAddress(alice), address(vault), alice);

        vm.startPrank(alice);
        vault.setEBool(e.externalEboolAt(0), e.inputProof(), alice);
        vault.setEUint8(e.externalEuint8At(1), e.inputProof(), alice);
        vault.setEAddress(e.externalEaddressAt(2), e.inputProof(), alice);
        vm.stopPrank();

        assertTrue(decrypt(vault.eBool(), address(vault), aliceKey));
        assertEq(decrypt(vault.eUint8(), address(vault), aliceKey), 255);
        assertEq(decrypt(vault.eAddress(), address(vault), aliceKey), alice);
    }

    /// The same three reads, with the handles taken from the ABI blob instead — `abi.decode` restates
    /// the types rather than checking them, so this is the unchecked route to the same values. Both
    /// ways of unpacking an `EncryptedInput` feed the short form identically.
    function test_everyTypeHasTheShortFormViaTheAbiBlob() public {
        EncryptedInput memory e = encryptValues(tvBool(true), tvUint8(255), tvAddress(alice), address(vault), alice);
        (externalEbool extBool, externalEuint8 extUint8, externalEaddress extAddr) =
            abi.decode(e.abiEncoded(), (externalEbool, externalEuint8, externalEaddress));

        vm.startPrank(alice);
        vault.setEBool(extBool, e.inputProof(), alice);
        vault.setEUint8(extUint8, e.inputProof(), alice);
        vault.setEAddress(extAddr, e.inputProof(), alice);
        vm.stopPrank();

        assertTrue(decrypt(vault.eBool(), address(vault), aliceKey));
        assertEq(decrypt(vault.eUint8(), address(vault), aliceKey), 255);
        assertEq(decrypt(vault.eAddress(), address(vault), aliceKey), alice);
    }

    /// Each call mints its own permit, so repeated reads are independent rather than shared.
    function test_eachCallSignsItsOwnPermit() public {
        EncryptedInput memory e = encryptValues(tvUint8(42), address(vault), alice);
        vm.prank(alice);
        vault.setEUint8(e.externalEuint8At(0), e.inputProof(), alice);

        assertEq(decrypt(vault.eUint8(), address(vault), aliceKey), 42);
        assertEq(decrypt(vault.eUint8(), address(vault), aliceKey), 42);
    }

    /// The permit it signs covers only the contract given, and names the key's own account.
    function test_theReaderMustOwnTheAccess() public {
        (, uint256 bobKey) = makeAddrAndKey("bob");

        EncryptedInput memory e = encryptValues(tvUint8(42), address(vault), alice);
        vm.prank(alice);
        vault.setEUint8(e.externalEuint8At(0), e.inputProof(), alice);

        // `vault.eUint8()` is itself an external call, so read it BEFORE arming `expectRevert`.
        euint8 value = vault.eUint8();

        vm.expectRevert();
        this.decryptAsBob(value, bobKey);
    }

    /// External so that `vm.expectRevert` has a call frame to catch.
    function decryptAsBob(euint8 v, uint256 key) external returns (uint8) {
        return decrypt(v, address(vault), key);
    }
}
