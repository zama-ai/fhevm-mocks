// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {externalEuint32, externalEuint64} from "encrypted-types/EncryptedTypes.sol";

import {StdFhevm, EncryptedInput} from "../../pkg/src/StdFhevm.sol";
import {FheType} from "../../pkg/src/_host/shared/FheType.sol";
import {LibEncryptedInput} from "../../pkg/src/LibEncryptedInput.sol";
import {Vault} from "./Vault.sol";

/// READING THE RESULT: everything `EncryptedInput` offers, with no dApp in the picture.
contract EncryptedInputApiTest is Test, StdFhevm {
    EncryptedInput internal e;
    address internal alice;

    function setUp() public {
        alice = makeAddr("alice");
        e = encryptValues(tvUint32(7), tvUint64(1234567890123), address(new Vault()), alice);
    }

    /// One handle per cleartext, plus the single proof binding them all.
    function test_lengthCountsTheValuesNotTheProof() public view {
        assertEq(e.length(), 2);
        assertGt(e.inputProof().length, 0);
    }

    /// The handle knows its own type — nothing has to be remembered by the caller.
    function test_typeNameAtReadsTheTypeOffTheHandle() public view {
        assertEq(e.typeNameAt(0), "euint32");
        assertEq(e.typeNameAt(1), "euint64");
    }

    /// The ABI blob, for callers who prefer the tuple form. The types are restated here, NOT verified —
    /// which is exactly what the typed accessors above exist to avoid.
    function test_abiEncodedDecodesAsATuple() public view {
        (externalEuint32 a, externalEuint64 b) = abi.decode(e.abiEncoded(), (externalEuint32, externalEuint64));

        assertEq(externalEuint32.unwrap(a), externalEuint32.unwrap(e.externalEuint32At(0)));
        assertEq(externalEuint64.unwrap(b), externalEuint64.unwrap(e.externalEuint64At(1)));
    }

    /// Asking for the wrong width is caught here, not inside the coprocessor.
    function test_theWrongAccessorReverts() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                LibEncryptedInput.TypeMismatch.selector, 0, uint8(FheType.Uint64), uint8(FheType.Uint32)
            )
        );
        this.readAsUint64(e, 0);
    }

    function test_readingPastTheEndReverts() public {
        vm.expectRevert(abi.encodeWithSelector(LibEncryptedInput.IndexOutOfBounds.selector, 2, 2));
        this.readAsUint32(e, 2);
    }

    function test_typeNameAtAlsoBoundsChecks() public {
        vm.expectRevert(abi.encodeWithSelector(LibEncryptedInput.IndexOutOfBounds.selector, 9, 2));
        this.readTypeName(e, 9);
    }

    /// A handle carries the slot it was minted at, so an `EncryptedInput` stitched together from
    /// two different batches is caught rather than silently mismatching the proof.
    function test_aHandleFromAnotherBatchIsRejected() public {
        EncryptedInput memory other = encryptValues(tvUint32(1), tvUint32(2), address(new Vault()), alice);

        EncryptedInput memory stitched;
        stitched._h = new bytes32[](2);
        stitched._h[0] = other._h[1]; // minted at slot 1, placed at slot 0
        stitched._h[1] = other._h[0];
        stitched._ip = other._ip;
        stitched._cid = other._cid;
        stitched._ver = other._ver;

        vm.expectRevert(abi.encodeWithSelector(LibEncryptedInput.IndexMismatch.selector, 0, 1));
        this.readAsUint32(stitched, 0);
    }

    /// The batch records the chain it was minted on; a handle from elsewhere is rejected.
    function test_aHandleFromAnotherChainIsRejected() public {
        EncryptedInput memory forged = e;
        forged._cid = block.chainid + 1;

        vm.expectRevert(
            abi.encodeWithSelector(
                LibEncryptedInput.ChainIdMismatch.selector, 0, block.chainid + 1, uint64(block.chainid)
            )
        );
        this.readAsUint32(forged, 0);
    }

    /// Same for the handle format: an unknown version fails here rather than deep in the coprocessor.
    function test_aHandleOfAnotherVersionIsRejected() public {
        EncryptedInput memory forged = e;
        forged._ver = 1;

        vm.expectRevert(abi.encodeWithSelector(LibEncryptedInput.VersionMismatch.selector, 0, 1, 0));
        this.readAsUint32(forged, 0);
    }

    /// What `encryptValues` records: the chain it ran on, and the format it minted.
    function test_theBatchRecordsItsChainAndVersion() public view {
        assertEq(e.chainId(), block.chainid);
        assertEq(e.version(), 0);
    }

    // -- External so that `vm.expectRevert` has a call frame to catch ------------------

    function readAsUint32(EncryptedInput memory input, uint256 i) external pure returns (externalEuint32) {
        return input.externalEuint32At(i);
    }

    function readAsUint64(EncryptedInput memory input, uint256 i) external pure returns (externalEuint64) {
        return input.externalEuint64At(i);
    }

    function readTypeName(EncryptedInput memory input, uint256 i) external pure returns (string memory) {
        return input.typeNameAt(i);
    }
}
