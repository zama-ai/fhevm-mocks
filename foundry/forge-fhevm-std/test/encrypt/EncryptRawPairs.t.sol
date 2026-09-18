// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {StdFhevm, EncryptedInput} from "../../pkg/src/StdFhevm.sol";
import {FheType} from "../../pkg/src/_internal/FheType.sol";
import {Vault} from "./Vault.sol";

/// THE RAW FORM: `abi.encode(typeId, value, typeId, value, ...)`. It is the escape hatch for a caller
/// that already has type ids in hand — prefer the `asUintN` overloads, which get the width checked by
/// the compiler instead of restated by the caller.
contract EncryptRawPairsTest is Test, StdFhevm {
    Vault internal vault;
    address internal alice;

    function setUp() public {
        setUpFhevm();
        vault = new Vault();
        alice = makeAddr("alice");
    }

    function test_rawPairsRoundTrip() public {
        EncryptedInput memory e = encryptValues(
            abi.encode(uint8(FheType.Uint32), uint256(7), uint8(FheType.Uint64), uint256(1234567890123)),
            address(vault),
            alice
        );

        vm.startPrank(alice);
        vault.setEUint32(e.externalEuint32At(0), e.inputProof);
        vault.setEUint64(e.externalEuint64At(1), e.inputProof);
        vm.stopPrank();

        assertEq(decryptPublic(vault.eUint32()), 7);
        assertEq(decryptPublic(vault.eUint64()), 1234567890123);
    }

    /// The raw form and the typed form describe the same thing — `asUint32(7)` IS `(Uint32, 7)`.
    function test_rawPairsDescribeTheSameHandlesAsTheTypedForm() public {
        EncryptedInput memory raw = encryptValues(
            abi.encode(uint8(FheType.Uint32), uint256(7), uint8(FheType.Uint64), uint256(9)), address(vault), alice
        );
        EncryptedInput memory typed = encryptValues(asUint32(7), asUint64(9), address(vault), alice);

        assertEq(raw.length(), typed.length());
        assertEq(raw.typeNameAt(0), typed.typeNameAt(0));
        assertEq(raw.typeNameAt(1), typed.typeNameAt(1));
    }
}
