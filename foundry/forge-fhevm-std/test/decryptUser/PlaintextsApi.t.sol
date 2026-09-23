// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint8, euint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm, EncryptedInput, Plaintexts} from "../../pkg/src/TestFhevm.sol";
import {FheType} from "../../pkg/src/_host/shared/FheType.sol";
import {LibPlaintexts} from "../../pkg/src/LibPlaintexts.sol";

import {UserVault} from "./UserVault.sol";

/// READING THE RESULT: everything `Plaintexts` offers, the counterpart of
/// `test/encrypt/EncryptedInputApi.t.sol` for the decrypt side.
contract PlaintextsApiTest is TestFhevm {
    UserVault internal vault;
    address internal alice;
    uint256 internal aliceKey;

    function setUp() public override {
        super.setUp();
        vault = new UserVault();
        (alice, aliceKey) = makeAddrAndKey("alice");

        EncryptedInput memory e =
            encryptValues(tvBool(true), tvUint8(255), tvUint16(65_535), tvUint32(70_000), address(vault), alice);
        vm.startPrank(alice);
        vault.setEBool(e.externalEboolAt(0), e.inputProof(), alice);
        vault.setEUint8(e.externalEuint8At(1), e.inputProof(), alice);
        vault.setEUint16(e.externalEuint16At(2), e.inputProof(), alice);
        vault.setEUint32(e.externalEuint32At(3), e.inputProof(), alice);
        vm.stopPrank();

        EncryptedInput memory w = encryptValues(
            tvUint64(1 << 40), tvUint128(1e30), tvUint256(type(uint256).max), tvAddress(alice), address(vault), alice
        );
        vm.startPrank(alice);
        vault.setEUint64(w.externalEuint64At(0), w.inputProof(), alice);
        vault.setEUint128(w.externalEuint128At(1), w.inputProof(), alice);
        vault.setEUint256(w.externalEuint256At(2), w.inputProof(), alice);
        vault.setEAddress(w.externalEaddressAt(3), w.inputProof(), alice);
        vm.stopPrank();
    }

    /// Every encrypted type, in one batch, through its own checked accessor.
    function _all() private returns (Plaintexts memory) {
        bytes memory handles = abi.encode(
            vault.eBool(),
            vault.eUint8(),
            vault.eUint16(),
            vault.eUint32(),
            vault.eUint64(),
            vault.eUint128(),
            vault.eUint256(),
            vault.eAddress()
        );
        return decrypt(handles, address(vault), aliceKey);
    }

    function test_everyTypedAccessorReads() public {
        Plaintexts memory d = _all();

        assertTrue(d.boolAt(0));
        assertEq(d.uint8At(1), 255);
        assertEq(d.uint16At(2), 65_535);
        assertEq(d.uint32At(3), 70_000);
        assertEq(d.uint64At(4), 1 << 40);
        assertEq(d.uint128At(5), 1e30);
        assertEq(d.uint256At(6), type(uint256).max);
        assertEq(d.addressAt(7), alice);
    }

    function test_lengthCountsTheValues() public {
        assertEq(_all().length(), 8);
    }

    /// The handle knows its own type — nothing has to be remembered by the caller.
    function test_typeNameAtReadsTheTypeOffTheHandle() public {
        Plaintexts memory d = _all();

        assertEq(d.typeNameAt(0), "ebool");
        assertEq(d.typeNameAt(1), "euint8");
        assertEq(d.typeNameAt(2), "euint16");
        assertEq(d.typeNameAt(3), "euint32");
        assertEq(d.typeNameAt(4), "euint64");
        assertEq(d.typeNameAt(5), "euint128");
        assertEq(d.typeNameAt(6), "euint256");
        assertEq(d.typeNameAt(7), "eaddress");
    }

    /// The ABI blob, for callers who prefer the tuple form. The types are restated here, NOT verified —
    /// which is exactly what the typed accessors above exist to avoid.
    function test_abiEncodedDecodesAsATuple() public {
        Plaintexts memory d = _all();

        (bool a, uint8 b, uint16 c, uint32 e) = abi.decode(d.abiEncoded(), (bool, uint8, uint16, uint32));
        assertTrue(a);
        assertEq(b, 255);
        assertEq(c, 65_535);
        assertEq(e, 70_000);
    }

    /// Asking for the wrong width is caught here, not silently truncated.
    function test_theWrongAccessorReverts() public {
        Plaintexts memory d = _all();

        vm.expectRevert(
            abi.encodeWithSelector(LibPlaintexts.TypeMismatch.selector, 3, uint8(FheType.Uint8), uint8(FheType.Uint32))
        );
        this.readAsUint8(d, 3);
    }

    function test_readingPastTheEndReverts() public {
        Plaintexts memory d = _all();

        vm.expectRevert(abi.encodeWithSelector(LibPlaintexts.IndexOutOfBounds.selector, 8, 8));
        this.readAsUint8(d, 8);
    }

    function test_typeNameAtAlsoBoundsChecks() public {
        Plaintexts memory d = _all();

        vm.expectRevert(abi.encodeWithSelector(LibPlaintexts.IndexOutOfBounds.selector, 9, 8));
        this.readTypeName(d, 9);
    }

    /// One plaintext per handle is the invariant every accessor rests on, and the struct is
    /// constructible by hand — so a mismatched pair is refused rather than read off the end.
    function test_aMismatchedStructIsRefused() public {
        Plaintexts memory d;
        d._h = new bytes32[](2);
        d._p = new uint256[](1);

        vm.expectRevert(abi.encodeWithSelector(LibPlaintexts.LengthMismatch.selector, 2, 1));
        this.readAsUint8(d, 0);
    }

    // -- By value, rather than by index ---------------------------------------

    /// The same eight values, found by the value instead of the slot.
    function test_everyTypedAccessorReadsByHandle() public {
        Plaintexts memory d = _all();

        assertTrue(d.plaintext(vault.eBool()));
        assertEq(d.plaintext(vault.eUint8()), 255);
        assertEq(d.plaintext(vault.eUint16()), 65_535);
        assertEq(d.plaintext(vault.eUint32()), 70_000);
        assertEq(d.plaintext(vault.eUint64()), 1 << 40);
        assertEq(d.plaintext(vault.eUint128()), 1e30);
        assertEq(d.plaintext(vault.eUint256()), type(uint256).max);
        assertEq(d.plaintext(vault.eAddress()), alice);
    }

    /// By value and by index give the same answer — the lookup only finds the slot.
    function test_byHandleAgreesWithByIndex() public {
        Plaintexts memory d = _all();

        assertEq(d.plaintext(vault.eUint32()), d.uint32At(3));
        assertEq(d.plaintext(vault.eAddress()), d.addressAt(7));
    }

    /// A value whose handle this batch never decrypted is refused, rather than answering with slot zero.
    function test_anUnknownHandleReverts() public {
        Plaintexts memory d = _all();
        euint32 stranger = euint32.wrap(bytes32(uint256(0xDEAD)));

        vm.expectRevert(abi.encodeWithSelector(LibPlaintexts.HandleNotFound.selector, bytes32(uint256(0xDEAD))));
        this.readByHandle(d, stranger);
    }

    /// The value's own type picks the overload, so the type check is belt and braces — it still
    /// catches a value wrapped by hand from a raw `bytes32`.
    function test_aHandWrappedHandleOfTheWrongTypeReverts() public {
        Plaintexts memory d = _all();
        euint8 lying = euint8.wrap(euint32.unwrap(vault.eUint32()));

        vm.expectRevert(
            abi.encodeWithSelector(LibPlaintexts.TypeMismatch.selector, 3, uint8(FheType.Uint8), uint8(FheType.Uint32))
        );
        this.readAsUint8ByHandle(d, lying);
    }

    // -- External so that `vm.expectRevert` has a call frame to catch ------------------

    function readByHandle(Plaintexts memory d, euint32 value) external pure returns (uint32) {
        return d.plaintext(value);
    }

    function readAsUint8ByHandle(Plaintexts memory d, euint8 value) external pure returns (uint8) {
        return d.plaintext(value);
    }

    function readAsUint8(Plaintexts memory d, uint256 index) external pure returns (uint8) {
        return d.uint8At(index);
    }

    function readTypeName(Plaintexts memory d, uint256 index) external pure returns (string memory) {
        return d.typeNameAt(index);
    }
}
