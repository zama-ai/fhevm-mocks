// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {StdFhevm, EncryptedInput} from "../../pkg/src/StdFhevm.sol";
import {Plaintexts} from "../../pkg/src/LibPlaintexts.sol";
import {Vault} from "./Vault.sol";

/// SEVERAL values under ONE proof, written inline. `asUintN(...)` fixes the width at compile time,
/// and the typed accessors on the result check it again against the handle before the dApp sees it.
contract EncryptTypedValuesTest is Test, StdFhevm {
    Vault internal vault;
    address internal alice;

    function setUp() public {
        vault = new Vault();
        alice = makeAddr("alice");
    }

    /// Two widths, one proof.
    function test_twoValues() public {
        EncryptedInput memory e = encryptValues(tvUint32(7), tvUint64(1234567890123), address(vault), alice);

        vm.startPrank(alice);
        vault.setEUint32(e.externalEuint32At(0), e.inputProof());
        vault.setEUint64(e.externalEuint64At(1), e.inputProof());
        vm.stopPrank();

        assertEq(decryptPublic(vault.eUint32()), 7);
        assertEq(decryptPublic(vault.eUint64()), 1234567890123);
    }

    /// Mixed kinds: a bool, an address and a wide integer travel together.
    function test_threeValuesOfMixedKinds() public {
        EncryptedInput memory e = encryptValues(tvBool(true), tvAddress(alice), tvUint128(1e30), address(vault), alice);

        vm.startPrank(alice);
        vault.setEBool(e.externalEboolAt(0), e.inputProof());
        vault.setEAddress(e.externalEaddressAt(1), e.inputProof());
        vault.setEUint128(e.externalEuint128At(2), e.inputProof());
        vm.stopPrank();

        Plaintexts memory clear = decryptPublic(abi.encode(vault.eBool(), vault.eAddress(), vault.eUint128()));
        assertTrue(clear.boolAt(0));
        assertEq(clear.addressAt(1), alice);
        assertEq(clear.uint128At(2), 1e30);
    }

    /// Five is the largest inline form — the same arity ceiling `console.log` lives with, for the
    /// same reason: Solidity has no variadics. Past five, see `EncryptValuesArray.t.sol`.
    function test_fiveValuesIsTheInlineCeiling() public {
        EncryptedInput memory e = encryptValues(
            tvBool(false), tvUint8(255), tvUint32(70_000), tvUint64(1 << 40), tvAddress(alice), address(vault), alice
        );

        assertEq(e.length(), 5);
        assertEq(e.typeNameAt(0), "ebool");
        assertEq(e.typeNameAt(1), "euint8");
        assertEq(e.typeNameAt(2), "euint32");
        assertEq(e.typeNameAt(3), "euint64");
        assertEq(e.typeNameAt(4), "eaddress");
    }

    /// The width comes from the CONSTRUCTOR's parameter type, not from the value: `tvUint32(7)` and
    /// `tvUint64(7)` are the same 7 but different handles. `tvUint8(300)` would not compile at all.
    function test_theWidthComesFromTheConstructorNotTheValue() public {
        EncryptedInput memory e = encryptValues(tvUint32(7), tvUint64(7), address(vault), alice);

        assertEq(e.typeNameAt(0), "euint32");
        assertEq(e.typeNameAt(1), "euint64");
    }
}
