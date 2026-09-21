// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {StdFhevm, EncryptedInput, TypedValue} from "../../pkg/src/StdFhevm.sol";
import {FheType} from "../../pkg/src/_host/shared/FheType.sol";
import {LibFhevmHandle} from "../../pkg/src/_host/shared/LibFhevmHandle.sol";

/// Field extraction from the handle layout `LibFhevmHandle` owns.
contract LibFhevmHandleTest is Test, StdFhevm {
    function setUp() public {}

    /// The chain id a real handle carries is the one it was minted on.
    function test_chainIdOfReadsBackTheMintingChain() public {
        EncryptedInput memory e = encryptValues(tvUint32(7), address(this), makeAddr("alice"));
        assertEq(LibFhevmHandle.chainIdOf(e._h[0]), uint64(block.chainid));
    }

    /// The core claim: the handle at slot `i` of a batch carries `i`.
    function test_indexOfMatchesThePositionInTheBatch() public {
        TypedValue[] memory batch = new TypedValue[](6);
        for (uint32 i = 0; i < 6; i++) {
            batch[i] = tvUint32(i + 1);
        }
        EncryptedInput memory e = encryptValues(batch, address(this), makeAddr("alice"));

        for (uint8 i = 0; i < 6; i++) {
            assertEq(LibFhevmHandle.indexOf(e._h[i]), i);
        }
    }

    /// A single value is index 0, not an absent field.
    function test_indexOfIsZeroForALoneValue() public {
        EncryptedInput memory e = encryptValues(tvUint32(7), address(this), makeAddr("alice"));
        assertEq(LibFhevmHandle.indexOf(e._h[0]), 0);
    }

    /// The fields are read from disjoint slices: chainId occupies bytes 22..29 and nothing else.
    function test_chainIdOfIsIsolatedFromTheNeighbouringFields() public pure {
        // hash21 = 0xaa.., index = 0xbb, chainId = 0x00000000deadbeef, typeId = Uint32 (4), version = 0xcc
        bytes32 handle = bytes32(
            (uint256(0xaa) << 248) | (uint256(0xbb) << 80) | (uint256(0xdeadbeef) << 16) | (uint256(4) << 8)
                | uint256(0xcc)
        );

        assertEq(LibFhevmHandle.chainIdOf(handle), uint64(0xdeadbeef));
        assertEq(LibFhevmHandle.indexOf(handle), 0xbb);
        assertEq(uint8(LibFhevmHandle.typeOf(handle)), uint8(FheType.Uint32));
    }

    /// The field is 8 bytes, so the top of a full-width value survives and nothing above it bleeds in.
    function test_chainIdOfKeepsTheFullEightByteWidth() public pure {
        bytes32 handle = bytes32((uint256(0xbb) << 80) | (uint256(type(uint64).max) << 16));
        assertEq(LibFhevmHandle.chainIdOf(handle), type(uint64).max);
    }
}
