// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    TestFhevm,
    EncryptedInput,
    Plaintexts,
    TransportKeypair,
    SignedDecryptionPermit
} from "../../pkg/src/TestFhevm.sol";
import {LibPlaintexts} from "../../pkg/src/LibPlaintexts.sol";

import {UserVault} from "./UserVault.sol";

/// The batch decrypt: `abi.encode(eA, eB, ...)` in, a `Plaintexts` out.
contract DecryptBatchTest is TestFhevm {
    UserVault internal vault;
    address internal alice;
    uint256 internal aliceKey;

    function setUp() public override {
        super.setUp();
        vault = new UserVault();
        (alice, aliceKey) = makeAddrAndKey("alice");

        EncryptedInput memory e = encryptValues(asUint8(255), asUint32(70_000), asAddress(alice), address(vault), alice);
        vm.startPrank(alice);
        vault.setEUint8(e.externalEuint8At(0), e.inputProof(), alice);
        vault.setEUint32(e.externalEuint32At(1), e.inputProof(), alice);
        vault.setEAddress(e.externalEaddressAt(2), e.inputProof(), alice);
        vm.stopPrank();
    }

    function _handles() private view returns (bytes memory) {
        return abi.encode(vault.eUint8(), vault.eUint32(), vault.eAddress());
    }

    /// The checked accessors, each verifying the handle's type before narrowing.
    function test_theTypedAccessorsRead() public {
        Plaintexts memory d = decrypt(_handles(), address(vault), aliceKey);

        assertEq(d.length(), 3);
        assertEq(d.uint8At(0), 255);
        assertEq(d.uint32At(1), 70_000);
        assertEq(d.addressAt(2), alice);
    }

    /// The handles travel back, so each value can name its own type.
    function test_typeNamesComeFromTheHandles() public {
        Plaintexts memory d = decrypt(_handles(), address(vault), aliceKey);

        assertEq(d.typeNameAt(0), "euint8");
        assertEq(d.typeNameAt(1), "euint32");
        assertEq(d.typeNameAt(2), "eaddress");
    }

    /// The ABI blob, restating the types rather than checking them.
    function test_theAbiBlobDecodesAtItsOwnWidths() public {
        Plaintexts memory d = decrypt(_handles(), address(vault), aliceKey);

        (uint8 a, uint32 b, address c) = abi.decode(d.abiEncoded(), (uint8, uint32, address));
        assertEq(a, 255);
        assertEq(b, 70_000);
        assertEq(c, alice);
    }

    /// Asking for the wrong type is caught here, not silently truncated.
    function test_theWrongAccessorReverts() public {
        Plaintexts memory d = decrypt(_handles(), address(vault), aliceKey);

        vm.expectRevert(abi.encodeWithSelector(LibPlaintexts.TypeMismatch.selector, 1, "euint8", "euint32"));
        this.readAsUint8(d, 1);
    }

    function test_readingPastTheEndReverts() public {
        Plaintexts memory d = decrypt(_handles(), address(vault), aliceKey);

        vm.expectRevert(abi.encodeWithSelector(LibPlaintexts.IndexOutOfBounds.selector, 3, 3));
        this.readAsUint8(d, 3);
    }

    /// The three forms agree.
    function test_allThreeFormsAgree() public {
        bytes memory byKey = decrypt(_handles(), address(vault), aliceKey).abiEncoded();
        bytes memory byName = decrypt(_handles(), address(vault), "alice").abiEncoded();

        TransportKeypair memory kp = generateTransportKeypair();
        address[] memory contracts = new address[](1);
        contracts[0] = address(vault);
        SignedDecryptionPermit memory permit =
            signLegacyDecryptionPermit(aliceKey, kp, contracts, block.timestamp, 7 days);
        bytes memory byPermit = decrypt(_handles(), address(vault), kp, permit).abiEncoded();

        assertEq(byName, byKey);
        assertEq(byPermit, byKey);
    }

    /// One permit, one request — and the same values the single-value reads give.
    function test_aBatchAgreesWithSingleValueReads() public {
        Plaintexts memory d = decrypt(_handles(), address(vault), aliceKey);

        assertEq(d.uint8At(0), decrypt(vault.eUint8(), address(vault), aliceKey));
        assertEq(d.uint32At(1), decrypt(vault.eUint32(), address(vault), aliceKey));
        assertEq(d.addressAt(2), decrypt(vault.eAddress(), address(vault), aliceKey));
    }

    /// An empty batch is a mistake, not an empty answer.
    function test_anEmptyBatchReverts() public {
        vm.expectRevert("StdFhevm: no encrypted value to decrypt");
        this.decryptBytes("", aliceKey);
    }

    /// A payload that is not a whole number of handles is refused.
    function test_aRaggedBatchReverts() public {
        vm.expectRevert("StdFhevm: abiEncryptedValues is not a whole number of 32-byte handles");
        this.decryptBytes(hex"0102030405", aliceKey);
    }

    // -- External so that `vm.expectRevert` has a call frame to catch ----------

    function readAsUint8(Plaintexts memory d, uint256 index) external pure returns (uint8) {
        return d.uint8At(index);
    }

    function decryptBytes(bytes memory values, uint256 key) external returns (Plaintexts memory) {
        return decrypt(values, address(vault), key);
    }
}
