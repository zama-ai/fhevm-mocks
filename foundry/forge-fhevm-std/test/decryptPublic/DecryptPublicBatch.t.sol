// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE} from "@fhevm/solidity/lib/FHE.sol";
import {euint32, euint64, externalEuint32, externalEuint64} from "encrypted-types/EncryptedTypes.sol";

import {StdFhevm, EncryptedInput, TypedValue} from "../../pkg/src/StdFhevm.sol";
import {Plaintexts} from "../../pkg/src/LibPlaintexts.sol";
import {LibEncryptedInput} from "../../pkg/src/LibEncryptedInput.sol";
import {FheType} from "../../pkg/src/_host/shared/FheType.sol";

/// Holds two publicly decryptable handles of DIFFERENT widths, so the batch has to keep their order.
contract TwoValuesDapp is ZamaEthereumConfig {
    euint32 private _small;
    euint64 private _big;

    // Two inputs, two proofs: each proof is bound to its own handle, so they arrive separately.
    function storeSmall(externalEuint32 a, bytes calldata inputProof) external {
        _small = FHE.fromExternal(a, inputProof);
        FHE.allowThis(_small);
        FHE.makePubliclyDecryptable(_small);
    }

    function storeBig(externalEuint64 b, bytes calldata inputProof) external {
        _big = FHE.fromExternal(b, inputProof);
        FHE.allowThis(_big);
        FHE.makePubliclyDecryptable(_big);
    }

    function small() external view returns (euint32) {
        return _small;
    }

    function big() external view returns (euint64) {
        return _big;
    }
}

contract DecryptPublicBatchTest is Test, StdFhevm {
    TwoValuesDapp internal dapp;
    address internal alice;

    function setUp() public {
        dapp = new TwoValuesDapp();
        alice = makeAddr("alice");
    }

    /// The other half: ONE proof for both values, and the handles come back in the order given.
    function test_batchEncryptRoundTripsThroughBatchDecrypt() public {
        EncryptedInput memory e = encryptValues(
            abi.encode(uint8(FheType.Uint32), uint256(7), uint8(FheType.Uint64), uint256(1234567890123)),
            address(dapp),
            alice
        );

        // The ABI blob splits back out exactly as `abi.encode(eA, eB)` would have been written by hand.
        (externalEuint32 a, externalEuint64 b) = abi.decode(e.abiEncoded(), (externalEuint32, externalEuint64));

        vm.prank(alice);
        dapp.storeSmall(a, e.inputProof());
        vm.prank(alice);
        dapp.storeBig(b, e.inputProof());

        Plaintexts memory clear = decryptPublic(abi.encode(dapp.small(), dapp.big()));
        (uint32 clearSmall, uint64 clearBig) = (clear.uint32At(0), clear.uint64At(1));
        assertEq(clearSmall, 7);
        assertEq(clearBig, 1234567890123);
    }

    /// The typed constructors: same round trip, but the compiler fixes each width — no `abi.encode`,
    /// no type ids, and `tvUint32(70000)` would not compile. The typed accessors then hand the
    /// handles straight to the dApp, checked against the type each handle carries.
    function test_typedConstructorsRoundTrip() public {
        EncryptedInput memory e = encryptValues(tvUint32(7), tvUint64(1234567890123), address(dapp), alice);
        assertEq(e.length(), 2);
        assertEq(e.typeNameAt(0), "euint32");
        assertEq(e.typeNameAt(1), "euint64");

        vm.prank(alice);
        dapp.storeSmall(e.externalEuint32At(0), e.inputProof());
        vm.prank(alice);
        dapp.storeBig(e.externalEuint64At(1), e.inputProof());

        Plaintexts memory clear = decryptPublic(abi.encode(dapp.small(), dapp.big()));
        (uint32 clearSmall, uint64 clearBig) = (clear.uint32At(0), clear.uint64At(1));
        assertEq(clearSmall, 7);
        assertEq(clearBig, 1234567890123);
    }

    /// Past the fixed-arity overloads: the `TypedValue[]` primitive, built in a loop.
    function test_typedValueArrayRoundTrip() public {
        TypedValue[] memory batch = new TypedValue[](2);
        batch[0] = tvUint32(7);
        batch[1] = tvUint64(1234567890123);
        EncryptedInput memory e = encryptValues(batch, address(dapp), alice);

        vm.prank(alice);
        dapp.storeSmall(e.externalEuint32At(0), e.inputProof());
        vm.prank(alice);
        dapp.storeBig(e.externalEuint64At(1), e.inputProof());

        Plaintexts memory clear = decryptPublic(abi.encode(dapp.small(), dapp.big()));
        (uint32 clearSmall, uint64 clearBig) = (clear.uint32At(0), clear.uint64At(1));
        assertEq(clearSmall, 7);
        assertEq(clearBig, 1234567890123);
    }

    /// Reading slot 0 (a Uint32) as `externalEuint64` reverts at the accessor, not inside the
    /// coprocessor mock.
    function test_typedAccessorRevertsOnWidthMismatch() public {
        EncryptedInput memory e = encryptValues(tvUint32(7), tvUint64(1234567890123), address(dapp), alice);

        vm.expectRevert(
            abi.encodeWithSelector(
                LibEncryptedInput.TypeMismatch.selector, 0, uint8(FheType.Uint64), uint8(FheType.Uint32)
            )
        );
        this.readAsUint64(e, 0);

        vm.expectRevert(abi.encodeWithSelector(LibEncryptedInput.IndexOutOfBounds.selector, 2, 2));
        this.readAsUint64(e, 2);
    }

    /// External so that `vm.expectRevert` has a call frame to catch.
    function readAsUint64(EncryptedInput memory e, uint256 i) external pure returns (externalEuint64) {
        return e.externalEuint64At(i);
    }

    function test_batchDecryptsEveryHandleInOrder() public {
        (externalEuint32 a, bytes memory proofA) = encryptUint32(7, address(dapp), alice);
        (externalEuint64 b, bytes memory proofB) = encryptUint64(1234567890123, address(dapp), alice);
        vm.prank(alice);
        dapp.storeSmall(a, proofA);
        vm.prank(alice);
        dapp.storeBig(b, proofB);

        Plaintexts memory clear = decryptPublic(abi.encode(dapp.small(), dapp.big()));
        (uint32 clearSmall, uint64 clearBig) = (clear.uint32At(0), clear.uint64At(1));

        assertEq(clearSmall, 7);
        assertEq(clearBig, 1234567890123);
    }

    /// Positional and array forms, as for a user decryption: the handles as held, answered in order.
    function test_positionalAndArrayForms() public {
        EncryptedInput memory e = encryptValues(tvUint32(7), tvUint64(1234567890123), address(dapp), alice);
        vm.prank(alice);
        dapp.storeSmall(e.externalEuint32At(0), e.inputProof());
        vm.prank(alice);
        dapp.storeBig(e.externalEuint64At(1), e.inputProof());
        (bytes32 hs, bytes32 hb) = (euint32.unwrap(dapp.small()), euint64.unwrap(dapp.big()));

        Plaintexts memory two = decryptPublic(hb, hs);
        assertEq(two.uint64At(0), 1234567890123, "a first");
        assertEq(two.uint32At(1), 7, "b second");

        (Plaintexts memory five, bytes memory proof) = decryptPublicWithSignatures(hs, hb, hs, hb, hs);
        assertEq(five.length(), 5);
        assertEq(five.uint64At(3), 1234567890123, "d");
        assertGt(proof.length, 0);

        bytes32[] memory arr = new bytes32[](2);
        (arr[0], arr[1]) = (hs, hb);
        assertEq(decryptPublic(arr).plaintext(dapp.big()), 1234567890123, "array, by value");
    }
}
