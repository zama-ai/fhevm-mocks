// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {TestFhevm, SignedDecryptionPermit, TransportKeypair, EncryptedInput} from "../../pkg/src/TestFhevm.sol";

import {UserVault} from "./UserVault.sol";

/// One `decrypt*` per encrypted type, all narrowing the same `_decryptValue`. The value goes out
/// through `encrypt*` and comes back through a user decryption — same value, same width.
contract DecryptUserTypesTest is TestFhevm {
    UserVault internal vault;
    address internal alice;
    uint256 internal aliceKey;
    TransportKeypair internal keypair;
    address[] internal contracts;

    function setUp() public override {
        super.setUp();
        vault = new UserVault();
        (alice, aliceKey) = makeAddrAndKey("alice");
        keypair = generateTransportKeypair();
        contracts.push(address(vault));
    }

    function _permit() private returns (SignedDecryptionPermit memory) {
        return signLegacyDecryptionPermit(aliceKey, keypair, contracts, block.timestamp, 7 days);
    }

    function test_bool() public {
        EncryptedInput memory e = encryptValues(tvBool(true), address(vault), alice);
        vm.prank(alice);
        vault.setEBool(e.externalEboolAt(0), e.inputProof(), alice);

        assertTrue(decrypt(vault.eBool(), address(vault), keypair, _permit()));
    }

    function test_uint8() public {
        EncryptedInput memory e = encryptValues(tvUint8(255), address(vault), alice);
        vm.prank(alice);
        vault.setEUint8(e.externalEuint8At(0), e.inputProof(), alice);

        assertEq(decrypt(vault.eUint8(), address(vault), keypair, _permit()), 255);
    }

    function test_uint16() public {
        EncryptedInput memory e = encryptValues(tvUint16(65_535), address(vault), alice);
        vm.prank(alice);
        vault.setEUint16(e.externalEuint16At(0), e.inputProof(), alice);

        assertEq(decrypt(vault.eUint16(), address(vault), keypair, _permit()), 65_535);
    }

    function test_uint32() public {
        EncryptedInput memory e = encryptValues(tvUint32(70_000), address(vault), alice);
        vm.prank(alice);
        vault.setEUint32(e.externalEuint32At(0), e.inputProof(), alice);

        assertEq(decrypt(vault.eUint32(), address(vault), keypair, _permit()), 70_000);
    }

    function test_uint64() public {
        EncryptedInput memory e = encryptValues(tvUint64(1 << 40), address(vault), alice);
        vm.prank(alice);
        vault.setEUint64(e.externalEuint64At(0), e.inputProof(), alice);

        assertEq(decrypt(vault.eUint64(), address(vault), keypair, _permit()), 1 << 40);
    }

    function test_uint128() public {
        EncryptedInput memory e = encryptValues(tvUint128(1e30), address(vault), alice);
        vm.prank(alice);
        vault.setEUint128(e.externalEuint128At(0), e.inputProof(), alice);

        assertEq(decrypt(vault.eUint128(), address(vault), keypair, _permit()), 1e30);
    }

    function test_uint256() public {
        EncryptedInput memory e = encryptValues(tvUint256(type(uint256).max), address(vault), alice);
        vm.prank(alice);
        vault.setEUint256(e.externalEuint256At(0), e.inputProof(), alice);

        assertEq(decrypt(vault.eUint256(), address(vault), keypair, _permit()), type(uint256).max);
    }

    /// The narrowing matters here: the mask is a full word, so an address must come back truncated.
    function test_address() public {
        EncryptedInput memory e = encryptValues(tvAddress(alice), address(vault), alice);
        vm.prank(alice);
        vault.setEAddress(e.externalEaddressAt(0), e.inputProof(), alice);

        assertEq(decrypt(vault.eAddress(), address(vault), keypair, _permit()), alice);
    }
}
