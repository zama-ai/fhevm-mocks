// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {StdFhevm, EncryptedInput} from "../../pkg/src/StdFhevm.sol";
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
        EncryptedInput memory e = encryptValues(asUint32(7), asUint64(1234567890123), address(vault), alice);

        vm.startPrank(alice);
        vault.setEUint32(e.externalEuint32At(0), e.inputProof());
        vault.setEUint64(e.externalEuint64At(1), e.inputProof());
        vm.stopPrank();

        assertEq(decryptPublic(vault.eUint32()), 7);
        assertEq(decryptPublic(vault.eUint64()), 1234567890123);
    }

    /// Mixed kinds: a bool, an address and a wide integer travel together.
    function test_threeValuesOfMixedKinds() public {
        EncryptedInput memory e = encryptValues(asBool(true), asAddress(alice), asUint128(1e30), address(vault), alice);

        vm.startPrank(alice);
        vault.setEBool(e.externalEboolAt(0), e.inputProof());
        vault.setEAddress(e.externalEaddressAt(1), e.inputProof());
        vault.setEUint128(e.externalEuint128At(2), e.inputProof());
        vm.stopPrank();

        (bool flag, address who, uint128 big) = abi.decode(
            decryptPublic(abi.encode(vault.eBool(), vault.eAddress(), vault.eUint128())), (bool, address, uint128)
        );
        assertTrue(flag);
        assertEq(who, alice);
        assertEq(big, 1e30);
    }

    /// Five is the largest inline form — the same arity ceiling `console.log` lives with, for the
    /// same reason: Solidity has no variadics. Past five, see `EncryptValuesArray.t.sol`.
    function test_fiveValuesIsTheInlineCeiling() public {
        EncryptedInput memory e = encryptValues(
            asBool(false), asUint8(255), asUint32(70_000), asUint64(1 << 40), asAddress(alice), address(vault), alice
        );

        assertEq(e.length(), 5);
        assertEq(e.typeNameAt(0), "ebool");
        assertEq(e.typeNameAt(1), "euint8");
        assertEq(e.typeNameAt(2), "euint32");
        assertEq(e.typeNameAt(3), "euint64");
        assertEq(e.typeNameAt(4), "eaddress");
    }

    /// The width comes from the CONSTRUCTOR's parameter type, not from the value: `asUint32(7)` and
    /// `asUint64(7)` are the same 7 but different handles. `asUint8(300)` would not compile at all.
    function test_theWidthComesFromTheConstructorNotTheValue() public {
        EncryptedInput memory e = encryptValues(asUint32(7), asUint64(7), address(vault), alice);

        assertEq(e.typeNameAt(0), "euint32");
        assertEq(e.typeNameAt(1), "euint64");
    }
}
