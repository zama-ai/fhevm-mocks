// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {StdFhevm, EncryptedInput, TypedValue} from "../../pkg/src/StdFhevm.sol";
import {Vault} from "./Vault.sol";

/// PAST FIVE, or built in a loop: `TypedValue[]` is the primitive every inline overload delegates to.
contract EncryptValuesArrayTest is Test, StdFhevm {
    Vault internal vault;
    address internal alice;

    function setUp() public {
        setUpFhevm();
        vault = new Vault();
        alice = makeAddr("alice");
    }

    /// Six values — one more than the inline forms can express — still one proof.
    function test_sixValuesInOneProof() public {
        TypedValue[] memory batch = new TypedValue[](6);
        batch[0] = asUint8(255);
        batch[1] = asUint16(65_535);
        batch[2] = asUint32(70_000);
        batch[3] = asUint64(1 << 40);
        batch[4] = asUint128(1e30);
        batch[5] = asUint256(type(uint256).max);

        EncryptedInput memory e = encryptValues(batch, address(vault), alice);
        assertEq(e.length(), 6);

        vm.startPrank(alice);
        vault.setEUint8(e.externalEuint8At(0), e.inputProof);
        vault.setEUint256(e.externalEuint256At(5), e.inputProof);
        vm.stopPrank();

        assertEq(decryptPublic(abi.encode(vault.eUint8())), abi.encode(uint8(255)));
        assertEq(decryptPublic(abi.encode(vault.eUint256())), abi.encode(type(uint256).max));
    }

    /// Built in a loop, which is the case the inline overloads cannot cover at all.
    function test_batchBuiltInALoop() public {
        TypedValue[] memory batch = new TypedValue[](4);
        for (uint32 i = 0; i < 4; i++) {
            batch[i] = asUint32(i + 1);
        }

        EncryptedInput memory e = encryptValues(batch, address(vault), alice);

        assertEq(e.length(), 4);
        for (uint256 i = 0; i < 4; i++) {
            assertEq(e.typeNameAt(i), "euint32");
        }
    }

    /// An array of one is legal — it is the same primitive, not a special case.
    function test_arrayOfOne() public {
        TypedValue[] memory batch = new TypedValue[](1);
        batch[0] = asUint32(7);

        EncryptedInput memory e = encryptValues(batch, address(vault), alice);

        vm.prank(alice);
        vault.setEUint32(e.externalEuint32At(0), e.inputProof);
        assertEq(decryptPublic(vault.eUint32()), 7);
    }

    /// An empty batch is a mistake, not an empty proof.
    function test_emptyBatchReverts() public {
        TypedValue[] memory batch = new TypedValue[](0);

        vm.expectRevert("StdFhevm: no value to encrypt");
        this.encryptBatch(batch, address(vault), alice);
    }

    /// External so that `vm.expectRevert` has a call frame to catch.
    function encryptBatch(TypedValue[] memory batch, address contractAddress, address userAddress)
        external
        returns (EncryptedInput memory)
    {
        return encryptValues(batch, contractAddress, userAddress);
    }
}
